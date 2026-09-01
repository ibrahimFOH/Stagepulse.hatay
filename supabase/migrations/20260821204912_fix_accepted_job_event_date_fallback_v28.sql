CREATE OR REPLACE FUNCTION public.ensure_job_for_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_job_id uuid; v_event_at timestamptz;
BEGIN
  IF NEW.status <> 'accepted' THEN RETURN NEW; END IF;
  v_event_at := COALESCE(NEW.event_start_at, NEW.event_date::timestamp AT TIME ZONE 'Europe/Istanbul');
  SELECT id INTO v_job_id FROM public.jobs WHERE offer_id = NEW.id LIMIT 1;
  IF v_job_id IS NULL THEN
    INSERT INTO public.jobs(offer_id,title,event_at,location,status,notes,event_start_at,event_end_at,setup_start_at,teardown_end_at)
    VALUES(NEW.id, coalesce(nullif(trim(NEW.event_type),''),nullif(trim(NEW.type),''),'Etkinlik') || ' — ' || coalesce(nullif(trim(NEW.name),''),NEW.quote_number,'Teklif'), v_event_at, NEW.location, 'pending', NEW.message, NEW.event_start_at, NEW.event_end_at, NULL, NULL);
    INSERT INTO public.notifications(kind,title,body,offer_id)
    VALUES('job_created','Yeni iş oluşturuldu',coalesce(NEW.quote_number,'Teklif')||' kabul edildi ve iş kaydı oluşturuldu.',NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
