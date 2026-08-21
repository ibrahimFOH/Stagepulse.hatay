-- Stagepulse: align staff jobs view with canonical permissions.
-- The portal uses schedule.view as the canonical permission for assigned jobs.
-- Additive migration: no files or tables are removed.

CREATE OR REPLACE VIEW public.my_jobs_staff AS
SELECT
  j.id,
  j.title,
  j.setup_at,
  j.event_at,
  j.teardown_at,
  j.location,
  j.status,
  j.notes,
  j.created_at,
  js.response_status,
  js.response_note,
  js.responded_at,
  js.fee
FROM public.jobs j
JOIN public.job_staff js ON js.job_id = j.id
JOIN public.staff s ON s.id = js.staff_id
JOIN public.staff_profiles sp
  ON sp.user_id = auth.uid()
 AND sp.active = true
 AND s.active = true
 AND lower(sp.display_name) = lower(s.name)
WHERE public.staff_has_perm('schedule.view');

grant select on public.my_jobs_staff to authenticated;

NOTIFY pgrst, 'reload schema';
