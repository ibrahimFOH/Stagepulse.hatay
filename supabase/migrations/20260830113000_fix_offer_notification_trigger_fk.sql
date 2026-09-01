-- Fix: notifications.offer_id was written from a BEFORE INSERT trigger.
-- The teklif row did not exist yet, so the FK rejected every new offer.
-- Keep enrichment/pricing in BEFORE INSERT; create the notification AFTER INSERT.

create or replace function public.on_quote_insert_enrich()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  c_id uuid;
  svc public.services;
  margin_pct numeric := 35;
  min_quote numeric := 0;
  base numeric := 0;
  price numeric := 0;
  crew numeric := 3;
  per_crew numeric := 0;
  setup_fee numeric := 0;
  teardown_fee numeric := 0;
  explicit_total boolean;
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
        last_contact_at=now(), updated_at=now()
    where id=c_id;
  end if;
  new.customer_id:=c_id;

  explicit_total:=coalesce(new.total,0)>0 or coalesce(new.estimated_price,0)>0;
  if not explicit_total then
    select * into svc from public.services where name=new.type and active=true limit 1;
    if found then
      base:=coalesce(svc.base_price,0);
      crew:=greatest(svc.crew_min,least(svc.default_crew,svc.crew_max));
      per_crew:=coalesce(svc.crew_unit_price,0);
      setup_fee:=coalesce(svc.setup_fee,0);
      teardown_fee:=coalesce(svc.teardown_fee,0);
      margin_pct:=coalesce(svc.margin_pct,35);
    else
      select value into crew from public.price_rules where name='Varsayılan ekip sayısı' and active=true limit 1;
      select value into per_crew from public.price_rules where name='Kişi başı ek ücret' and active=true limit 1;
      select value into setup_fee from public.price_rules where name='Kurulum' and active=true limit 1;
      select value into teardown_fee from public.price_rules where name='Söküm' and active=true limit 1;
      select value into margin_pct from public.price_rules where name='Varsayılan kâr marjı' and active=true limit 1;
    end if;
    select value into min_quote from public.price_rules where name='Minimum teklif' and active=true limit 1;
    price:=base+coalesce(setup_fee,0)+coalesce(teardown_fee,0)+(greatest(1,least(coalesce(crew,3),12))*coalesce(per_crew,0));
    if price>0 and price<coalesce(min_quote,0) then price:=min_quote; end if;
    new.estimated_price:=round(price,2);
    new.total:=new.estimated_price;
    if margin_pct>0 and price>0 then
      new.estimated_cost:=round(price/(1+(margin_pct/100)),2);
    else
      new.estimated_cost:=coalesce(svc.base_cost,0);
    end if;
    new.margin:=coalesce(new.total,0)-coalesce(new.estimated_cost,0);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quote_insert_enrich on public.teklifler;
create trigger trg_quote_insert_enrich
before insert on public.teklifler
for each row execute function public.on_quote_insert_enrich();

create or replace function public.notify_new_quote()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.notifications(kind,title,body,offer_id)
  values('new_quote','Yeni teklif talebi',coalesce(new.quote_number,'Yeni teklif')||' - '||coalesce(new.name,''),new.id);
  return new;
end;
$$;

drop trigger if exists trg_quote_new_notification on public.teklifler;
create trigger trg_quote_new_notification
after insert on public.teklifler
for each row execute function public.notify_new_quote();

notify pgrst, 'reload schema';
