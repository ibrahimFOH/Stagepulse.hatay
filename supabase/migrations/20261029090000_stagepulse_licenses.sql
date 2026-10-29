begin;

create extension if not exists pgcrypto;

create table if not exists public.stagepulse_licenses (
  id uuid primary key default gen_random_uuid(),
  license_hash text not null unique,
  license_prefix text not null,
  customer_name text not null,
  product_code text not null default 'stagepulse',
  status text not null default 'active' check (status in ('active','revoked','expired')),
  max_devices integer not null default 1 check (max_devices between 1 and 50),
  activated_devices jsonb not null default '[]'::jsonb check (jsonb_typeof(activated_devices) = 'array'),
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists stagepulse_licenses_status_idx on public.stagepulse_licenses(status);
create index if not exists stagepulse_licenses_created_at_idx on public.stagepulse_licenses(created_at desc);

alter table public.stagepulse_licenses enable row level security;
revoke all on public.stagepulse_licenses from anon, authenticated;
grant all on public.stagepulse_licenses to service_role;

comment on table public.stagepulse_licenses is 'Stagepulse lisansları. Erişim yalnızca service-role kullanan lisans Edge Function üzerinden yapılır; istemci rolleri doğrudan erişemez.';

commit;
