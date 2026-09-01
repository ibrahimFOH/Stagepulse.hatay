-- Keep the REST-facing RPC names stable while moving SECURITY DEFINER implementations
-- out of the exposed public schema. The public wrappers are SECURITY INVOKER.

BEGIN;

ALTER FUNCTION public.register_notification_device(text,text,text) SET SCHEMA private;
ALTER FUNCTION private.register_notification_device(text,text,text) RENAME TO register_notification_device_impl;

ALTER FUNCTION public.staff_respond_job(uuid,text,text) SET SCHEMA private;
ALTER FUNCTION private.staff_respond_job(uuid,text,text) RENAME TO staff_respond_job_impl;

ALTER FUNCTION public.staff_update_job_status(uuid,text) SET SCHEMA private;
ALTER FUNCTION private.staff_update_job_status(uuid,text) RENAME TO staff_update_job_status_impl;

ALTER FUNCTION public.staff_update_job_notes(uuid,text) SET SCHEMA private;
ALTER FUNCTION private.staff_update_job_notes(uuid,text) RENAME TO staff_update_job_notes_impl;

REVOKE ALL ON FUNCTION private.register_notification_device_impl(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.staff_respond_job_impl(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.staff_update_job_status_impl(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.staff_update_job_notes_impl(uuid,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.register_notification_device_impl(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_respond_job_impl(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_update_job_status_impl(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_update_job_notes_impl(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_notification_device(p_token text,p_platform text,p_app_variant text)
RETURNS public.notification_devices
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $$ SELECT private.register_notification_device_impl(p_token,p_platform,p_app_variant); $$;

CREATE OR REPLACE FUNCTION public.staff_respond_job(p_job_id uuid,p_response text,p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $$ SELECT private.staff_respond_job_impl(p_job_id,p_response,p_note); $$;

CREATE OR REPLACE FUNCTION public.staff_update_job_status(p_job_id uuid,p_status text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $$ SELECT private.staff_update_job_status_impl(p_job_id,p_status); $$;

CREATE OR REPLACE FUNCTION public.staff_update_job_notes(p_job_id uuid,p_notes text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $$ SELECT private.staff_update_job_notes_impl(p_job_id,p_notes); $$;

REVOKE ALL ON FUNCTION public.register_notification_device(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_respond_job(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_update_job_status(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_update_job_notes(uuid,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.register_notification_device(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_respond_job(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_job_status(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_job_notes(uuid,text) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
