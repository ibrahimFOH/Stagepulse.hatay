-- Restore authenticated admin access after Supabase restore/ACL drift.
-- RLS remains enabled and is the authorization boundary. Table grants only
-- permit the authenticated role to reach the policies; they do not bypass RLS.

begin;

grant select, insert, update, delete on table public.teklifler to authenticated;

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

grant execute on function private.is_admin() to authenticated;
revoke execute on function private.is_admin() from anon;

commit;
