begin;

grant execute on function public.staff_capability(text) to anon, authenticated;
grant execute on function public.staff_capabilities(uuid) to anon, authenticated;
grant execute on function public.get_my_staff_permissions() to authenticated;
grant execute on function public.get_my_staff_profile() to authenticated;

create or replace function public.staff_capabilities(p_user_id uuid default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_object_agg(pc.key,coalesce(sp.enabled,false)),'{}'::jsonb)
  from public.permission_catalog pc
  left join public.staff_permissions sp on sp.permission_key=pc.key and sp.user_id=case when private.is_admin() then coalesce(p_user_id,auth.uid()) else auth.uid() end
  where pc.active=true;
$$;
grant execute on function public.staff_capabilities(uuid) to anon, authenticated;

drop function if exists public.staff_update_offer_event_date(uuid,date);
create function public.staff_update_offer_event_date(p_offer_id uuid,p_event_date date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old_date date; v_delta integer; v_is_admin boolean:=private.is_admin(); v_can_manage boolean; v_has_assignment boolean; v_job_count integer:=0;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  if p_event_date is null then raise exception 'Etkinlik tarihi gerekli'; end if;
  select event_date into v_old_date from public.teklifler where id=p_offer_id for update;
  if v_old_date is null then raise exception 'Teklif bulunamadı'; end if;
  v_can_manage:=v_is_admin or public.staff_has_perm('offers.manage') or public.staff_has_perm('schedule.manage');
  if not v_can_manage then raise exception 'Etkinlik tarihi değiştirme yetkiniz yok'; end if;
  if not v_is_admin and not public.staff_has_perm('offers.manage') then
    select exists(select 1 from public.job_staff js join public.staff s on s.id=js.staff_id join public.jobs j on j.id=js.job_id where j.offer_id=p_offer_id and s.user_id=auth.uid() and s.active=true) into v_has_assignment;
    if not v_has_assignment then raise exception 'Bu etkinlik size atanmış değil'; end if;
  end if;
  v_delta:=p_event_date-v_old_date;
  update public.teklifler set event_date=p_event_date,updated_at=now() where id=p_offer_id;
  update public.settlements set event_date=p_event_date,updated_at=now() where offer_id=p_offer_id;
  if v_delta<>0 then
    update public.jobs set setup_at=case when setup_at is null then null else setup_at+make_interval(days=>v_delta) end,event_at=case when event_at is null then null else event_at+make_interval(days=>v_delta) end,teardown_at=case when teardown_at is null then null else teardown_at+make_interval(days=>v_delta) end where offer_id=p_offer_id;
    get diagnostics v_job_count=row_count;
  end if;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'event_date_changed','teklif',p_offer_id,jsonb_build_object('old_event_date',v_old_date,'new_event_date',p_event_date,'delta_days',v_delta,'jobs_shifted',v_job_count));
  return jsonb_build_object('ok',true,'offer_id',p_offer_id,'old_event_date',v_old_date,'event_date',p_event_date,'jobs_shifted',v_job_count);
end;
$$;
grant execute on function public.staff_update_offer_event_date(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;