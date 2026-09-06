begin;

-- Canonical notification recipient resolution: organization membership + role/capability.
-- Legacy admin_profiles/staff_profiles are intentionally not authorization sources.

create or replace function public.register_notification_device(p_token text, p_platform text, p_app_variant text)
returns public.notification_devices
language plpgsql
security definer
set search_path = 'public','pg_temp'
as $$
declare r public.notification_devices;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  if length(trim(coalesce(p_token,''))) < 20 then raise exception 'Geçersiz bildirim tokenı'; end if;
  if p_platform not in ('android','web') then raise exception 'Geçersiz platform'; end if;
  if p_app_variant not in ('admin','staff') then raise exception 'Geçersiz uygulama'; end if;
  if not exists (select 1 from public.org_memberships m join public.org_roles r on r.id=m.role_id and r.active=true where m.user_id=auth.uid() and m.active=true and (p_app_variant='staff' or coalesce(r.is_admin_role,false)=true)) then raise exception 'Uygulama yetkisi gerekli'; end if;
  insert into public.notification_devices(user_id,token,platform,app_variant,active,last_seen_at,updated_at)
  values(auth.uid(),trim(p_token),p_platform,p_app_variant,true,now(),now())
  on conflict (user_id, token, app_variant) do update set platform=excluded.platform,active=true,last_seen_at=now(),updated_at=now()
  returning * into r;
  return r;
end;
$$;
revoke all on function public.register_notification_device(text,text,text) from public, anon;
grant execute on function public.register_notification_device(text,text,text) to authenticated;

create or replace function public.dispatch_business_notification()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); title text; body text; changed boolean:=false;
begin
  if tg_table_name='teklifler' then
    if tg_op='INSERT' then
      title:='Yeni teklif talebi'; body:=coalesce(new.quote_number,'Yeni teklif')||' - '||coalesce(new.name,'');
      insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
      select distinct m.user_id,'new_quote',title,body,new.id from public.org_memberships m join public.org_roles r on r.id=m.role_id and r.active=true
      where m.active=true and m.user_id is distinct from actor and (coalesce(r.is_admin_role,false)=true or r.code='owner' or exists(select 1 from public.admin_capability_grants g join public.admin_capabilities c on c.key=g.capability_key and c.active=true where g.user_id=m.user_id and g.enabled=true and c.key in ('offers.view','offers.manage','offers.evaluate','admin.offers.view')));
      return new;
    end if;
    changed:=(to_jsonb(new)-array['updated_at','event_date','evaluation_status','evaluated_by','evaluated_at','accepted_at','rejected_at','archived_at']) is distinct from (to_jsonb(old)-array['updated_at','event_date','evaluation_status','evaluated_by','evaluated_at','accepted_at','rejected_at','archived_at']);
    if not changed then return new; end if;
    title:='Teklif güncellendi'; body:=coalesce(new.quote_number,'Teklif')||' üzerinde değişiklik yapıldı.';
    insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
    select distinct x.user_id,'offer_change',title,body,new.id from (
      select m.user_id from public.org_memberships m join public.org_roles r on r.id=m.role_id and r.active=true where m.active=true and m.user_id is distinct from actor and coalesce(r.is_admin_role,false)=true
      union select s.user_id from public.job_staff js join public.staff s on s.id=js.staff_id join public.jobs j on j.id=js.job_id where j.offer_id=new.id and s.active=true and s.user_id is not null and s.user_id is distinct from actor
      union select m.user_id from public.org_memberships m where m.active=true and m.user_id is distinct from actor and exists(select 1 from public.admin_capability_grants g join public.admin_capabilities c on c.key=g.capability_key and c.active=true where g.user_id=m.user_id and g.enabled=true and c.key in ('offers.view','offers.manage','offers.evaluate','admin.offers.view'))
    ) x;
    return new;
  end if;
  if tg_table_name='jobs' then
    changed:=(to_jsonb(new)-array['updated_at','setup_at','event_at','teardown_at','event_start_at','event_end_at','setup_start_at','teardown_end_at']) is distinct from (to_jsonb(old)-array['updated_at','setup_at','event_at','teardown_at','event_start_at','event_end_at','setup_start_at','teardown_end_at']);
    if not changed then return new; end if;
    title:='İş güncellendi'; body:=coalesce(new.title,'İş')||' üzerinde değişiklik yapıldı.';
    insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
    select distinct x.user_id,'job_change',title,body,new.offer_id from (
      select m.user_id from public.org_memberships m join public.org_roles r on r.id=m.role_id and r.active=true where m.active=true and m.user_id is distinct from actor and coalesce(r.is_admin_role,false)=true
      union select s.user_id from public.job_staff js join public.staff s on s.id=js.staff_id where js.job_id=new.id and s.active=true and s.user_id is not null and s.user_id is distinct from actor
    ) x;
    return new;
  end if;
  if tg_table_name='equipment' then
    changed:=(to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at');
    if not changed then return new; end if;
    insert into public.notifications(recipient_user_id,kind,title,body)
    select distinct m.user_id,'equipment_change','Ekipman güncellendi','Ekipman kaydı güncellendi.' from public.org_memberships m where m.active=true and m.user_id is distinct from actor;
  end if;
  return new;
exception when others then raise warning 'business notification failed: %',sqlerrm; return new;
end;
$$;
revoke all on function public.dispatch_business_notification() from public,anon,authenticated;

drop trigger if exists trg_quote_new_notification on public.teklifler;
drop trigger if exists trg_quote_after_notify on public.teklifler;
drop trigger if exists trg_offer_change_notification on public.teklifler;
drop trigger if exists trg_business_change_offer on public.teklifler;
drop trigger if exists trg_job_change_notification on public.jobs;
drop trigger if exists trg_business_change_jobs on public.jobs;
drop trigger if exists trg_notify_business_change_equipment on public.equipment;
create trigger trg_business_notification_offer after insert or update on public.teklifler for each row execute function public.dispatch_business_notification();
create trigger trg_business_notification_job after update on public.jobs for each row execute function public.dispatch_business_notification();
create trigger trg_business_notification_equipment after update on public.equipment for each row execute function public.dispatch_business_notification();

commit;
