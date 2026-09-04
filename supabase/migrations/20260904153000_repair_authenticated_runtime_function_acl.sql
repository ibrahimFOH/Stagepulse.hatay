begin;

-- Runtime authorization helpers used directly by authenticated RLS/policies.
-- Keep all of them inaccessible to anonymous callers.
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_org_owner() to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_user_assigned_to_event(uuid) to authenticated;
grant execute on function private.staff_has_perm(text[]) to authenticated;
grant execute on function private.staff_has_exact_perm(text) to authenticated;
grant execute on function private.admin_has_capability(text) to authenticated;

revoke execute on function private.is_admin() from anon;
revoke execute on function private.is_org_owner() from anon;
revoke execute on function private.is_active_staff() from anon;
revoke execute on function private.is_user_assigned_to_event(uuid) from anon;
revoke execute on function private.staff_has_perm(text[]) from anon;
revoke execute on function private.staff_has_exact_perm(text) from anon;
revoke execute on function private.admin_has_capability(text) from anon;

-- Authenticated client-facing RPCs whose bodies enforce the actual RBAC check.
grant execute on function public.current_admin_profile() to authenticated;
grant execute on function public.panel_access(text) to authenticated;
grant execute on function public.admin_org_bootstrap_check() to authenticated;
grant execute on function public.admin_update_business_settings(jsonb) to authenticated;
grant execute on function public.staff_assigned_jobs() to authenticated;
grant execute on function public.staff_list_jobs() to authenticated;
grant execute on function public.can_use_admin_capability(text,uuid) to authenticated;

revoke execute on function public.current_admin_profile() from anon;
revoke execute on function public.panel_access(text) from anon;
revoke execute on function public.admin_org_bootstrap_check() from anon;
revoke execute on function public.admin_update_business_settings(jsonb) from anon;
revoke execute on function public.staff_assigned_jobs() from anon;
revoke execute on function public.staff_list_jobs() from anon;
revoke execute on function public.can_use_admin_capability(text,uuid) from anon;

commit;
