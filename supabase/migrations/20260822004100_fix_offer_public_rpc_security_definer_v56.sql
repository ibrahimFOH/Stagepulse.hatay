CREATE OR REPLACE FUNCTION public.offer_claim_for_review(p_offer_id uuid)
RETURNS public.teklifler
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.offer_claim_for_review(p_offer_id)
$function$;

CREATE OR REPLACE FUNCTION public.offer_evaluate(p_offer_id uuid, p_status text, p_note text DEFAULT NULL::text)
RETURNS public.teklifler
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.offer_evaluate(p_offer_id,p_status,p_note)
$function$;

CREATE OR REPLACE FUNCTION public.offer_update_event_date(p_offer_id uuid, p_event_date date)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.offer_update_event_date(p_offer_id,p_event_date)
$function$;

REVOKE ALL ON FUNCTION public.offer_claim_for_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.offer_evaluate(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.offer_update_event_date(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_claim_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_evaluate(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_update_event_date(uuid,date) TO authenticated;
