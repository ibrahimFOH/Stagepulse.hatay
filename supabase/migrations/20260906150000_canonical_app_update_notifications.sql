create or replace function public.dispatch_app_update_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_body text;
  v_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    v_changed := new.apk_version is not null;
  else
    v_changed := coalesce(new.version_code,new.apk_version) is distinct from coalesce(old.version_code,old.apk_version)
      or new.minimum_version is distinct from old.minimum_version
      or new.apk_url is distinct from old.apk_url
      or new.apk_sha256 is distinct from old.apk_sha256;
  end if;
  if not v_changed then return new; end if;

  v_title := case when lower(coalesce(new.platform,''))='admin' then 'Stagepulse Yönetim güncellemesi' else 'Stagepulse Personel güncellemesi' end;
  v_body := 'Yeni APK sürümü hazır: ' || coalesce(new.web_version, new.version_code::text, new.apk_version::text, 'yeni sürüm') || '. Uygulama güncellemesini kontrol edin.';

  insert into public.notifications(recipient_user_id,kind,title,body)
  select distinct m.user_id,'app_update',v_title,v_body
  from public.org_memberships m
  where m.active = true
    and m.user_id is not null;

  return new;
exception when others then
  raise warning 'app update notification failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_app_update_notification on public.app_versions;
create trigger trg_app_update_notification
after insert or update of apk_version,version_code,minimum_version,apk_url,apk_sha256,web_version
on public.app_versions
for each row execute function public.dispatch_app_update_notification();
