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

-- Serialize device activation to prevent concurrent requests exceeding max_devices.
create or replace function public.stagepulse_activate_license_device(p_license_id uuid, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lic public.stagepulse_licenses%rowtype;
  devices jsonb;
begin
  if p_device_id is null or length(p_device_id) < 1 or length(p_device_id) > 160 then
    return jsonb_build_object('ok', false, 'error', 'Cihaz kimliği geçersiz.');
  end if;

  select * into lic from public.stagepulse_licenses where id = p_license_id for update;
  if not found or lic.status <> 'active' or (lic.expires_at is not null and lic.expires_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'Lisans geçersiz veya süresi dolmuş.');
  end if;

  devices := coalesce(lic.activated_devices, '[]'::jsonb);
  if exists (
    select 1 from jsonb_array_elements(devices) d
    where d->>'id' = p_device_id
  ) then
    return jsonb_build_object('ok', true, 'already_activated', true);
  end if;

  if jsonb_array_length(devices) >= lic.max_devices then
    return jsonb_build_object('ok', false, 'error', 'Lisansın cihaz sınırı dolmuş.');
  end if;

  update public.stagepulse_licenses
  set activated_devices = devices || jsonb_build_array(jsonb_build_object('id', p_device_id, 'activated_at', now())),
      updated_at = now()
  where id = lic.id;

  return jsonb_build_object('ok', true, 'already_activated', false);
end;
$$;

revoke all on function public.stagepulse_activate_license_device(uuid, text) from public, anon, authenticated;
grant execute on function public.stagepulse_activate_license_device(uuid, text) to service_role;

comment on table public.stagepulse_licenses is 'Stagepulse lisansları. Erişim yalnızca service-role kullanan lisans Edge Function üzerinden yapılır; istemci rolleri doğrudan erişemez.';

commit;
