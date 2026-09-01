-- PROTECTED CORE
-- Restores the production notification -> FCM dispatch path without changing
-- staff/admin RBAC. New offers must continue to create notifications for active
-- admins and staff with offers.view, then dispatch each notification to FCM.

create extension if not exists pg_net with schema extensions;

alter table public.notifications
  add column if not exists push_dispatch_token uuid default gen_random_uuid(),
  add column if not exists push_dispatched_at timestamptz;

update public.notifications
set push_dispatch_token = gen_random_uuid()
where push_dispatch_token is null;

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = 'public','extensions'
as $$
begin
  if new.push_dispatch_token is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://mtjcqqrogjqaxkagwkti.supabase.co/functions/v1/send-fcm-notification',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object(
      'notification_id', new.id,
      'dispatch_token', new.push_dispatch_token
    )
  );
  return new;
exception when others then
  raise warning 'Stagepulse protected notification push dispatch failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notification_push_dispatch on public.notifications;
create trigger trg_notification_push_dispatch
after insert on public.notifications
for each row execute function public.dispatch_notification_push();

-- Keep exactly one offer-created notification trigger. The current production
-- implementation of on_quote_after_notify selects active admins plus staff
-- whose offers.view permission is enabled.
drop trigger if exists trg_new_offer_notification on public.teklifler;
create trigger trg_new_offer_notification
after insert on public.teklifler
for each row execute function public.on_quote_after_notify();

comment on function public.dispatch_notification_push() is
'PROTECTED CORE: dispatches every newly-created Stagepulse notification to the FCM Edge Function. Do not couple this function to staff RBAC UI changes.';
