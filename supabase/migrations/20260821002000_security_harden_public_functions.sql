-- Stagepulse security hardening.
-- Admin authorization is kept in a non-exposed schema so it can be used by RLS
-- without being callable through the public API.

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_profiles p
    where p.user_id = auth.uid()
      and p.active = true
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%is_admin()%' or
        coalesce(with_check, '') ilike '%is_admin()%'
      )
  loop
    if r.qual is not null then
      execute format(
        'alter policy %I on %I.%I using (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        replace(r.qual, 'is_admin()', 'private.is_admin()')
      );
    end if;

    if r.with_check is not null then
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        r.policyname,
        r.schemaname,
        r.tablename,
        replace(r.with_check, 'is_admin()', 'private.is_admin()')
      );
    end if;
  end loop;
end $$;

revoke all on function public.is_admin() from public;
drop function public.is_admin();

-- Public quote access is served only by the hardened Edge Function.
revoke all on function public.get_public_quote(text) from public;
revoke all on function public.respond_to_quote(text, text) from public;
