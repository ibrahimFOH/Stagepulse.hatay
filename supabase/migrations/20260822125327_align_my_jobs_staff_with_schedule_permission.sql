-- Align the staff job view with the canonical runtime permission used by the portal and jobs RLS.
CREATE OR REPLACE VIEW public.my_jobs_staff AS
SELECT j.id,j.title,j.setup_at,j.event_at,j.teardown_at,j.location,j.status,j.notes,j.created_at,
       js.response_status,js.response_note,js.responded_at,js.fee,
       j.event_start_at,j.event_end_at,j.setup_start_at,j.teardown_end_at
FROM public.jobs j
JOIN public.job_staff js ON js.job_id=js.job_id
JOIN public.staff s ON s.id=js.staff_id
WHERE s.user_id=(SELECT auth.uid()) AND s.active=true AND public.staff_has_perm('schedule.view');
ALTER VIEW public.my_jobs_staff SET (security_invoker=true);
GRANT SELECT ON public.my_jobs_staff TO authenticated;
NOTIFY pgrst,'reload schema';
