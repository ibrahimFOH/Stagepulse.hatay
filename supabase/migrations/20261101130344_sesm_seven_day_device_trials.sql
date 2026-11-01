-- 7 günlük demo hakkı kullanıcıya ve cihaza bağlanır.
-- Bu tablo yalnızca sunucu tarafından, service_role yetkili Edge Function üzerinden okunur/yazılır.
create table if not exists public.sesm_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_hash text not null unique
    constraint sesm_trials_device_hash_check check (device_hash ~ '^[0-9a-f]{64}$'),
  platform text not null default 'windows'
    constraint sesm_trials_platform_check check (platform in ('windows', 'android', 'unknown')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_seen_at timestamptz not null default now(),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.sesm_trials enable row level security;
revoke all on table public.sesm_trials from anon, authenticated;
grant all on table public.sesm_trials to service_role;

comment on table public.sesm_trials is
  'Stagepulse Ses Merkezi 7 günlük deneme kayıtları. Tek kullanıcı ve tek cihaz başına bir deneme; istemciler doğrudan erişemez.';
