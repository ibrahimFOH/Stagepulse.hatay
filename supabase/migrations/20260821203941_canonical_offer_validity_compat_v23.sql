CREATE OR REPLACE FUNCTION public.sync_offer_validity_compat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.validity_until IS NULL AND NEW.valid_until IS NOT NULL THEN
    NEW.validity_until := (NEW.valid_until::timestamp AT TIME ZONE 'Europe/Istanbul') + interval '23 hours 59 minutes 59 seconds';
  ELSIF NEW.validity_until IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.validity_until IS DISTINCT FROM OLD.validity_until) THEN
    NEW.valid_until := (NEW.validity_until AT TIME ZONE 'Europe/Istanbul')::date;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_offer_validity_compat ON public.teklifler;
CREATE TRIGGER trg_offer_validity_compat
BEFORE INSERT OR UPDATE OF valid_until, validity_until ON public.teklifler
FOR EACH ROW EXECUTE FUNCTION public.sync_offer_validity_compat();
UPDATE public.teklifler
SET validity_until = (valid_until::timestamp AT TIME ZONE 'Europe/Istanbul') + interval '23 hours 59 minutes 59 seconds'
WHERE validity_until IS NULL AND valid_until IS NOT NULL;
UPDATE public.teklifler
SET valid_until = (validity_until AT TIME ZONE 'Europe/Istanbul')::date
WHERE validity_until IS NOT NULL AND valid_until IS DISTINCT FROM (validity_until AT TIME ZONE 'Europe/Istanbul')::date;
