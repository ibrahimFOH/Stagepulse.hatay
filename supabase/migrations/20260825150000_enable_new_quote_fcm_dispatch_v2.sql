create or replace function public.dispatch_notification_push() returns trigger
language plpgsql
security definer
set search_path to 'public','extensions' as $$
begin
  perform net.http_post(
    url := 'https://mtjcqqrogjqaxkagwkti.supabase.co/functions/v1/send-fcm-notification',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'dispatch_token', NEW.push_dispatch_token
    )
  );
  return NEW;
exception when others then
  raise warning 'notification push dispatch queue failed: %', sqlerrm;
  return NEW;
end $$;
