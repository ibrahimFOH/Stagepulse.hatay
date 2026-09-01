DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.teklifler; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.customers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.payments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.settlements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION public.offer_update_event_date(p_offer_id uuid,p_event_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_date date; u uuid:=auth.uid(); r public.teklifler;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Oturum gerekli'; END IF;
  IF NOT (public.staff_has_perm('schedule.manage') OR public.staff_has_perm('offers.update') OR private.is_admin()) THEN RAISE EXCEPTION 'Etkinlik tarihi düzenleme yetkisi gerekli'; END IF;
  IF p_event_date IS NULL THEN RAISE EXCEPTION 'Etkinlik tarihi gerekli'; END IF;
  SELECT * INTO r FROM public.teklifler WHERE id=p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teklif bulunamadı'; END IF;
  old_date:=r.event_date;
  UPDATE public.teklifler SET event_date=p_event_date,updated_at=now() WHERE id=p_offer_id RETURNING * INTO r;
  RETURN jsonb_build_object('offer_id',r.id,'old_date',old_date,'new_date',r.event_date);
END; $$;

CREATE OR REPLACE FUNCTION public.notify_business_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); actor_is_admin boolean := coalesce(private.is_admin(), false); title text; body text; changed boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' OR u IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='teklifler' THEN
    changed := (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at');
    IF changed AND (to_jsonb(NEW)-'updated_at'-'event_date') IS NOT DISTINCT FROM (to_jsonb(OLD)-'updated_at'-'event_date') THEN changed := false; END IF;
    title := 'Teklif güncellendi'; body := coalesce(NEW.quote_number,'Teklif') || ' için bilgiler güncellendi.';
    IF changed THEN
      IF actor_is_admin THEN
        INSERT INTO public.notifications(recipient_user_id,kind,title,body,offer_id)
        SELECT s.user_id,'offer_change',title,body,NEW.id FROM public.jobs j JOIN public.job_staff js ON js.job_id=j.id JOIN public.staff s ON s.id=js.staff_id WHERE j.offer_id=NEW.id AND s.active=true AND s.user_id IS NOT NULL AND s.user_id<>u;
      ELSE
        INSERT INTO public.notifications(recipient_user_id,kind,title,body,offer_id)
        SELECT ap.user_id,'offer_change',title,body,NEW.id FROM public.admin_profiles ap WHERE ap.active=true AND ap.user_id IS NOT NULL AND ap.user_id<>u;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='jobs' THEN
    changed := (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at'); title := 'İş güncellendi'; body := coalesce(NEW.title,'İş') || ' için bilgiler güncellendi.';
    IF changed THEN
      IF actor_is_admin THEN
        INSERT INTO public.notifications(recipient_user_id,kind,title,body,offer_id)
        SELECT s.user_id,'job_change',title,body,NEW.offer_id FROM public.job_staff js JOIN public.staff s ON s.id=js.staff_id WHERE js.job_id=NEW.id AND s.active=true AND s.user_id IS NOT NULL AND s.user_id<>u;
      ELSE
        INSERT INTO public.notifications(recipient_user_id,kind,title,body,offer_id)
        SELECT ap.user_id,'job_change',title,body,NEW.offer_id FROM public.admin_profiles ap WHERE ap.active=true AND ap.user_id IS NOT NULL AND ap.user_id<>u;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='equipment' THEN
    changed := (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at'); title := 'Ekipman güncellendi'; body := 'Ekipman kaydı güncellendi.';
    IF changed THEN
      IF actor_is_admin THEN
        INSERT INTO public.notifications(recipient_user_id,kind,title,body) SELECT sp.user_id,'equipment_change',title,body FROM public.staff_profiles sp WHERE sp.active=true AND sp.user_id IS NOT NULL AND sp.user_id<>u;
      ELSE
        INSERT INTO public.notifications(recipient_user_id,kind,title,body) SELECT ap.user_id,'equipment_change',title,body FROM public.admin_profiles ap WHERE ap.active=true AND ap.user_id IS NOT NULL AND ap.user_id<>u;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'business change notification failed: %', sqlerrm; RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_business_change_offer ON public.teklifler;
CREATE TRIGGER trg_notify_business_change_offer AFTER UPDATE ON public.teklifler FOR EACH ROW EXECUTE FUNCTION public.notify_business_change();
DROP TRIGGER IF EXISTS trg_notify_business_change_job ON public.jobs;
CREATE TRIGGER trg_notify_business_change_job AFTER UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.notify_business_change();
DROP TRIGGER IF EXISTS trg_notify_business_change_equipment ON public.equipment;
CREATE TRIGGER trg_notify_business_change_equipment AFTER UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.notify_business_change();
