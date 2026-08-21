-- Stagepulse: restore the staff jobs view used by /portal.
-- Additive migration: no tables or existing files are removed.

create or replace view public.my_jobs_staff as
select
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
from public.jobs j
join public.job_staff js on js.job_id = j.id
join public.staff s on s.id = js.staff_id
join public.staff_profiles sp on sp.user_id = s.user_id
where sp.user_id = auth.uid()
  and sp.active = true
  and s.active = true
  and public.staff_has_perm('jobs');

grant select on public.my_jobs_staff to authenticated;

notify pgrst, 'reload schema';
