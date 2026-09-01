begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Columns already consumed by the FCM registration functions, but absent from
-- the repository migration which originally created notification_devices.
alter table public.notification_devices
  add column if not exists push_type text not null default 'fcm',
  add column if not exists subscription_updated_at timestamptz;

alter table public.notification_devices
  drop constraint if exists notification_devices_push_type_check;
alter table public.notification_devices
  add constraint notification_devices_push_type_check
  check (push_type in ('fcm'));

alter table public.notifications
  add column if not exists push_dispatch_token uuid default gen_random_uuid(),
  add column if not exists push_dispatched_at timestamptz,
  add column if not exists push_attempt_count integer not null default 0,
  add column if not exists push_last_attempt_at timestamptz,
  add column if not exists push_next_attempt_at timestamptz not null default now(),
  add column if not exists push_claim_token uuid,
  add column if not exists push_claimed_at timestamptz,
  add column if not exists push_last_error text;

alter table public.notifications
  drop constraint if exists notifications_push_attempt_count_check;
alter table public.notifications
  add constraint notifications_push_attempt_count_check
  check (push_attempt_count between 0 and 6);

update public.notifications
set push_dispatch_token = gen_random_uuid()
where push_dispatch_token is null;

-- Do not replay historical notifications when retry automation is introduced.
-- Only notifications inserted after this migration start with a retry budget.
update public.notifications
set push_attempt_count = 6,
    push_next_attempt_at = now(),
    push_last_error = coalesce(push_last_error, 'Historical notification excluded from automatic retry rollout')
where push_dispatched_at is null
  and push_attempt_count = 0;

create index if not exists notifications_push_retry_due_idx
on public.notifications (push_next_attempt_at, id)
where push_dispatched_at is null and push_attempt_count < 6;

create or replace function private.enqueue_notification_push(p_notification_id bigint)
returns bigint
language plpgsql
security definer
set search_path = 'public, extensions, pg_temp'
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
    and (
      n.push_claimed_at is null
      or n.push_claimed_at < now() - interval '5 minutes'
    )
  returning n.push_dispatch_token into v_token;

  if v_token is null then
    return null;
  end if;

  begin
    select net.http_post(
      url := 'https://mtjcqqrogjqaxkagwkti.supabase.co/functions/v1/send-fcm-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'notification_id', p_notification_id,
        'dispatch_token', v_token
      )
    )
    into v_request_id;
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
set search_path = 'public, extensions, pg_temp'
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
      and (
        n.push_claimed_at is null
        or n.push_claimed_at < now() - interval '5 minutes'
      )
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
set search_path = 'public, extensions, pg_temp'
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

-- Keep the full quote payload and per-recipient fan-out, while reducing the
-- two independently-created new_quote rows/triggers to one canonical trigger.
create or replace function public.on_quote_after_notify()
returns trigger
language plpgsql
security definer
set search_path = 'public, pg_temp'
as $$
declare
  v_body text;
begin
  v_body := concat_ws(E'\n',
    'Merhaba, Stagepulse üzerinden teklif almak istiyorum.',
    '',
    'Ad Soyad / Firma: ' || coalesce(new.name, ''),
    case when nullif(new.company, '') is not null then 'Firma: ' || new.company end,
    case when nullif(new.email, '') is not null then 'E-posta: ' || new.email end,
    'Telefon: ' || coalesce(new.phone, ''),
    'Etkinlik Türü: ' || coalesce(new.event_type, ''),
    'Hizmet: ' || coalesce(new.type, ''),
    'Lokasyon: ' || coalesce(new.location, ''),
    'Katılımcı: ' || coalesce(new.people::text, ''),
    'Etkinlik Tarihi: ' || coalesce(new.event_date::text, ''),
    'Detay: ' || coalesce(new.message, '')
  );

  insert into public.notifications(
    recipient_user_id, kind, title, body, offer_id
  )
  select
    recipients.user_id,
    'new_quote',
    'Yeni teklif talebi',
    left(v_body, 4000),
    new.id
  from (
    select membership.user_id
    from public.org_memberships membership
    join public.org_roles role
      on role.id = membership.role_id
     and role.active = true
    where membership.active = true
      and membership.user_id is not null
      and (
        role.is_admin_role = true
        or exists (
          select 1
          from public.admin_capability_grants grant_row
          join public.admin_capabilities capability
            on capability.key = grant_row.capability_key
           and capability.active = true
          where grant_row.user_id = membership.user_id
            and grant_row.enabled = true
            and grant_row.capability_key = 'offers.view'
        )
      )
  ) recipients;

  return new;
exception when others then
  raise warning 'new offer notification failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_new_offer_notification on public.teklifler;
drop trigger if exists trg_quote_new_notification on public.teklifler;
create trigger trg_new_offer_notification
after insert on public.teklifler
for each row execute function public.on_quote_after_notify();

do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'stagepulse-notification-push-retry'
  ) then
    perform cron.unschedule('stagepulse-notification-push-retry');
  end if;

  perform cron.schedule(
    'stagepulse-notification-push-retry',
    '* * * * *',
    'select private.retry_notification_pushes();'
  );
end;
$$;

comment on function public.dispatch_notification_push() is
'PROTECTED CORE: queues bounded notification delivery attempts through pg_net; delivery is acknowledged only by send-fcm-notification.';

commit;