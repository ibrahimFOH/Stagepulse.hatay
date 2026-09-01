CREATE OR REPLACE FUNCTION public.offer_update_event_date(p_offer_id uuid,p_event_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_date date; delta interval; u uuid:=auth.uid(); r public.teklifler; j public.jobs; job_count integer:=0;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Oturum gerekli'; END IF;
 IF NOT (public.staff_has_perm('schedule.manage') OR public.staff_has_perm('offers.update') OR private.is_admin()) THEN RAISE EXCEPTION 'Etkinlik tarihi düzenleme yetkisi gerekli'; END IF;
 IF p_event_date IS NULL THEN RAISE EXCEPTION 'Etkinlik tarihi gerekli'; END IF;
 SELECT * INTO r FROM public.teklifler WHERE id=p_offer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Teklif bulunamadı'; END IF;
 old_date:=r.event_date; IF old_date IS NULL THEN delta:=interval '0'; ELSE delta:=make_interval(days=>(p_event_date-old_date)); END IF;
 PERFORM set_config('stagepulse.skip_event_sync','on',true); UPDATE public.teklifler SET event_date=p_event_date,updated_at=now() WHERE id=p_offer_id RETURNING * INTO r; PERFORM set_config('stagepulse.skip_event_sync','off',true);
 UPDATE public.settlements SET event_date=p_event_date,updated_at=now() WHERE offer_id=p_offer_id;
 FOR j IN SELECT * FROM public.jobs WHERE offer_id=p_offer_id FOR UPDATE LOOP
  UPDATE public.jobs SET setup_at=CASE WHEN j.setup_at IS NULL THEN NULL ELSE j.setup_at+delta END,event_at=CASE WHEN j.event_at IS NULL THEN NULL ELSE j.event_at+delta END,teardown_at=CASE WHEN j.teardown_at IS NULL THEN NULL ELSE j.teardown_at+delta END,setup_start_at=CASE WHEN j.setup_start_at IS NULL THEN NULL ELSE j.setup_start_at+delta END,event_start_at=CASE WHEN j.event_start_at IS NULL THEN NULL ELSE j.event_start_at+delta END,event_end_at=CASE WHEN j.event_end_at IS NULL THEN NULL ELSE j.event_end_at+delta END,teardown_end_at=CASE WHEN j.teardown_end_at IS NULL THEN NULL ELSE j.teardown_end_at+delta END WHERE id=j.id;
  job_count:=job_count+1;
  INSERT INTO public.notifications(recipient_user_id,kind,title,body,offer_id) SELECT s.user_id,'event_change','Etkinlik tarihi değişti','Etkinlik tarihi güncellendi.',p_offer_id FROM public.job_staff js JOIN public.staff s ON s.id=js.staff_id WHERE js.job_id=j.id AND s.active=true AND s.user_id IS NOT NULL;
 END LOOP;
 INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,metadata) VALUES(u,'event_date_changed','teklifler',p_offer_id,jsonb_build_object('old_date',old_date,'new_date',p_event_date,'jobs_updated',job_count));
 RETURN jsonb_build_object('offer_id',p_offer_id,'old_date',old_date,'new_date',p_event_date,'jobs_updated',job_count);
END; $$;
