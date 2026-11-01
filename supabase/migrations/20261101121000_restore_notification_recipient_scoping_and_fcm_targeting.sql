begin;

-- Notifications were historically created without a recipient. Restore the
-- recipient relation required by the staff portal and the FCM sender.
alter table public.notifications
  add column if not exists recipient_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_recipient_user_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_recipient_user_id_fkey
      foreign key (recipient_user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

alter table public.notifications enable row level security;

-- Authenticated clients must not be able to forge notifications, alter their
-- payload/recipient or manipulate FCM delivery state. They may read/delete
-- only their own addressed rows and may update only read_at.
revoke all privileges on table public.notifications from authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists notifications_recipient_select on public.notifications;
create policy notifications_recipient_select
  on public.notifications
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));

drop policy if exists notifications_recipient_update on public.notifications;
create policy notifications_recipient_update
  on public.notifications
  for update to authenticated
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

drop policy if exists notifications_recipient_delete on public.notifications;
create policy notifications_recipient_delete
  on public.notifications
  for delete to authenticated
  using (recipient_user_id = (select auth.uid()));

-- A quote creates one row for every active administrator and every active
-- organization member explicitly granted offers.view. Each row has one owner,
-- which is also the routing target used by send-fcm-notification.
create or replace function public.notify_new_quote()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  insert into public.notifications (
    recipient_user_id, kind, title, body, offer_id
  )
  select distinct
    membership.user_id,
    'new_quote',
    'Yeni teklif talebi',
    coalesce(new.quote_number, 'Yeni teklif') || ' - ' || coalesce(new.name, ''),
    new.id
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
    );
  return new;
exception when others then
  raise warning 'Stagepulse quote notification creation failed: %', sqlerrm;
  return new;
end;
$$;

-- No-recipient notifications (for example, admin-only quote response notices)
-- remain available in the admin center but must never be marked as FCM-delivered.
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
    and n.recipient_user_id is not null
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
    where n.recipient_user_id is not null
      and n.push_dispatched_at is null
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

revoke all on function public.notify_new_quote() from public, anon, authenticated;

comment on function public.notify_new_quote() is
  'Creates one recipient-scoped notification per active administrator or offers.view member.';
comment on function private.enqueue_notification_push(bigint) is
  'Queues FCM only for notifications with an explicit recipient_user_id.';
comment on function private.retry_notification_pushes() is
  'Retries only recipient-addressed notification rows with bounded exponential backoff.';

commit;
