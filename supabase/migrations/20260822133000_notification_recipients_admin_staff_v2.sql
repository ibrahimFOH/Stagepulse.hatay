create or replace function public.on_quote_after_notify() returns trigger language plpgsql security definer set search_path to '' as $$ begin
  insert into public.notifications(kind,title,body,offer_id,recipient_user_id)
  select 'new_quote','Yeni teklif talebi',coalesce(new.quote_number,'Yeni teklif')||' - '||coalesce(new.name,''),new.id,r.user_id
  from (
    select ap.user_id from public.admin_profiles ap where ap.active=true
    union
    select sp.user_id from public.staff_profiles sp
    join public.staff_permissions perm on perm.user_id=sp.user_id and perm.permission_key='offers.view' and perm.enabled=true
    where sp.active=true
  ) r;
  return new;
exception when others then raise warning 'notification insert failed: %', sqlerrm; return new; end $$;

create or replace function public.ensure_job_for_accepted_quote() returns trigger language plpgsql security definer set search_path to '' as $$
declare v_job_id uuid; v_event_at timestamptz;
begin
  if new.status <> 'accepted' then return new; end if;
  v_event_at := coalesce(new.event_start_at,new.event_date::timestamp at time zone 'Europe/Istanbul');
  select id into v_job_id from public.jobs where offer_id=new.id limit 1;
  if v_job_id is null then
    insert into public.jobs(offer_id,title,event_at,location,status,notes,event_start_at,event_end_at,setup_start_at,teardown_end_at)
    values(new.id,coalesce(nullif(trim(new.event_type),''),nullif(trim(new.type),''),'Etkinlik')||' — '||coalesce(nullif(trim(new.name),''),new.quote_number,'Teklif'),v_event_at,new.location,'pending',new.message,new.event_start_at,new.event_end_at,null,null);
    insert into public.notifications(kind,title,body,offer_id,recipient_user_id)
    select 'job_created','Yeni iş oluşturuldu',coalesce(new.quote_number,'Teklif')||' kabul edildi ve iş kaydı oluşturuldu.',new.id,r.user_id
    from (
      select ap.user_id from public.admin_profiles ap where ap.active=true
      union
      select sp.user_id from public.staff_profiles sp join public.staff_permissions perm on perm.user_id=sp.user_id and perm.permission_key='jobs.view' and perm.enabled=true where sp.active=true
    ) r;
  end if;
  return new;
end $$;

create or replace function private.offer_evaluate(p_offer_id uuid,p_status text,p_note text default null) returns public.teklifler language plpgsql security definer set search_path to '' as $$
declare r public.teklifler; u uuid:=auth.uid(); v text:=lower(trim(coalesce(p_status,''))); eval_state text;
begin
 if u is null then raise exception 'Oturum gerekli'; end if;
 if not (public.staff_has_perm('offers.evaluate') or private.is_admin()) then raise exception 'Teklif değerlendirme yetkisi gerekli'; end if;
 if v not in ('accepted','rejected','reviewing') then raise exception 'Geçersiz değerlendirme durumu'; end if;
 eval_state:=case when v='reviewing' then 'evaluating' else 'completed' end;
 select * into r from public.teklifler where id=p_offer_id for update; if not found then raise exception 'Teklif bulunamadı'; end if;
 if r.evaluation_status='evaluating' and r.evaluated_by is distinct from u and not private.is_admin() then raise exception 'Teklif kilitli'; end if;
 update public.teklifler set status=case when v='accepted' then 'accepted' when v='rejected' then 'rejected' else status end,evaluation_status=eval_state,evaluated_by=u,evaluated_at=now(),rejected_at=case when v='rejected' then now() else rejected_at end,accepted_at=case when v='accepted' then now() else accepted_at end,updated_at=now() where id=p_offer_id returning * into r;
 if p_note is not null and length(trim(p_note))>0 then insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(u,'offer_evaluation_note','teklifler',p_offer_id,jsonb_build_object('note',left(p_note,4000))); end if;
 insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(u,'offer_evaluated','teklifler',p_offer_id,jsonb_build_object('status',v,'note',left(coalesce(p_note,''),4000)));
 if v in ('accepted','rejected') then
   insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
   select rcp.user_id,'offer_evaluation','Teklif güncellendi',case when v='accepted' then 'Teklif kabul edildi.' else 'Teklif reddedildi.' end,p_offer_id
   from (select ap.user_id from public.admin_profiles ap where ap.active=true and ap.user_id<>u union select sp.user_id from public.staff_profiles sp join public.staff_permissions perm on perm.user_id=sp.user_id and perm.permission_key='offers.view' and perm.enabled=true where sp.active=true and sp.user_id<>u) rcp;
 end if;
 return r;
end $$;

create or replace function private.offer_update_event_date(p_offer_id uuid,p_event_date date) returns jsonb language plpgsql security definer set search_path to '' as $$
declare old_date date; delta interval; u uuid:=auth.uid(); r public.teklifler; j public.jobs; job_count integer:=0;
begin
 if u is null then raise exception 'Oturum gerekli'; end if;
 if not (public.staff_has_perm('schedule.manage') or public.staff_has_perm('offers.update') or private.is_admin()) then raise exception 'Etkinlik tarihi düzenleme yetkisi gerekli'; end if;
 if p_event_date is null then raise exception 'Etkinlik tarihi gerekli'; end if;
 select * into r from public.teklifler where id=p_offer_id for update; if not found then raise exception 'Teklif bulunamadı'; end if;
 old_date:=r.event_date; if old_date is null then delta:=interval '0'; else delta:=make_interval(days => (p_event_date-old_date)); end if;
 perform set_config('stagepulse.skip_event_sync','on',true); update public.teklifler set event_date=p_event_date,updated_at=now() where id=p_offer_id returning * into r; perform set_config('stagepulse.skip_event_sync','off',true);
 update public.settlements set event_date=p_event_date,updated_at=now() where offer_id=p_offer_id;
 for j in select * from public.jobs where offer_id=p_offer_id for update loop
  update public.jobs set setup_at=case when j.setup_at is null then null else j.setup_at+delta end,event_at=case when j.event_at is null then null else j.event_at+delta end,teardown_at=case when j.teardown_at is null then null else j.teardown_at+delta end,setup_start_at=case when j.setup_start_at is null then null else j.setup_start_at+delta end,event_start_at=case when j.event_start_at is null then null else j.event_start_at+delta end,event_end_at=case when j.event_end_at is null then null else j.event_end_at+delta end,teardown_end_at=case when j.teardown_end_at is null then null else j.teardown_end_at+delta end where id=j.id;
  job_count:=job_count+1;
  insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
  select rcp.user_id,'event_change','Etkinlik tarihi değişti','Etkinlik tarihi güncellendi.',p_offer_id
  from (select ap.user_id from public.admin_profiles ap where ap.active=true union select s.user_id from public.job_staff js join public.staff s on s.id=js.staff_id where js.job_id=j.id and s.active=true and s.user_id is not null) rcp;
 end loop;
 insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(u,'event_date_changed','teklifler',p_offer_id,jsonb_build_object('old_date',old_date,'new_date',p_event_date,'jobs_updated',job_count));
 return jsonb_build_object('offer_id',p_offer_id,'old_date',old_date,'new_date',p_event_date,'jobs_updated',job_count);
end $$;
