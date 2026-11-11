CREATE OR REPLACE FUNCTION private._api_get_public_quote(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_token IS NULL
      OR length(p_token) <> 64
      OR p_token !~ '^[0-9a-fA-F]{64}$'
      THEN NULL::jsonb
    ELSE (
      SELECT to_jsonb(q)
      FROM public.public_quotes q
      WHERE q.public_token = lower(p_token)
      LIMIT 1
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION private._api_respond_to_quote(p_token text, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  r public.teklifler;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  IF p_token IS NULL
     OR length(p_token) <> 64
     OR p_token !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'Quote not found, expired, or already answered';
  END IF;

  UPDATE public.teklifler
  SET status = p_action,
      accepted_at = CASE WHEN p_action = 'accepted' THEN now() ELSE accepted_at END,
      rejected_at = CASE WHEN p_action = 'rejected' THEN now() ELSE rejected_at END,
      updated_at = now()
  WHERE public_token = lower(p_token)
    AND valid_until >= current_date
    AND status NOT IN ('accepted', 'rejected', 'cancelled', 'archived', 'expired')
  RETURNING * INTO r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found, expired, or already answered';
  END IF;

  INSERT INTO public.notifications(kind, title, body, offer_id)
  VALUES (
    'quote_response',
    'Teklif yanıtı',
    coalesce(r.quote_number, 'Teklif') || ' müşteriden ' || p_action || ' yanıtı aldı.',
    r.id
  );

  RETURN jsonb_build_object('ok', true, 'status', r.status, 'quote_number', r.quote_number);
END;
$function$;
