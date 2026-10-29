alter table public.stagepulse_license_admin_config
  add column if not exists temporary_username text,
  add column if not exists temporary_password_hash text,
  add column if not exists temporary_expires_at timestamptz;
