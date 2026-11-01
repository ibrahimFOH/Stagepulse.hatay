begin;

create table if not exists public.notification_devices (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android','web')),
  push_type text not null default 'fcm' check (push_type = 'fcm'),
  app_variant text not null check (app_variant in ('admin','staff')),
  active boolean not null default true,
  last_seen_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  subscription_updated_at timestamptz
);

create unique index if not exists notification_devices_user_token_variant_uidx
  on public.notification_devices(user_id, token, app_variant);
create index if not exists notification_devices_user_active_push_idx
  on public.notification_devices(user_id, active, push_type, app_variant);

alter table public.notification_devices enable row level security;
drop policy if exists notification_devices_self_select on public.notification_devices;
drop policy if exists notification_devices_self_insert on public.notification_devices;
drop policy if exists notification_devices_self_update on public.notification_devices;
drop policy if exists notification_devices_self_delete on public.notification_devices;

create policy notification_devices_self_select on public.notification_devices
  for select to authenticated using (user_id = auth.uid());
create policy notification_devices_self_insert on public.notification_devices
  for insert to authenticated with check (user_id = auth.uid());
create policy notification_devices_self_update on public.notification_devices
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_devices_self_delete on public.notification_devices
  for delete to authenticated using (user_id = auth.uid());

revoke all on table public.notification_devices from anon;
grant select, insert, update, delete on table public.notification_devices to authenticated;

create or replace function public.register_notification_device(
  p_token text,
  p_platform text,
  p_app_variant text
)
returns public.notification_devices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.notification_devices;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  if p_token is null or pg_catalog.length(pg_catalog.btrim(p_token)) < 20
     or pg_catalog.length(p_token) > 4096 then raise exception 'Geçersiz bildirim tokenı'; end if;
  if p_platform not in ('android','web') then raise exception 'Geçersiz platform'; end if;
  if p_app_variant not in ('admin','staff') then raise exception 'Geçersiz uygulama'; end if;
  if p_app_variant='admin' and not public.is_admin() then raise exception 'Yönetici uygulaması yetkisi gerekli'; end if;
  if p_app_variant='staff' and not public.is_staff() then raise exception 'Personel uygulaması yetkisi gerekli'; end if;

  insert into public.notification_devices(
    user_id,token,platform,push_type,app_variant,active,last_seen_at,updated_at,subscription_updated_at
  )
  values(
    auth.uid(),pg_catalog.btrim(p_token),p_platform,'fcm',p_app_variant,true,
    pg_catalog.now(),pg_catalog.now(),pg_catalog.now()
  )
  on conflict (user_id,token,app_variant) do update
    set platform=excluded.platform,
        push_type='fcm',
        active=true,
        last_seen_at=pg_catalog.now(),
        updated_at=pg_catalog.now(),
        subscription_updated_at=pg_catalog.now()
  returning * into r;

  return r;
end;
$$;

revoke all on function public.register_notification_device(text,text,text) from public, anon;
grant execute on function public.register_notification_device(text,text,text) to authenticated;

alter table public.notifications
  add column if not exists push_dispatch_token uuid default pg_catalog.gen_random_uuid(),
  add column if not exists push_dispatched_at timestamptz,
  add column if not exists push_attempt_count integer not null default 0,
  add column if not exists push_last_attempt_at timestamptz,
  add column if not exists push_next_attempt_at timestamptz not null default pg_catalog.now(),
  add column if not exists push_claim_token uuid,
  add column if not exists push_claimed_at timestamptz,
  add column if not exists push_last_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.notifications'::regclass
      and conname='notifications_push_attempt_count_check'
  ) then
    alter table public.notifications
      add constraint notifications_push_attempt_count_check
      check (push_attempt_count between 0 and 6);
  end if;
end;
$$;

create index if not exists notifications_push_retry_due_idx
  on public.notifications(push_next_attempt_at,id)
  where push_dispatched_at is null and push_attempt_count < 6;

commit;
