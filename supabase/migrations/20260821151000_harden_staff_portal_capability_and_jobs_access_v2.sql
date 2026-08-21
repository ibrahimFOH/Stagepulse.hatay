begin;

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

create or replace function public.staff_capabilities(p_user_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_object_agg(pc.key, coalesce(sp.enabled, false)),
    '{}'::jsonb
  )
  from public.permission_catalog pc
  left join public.staff_permissions sp
    on sp.permission_key = pc.key
   and sp.user_id = case
      when private.is_admin() then coalesce(p_user_id, auth.uid())
      else auth.uid()
    end
  where pc.active = true;
$$;

revoke all on function public.staff_capabilities(uuid) from public;
grant execute on function public.staff_capabilities(uuid) to authenticated;

drop policy if exists staff_self_select on public.staff;
create policy staff_self_select
on public.staff
for select
to authenticated
using (user_id = auth.uid() and active = true);

drop policy if exists jobs_staff_assigned_select on public.jobs;
create policy jobs_staff_assigned_select
on public.jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.job_staff js
    join public.staff s on s.id = js.staff_id
    where js.job_id = jobs.id
      and s.user_id = auth.uid()
      and s.active = true
  )
  and public.staff_has_perm('schedule.view')
);

alter view public.my_jobs_staff set (security_invoker = true);
grant select on public.my_jobs_staff to authenticated;

notify pgrst, 'reload schema';
commit;
