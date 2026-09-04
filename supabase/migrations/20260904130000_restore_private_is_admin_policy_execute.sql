begin;
-- RLS policies evaluate private.is_admin() under the authenticated caller.
-- SECURITY DEFINER protects the implementation, while EXECUTE is still
-- required for PostgreSQL to evaluate the policy expression.
grant execute on function private.is_admin() to authenticated;
revoke execute on function private.is_admin() from anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
commit;
