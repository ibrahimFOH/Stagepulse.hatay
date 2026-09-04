begin;

-- Keep public.is_admin() as the authenticated compatibility gate used by
-- existing RLS policies. It must represent an active admin role, not only
-- the Owner account; Owner-only operations are enforced separately by the
-- org-admin-control Edge Function and private.is_org_owner().
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.org_roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.active = true
      and r.active = true
      and r.is_admin_role = true
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;

-- Browser/RLS compatibility wrapper. Never expose this to anonymous callers.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

commit;
