-- Unified RBAC: job visibility is driven by organization roles + admin capabilities.
begin;

create or replace function public.staff_has_exact_perm(p_key text)
returns boolean language sql stable security definer set search_path='public, private' as $$
  select exists (
    select 1
    from public.admin_capability_grants g
    join public.admin_capabilities c on c.key=g.capability_key and c.active=true
    where g.user_id=auth.uid()
      and g.enabled=true
      and (g.capability_key=p_key or g.capability_key=replace(p_key,'.view','.read'))
  )
  or exists (
    select 1
    from public.org_memberships m
    join public.org_roles r on r.id=m.role_id and r.active=true
    where m.user_id=auth.uid() and m.active=true and r.code='owner'
  );
$$;
revoke all on function public.staff_has_exact_perm(text) from public,anon;
grant execute on function public.staff_has_exact_perm(text) to authenticated;

create or replace function public.staff_list_jobs()
returns setof public.jobs language plpgsql stable security definer set search_path='public, private' as $$
begin
  if public.staff_has_exact_perm('owner') then return query select j.* from public.jobs j order by j.event_at nulls last,j.created_at desc nulls last; return; end if;
  if not public.is_active_staff() then return; end if;
  if public.staff_has_exact_perm('jobs.view') or public.staff_has_exact_perm('schedule.view') or public.staff_has_exact_perm('schedule.manage') then
    return query select j.* from public.jobs j order by j.event_at nulls last,j.created_at desc nulls last; return;
  end if;
  if public.staff_has_exact_perm('jobs.assigned.view') then
    return query select j.* from public.jobs j join public.job_assignments ja on ja.job_id=j.id where ja.user_id=auth.uid() order by j.event_at nulls last,j.created_at desc nulls last;
  end if;
end;
$$;
revoke all on function public.staff_list_jobs() from public,anon;
grant execute on function public.staff_list_jobs() to authenticated;

drop policy if exists jobs_staff_select on public.jobs;
create policy jobs_staff_select on public.jobs for select to authenticated using (
  (exists (select 1 from public.org_memberships m join public.org_roles r on r.id=m.role_id where m.user_id=auth.uid() and m.active=true and r.code='owner'))
  or (public.is_active_staff() and (
    public.staff_has_exact_perm('jobs.view') or
    public.staff_has_exact_perm('schedule.view') or
    public.staff_has_exact_perm('schedule.manage') or
    (public.staff_has_exact_perm('jobs.assigned.view') and exists(select 1 from public.job_assignments ja where ja.job_id=jobs.id and ja.user_id=auth.uid()))
  ))
);

notify pgrst,'reload schema';
commit;
