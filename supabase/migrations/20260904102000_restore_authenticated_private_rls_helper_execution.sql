begin;

-- These SECURITY DEFINER helpers are intentionally referenced by public-schema
-- RLS policies. They remain in the private schema and are not exposed as a
-- public Data API surface, but the invoking database role needs EXECUTE while
-- PostgreSQL evaluates the policy expression.
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_org_owner() to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_user_assigned_to_event(uuid) to authenticated;

commit;
