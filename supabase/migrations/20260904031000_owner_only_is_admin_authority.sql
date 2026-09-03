begin;

-- Canonical authority: Patron / Owner is the only unconditional admin.
-- CEO, Super Admin and delegated staff use capability-based authorization.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_org_owner();
$$;

revoke all on function private.is_admin() from public, anon, authenticated;

-- Browser/RLS compatibility wrapper. Never expose this to anonymous callers.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

commit;
