-- Prevent direct staff access to other staff members' assignment fees.
-- Staff can read only their own assigned rows through the authenticated portal.
DROP POLICY IF EXISTS job_staff_staff_select ON public.job_staff;
CREATE POLICY job_staff_staff_select ON public.job_staff
FOR SELECT TO authenticated
USING (
  (SELECT private._api_staff_has_perm('jobs'))
  AND EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.staff_profiles sp
      ON sp.user_id = (SELECT auth.uid())
     AND sp.active = true
     AND lower(sp.display_name) = lower(s.name)
     AND (
       sp.phone IS NULL
       OR s.phone IS NULL
       OR regexp_replace(sp.phone, '[^0-9]', '', 'g')
          = regexp_replace(s.phone, '[^0-9]', '', 'g')
     )
    WHERE s.id = job_staff.staff_id
      AND s.active = true
  )
);

-- Prevent direct staff UPDATE on arbitrary jobs. The status/notes RPCs enforce
-- assignment ownership; admin direct edits remain available via jobs_admin.
DROP POLICY IF EXISTS jobs_staff_update ON public.jobs;

CREATE OR REPLACE VIEW public.my_jobs_staff
WITH (security_invoker = true)
AS
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
  ON sp.user_id = (SELECT auth.uid())
 AND sp.active = true
 AND lower(sp.display_name) = lower(s.name)
 AND (
   sp.phone IS NULL
   OR s.phone IS NULL
   OR regexp_replace(sp.phone, '[^0-9]', '', 'g')
      = regexp_replace(s.phone, '[^0-9]', '', 'g')
 )
WHERE s.active = true
  AND private._api_staff_has_perm('jobs');

GRANT SELECT ON public.my_jobs_staff TO authenticated;
NOTIFY pgrst, 'reload schema';
