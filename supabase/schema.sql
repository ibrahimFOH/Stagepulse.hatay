-- STAGEPULSE CRM / QUOTE SYSTEM
-- Run this migration in Supabase SQL Editor.
-- Never put the service-role key in the website.

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default 'Stagepulse Admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Stagepulse',
  phone text not null default '05320683012',
  whatsapp text not null default '05320683012',
  email text not null default 'teklifal@stagepulse.com.tr',
  instagram text not null default 'stagepulse.hatay',
  quote_valid_days integer not null default 7,
  min_quote numeric(12,2) not null default 0,
  default_margin numeric(5,2) not null default 35,
  updated_at timestamptz not null default now()
);
insert into public.business_settings(id) values(true) on conflict (id) do nothing;

create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.event_types(name,sort_order) values
('Konser',1),('Festival',2),('Düğün',3),('Kurumsal',4),('Özel Etkinlik',5),('Diğer',99)
on conflict (name) do nothing;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  base_cost numeric(12,2) not null default 0,
  base_price numeric(12,2) not null default 0
);
insert into public.services(name,sort_order) values
('Ses Sistemi Kiralama',1),('Işık & Truss Kiralama',2),('Stage Plot / Sahne Planı',3),
('3D Sahne Çizimi',4),('SPL Hesaplama',5),('Teknik Rider Hazırlama',6),
('FOH Operasyonu',7),('Paket (Kiralama + Mühendislik)',8),('Diğer',99)
on conflict (name) do nothing;

create table if not exists public.price_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rule_type text not null check (rule_type in ('fixed','per_person','per_km','percent','multiplier')),
  value numeric(12,4) not null default 0,
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);
insert into public.price_rules(name,rule_type,value,notes) values
('Varsayılan kâr marjı','percent',35,'Admin panelinden değiştirilebilir'),
('Minimum teklif','fixed',0,'0 = minimum yok'),
('Kurulum','fixed',0,'Gerçek maliyet/fiyatını gir'),
('Söküm','fixed',0,'Gerçek maliyet/fiyatını gir'),
('Nakliye / km','per_km',0,'Şehir dışı/uzak işler için'),
('Fazla mesai','percent',25,'Standart fiyatın yüzdesi')
on conflict (name) do nothing;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  phone text,
  email text,
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_phone_uq on public.customers(phone) where phone is not null and phone <> '';

create table if not exists public.teklifler (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  company text,
  phone text,
  email text,
  type text,
  event_type text,
  location text,
  people integer,
  event_date date,
  duration_hours numeric(6,2),
  message text,
  services jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','reviewing','preparing','sent','accepted','rejected','cancelled','archived','expired')),
  currency text not null default 'TRY',
  estimated_cost numeric(12,2) not null default 0,
  estimated_price numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  margin numeric(12,2) not null default 0,
  public_token text unique default encode(gen_random_bytes(24),'hex'),
  valid_until date,
  accepted_at timestamptz,
  rejected_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teklifler add column if not exists quote_number text;
alter table public.teklifler add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.teklifler add column if not exists company text;
alter table public.teklifler add column if not exists email text;
alter table public.teklifler add column if not exists event_type text;
alter table public.teklifler add column if not exists duration_hours numeric(6,2);
alter table public.teklifler add column if not exists services jsonb not null default '[]'::jsonb;
alter table public.teklifler add column if not exists status text not null default 'new';
alter table public.teklifler add column if not exists currency text not null default 'TRY';
alter table public.teklifler add column if not exists estimated_cost numeric(12,2) not null default 0;
alter table public.teklifler add column if not exists estimated_price numeric(12,2) not null default 0;
alter table public.teklifler add column if not exists discount numeric(12,2) not null default 0;
alter table public.teklifler add column if not exists total numeric(12,2) not null default 0;
alter table public.teklifler add column if not exists margin numeric(12,2) not null default 0;
alter table public.teklifler add column if not exists public_token text unique default encode(gen_random_bytes(24),'hex');
alter table public.teklifler add column if not exists valid_until date;
alter table public.teklifler add column if not exists accepted_at timestamptz;
alter table public.teklifler add column if not exists rejected_at timestamptz;
alter table public.teklifler add column if not exists archived_at timestamptz;
alter table public.teklifler add column if not exists updated_at timestamptz not null default now();

create table if not exists public.offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.teklifler(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  brand text,
  model text,
  quantity integer not null default 0,
  daily_cost numeric(12,2) not null default 0,
  daily_price numeric(12,2) not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.teklifler(id) on delete set null,
  title text not null,
  setup_at timestamptz,
  event_at timestamptz,
  teardown_at timestamptz,
  location text,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.teklifler(id) on delete cascade,
  description text,
  amount numeric(12,2) not null default 0,
  due_date date,
  paid_at timestamptz,
  status text not null default 'pending' check (status in ('pending','deposit','partial','paid','overdue')),
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  phone text,
  daily_cost numeric(12,2) not null default 0,
  active boolean not null default true
);
create table if not exists public.job_staff (
  job_id uuid references public.jobs(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  fee numeric(12,2) not null default 0,
  primary key(job_id,staff_id)
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  kind text not null,
  title text not null,
  body text,
  offer_id uuid references public.teklifler(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create sequence if not exists public.quote_number_seq start 1;
create or replace function public.next_quote_number() returns text language plpgsql security definer set search_path=public as $$
declare n bigint; begin n:=nextval('public.quote_number_seq'); return 'SP-'||to_char(current_date,'YYYY')||'-'||lpad(n::text,4,'0'); end; $$;

create or replace function public.set_quote_defaults() returns trigger language plpgsql as $$
declare d integer; begin
 if new.quote_number is null or new.quote_number='' then new.quote_number:=public.next_quote_number(); end if;
 if new.public_token is null or new.public_token='' then new.public_token:=encode(gen_random_bytes(24),'hex'); end if;
 if new.valid_until is null then select quote_valid_days into d from public.business_settings where id=true; new.valid_until:=coalesce(new.event_date,current_date)+coalesce(d,7); end if;
 new.updated_at:=now();
 return new; end $$;
drop trigger if exists trg_quote_defaults on public.teklifler;
create trigger trg_quote_defaults before insert or update on public.teklifler for each row execute function public.set_quote_defaults();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_profiles p where p.user_id=auth.uid() and p.active=true); $$;

-- Public-safe view: no internal cost/margin is exposed.
create or replace view public.public_quotes as
select id, quote_number, name, company, type, event_type, location, people, event_date, duration_hours, services,
       total, currency, valid_until, status, public_token, created_at, updated_at
from public.teklifler;

-- IMPORTANT: anon/authenticated must NEVER select this view directly (it would let
-- anyone enumerate every quote). Access is only allowed through the security-definer
-- get_public_quote()/respond_to_quote() RPCs below, which require the exact token.
revoke all on public.public_quotes from anon, authenticated, public;

-- Public customer actions through security-definer RPC, token-only.
create or replace function public.respond_to_quote(p_token text, p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.teklifler; begin
 if p_action not in ('accepted','rejected') then raise exception 'Invalid action'; end if;
 update public.teklifler set status=p_action, accepted_at=case when p_action='accepted' then now() else accepted_at end,
 rejected_at=case when p_action='rejected' then now() else rejected_at end, updated_at=now()
 where public_token=p_token
   and valid_until >= current_date
   and status not in ('accepted','rejected','cancelled','archived','expired')
 returning * into r;
 if not found then raise exception 'Quote not found, expired, or already answered'; end if;
 insert into public.notifications(kind,title,body,offer_id) values('quote_response','Teklif yanıtı',coalesce(r.quote_number,'Teklif')||' müşteriden '||p_action||' yanıtı aldı.',r.id);
 return jsonb_build_object('ok',true,'status',r.status,'quote_number',r.quote_number);
end $$;


-- Automatically upsert a customer record and calculate an internal estimate for new leads.
-- people = seyirci/katılımcı (bilgi); fiyata çarpılmaz. Lead'lerde total genelde 0, admin yazar.
create or replace function public.on_quote_insert_enrich() returns trigger language plpgsql security definer set search_path=public as $$
declare c_id uuid; svc public.services; margin_pct numeric:=35; min_quote numeric:=0; base numeric:=0; price numeric:=0; explicit_total boolean;
begin
 select id into c_id from public.customers where phone=new.phone limit 1;
 if c_id is null then
   insert into public.customers(name,company,phone,email,last_contact_at) values(new.name,new.company,new.phone,new.email,now()) returning id into c_id;
 else
   update public.customers set name=coalesce(nullif(new.name,''),name), company=coalesce(nullif(new.company,''),company), email=coalesce(nullif(new.email,''),email), last_contact_at=now(), updated_at=now() where id=c_id;
 end if;
 new.customer_id:=c_id;
 explicit_total := coalesce(new.total,0) > 0 or coalesce(new.estimated_price,0) > 0;
 if not explicit_total then
   select * into svc from public.services where name=new.type and active=true limit 1;
   if found then base:=coalesce(svc.base_price,0); end if;
   select value into margin_pct from public.price_rules where name='Varsayılan kâr marjı' and active=true limit 1;
   select value into min_quote from public.price_rules where name='Minimum teklif' and active=true limit 1;
   price:=base;
   if price > 0 and price < coalesce(min_quote,0) then price:=coalesce(min_quote,0); end if;
   new.estimated_price:=round(price,2);
   new.total:=new.estimated_price;
   if margin_pct is not null and margin_pct>0 and price>0 then new.estimated_cost:=round(price/(1+(margin_pct/100)),2); else new.estimated_cost:=coalesce(svc.base_cost,0); end if;
   new.margin:=coalesce(new.total,0)-coalesce(new.estimated_cost,0);
 end if;
 insert into public.notifications(kind,title,body,offer_id) values('new_quote','Yeni teklif talebi',coalesce(new.quote_number,'Yeni teklif')||' - '||coalesce(new.name,''),new.id);
 return new;
end $$;
drop trigger if exists trg_quote_insert_enrich on public.teklifler;
create trigger trg_quote_insert_enrich before insert on public.teklifler for each row execute function public.on_quote_insert_enrich();

insert into public.price_rules(name,rule_type,value,notes) values('Kişi başı ek ücret','per_person',0,'Kullanılmıyor: people seyirci bilgisidir, fiyat çarpanı değildir.') on conflict(name) do nothing;

-- RLS
alter table public.admin_profiles add column if not exists singleton boolean not null default true;
create unique index if not exists admin_profiles_singleton_uq on public.admin_profiles(singleton);
alter table public.admin_profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.event_types enable row level security;
alter table public.services enable row level security;
alter table public.price_rules enable row level security;
alter table public.customers enable row level security;
alter table public.teklifler enable row level security;
alter table public.offer_items enable row level security;
alter table public.equipment enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;
alter table public.staff enable row level security;
alter table public.job_staff enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

-- Remove permissive policies from prior iterations where names are known.
do $$ declare t text; begin
 foreach t in array array['admin_all','admin_profiles_all','settings_admin','settings_public','services_public','services_admin','events_public','events_admin','quotes_public_insert','quotes_admin','offer_items_admin','equipment_admin','jobs_admin','payments_admin','staff_admin','job_staff_admin','activity_admin','notifications_admin'] loop
  execute format('drop policy if exists %I on public.admin_profiles',t) ;
  execute format('drop policy if exists %I on public.business_settings',t);
  execute format('drop policy if exists %I on public.event_types',t);
  execute format('drop policy if exists %I on public.services',t);
  execute format('drop policy if exists %I on public.price_rules',t);
  execute format('drop policy if exists %I on public.customers',t);
  execute format('drop policy if exists %I on public.teklifler',t);
  execute format('drop policy if exists %I on public.offer_items',t);
  execute format('drop policy if exists %I on public.equipment',t);
  execute format('drop policy if exists %I on public.jobs',t);
  execute format('drop policy if exists %I on public.payments',t);
  execute format('drop policy if exists %I on public.staff',t);
  execute format('drop policy if exists %I on public.job_staff',t);
  execute format('drop policy if exists %I on public.activity_logs',t);
  execute format('drop policy if exists %I on public.notifications',t);
 end loop; end $$;

do $$ declare r record; begin
 for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('admin_profiles','business_settings','event_types','services','price_rules','customers','teklifler','offer_items','equipment','jobs','payments','staff','job_staff','activity_logs','notifications') loop
  execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
 end loop;
end $$;

create policy admin_profiles_all on public.admin_profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy settings_admin on public.business_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy services_public on public.services for select to anon,authenticated using(active=true);
create policy services_admin on public.services for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy events_public on public.event_types for select to anon,authenticated using(active=true);
create policy events_admin on public.event_types for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy quotes_public_insert on public.teklifler for insert to anon,authenticated with check(true);
create policy quotes_admin on public.teklifler for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy offer_items_admin on public.offer_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy equipment_admin on public.equipment for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy jobs_admin on public.jobs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy payments_admin on public.payments for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy staff_admin on public.staff for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy job_staff_admin on public.job_staff for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy activity_admin on public.activity_logs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy notifications_admin on public.notifications for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy customers_admin on public.customers for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy pricing_admin on public.price_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Public quote retrieval: intentionally requires exact token via a security-definer function.
create or replace function public.get_public_quote(p_token text)
returns jsonb language sql security definer set search_path=public as $$
 select to_jsonb(q) from public.public_quotes q where q.public_token=p_token limit 1;
$$;

-- Grants for RPCs. Do not grant table reads to anon.
grant execute on function public.get_public_quote(text) to anon, authenticated;
grant execute on function public.respond_to_quote(text,text) to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select on public.event_types to anon, authenticated;
grant insert on public.teklifler to anon, authenticated;

-- Bootstrap note: after creating the single Auth user in Supabase Dashboard, run:
-- insert into public.admin_profiles(user_id,username,display_name) values('<AUTH USER UUID>','stagepulseadmin','Stagepulse Admin');
-- Then the username login Edge Function will be active.
