begin;

-- org_visible_staff intentionally reads auth.users but exposes only the rows
-- returned by the role-scoped org_visible_member_ids helper. Keep the API
-- function authenticated-only and execute it with the definer's catalog access.
create or replace function public.org_visible_staff()
returns table(
  user_id uuid,
  username text,
  display_name text,
  role text,
  department_id uuid,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    coalesce(u.raw_user_meta_data->>'username', split_part(u.email,'@',1)),
    coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', ''),
    r.code,
    m.department_id,
    m.active
  from auth.users u
  join public.org_memberships m on m.user_id=u.id and m.active=true
  join public.org_roles r on r.id=m.role_id and r.active=true
  where u.id in (select user_id from public.org_visible_member_ids(auth.uid()));
$$;

revoke all on function public.org_visible_staff() from public, anon, authenticated;
grant execute on function public.org_visible_staff() to authenticated;

notify pgrst, 'reload schema';
commit;
