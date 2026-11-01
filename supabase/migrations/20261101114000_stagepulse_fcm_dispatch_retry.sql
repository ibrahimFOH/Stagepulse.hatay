begin;

-- Stagepulse FCM dispatch pipeline.
-- Uses the current production project URL; do not reuse historical retired URLs.
create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table if not exists public.notification_push_dead_letters (
  notification_id bigint primary key references public.notifications(id) on delete cascade,
  attempt_count integer not null,
  last_error text,
  failed_at timestamptz not null default now(),
  replay_count integer not null default 0,
  last_replayed_at timestamptz,
  constraint notification_push_dead_letters_attempt_check check (attempt_count >= 6),
  constraint notification_push_dead_letters_replay_check check (replay_count >= 0)
);

create index if not exists notification_push_dead_letters_failed_idx
  on public.notification_push_dead_letters (failed_at desc, notification_id);

alter table public.notification_push_dead_letters enable row level security;
revoke all on public.notification_push_dead_letters from public, anon, authenticated;
grant select on public.notification_push_dead_letters to authenticated;

drop policy if exists notification_push_dead_letters_operator_select
  on public.notification_push_dead_letters;
create policy notification_push_dead_letters_operator_select
  on public.notification_push_dead_letters
  for select to authenticated
  using (public.is_admin());

create or replace function private.sync_notification_push_dead_letter()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.push_dispatched_at is not null or new.push_attempt_count < 6 then
    delete from public.notification_push_dead_letters
    where notification_id = new.id;
  else
    insert into public.notification_push_dead_letters (
      notification_id, attempt_count, last_error, failed_at
    )
    values (
      new.id,
      new.push_attempt_count,
      new.push_last_error,
      coalesce(new.push_last_attempt_at, now())
    )
    on conflict (notification_id) do update
      set attempt_count = excluded.attempt_count,
          last_error = excluded.last_error,
          failed_at = excluded.failed_at;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_notification_push_dead_letter() from public, anon, authenticated;

drop trigger if exists trg_notification_push_dead_letter on public.notifications;
create trigger trg_notification_push_dead_letter
after insert or update of push_attempt_count, push_dispatched_at, push_last_error
on public.notifications
for each row execute function private.sync_notification_push_dead_letter();

insert into public.notification_push_dead_letters (
  notification_id, attempt_count, last_error, failed_at
)
select
  n.id,
  n.push_attempt_count,
  n.push_last_error,
  coalesce(n.push_last_attempt_at, n.created_at, now())
from public.notifications n
where n.push_dispatched_at is null
  and n.push_attempt_count >= 6
on conflict (notification_id) do update
  set attempt_count = excluded.attempt_count,
      last_error = excluded.last_error,
      failed_at = excluded.failed_at;

create or replace function private.enqueue_notification_push(p_notification_id bigint)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, private, net, pg_temp
as $$
declare
  v_token uuid;
  v_request_id bigint;
begin
  update public.notifications n
  set push_dispatch_token = gen_random_uuid(),
      push_attempt_count = n.push_attempt_count + 1,
      push_last_attempt_at = now(),
      push_next_attempt_at = now() + make_interval(
        secs => least(900, (30 * power(2, n.push_attempt_count))::integer)
      ),
      push_claim_token = null,
      push_claimed_at = null
  where n.id = p_notification_id
    and n.push_dispatched_at is null
    and n.push_attempt_count < 6
    and n.push_next_attempt_at <= now()
    and (n.push_claimed_at is null or n.push_claimed_at < now() - interval '5 minutes')
  returning n.push_dispatch_token into v_token;

  if v_token is null then
    return null;
  end if;

  begin
    select net.http_post(
      url := 'https://itasctyjzyewcykozuex.supabase.co/functions/v1/send-fcm-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'notification_id', p_notification_id,
        'dispatch_token', v_token
      ),
      timeout_milliseconds := 5000
    ) into v_request_id;
  exception when others then
    update public.notifications
    set push_last_error = left('pg_net enqueue failed: ' || sqlerrm, 2000),
        push_next_attempt_at = now() + interval '1 minute'
    where id = p_notification_id
      and push_dispatch_token = v_token
      and push_dispatched_at is null;
    return null;
  end;

  return v_request_id;
end;
$$;

create or replace function private.retry_notification_pushes()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, net, pg_temp
as $$
declare
  v_id bigint;
  v_queued integer := 0;
begin
  for v_id in
    select n.id
    from public.notifications n
    where n.push_dispatched_at is null
      and n.push_attempt_count < 6
      and n.push_next_attempt_at <= now()
      and (n.push_claimed_at is null or n.push_claimed_at < now() - interval '5 minutes')
    order by n.push_next_attempt_at, n.id
    for update skip locked
    limit 50
  loop
    if private.enqueue_notification_push(v_id) is not null then
      v_queued := v_queued + 1;
    end if;
  end loop;
  return v_queued;
end;
$$;

revoke all on function private.enqueue_notification_push(bigint) from public, anon, authenticated;
revoke all on function private.retry_notification_pushes() from public, anon, authenticated;

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, net, pg_temp
as $$
begin
  perform private.enqueue_notification_push(new.id);
  return new;
exception when others then
  raise warning 'Stagepulse notification push enqueue failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.dispatch_notification_push() from public, anon, authenticated;

drop trigger if exists trg_notification_push_dispatch on public.notifications;
create trigger trg_notification_push_dispatch
after insert on public.notifications
for each row execute function public.dispatch_notification_push();

create or replace function public.admin_replay_notification_push(p_notification_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, net, pg_temp
as $$
declare
  v_replay_count integer;
  v_request_id bigint;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode = '42501';
  end if;

  update public.notification_push_dead_letters
  set replay_count = replay_count + 1,
      last_replayed_at = now()
  where notification_id = p_notification_id
  returning replay_count into v_replay_count;

  if v_replay_count is null then
    raise exception 'Dead-letter bildirimi bulunamadı.';
  end if;

  update public.notifications
  set push_attempt_count = 0,
      push_next_attempt_at = now(),
      push_claim_token = null,
      push_claimed_at = null,
      push_last_error = null,
      push_dispatch_token = gen_random_uuid()
  where id = p_notification_id
    and push_dispatched_at is null;

  if not found then
    delete from public.notification_push_dead_letters
    where notification_id = p_notification_id;
    raise exception 'Bildirim zaten gönderilmiş veya artık mevcut değil.';
  end if;

  v_request_id := private.enqueue_notification_push(p_notification_id);

  return jsonb_build_object(
    'notification_id', p_notification_id,
    'replay_count', v_replay_count,
    'request_id', v_request_id,
    'queued', v_request_id is not null
  );
end;
$$;

revoke all on function public.admin_replay_notification_push(bigint) from public, anon, authenticated;
grant execute on function public.admin_replay_notification_push(bigint) to authenticated;

select cron.schedule(
  'stagepulse-notification-push-retry',
  '* * * * *',
  'select private.retry_notification_pushes();'
);

comment on function public.dispatch_notification_push() is
  'PROTECTED CORE: queues notification delivery through the current Stagepulse FCM Edge Function.';
comment on function private.retry_notification_pushes() is
  'PROTECTED CORE: retries pending FCM deliveries with bounded exponential backoff and skip-locked row claims.';
comment on function public.admin_replay_notification_push(bigint) is
  'Admin-only replay of terminal FCM failures; resets bounded retry state and queues a new delivery attempt.';
comment on table public.notification_push_dead_letters is
  'Admin-visible terminal FCM delivery failures after six attempts.';

commit;
