-- Allow only the permission-checked staff_create_offer RPC to preserve its quote totals.
-- Anonymous/public quote submissions continue to be normalized by the existing trigger.
create or replace function public.enforce_public_quote_input()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if pg_catalog.current_setting('stagepulse.trusted_offer_write', true) = 'on' then
    return new;
  end if;

  if auth.role() in ('anon','authenticated') then
    new.quote_number := null;
    new.customer_id := null;
    new.status := 'new';
    new.currency := 'TRY';
    new.estimated_cost := 0;
    new.estimated_price := 0;
    new.discount := 0;
    new.total := 0;
    new.margin := 0;
    new.public_token := null;
    new.valid_until := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.archived_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.on_quote_insert_enrich()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  c_id uuid;
  svc public.services;
  margin_pct numeric := 35;
  min_quote numeric := 0;
  base numeric := 0;
  price numeric := 0;
  per_person numeric := 0;
  services_subtotal numeric := 0;
begin
  select id into c_id from public.customers where phone = new.phone limit 1;
  if c_id is null then
    insert into public.customers(name,company,phone,email,last_contact_at)
    values(new.name,new.company,new.phone,new.email,now()) returning id into c_id;
  else
    update public.customers
      set name=coalesce(nullif(new.name,''),name),
          company=coalesce(nullif(new.company,''),company),
          email=coalesce(nullif(new.email,''),email),
          last_contact_at=now(),updated_at=now()
    where id=c_id;
  end if;
  new.customer_id := c_id;

  if pg_catalog.current_setting('stagepulse.trusted_offer_write', true) = 'on'
     and jsonb_typeof(coalesce(new.services,'[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(new.services,'[]'::jsonb)) > 0 then
    select coalesce(sum(
      coalesce(
        nullif(j->>'total','')::numeric,
        coalesce(nullif(j->>'quantity','')::numeric,1) *
        coalesce(nullif(j->>'unit_price','')::numeric,nullif(j->>'price','')::numeric,0)
      )
    ),0)
    into services_subtotal
    from jsonb_array_elements(new.services) as items(j);

    new.total := greatest(0,coalesce(new.total,0));
    new.discount := greatest(0,services_subtotal-new.total);
    new.estimated_price := new.total;

    select value into margin_pct from public.price_rules
      where name='Varsayılan kâr marjı' and active=true limit 1;
    if margin_pct is not null and margin_pct > 0 then
      new.estimated_cost := round(new.total/(1+(margin_pct/100)),2);
    else
      new.estimated_cost := coalesce(new.estimated_cost,0);
    end if;
    new.margin := new.total-new.estimated_cost;
    return new;
  end if;

  select * into svc from public.services where name=new.type and active=true limit 1;
  if found then base:=coalesce(svc.base_price,0); end if;
  select value into margin_pct from public.price_rules where name='Varsayılan kâr marjı' and active=true limit 1;
  select value into min_quote from public.price_rules where name='Minimum teklif' and active=true limit 1;
  select value into per_person from public.price_rules where name='Kişi başı ek ücret' and active=true limit 1;
  if per_person is null then per_person:=0; end if;
  price:=base+coalesce(new.people,0)*per_person;
  if price<coalesce(min_quote,0) then price:=coalesce(min_quote,0); end if;
  if price=0 and base>0 then price:=base; end if;
  new.estimated_price:=round(price,2);
  if margin_pct is not null and margin_pct>0 then
    new.estimated_cost:=round(price/(1+(margin_pct/100)),2);
  else
    new.estimated_cost:=coalesce(svc.base_cost,0);
  end if;
  new.total:=new.estimated_price;
  new.margin:=new.total-new.estimated_cost;
  return new;
end;
$$;

create or replace function private.staff_create_offer(
  p_name text,
  p_company text default null,
  p_phone text default null,
  p_email text default null,
  p_type text default null,
  p_event_type text default null,
  p_location text default null,
  p_people integer default null,
  p_event_date date default null,
  p_message text default null,
  p_total numeric default 0,
  p_services jsonb default '[]'::jsonb
)
returns public.teklifler
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.teklifler;
begin
  if not public.staff_can_any(array['offers.create','offers.manage']) then
    raise exception 'Teklif oluşturma yetkiniz yok';
  end if;
  if nullif(trim(p_name),'') is null then
    raise exception 'Müşteri adı zorunludur';
  end if;

  perform pg_catalog.set_config('stagepulse.trusted_offer_write','on',true);
  insert into public.teklifler(
    name,company,phone,email,type,event_type,location,people,event_date,message,
    total,estimated_price,services,status
  ) values (
    nullif(trim(p_name),''),
    nullif(trim(p_company),''),
    nullif(trim(p_phone),''),
    nullif(trim(p_email),''),
    nullif(trim(p_type),''),
    nullif(trim(p_event_type),''),
    nullif(trim(p_location),''),
    p_people,p_event_date,nullif(trim(p_message),''),
    greatest(coalesce(p_total,0),0),
    greatest(coalesce(p_total,0),0),
    coalesce(p_services,'[]'::jsonb),
    'preparing'
  ) returning * into r;
  perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true);
  return r;
exception when others then
  perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true);
  raise;
end;
$$;
