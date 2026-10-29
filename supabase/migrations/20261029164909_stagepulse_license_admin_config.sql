begin;

create table if not exists public.stagepulse_license_admin_config (
  singleton boolean primary key default true check (singleton),
  username text not null,
  password_hash text not null,
  token_secret text not null check (length(token_secret) >= 32),
  updated_at timestamptz not null default now()
);

alter table public.stagepulse_license_admin_config enable row level security;
revoke all on public.stagepulse_license_admin_config from anon, authenticated;
grant all on public.stagepulse_license_admin_config to service_role;

comment on table public.stagepulse_license_admin_config is
  'Bağımsız Stagepulse lisans yöneticisi yapılandırması. Yalnızca service_role erişebilir. Parola PBKDF2-SHA256 özeti olarak saklanır.';

commit;
