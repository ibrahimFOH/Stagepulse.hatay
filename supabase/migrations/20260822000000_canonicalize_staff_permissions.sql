begin;

-- Keep one canonical permission namespace for staff portal access.
-- Legacy *_view keys remain inactive for compatibility; runtime authorization
-- resolves through the canonical dotted keys only.

create or replace function public.staff_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.staff_has_perm(p_capability);
$$;

revoke all on function public.staff_capability(text) from public;
grant execute on function public.staff_capability(text) to authenticated;

-- Make the staff permission helper safe for direct PostgREST RPC calls.
create or replace function public.staff_has_perm(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_permissions sp
    join public.permission_catalog pc on pc.key = sp.permission_key and pc.active = true
    join public.staff_profiles s on s.user_id = sp.user_id and s.active = true
    where sp.user_id = auth.uid()
      and sp.enabled = true
      and sp.permission_key = p_permission
  );
$$;

revoke all on function public.staff_has_perm(text) from public;
grant execute on function public.staff_has_perm(text) to authenticated;

-- Remove duplicate permissive staff self-read policy; admin policy remains.
drop policy if exists staff_permissions_self_read on public.staff_permissions;

-- Avoid duplicate staff SELECT policies for the same actor while preserving
-- admin access and the authenticated user's own active profile.
drop policy if exists staff_self_select on public.staff;
create policy staff_self_select
on public.staff
for select
to authenticated
using (user_id = auth.uid() and active = true);

-- Keep assigned-job access tied to the canonical schedule.view permission.
drop policy if exists jobs_staff_assigned_select on public.jobs;
create policy jobs_staff_assigned_select
on public.jobs
for select
to authenticated
using (
  public.staff_has_perm('schedule.view')
  and exists (
    select 1
    from public.job_staff js
    join public.staff s on s.id = js.staff_id
    where js.job_id = jobs.id
      and s.user_id = auth.uid()
      and s.active = true
  )
);

-- Ensure the staff compatibility view obeys caller RLS.
alter view public.my_jobs_staff set (security_invoker = true);
grant select on public.my_jobs_staff to authenticated;

-- Index the foreign-key permission lookup used by staff_has_perm().
create index if not exists staff_permissions_user_permission_idx
  on public.staff_permissions (user_id, permission_key)
  where enabled = true;

notify pgrst, 'reload schema';
commit;
