begin;

-- Remove unused anonymous privileges from private CRM/finance/operations tables.
revoke all on table
  public.activity_logs,
  public.admin_capabilities,
  public.admin_capability_grants,
  public.admin_profiles,
  public.business_settings,
  public.customers,
  public.equipment,
  public.job_equipment,
  public.job_staff,
  public.jobs,
  public.notifications,
  public.offer_items,
  public.org_departments,
  public.org_memberships,
  public.org_positions,
  public.org_regions,
  public.org_roles,
  public.payments,
  public.price_rules,
  public.settlements,
  public.staff,
  public.staff_profiles
from anon;

-- Public lookup tables are read-only for anonymous visitors.
revoke all on table public.services, public.event_types, public.app_versions from anon;
grant select on table public.services, public.event_types, public.app_versions to anon;

-- The public quote form may only insert. All other quote access stays protected.
revoke all on table public.teklifler from anon;
grant insert on table public.teklifler to anon;

-- Staff views use security_invoker=true and rely on base-table RLS;
-- they are not anonymous endpoints.
revoke all on table
  public.customers_staff,
  public.equipment_financial_staff,
  public.equipment_staff,
  public.my_jobs_staff,
  public.offers_financial_staff,
  public.offers_staff,
  public.payments_staff,
  public.pricing_staff
from anon;

-- Stop authenticated users from probing another user's capability assignments.
create or replace function public.admin_has_capability(
  p_capability_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when auth.uid() is null then false
    when p_user_id is distinct from auth.uid() and not public.is_org_owner() then false
    when public.is_org_owner() and p_user_id = auth.uid() then true
    else exists (
      select 1
      from public.admin_capability_grants g
      join public.org_memberships om on om.user_id = g.user_id and om.active = true
      join public.org_roles r on r.id = om.role_id and r.is_admin_role = true
      join public.admin_capabilities c on c.key = g.capability_key and c.active = true
      where g.user_id = p_user_id
        and g.enabled = true
        and g.capability_key = p_capability_key
    )
  end;
$function$;

-- Role hierarchy lookups return the caller's tier unless the caller is the Owner.
create or replace function public.org_role_tier_for(p_user_id uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce((
    select r.tier
    from public.org_memberships om
    join public.org_roles r on r.id = om.role_id
    where om.user_id = case
      when p_user_id is null or p_user_id = auth.uid() or public.is_org_owner()
        then coalesce(p_user_id, auth.uid())
      else auth.uid()
    end
      and om.active = true
    limit 1
  ), 99);
$function$;

revoke all on function public.admin_has_capability(text,uuid) from public, anon;
grant execute on function public.admin_has_capability(text,uuid) to authenticated;
revoke all on function public.org_role_tier_for(uuid) from public, anon;
grant execute on function public.org_role_tier_for(uuid) to authenticated;

-- Trusted offer RPC writes are explicitly marked and authorized below.
create or replace function public.enforce_public_quote_input()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if coalesce(current_setting('stagepulse.trusted_offer_write', true), 'off') = 'on' then
    return new;
  end if;

  if coalesce(auth.jwt()->>'role','') in ('anon','authenticated') then
    new.quote_number := null;
    new.customer_id := null;
    new.status := 'new';
    new.currency := 'TRY';
    new.estimated_cost := 0;
    new.estimated_price := 0;
    new.discount := 0;
    new.total := 0;
    new.margin := 0;
    new.internal_costs := '[]'::jsonb;
    new.public_code := null;
    new.public_token := null;
    new.valid_until := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.archived_at := null;
  end if;
  return new;
end;
$function$;

create or replace function public.enforce_public_quote_rate_limit()
returns trigger
language plpgsql
security definer
set search_path='public','private'
as $function$
declare
  client_key text;
begin
  if coalesce(current_setting('stagepulse.trusted_offer_write', true), 'off') = 'on' then
    return new;
  end if;

  if coalesce(auth.jwt()->>'role','') in ('anon','authenticated') then
    client_key := 'quote:' || coalesce(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      'unknown'
    );
    if not public.check_login_rate_limit(client_key, 8) then
      raise exception 'Çok fazla teklif talebi. Lütfen daha sonra tekrar deneyin.';
    end if;
    if length(coalesce(new.name,'')) < 2 or length(new.name) > 160 then
      raise exception 'Geçersiz ad';
    end if;
    if new.people is not null and (new.people < 1 or new.people > 100000) then
      raise exception 'Geçersiz kişi sayısı';
    end if;
    if length(coalesce(new.message,'')) > 5000 then
      raise exception 'Mesaj çok uzun';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.on_quote_insert_enrich()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  c_id uuid;
  svc public.services;
  margin_pct numeric := 35;
  min_quote numeric := 0;
  base numeric := 0;
  price numeric := 0;
  per_person numeric := 0;
begin
  if coalesce(current_setting('stagepulse.trusted_offer_write', true), 'off') = 'on' then
    return new;
  end if;

  select id into c_id from public.customers where phone = new.phone limit 1;
  if c_id is null then
    insert into public.customers(name,company,phone,email,last_contact_at)
    values(new.name,new.company,new.phone,new.email,pg_catalog.now())
    returning id into c_id;
  else
    update public.customers
      set name=coalesce(nullif(new.name,''),name),
          company=coalesce(nullif(new.company,''),company),
          email=coalesce(nullif(new.email,''),email),
          last_contact_at=pg_catalog.now(),
          updated_at=pg_catalog.now()
      where id=c_id;
  end if;
  new.customer_id := c_id;

  select * into svc from public.services where name = new.type and active = true limit 1;
  if found then base := coalesce(svc.base_price,0); end if;

  select value into margin_pct from public.price_rules
    where name = 'Varsayılan kâr marjı' and active = true limit 1;
  select value into min_quote from public.price_rules
    where name = 'Minimum teklif' and active = true limit 1;
  select value into per_person from public.price_rules
    where name = 'Kişi başı ek ücret' and active = true limit 1;
  if per_person is null then per_person := 0; end if;

  price := base + coalesce(new.people,0) * per_person;
  if price < coalesce(min_quote,0) then price := coalesce(min_quote,0); end if;
  if price = 0 and base > 0 then price := base; end if;

  new.estimated_price := round(price,2);
  if margin_pct is not null and margin_pct > 0 then
    new.estimated_cost := round(price/(1+(margin_pct/100)),2);
  else
    new.estimated_cost := coalesce(svc.base_cost,0);
  end if;
  new.total := new.estimated_price;
  new.margin := new.total - new.estimated_cost;
  return new;
end;
$function$;

-- The Admin UI calls this RPC. It was referenced in the client but absent in production.
create or replace function public.staff_create_offer(
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
  p_services jsonb default '[]'::jsonb,
  p_internal_costs jsonb default '[]'::jsonb
)
returns public.teklifler
language plpgsql
security definer
set search_path=''
as $function$
declare
  r public.teklifler;
  c_total numeric := 0;
  c_cost numeric := 0;
  safe_costs jsonb := '[]'::jsonb;
  final_total numeric := greatest(0,coalesce(p_total,0));
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode='28000';
  end if;
  if not (public.is_admin() or public.staff_has_perm('offers')) then
    raise exception 'Teklif oluşturma yetkiniz yok.' using errcode='42501';
  end if;
  if nullif(trim(p_name),'') is null then
    raise exception 'Müşteri adı zorunludur.';
  end if;
  if jsonb_typeof(coalesce(p_services,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_services,'[]'::jsonb)) = 0 then
    raise exception 'En az bir iş kalemi gerekli.';
  end if;
  if jsonb_typeof(coalesce(p_internal_costs,'[]'::jsonb)) <> 'array' then
    raise exception 'İç maliyet listesi geçersiz.';
  end if;
  if coalesce(p_total,0) < 0 or coalesce(p_total,0) > 999999999 then
    raise exception 'Teklif tutarı geçersiz.';
  end if;
  if p_people is not null and (p_people < 1 or p_people > 100000) then
    raise exception 'Kişi sayısı geçersiz.';
  end if;

  select coalesce(sum(
    coalesce(
      nullif(j->>'total','')::numeric,
      coalesce(nullif(j->>'quantity','')::numeric,1)
        * coalesce(nullif(j->>'unit_price','')::numeric,nullif(j->>'price','')::numeric,0)
    )
  ),0)
  into c_total
  from jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) as items(j);

  if public.is_admin() or public.staff_has_perm('financials') then
    safe_costs := coalesce(p_internal_costs,'[]'::jsonb);
    select coalesce(sum(
      coalesce(nullif(j->>'cost_total','')::numeric,
        coalesce(nullif(j->>'quantity','')::numeric,1)
          * coalesce(nullif(j->>'cost_unit','')::numeric,0)
      )
    ),0)
    into c_cost
    from jsonb_array_elements(safe_costs) as costs(j);
  else
    safe_costs := '[]'::jsonb;
    c_cost := 0;
  end if;

  perform pg_catalog.set_config('stagepulse.trusted_offer_write','on',true);
  insert into public.teklifler(
    name,company,phone,email,type,event_type,location,people,event_date,message,
    total,estimated_price,estimated_cost,margin,discount,services,internal_costs,status
  )
  values(
    nullif(trim(p_name),''),nullif(trim(p_company),''),nullif(trim(p_phone),''),
    nullif(trim(p_email),''),nullif(trim(p_type),''),nullif(trim(p_event_type),''),
    nullif(trim(p_location),''),p_people,p_event_date,nullif(trim(p_message),''),
    final_total,final_total,c_cost,final_total-c_cost,
    greatest(0,c_total-final_total),coalesce(p_services,'[]'::jsonb),safe_costs,'preparing'
  )
  returning * into r;

  perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true);
  return r;
exception when others then
  perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true);
  raise;
end;
$function$;

revoke all on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb,jsonb) from public, anon;
grant execute on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
