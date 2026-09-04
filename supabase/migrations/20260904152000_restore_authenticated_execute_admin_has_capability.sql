begin;

-- Public admin RPCs are invoked by authenticated clients and enforce
-- authorization through this SECURITY DEFINER helper. The helper itself must
-- remain unavailable to anon/public while executable by authenticated users.
grant execute on function private.admin_has_capability(text) to authenticated;
revoke execute on function private.admin_has_capability(text) from anon;

commit;
