begin;

-- Regression guard: public.is_admin() is used by existing RLS policies and
-- must authorize active admin roles (Owner, Super Admin, Upper Admin, etc.).
-- Owner-only actions remain protected by private.is_org_owner() and the
-- org-admin-control Edge Function.
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
