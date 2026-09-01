begin;

-- RLS policies and SECURITY DEFINER helper functions still require EXECUTE
-- for the caller's role. Keep these helpers inaccessible to anon/public while
-- allowing authenticated admin/staff sessions to evaluate the existing RLS.
revoke execute on function private.is_admin() from anon, public;
revoke execute on function private.is_org_owner() from anon, public;
revoke execute on function private.is_active_staff() from anon, public;
revoke execute on function private.staff_has_exact_perm(text) from anon, public;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_org_owner() to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.staff_has_exact_perm(text) to authenticated;

notify pgrst, 'reload schema';
commit;
