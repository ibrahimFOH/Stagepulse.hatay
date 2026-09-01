-- Stagepulse configurable pricing + AI management center
begin;

alter table public.services
  add column if not exists crew_min integer not null default 1,
  add column if not exists crew_max integer not null default 12,
  add column if not exists default_crew integer not null default 3,
  add column if not exists crew_unit_price numeric not null default 0,
  add column if not exists setup_fee numeric not null default 0,
  add column if not exists teardown_fee numeric not null default 0,
  add column if not exists margin_pct numeric not null default 35;

update public.services
set crew_min = greatest(1, least(coalesce(crew_min, 1), 12)),
    crew_max = greatest(greatest(1, least(coalesce(crew_min, 1), 12)), least(coalesce(crew_max, 12), 12)),
    default_crew = greatest(greatest(1, least(coalesce(crew_min, 1), 12)), least(coalesce(default_crew, 3), greatest(1, least(coalesce(crew_max, 12), 12)))),
    crew_unit_price = coalesce(crew_unit_price, (select value from public.price_rules where name='Kişi başı ek ücret' and active=true limit 1), 0),
    setup_fee = coalesce(setup_fee, (select value from public.price_rules where name='Kurulum' and active=true limit 1), 0),
    teardown_fee = coalesce(teardown_fee, (select value from public.price_rules where name='Söküm' and active=true limit 1), 0),
    margin_pct = coalesce(margin_pct, (select value from public.price_rules where name='Varsayılan kâr marjı' and active=true limit 1), 35);

create or replace function public.admin_update_ai_agent(p_code text,p_active boolean,p_can_read boolean,p_can_propose boolean,p_can_execute boolean)
returns public.ai_agents language plpgsql security definer set search_path=public as $$
declare r public.ai_agents;
begin
  if not exists (select 1 from public.admin_profiles where user_id=auth.uid() and active=true) then raise exception 'Yönetici yetkisi gerekli.'; end if;
  update public.ai_agents set active=coalesce(p_active,active),can_read=coalesce(p_can_read,can_read),can_propose=coalesce(p_can_propose,can_propose),can_execute=coalesce(p_can_execute,can_execute) where code=p_code returning * into r;
  if r.id is null then raise exception 'AI bulunamadı.'; end if;
  return r;
end; $$;

create or replace function public.admin_update_price_rule(p_id uuid,p_value numeric,p_active boolean,p_notes text)
returns public.price_rules language plpgsql security definer set search_path=public as $$
declare r public.price_rules;
begin
  if not exists (select 1 from public.admin_profiles where user_id=auth.uid() and active=true) then raise exception 'Yönetici yetkisi gerekli.'; end if;
  update public.price_rules set value=coalesce(p_value,value),active=coalesce(p_active,active),notes=case when p_notes is null then notes else left(p_notes,2000) end,updated_at=now() where id=p_id returning * into r;
  if r.id is null then raise exception 'Fiyat kuralı bulunamadı.'; end if;
  return r;
end; $$;

create or replace function public.admin_update_service_pricing(p_id uuid,p_base_price numeric,p_base_cost numeric,p_crew_min integer,p_crew_max integer,p_default_crew integer,p_crew_unit_price numeric,p_setup_fee numeric,p_teardown_fee numeric,p_margin_pct numeric,p_active boolean)
returns public.services language plpgsql security definer set search_path=public as $$
declare r public.services; vmin integer; vmax integer; vdef integer;
begin
  if not exists (select 1 from public.admin_profiles where user_id=auth.uid() and active=true) then raise exception 'Yönetici yetkisi gerekli.'; end if;
  vmin := greatest(1,least(coalesce(p_crew_min,1),12));
  vmax := greatest(vmin,least(coalesce(p_crew_max,12),12));
  vdef := greatest(vmin,least(coalesce(p_default_crew,vmin),vmax));
  update public.services set base_price=greatest(0,coalesce(p_base_price,base_price)),base_cost=greatest(0,coalesce(p_base_cost,base_cost)),crew_min=vmin,crew_max=vmax,default_crew=vdef,crew_unit_price=greatest(0,coalesce(p_crew_unit_price,crew_unit_price)),setup_fee=greatest(0,coalesce(p_setup_fee,setup_fee)),teardown_fee=greatest(0,coalesce(p_teardown_fee,teardown_fee)),margin_pct=greatest(0,coalesce(p_margin_pct,margin_pct)),active=coalesce(p_active,active) where id=p_id returning * into r;
  if r.id is null then raise exception 'Hizmet bulunamadı.'; end if;
  return r;
end; $$;

create or replace function public.admin_set_service_active(p_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.admin_profiles where user_id=auth.uid() and active=true) then raise exception 'Yönetici yetkisi gerekli.'; end if;
  update public.services set active=coalesce(p_active,false) where id=p_id; return found;
end; $$;

create or replace function public.admin_set_price_rule_active(p_id uuid,p_active boolean) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.admin_profiles where user_id=auth.uid() and active=true) then raise exception 'Yönetici yetkisi gerekli.'; end if;
  update public.price_rules set active=coalesce(p_active,false),updated_at=now() where id=p_id; return found;
end; $$;

create or replace function public.admin_create_service(p_name text,p_description text,p_base_price numeric,p_base_cost numeric,p_crew_min integer,p_crew_max integer,p_default_crew integer,p_crew_unit_price numeric,p_setup_fee numeric,p_teardown_fee numeric,p_margin_pct numeric)
returns public.services language plpgsql security definer set search_path=public as $$
declare r public.services; vmin integer; vmax integer; vdef integer;
begin
  if not exists (select 1 from public.admin_profiles where user_id=auth.uid() and active=true) then raise exception 'Yönetici yetkisi gerekli.'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Hizmet adı gerekli.'; end if;
  vmin := greatest(1,least(coalesce(p_crew_min,1),12)); vmax := greatest(vmin,least(coalesce(p_crew_max,12),12)); vdef := greatest(vmin,least(coalesce(p_default_crew,vmin),vmax));
  insert into public.services(name,description,base_price,base_cost,active,crew_min,crew_max,default_crew,crew_unit_price,setup_fee,teardown_fee,margin_pct)
  values(left(trim(p_name),120),left(coalesce(p_description,''),2000),greatest(0,coalesce(p_base_price,0)),greatest(0,coalesce(p_base_cost,0)),true,vmin,vmax,vdef,greatest(0,coalesce(p_crew_unit_price,0)),greatest(0,coalesce(p_setup_fee,0)),greatest(0,coalesce(p_teardown_fee,0)),greatest(0,coalesce(p_margin_pct,35))) returning * into r;
  return r;
end; $$;

create or replace function public.admin_create_price_rule(p_name text,p_rule_type text,p_value numeric,p_notes text)
returns public.price_rules language plpgsql security definer set search_path=public as $$
declare r public.price_rules;
begin
  if not exists (select 1 from public.admin_profiles where user_id=auth.uid() and active=true) then raise exception 'Yönetici yetkisi gerekli.'; end if;
  if p_rule_type not in ('fixed','per_person','per_km','percent','multiplier') then raise exception 'Geçersiz kural tipi.'; end if;
  insert into public.price_rules(name,rule_type,value,notes,active) values(left(trim(p_name),120),p_rule_type,coalesce(p_value,0),left(coalesce(p_notes,''),2000),true) returning * into r;
  return r;
end; $$;

create or replace function public.on_quote_insert_enrich() returns trigger language plpgsql security definer set search_path=public as $$
declare c_id uuid; svc public.services; margin_pct numeric:=35; min_quote numeric:=0; base numeric:=0; price numeric:=0; crew numeric:=3; per_crew numeric:=0; setup_fee numeric:=0; teardown_fee numeric:=0; explicit_total boolean;
begin
  select id into c_id from public.customers where phone=new.phone limit 1;
  if c_id is null then insert into public.customers(name,company,phone,email,last_contact_at) values(new.name,new.company,new.phone,new.email,now()) returning id into c_id;
  else update public.customers set name=coalesce(nullif(new.name,''),name),company=coalesce(nullif(new.company,''),company),email=coalesce(nullif(new.email,''),email),last_contact_at=now(),updated_at=now() where id=c_id; end if;
  new.customer_id:=c_id; explicit_total:=coalesce(new.total,0)>0 or coalesce(new.estimated_price,0)>0;
  if not explicit_total then
    select * into svc from public.services where name=new.type and active=true limit 1;
    if found then base:=coalesce(svc.base_price,0); crew:=greatest(svc.crew_min,least(svc.default_crew,svc.crew_max)); per_crew:=coalesce(svc.crew_unit_price,0); setup_fee:=coalesce(svc.setup_fee,0); teardown_fee:=coalesce(svc.teardown_fee,0); margin_pct:=coalesce(svc.margin_pct,35);
    else
      select value into crew from public.price_rules where name='Varsayılan ekip sayısı' and active=true limit 1; select value into per_crew from public.price_rules where name='Kişi başı ek ücret' and active=true limit 1; select value into setup_fee from public.price_rules where name='Kurulum' and active=true limit 1; select value into teardown_fee from public.price_rules where name='Söküm' and active=true limit 1; select value into margin_pct from public.price_rules where name='Varsayılan kâr marjı' and active=true limit 1;
    end if;
    select value into min_quote from public.price_rules where name='Minimum teklif' and active=true limit 1;
    price:=base+coalesce(setup_fee,0)+coalesce(teardown_fee,0)+(greatest(1,least(coalesce(crew,3),12))*coalesce(per_crew,0));
    if price>0 and price<coalesce(min_quote,0) then price:=min_quote; end if;
    new.estimated_price:=round(price,2); new.total:=new.estimated_price;
    if margin_pct>0 and price>0 then new.estimated_cost:=round(price/(1+(margin_pct/100)),2); else new.estimated_cost:=coalesce(svc.base_cost,0); end if;
    new.margin:=coalesce(new.total,0)-coalesce(new.estimated_cost,0);
  end if;
  insert into public.notifications(kind,title,body,offer_id) values('new_quote','Yeni teklif talebi',coalesce(new.quote_number,'Yeni teklif')||' - '||coalesce(new.name,''),new.id);
  return new;
end; $$;
drop trigger if exists trg_quote_insert_enrich on public.teklifler;
create trigger trg_quote_insert_enrich before insert on public.teklifler for each row execute function public.on_quote_insert_enrich();

commit;
