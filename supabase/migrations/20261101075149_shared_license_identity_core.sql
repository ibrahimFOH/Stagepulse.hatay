-- Ortak Stagepulse lisans ve kimlik çekirdeği.
-- Eski Stagepulse ve Ses Merkezi kayıtları korunur; tetikleyiciler bunları ortak sicile eşitler.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists public.license_products (
  app_id text primary key check (app_id ~ '^[a-z0-9._-]{2,80}$'),
  product_code text not null check (product_code ~ '^[a-z0-9._-]{2,80}$'),
  display_name text not null,
  platform text not null check (platform in ('web','windows','android')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.license_products(app_id,product_code,display_name,platform)
values
 ('stagepulse','stagepulse','Stagepulse','web'),
 ('ses-merkezi','ses-merkezi','Stagepulse Ses Merkezi','windows'),
 ('jarvis-windows','jarvis','Stagepulse JARVIS Windows','windows'),
 ('jarvis-android','jarvis','Stagepulse JARVIS Android','android')
on conflict (app_id) do update set
 product_code=excluded.product_code, display_name=excluded.display_name,
 platform=excluded.platform, is_active=true;

create table if not exists public.license_product_entitlements (
  app_id text not null references public.license_products(app_id) on delete cascade,
  capability text not null check (capability ~ '^[a-z0-9._-]{2,100}$'),
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits)='object'),
  primary key(app_id,capability)
);

insert into public.license_product_entitlements(app_id,capability,enabled,limits)
values
 ('stagepulse','license.activate',true,'{}'),
 ('stagepulse','license.validate',true,'{}'),
 ('ses-merkezi','education.catalog',true,'{}'),
 ('ses-merkezi','education.progress',true,'{}'),
 ('ses-merkezi','audio.tools',true,'{}'),
 ('jarvis-windows','assistant.chat',true,'{}'),
 ('jarvis-windows','assistant.voice',true,'{}'),
 ('jarvis-windows','computer.control',true,'{}'),
 ('jarvis-android','assistant.chat',true,'{}'),
 ('jarvis-android','assistant.voice',true,'{}'),
 ('jarvis-android','android.bridge',true,'{}')
on conflict (app_id,capability) do nothing;

create table if not exists public.license_core (
  id uuid primary key default gen_random_uuid(),
  product_code text not null check (product_code ~ '^[a-z0-9._-]{2,80}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  key_normalization text not null check (key_normalization in ('trim_upper','alnum_upper')),
  legacy_system text,
  legacy_license_id uuid,
  owner_user_id uuid references auth.users(id) on delete set null,
  customer_name text not null default '',
  status text not null default 'active' check (status in ('active','revoked','expired','disabled')),
  plan_code text not null default 'standard',
  bundle_code text,
  max_devices integer not null default 1 check (max_devices between 1 and 100),
  expires_at timestamptz,
  payment_status text not null default 'paid' check (payment_status in ('paid','unpaid','refunded')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint license_core_legacy_pair_unique unique(legacy_system,legacy_license_id)
);
create index if not exists license_core_product_status_idx on public.license_core(product_code,status,created_at desc);
create index if not exists license_core_owner_idx on public.license_core(owner_user_id,created_at desc);

create table if not exists public.license_entitlements (
  license_id uuid not null references public.license_core(id) on delete cascade,
  app_id text not null references public.license_products(app_id) on delete cascade,
  capability text not null check (capability ~ '^[a-z0-9._-]{2,100}$'),
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits)='object'),
  created_at timestamptz not null default now(),
  primary key(license_id,app_id,capability)
);

create table if not exists public.license_core_devices (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.license_core(id) on delete cascade,
  app_id text not null references public.license_products(app_id),
  user_id uuid references auth.users(id) on delete set null,
  device_hash text not null check (char_length(device_hash) between 8 and 256),
  platform text not null check (platform in ('web','windows','android','legacy')),
  is_active boolean not null default true,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  unique(license_id,app_id,device_hash)
);
create index if not exists license_core_devices_user_idx on public.license_core_devices(user_id,app_id,is_active);

create table if not exists public.license_core_audit (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.license_core(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  app_id text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);
create index if not exists license_core_audit_created_idx on public.license_core_audit(created_at desc);

alter table public.license_products enable row level security;
alter table public.license_product_entitlements enable row level security;
alter table public.license_core enable row level security;
alter table public.license_entitlements enable row level security;
alter table public.license_core_devices enable row level security;
alter table public.license_core_audit enable row level security;

revoke all on public.license_products, public.license_product_entitlements, public.license_core,
 public.license_entitlements, public.license_core_devices, public.license_core_audit
 from public, anon, authenticated;
grant all on public.license_products, public.license_product_entitlements, public.license_core,
 public.license_entitlements, public.license_core_devices, public.license_core_audit
 to service_role;

create or replace function private.sync_stagepulse_license_to_core()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_product text; v_core_id uuid; v_device jsonb;
begin
  v_product := case when new.product_code in ('ses-merkezi-desktop','ses-merkezi') then 'ses-merkezi' else lower(new.product_code) end;
  insert into public.license_core(
    product_code,key_hash,key_normalization,legacy_system,legacy_license_id,customer_name,
    status,plan_code,max_devices,expires_at,payment_status,metadata,created_at,updated_at,revoked_at
  ) values (
    v_product,new.license_hash,'trim_upper','stagepulse',new.id,coalesce(new.customer_name,''),
    new.status,'standard',new.max_devices,new.expires_at,'paid',
    jsonb_build_object('license_prefix',new.license_prefix,'notes',new.notes),
    new.created_at,new.updated_at,new.revoked_at
  )
  on conflict (legacy_system,legacy_license_id) do update set
    product_code=excluded.product_code,key_hash=excluded.key_hash,customer_name=excluded.customer_name,
    status=excluded.status,max_devices=excluded.max_devices,expires_at=excluded.expires_at,
    metadata=excluded.metadata,updated_at=excluded.updated_at,revoked_at=excluded.revoked_at
  returning id into v_core_id;

  update public.license_core_devices set is_active=false,last_seen_at=now()
   where license_id=v_core_id and app_id='stagepulse' and platform='legacy';

  if new.status='active' and jsonb_typeof(new.activated_devices)='array' then
    for v_device in select value from jsonb_array_elements(new.activated_devices)
    loop
      if nullif(v_device->>'id','') is not null then
        insert into public.license_core_devices(license_id,app_id,device_hash,platform,is_active,activated_at,last_seen_at)
        values(v_core_id,'stagepulse',left(v_device->>'id',256),'legacy',true,
          coalesce((v_device->>'activated_at')::timestamptz,now()),now())
        on conflict(license_id,app_id,device_hash) do update set is_active=true,last_seen_at=now();
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function private.sync_sesm_license_to_core()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_core_id uuid;
begin
  insert into public.license_core(
    product_code,key_hash,key_normalization,legacy_system,legacy_license_id,owner_user_id,
    customer_name,status,plan_code,bundle_code,max_devices,expires_at,payment_status,metadata,created_at,updated_at
  ) values (
    'ses-merkezi',new.key_hash,'alnum_upper','ses-merkezi',new.id,new.created_by,
    coalesce(new.customer_name,new.label,''),case when new.is_active then 'active' else 'revoked' end,
    new.plan_code,new.bundle_code,new.max_activations,new.expires_at,new.payment_status,
    jsonb_build_object('label',new.label,'notes',new.notes,'amount',new.amount,'currency',new.currency,
      'payment_method',new.payment_method,'payment_reference',new.payment_reference),
    new.created_at,now()
  )
  on conflict (legacy_system,legacy_license_id) do update set
    key_hash=excluded.key_hash,owner_user_id=excluded.owner_user_id,customer_name=excluded.customer_name,
    status=excluded.status,plan_code=excluded.plan_code,bundle_code=excluded.bundle_code,
    max_devices=excluded.max_devices,expires_at=excluded.expires_at,payment_status=excluded.payment_status,
    metadata=excluded.metadata,updated_at=now()
  returning id into v_core_id;
  return new;
end;
$$;

create or replace function private.sync_sesm_activation_to_core()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_core_id uuid;
begin
  select id into v_core_id from public.license_core
   where legacy_system='ses-merkezi' and legacy_license_id=new.license_id;
  if v_core_id is not null then
    insert into public.license_core_devices(
      license_id,app_id,user_id,device_hash,platform,is_active,activated_at,last_seen_at
    ) values(v_core_id,'ses-merkezi',new.user_id,new.device_hash,'legacy',new.is_active,new.activated_at,new.last_seen_at)
    on conflict(license_id,app_id,device_hash) do update set
      user_id=excluded.user_id,is_active=excluded.is_active,last_seen_at=excluded.last_seen_at;
  end if;
  return new;
end;
$$;

drop trigger if exists stagepulse_license_core_sync on public.stagepulse_licenses;
create trigger stagepulse_license_core_sync after insert or update on public.stagepulse_licenses
for each row execute function private.sync_stagepulse_license_to_core();

drop trigger if exists sesm_license_core_sync on public.sesm_license_keys;
create trigger sesm_license_core_sync after insert or update on public.sesm_license_keys
for each row execute function private.sync_sesm_license_to_core();

drop trigger if exists sesm_activation_core_sync on public.sesm_activations;
create trigger sesm_activation_core_sync after insert or update on public.sesm_activations
for each row execute function private.sync_sesm_activation_to_core();

revoke all on function private.sync_stagepulse_license_to_core() from public,anon,authenticated;
revoke all on function private.sync_sesm_license_to_core() from public,anon,authenticated;
revoke all on function private.sync_sesm_activation_to_core() from public,anon,authenticated;
