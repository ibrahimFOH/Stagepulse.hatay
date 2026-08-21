CREATE OR REPLACE FUNCTION public.register_notification_device(p_token text,p_platform text,p_app_variant text)
RETURNS public.notification_devices
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE r public.notification_devices;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Oturum gerekli'; END IF;
  IF length(trim(coalesce(p_token,''))) < 20 THEN RAISE EXCEPTION 'Geçersiz bildirim tokenı'; END IF;
  IF p_platform NOT IN ('android','web') THEN RAISE EXCEPTION 'Geçersiz platform'; END IF;
  IF p_app_variant NOT IN ('admin','staff') THEN RAISE EXCEPTION 'Geçersiz uygulama'; END IF;
  INSERT INTO public.notification_devices(user_id,token,platform,app_variant,active,last_seen_at,updated_at)
  VALUES(auth.uid(),trim(p_token),p_platform,p_app_variant,true,now(),now())
  ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,platform=excluded.platform,app_variant=excluded.app_variant,active=true,last_seen_at=now(),updated_at=now()
  WHERE public.notification_devices.user_id = auth.uid()
  RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Bu bildirim tokenı başka kullanıcıya ait'; END IF;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION public.register_notification_device(text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_notification_device(text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_notification_device(text,text,text) TO authenticated;
