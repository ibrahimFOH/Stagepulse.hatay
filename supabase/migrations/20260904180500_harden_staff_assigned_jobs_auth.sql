-- Harden the authenticated staff job RPC to fail closed for anonymous callers.
-- Keep SECURITY DEFINER because the function reads protected job-assignment data.
create or replace function public.staff_assigned_jobs()
returns setof public.jobs
language sql
stable
security definer
set search_path = ''
as $$
  select j.*
  from public.jobs j
  join public.job_staff js on js.job_id=j.id
  join public.staff s on s.id=js.staff_id
  where auth.uid() is not null
    and s.user_id=auth.uid()
    and s.active=true
  order by j.event_at nulls last,j.created_at desc
$$;
revoke execute on function public.staff_assigned_jobs() from public;
grant execute on function public.staff_assigned_jobs() to authenticated;
