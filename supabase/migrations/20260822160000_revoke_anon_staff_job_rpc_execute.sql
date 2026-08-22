-- Security hardening: staff-only job RPCs must never be callable by anon.
REVOKE EXECUTE ON FUNCTION public.staff_respond_job(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_update_job_status(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_update_job_notes(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_respond_job(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_job_status(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_job_notes(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
