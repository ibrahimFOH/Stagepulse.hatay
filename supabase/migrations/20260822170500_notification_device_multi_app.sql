-- Allow the same physical browser/device token to be registered for both
-- Stagepulse Admin and Stagepulse Staff sessions without moving ownership.
-- The authenticated session remains the owner of each registration.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notification_devices'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (token)'
  LOOP
    EXECUTE format('ALTER TABLE public.notification_devices DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS notification_devices_user_token_variant_uidx
  ON public.notification_devices(user_id, token, app_variant);

CREATE OR REPLACE FUNCTION public.register_notification_device(
  p_token text,
  p_platform text,
  p_app_variant text
)
RETURNS public.notification_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE r public.notification_devices;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Oturum gerekli'; END IF;
  IF length(trim(coalesce(p_token,''))) < 20 THEN RAISE EXCEPTION 'Geçersiz bildirim tokenı'; END IF;
  IF p_platform NOT IN ('android','web') THEN RAISE EXCEPTION 'Geçersiz platform'; END IF;
  IF p_app_variant NOT IN ('admin','staff') THEN RAISE EXCEPTION 'Geçersiz uygulama'; END IF;
  IF p_app_variant='admin' AND NOT private.is_admin() THEN RAISE EXCEPTION 'Yönetici uygulaması yetkisi gerekli'; END IF;
  IF p_app_variant='staff' AND NOT public.is_staff() THEN RAISE EXCEPTION 'Personel uygulaması yetkisi gerekli'; END IF;

  INSERT INTO public.notification_devices(user_id,token,platform,app_variant,active,last_seen_at,updated_at)
  VALUES(auth.uid(),trim(p_token),p_platform,p_app_variant,true,now(),now())
  ON CONFLICT (user_id, token, app_variant) DO UPDATE
    SET platform=excluded.platform,
        active=true,
        last_seen_at=now(),
        updated_at=now()
  RETURNING * INTO r;
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.register_notification_device(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_notification_device(text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
