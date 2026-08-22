-- Stagepulse notification registration hardening.
-- register_notification_device is SECURITY DEFINER and must not depend on the
-- private schema because authenticated callers intentionally have no private
-- schema USAGE/EXECUTE privileges.
CREATE OR REPLACE FUNCTION public.register_notification_device(
  p_token text,
  p_platform text,
  p_app_variant text
)
RETURNS public.notification_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.notification_devices;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum gerekli';
  END IF;

  IF length(trim(coalesce(p_token, ''))) < 20 THEN
    RAISE EXCEPTION 'Geçersiz bildirim tokenı';
  END IF;

  IF p_platform NOT IN ('android', 'web') THEN
    RAISE EXCEPTION 'Geçersiz platform';
  END IF;

  IF p_app_variant NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Geçersiz uygulama';
  END IF;

  -- IMPORTANT: use the public authorizer. private.is_admin() is deliberately
  -- inaccessible to authenticated callers by the private-schema hardening
  -- migration and caused the historical "permission denied for function
  -- is_admin" failure during device registration.
  IF p_app_variant = 'admin' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yönetici uygulaması yetkisi gerekli';
  END IF;

  IF p_app_variant = 'staff' AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Personel uygulaması yetkisi gerekli';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notification_devices d
    WHERE d.token = trim(p_token)
      AND d.user_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Bu bildirim cihazı başka bir hesaba bağlı';
  END IF;

  INSERT INTO public.notification_devices(
    user_id, token, platform, app_variant, active, last_seen_at, updated_at
  )
  VALUES (
    auth.uid(), trim(p_token), p_platform, p_app_variant, true, now(), now()
  )
  ON CONFLICT(token) DO UPDATE
    SET platform = excluded.platform,
        app_variant = excluded.app_variant,
        active = true,
        last_seen_at = now(),
        updated_at = now()
  RETURNING * INTO r;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.register_notification_device(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_notification_device(text, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
