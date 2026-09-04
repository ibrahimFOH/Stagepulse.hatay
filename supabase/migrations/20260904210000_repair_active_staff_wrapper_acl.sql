begin;

-- Keep the browser-facing helper invoker-safe while delegating protected table
-- access to the canonical private SECURITY DEFINER implementation. This helper
-- is referenced by RLS policies, so authenticated must retain EXECUTE access.
create or replace function public.is_active_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_active_staff();
$$;

revoke all on function public.is_active_staff() from public, anon, authenticated;
grant execute on function public.is_active_staff() to authenticated;

notify pgrst, 'reload schema';
commit;
