begin;

-- Browser/RLS compatibility wrapper.
-- Keep the canonical authority in private.is_admin(); expose only a safe
-- authenticated public RPC because the admin portal calls public.is_admin().
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
