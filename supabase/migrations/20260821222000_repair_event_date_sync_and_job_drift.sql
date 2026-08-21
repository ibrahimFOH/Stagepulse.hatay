CREATE OR REPLACE FUNCTION public.sync_offer_event_date_to_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE delta interval; j public.jobs;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.event_date IS NOT DISTINCT FROM OLD.event_date THEN RETURN NEW; END IF;
  IF coalesce(current_setting('stagepulse.skip_event_sync', true), '') = 'on' THEN RETURN NEW; END IF;
  IF OLD.event_date IS NULL THEN delta := interval '0'; ELSE delta := make_interval(days => (NEW.event_date - OLD.event_date)); END IF;
  UPDATE public.settlements SET event_date = NEW.event_date, updated_at = now() WHERE offer_id = NEW.id;
  FOR j IN SELECT * FROM public.jobs WHERE offer_id = NEW.id FOR UPDATE LOOP
    UPDATE public.jobs
       SET setup_at = CASE WHEN j.setup_at IS NULL THEN NULL ELSE j.setup_at + delta END,
           event_at = CASE WHEN j.event_at IS NULL THEN NULL ELSE j.event_at + delta END,
           teardown_at = CASE WHEN j.teardown_at IS NULL THEN NULL ELSE j.teardown_at + delta END,
           setup_start_at = CASE WHEN j.setup_start_at IS NULL THEN NULL ELSE j.setup_start_at + delta END,
           event_start_at = CASE WHEN j.event_start_at IS NULL THEN NULL ELSE j.event_start_at + delta END,
           event_end_at = CASE WHEN j.event_end_at IS NULL THEN NULL ELSE j.event_end_at + delta END,
           teardown_end_at = CASE WHEN j.teardown_end_at IS NULL THEN NULL ELSE j.teardown_end_at + delta END
     WHERE id = j.id;
    INSERT INTO public.notifications(recipient_user_id, kind, title, body, offer_id)
    SELECT s.user_id, 'event_change', 'Etkinlik tarihi değişti', 'Etkinlik tarihi güncellendi.', NEW.id
      FROM public.job_staff js JOIN public.staff s ON s.id = js.staff_id
     WHERE js.job_id = j.id AND s.active = true AND s.user_id IS NOT NULL;
  END LOOP;
  INSERT INTO public.activity_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'event_date_changed', 'teklifler', NEW.id,
          jsonb_build_object('old_date', OLD.event_date, 'new_date', NEW.event_date, 'jobs_synced', true));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_event_date_sync ON public.teklifler;
CREATE TRIGGER trg_offer_event_date_sync AFTER UPDATE OF event_date ON public.teklifler
FOR EACH ROW EXECUTE FUNCTION public.sync_offer_event_date_to_jobs();

CREATE OR REPLACE FUNCTION public.offer_update_event_date(p_offer_id uuid, p_event_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_date date; u uuid := auth.uid(); r public.teklifler;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Oturum gerekli'; END IF;
  IF NOT (public.staff_has_perm('schedule.manage') OR public.staff_has_perm('offers.update') OR private.is_admin()) THEN RAISE EXCEPTION 'Etkinlik tarihi düzenleme yetkisi gerekli'; END IF;
  IF p_event_date IS NULL THEN RAISE EXCEPTION 'Etkinlik tarihi gerekli'; END IF;
  SELECT * INTO r FROM public.teklifler WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teklif bulunamadı'; END IF;
  old_date := r.event_date;
  PERFORM set_config('stagepulse.skip_event_sync', 'on', true);
  UPDATE public.teklifler SET event_date = p_event_date, updated_at = now() WHERE id = p_offer_id RETURNING * INTO r;
  PERFORM set_config('stagepulse.skip_event_sync', 'off', true);
  RETURN jsonb_build_object('offer_id', r.id, 'old_date', old_date, 'new_date', r.event_date);
END;
$$;

UPDATE public.jobs j
SET setup_at = CASE WHEN j.setup_at IS NULL THEN NULL ELSE j.setup_at + make_interval(days => (o.event_date - j.setup_at::date)) END,
    event_at = CASE WHEN j.event_at IS NULL THEN NULL ELSE j.event_at + make_interval(days => (o.event_date - j.event_at::date)) END,
    teardown_at = CASE WHEN j.teardown_at IS NULL THEN NULL ELSE j.teardown_at + make_interval(days => (o.event_date - j.teardown_at::date)) END,
    setup_start_at = CASE WHEN j.setup_start_at IS NULL THEN NULL ELSE j.setup_start_at + make_interval(days => (o.event_date - j.setup_start_at::date)) END,
    event_start_at = CASE WHEN j.event_start_at IS NULL THEN NULL ELSE j.event_start_at + make_interval(days => (o.event_date - j.event_start_at::date)) END,
    event_end_at = CASE WHEN j.event_end_at IS NULL THEN NULL ELSE j.event_end_at + make_interval(days => (o.event_date - j.event_end_at::date)) END,
    teardown_end_at = CASE WHEN j.teardown_end_at IS NULL THEN NULL ELSE j.teardown_end_at + make_interval(days => (o.event_date - j.teardown_end_at::date)) END
FROM public.teklifler o
WHERE j.offer_id = o.id AND o.event_date IS NOT NULL AND o.status = 'accepted';

UPDATE public.settlements s SET event_date = o.event_date, updated_at = now()
FROM public.teklifler o
WHERE s.offer_id = o.id AND o.event_date IS NOT NULL AND s.event_date IS DISTINCT FROM o.event_date;
