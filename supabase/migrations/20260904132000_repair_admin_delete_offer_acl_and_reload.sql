begin;

-- Keep the browser-facing wrapper callable only by authenticated users.
revoke all on function public.admin_delete_offer(uuid) from public, anon;
grant execute on function public.admin_delete_offer(uuid) to authenticated;

-- The implementation is private and must never be directly executable by API roles.
revoke all on function private.admin_delete_offer(uuid) from public, anon, authenticated;

-- Ensure PostgREST immediately sees the final function ACL after this migration.
notify pgrst, 'reload schema';

commit;
