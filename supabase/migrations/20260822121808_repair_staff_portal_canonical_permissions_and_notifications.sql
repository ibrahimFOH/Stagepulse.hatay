-- Repair the live staff portal against the canonical permission catalog.
create or replace view public.my_jobs_staff as
select
  j.id,j.title,j.setup_at,j.event_at,j.teardown_at,j.location,j.status,j.notes,j.created_at,
  js.response_status,js.response_note,js.responded_at,js.fee,
  j.event_start_at,j.event_end_at,j.setup_start_at,j.teardown_end_at
from public.jobs j
join public.job_staff js on js.job_id=j.id
join public.staff s on s.id=js.staff_id
where s.user_id=(select auth.uid()) and s.active=true and public.staff_has_perm('schedule.view');

grant select on public.my_jobs_staff to authenticated;

create or replace function public.staff_respond_job(p_job_id uuid,p_response text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff_id uuid; v_row public.job_staff%rowtype;
begin
 if not public.is_staff() then raise exception 'Yetkisiz'; end if;
 if p_response not in ('accepted','rejected') then raise exception 'Geçersiz cevap'; end if;
 if p_response='accepted' and not public.staff_has_perm('jobs.accept') then raise exception 'İş kabul yetkiniz yok'; end if;
 if p_response='rejected' and not public.staff_has_perm('jobs.reject') then raise exception 'İş red yetkiniz yok'; end if;
 select s.id into v_staff_id from public.staff s where s.user_id=(select auth.uid()) and s.active=true limit 1;
 if v_staff_id is null then raise exception 'Personel kaydı bulunamadı'; end if;
 update public.job_staff set response_status=p_response,response_note=nullif(trim(p_note),''),responded_at=now(),updated_at=now() where job_id=p_job_id and staff_id=v_staff_id returning * into v_row;
 if not found then raise exception 'Bu iş size atanmamış'; end if;
 insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values((select auth.uid()),'job_staff_response','job_staff',p_job_id,jsonb_build_object('response',p_response));
 return jsonb_build_object('ok',true,'job_id',p_job_id,'response',p_response,'responded_at',v_row.responded_at);
end;
$$;
revoke all on function public.staff_respond_job(uuid,text,text) from public;
grant execute on function public.staff_respond_job(uuid,text,text) to authenticated;

create or replace function public.staff_update_job_status(p_job_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff_id uuid; v_exists boolean;
begin
 if not public.is_staff() then raise exception 'Yetkisiz'; end if;
 if not public.staff_has_perm('jobs.status.update') then raise exception 'İş durumu güncelleme yetkiniz yok'; end if;
 if p_status not in ('planned','confirmed','in_progress','done','cancelled') then raise exception 'Geçersiz iş durumu'; end if;
 select s.id into v_staff_id from public.staff s where s.user_id=(select auth.uid()) and s.active=true limit 1;
 if v_staff_id is null then raise exception 'Personel kaydı bulunamadı'; end if;
 select exists(select 1 from public.job_staff js where js.job_id=p_job_id and js.staff_id=v_staff_id) into v_exists;
 if not v_exists then raise exception 'Bu iş size atanmamış'; end if;
 update public.jobs set status=p_status,updated_at=now() where id=p_job_id;
 insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values((select auth.uid()),'job_status_updated','jobs',p_job_id,jsonb_build_object('status',p_status));
 return jsonb_build_object('ok',true,'job_id',p_job_id,'status',p_status);
end;
$$;
revoke all on function public.staff_update_job_status(uuid,text) from public;
grant execute on function public.staff_update_job_status(uuid,text) to authenticated;

create or replace function public.staff_update_job_notes(p_job_id uuid,p_notes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_staff_id uuid; v_exists boolean;
begin
 if not public.is_staff() then raise exception 'Yetkisiz'; end if;
 if not public.staff_has_perm('jobs.notes.update') then raise exception 'İş notu güncelleme yetkiniz yok'; end if;
 select s.id into v_staff_id from public.staff s where s.user_id=(select auth.uid()) and s.active=true limit 1;
 if v_staff_id is null then raise exception 'Personel kaydı bulunamadı'; end if;
 select exists(select 1 from public.job_staff js where js.job_id=p_job_id and js.staff_id=v_staff_id) into v_exists;
 if not v_exists then raise exception 'Bu iş size atanmamış'; end if;
 update public.jobs set notes=left(coalesce(p_notes,''),4000),updated_at=now() where id=p_job_id;
 insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values((select auth.uid()),'job_notes_updated','jobs',p_job_id,jsonb_build_object('length',length(coalesce(p_notes,''))));
 return jsonb_build_object('ok',true,'job_id',p_job_id);
end;
$$;
revoke all on function public.staff_update_job_notes(uuid,text) from public;
grant execute on function public.staff_update_job_notes(uuid,text) to authenticated;

-- Staff can mark only their own notifications read/delete; admins retain full access.
drop policy if exists notifications_staff_update on public.notifications;
create policy notifications_staff_update on public.notifications for update to authenticated using (recipient_user_id=(select auth.uid()) and public.staff_has_perm('notifications.view')) with check (recipient_user_id=(select auth.uid()) and public.staff_has_perm('notifications.view'));
drop policy if exists notifications_staff_delete on public.notifications;
create policy notifications_staff_delete on public.notifications for delete to authenticated using (recipient_user_id=(select auth.uid()) and public.staff_has_perm('notifications.view'));

drop policy if exists notification_devices_admin_select on public.notification_devices;
create policy notification_devices_admin_select on public.notification_devices for select to authenticated using (private.is_admin());
drop policy if exists notification_devices_admin_delete on public.notification_devices;
create policy notification_devices_admin_delete on public.notification_devices for delete to authenticated using (private.is_admin());

-- Repair obsolete capability helpers so they use canonical staff_permissions only.
create or replace function public.admin_set_staff_capability(p_user_id uuid,p_capability text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Yetkisiz'; end if;
 if not exists(select 1 from public.staff_profiles where user_id=p_user_id and role<>'admin') then raise exception 'Personel hesabı bulunamadı'; end if;
 if not exists(select 1 from public.permission_catalog where key=p_capability and active=true) then raise exception 'Geçersiz yetki'; end if;
 insert into public.staff_permissions(user_id,permission_key,enabled,updated_at) values(p_user_id,p_capability,p_enabled,now()) on conflict(user_id,permission_key) do update set enabled=excluded.enabled,updated_at=now();
 return jsonb_build_object('ok',true,'user_id',p_user_id,'permission',p_capability,'enabled',p_enabled);
end;
$$;
revoke all on function public.admin_set_staff_capability(uuid,text,boolean) from public;
grant execute on function public.admin_set_staff_capability(uuid,text,boolean) to service_role;

create or replace function public.admin_set_staff_capabilities(p_user_id uuid,p_permissions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Yetkisiz'; end if;
 if not exists(select 1 from public.staff_profiles where user_id=p_user_id and role<>'admin') then raise exception 'Personel hesabı bulunamadı'; end if;
 if jsonb_typeof(coalesce(p_permissions,'{}'::jsonb))<>'object' then raise exception 'Geçersiz yetki verisi'; end if;
 delete from public.staff_permissions where user_id=p_user_id;
 insert into public.staff_permissions(user_id,permission_key,enabled,updated_at)
 select p_user_id,pc.key,coalesce((p_permissions->pc.key)::boolean,false),now() from public.permission_catalog pc where pc.active=true;
 return jsonb_build_object('ok',true,'user_id',p_user_id);
end;
$$;
revoke all on function public.admin_set_staff_capabilities(uuid,jsonb) from public;
grant execute on function public.admin_set_staff_capabilities(uuid,jsonb) to service_role;
