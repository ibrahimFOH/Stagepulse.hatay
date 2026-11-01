-- Seven-day Ses Merkezi device trials remain server-managed.
-- Preserve the table for service-role workflows and explicitly deny client API access.
begin;

create table if not exists public.sesm_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_hash text not null unique check (device_hash ~ '^[0-9a-f]{64}$'),
  platform text not null default 'windows' check (platform in ('windows', 'android', 'unknown')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_seen_at timestamptz not null default now(),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.sesm_trials enable row level security;

drop policy if exists sesm_trials_deny_client_access on public.sesm_trials;
create policy sesm_trials_deny_client_access
  on public.sesm_trials
  for all to anon, authenticated
  using (false) with check (false);

revoke all on table public.sesm_trials from public, anon, authenticated;
grant all on table public.sesm_trials to service_role;

commit;
