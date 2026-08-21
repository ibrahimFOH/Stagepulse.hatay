-- Stagepulse production fix: RLS policies call public.is_admin().
-- Keep the function SECURITY DEFINER and expose execution only to signed-in users.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles p
    where p.user_id = auth.uid()
      and p.active = true
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
