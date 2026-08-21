CREATE OR REPLACE FUNCTION public.sync_offer_validity_compat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.validity_until IS NOT NULL THEN
      NEW.valid_until := (NEW.validity_until AT TIME ZONE 'Europe/Istanbul')::date;
    ELSIF NEW.valid_until IS NOT NULL THEN
      NEW.validity_until := NEW.valid_until::timestamp AT TIME ZONE 'Europe/Istanbul';
    END IF;
  ELSE
    IF NEW.valid_until IS DISTINCT FROM OLD.valid_until THEN
      NEW.validity_until := CASE
        WHEN NEW.valid_until IS NULL THEN NULL
        ELSE NEW.valid_until::timestamp AT TIME ZONE 'Europe/Istanbul'
      END;
    ELSIF NEW.validity_until IS DISTINCT FROM OLD.validity_until THEN
      NEW.valid_until := CASE
        WHEN NEW.validity_until IS NULL THEN NULL
        ELSE (NEW.validity_until AT TIME ZONE 'Europe/Istanbul')::date
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
