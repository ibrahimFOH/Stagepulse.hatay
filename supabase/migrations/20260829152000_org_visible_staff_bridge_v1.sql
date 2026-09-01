begin;

-- Canonical organization visibility. Authentication/profile data comes from
-- auth.users + org_memberships; staff_profiles is not an authorization source.
create or replace function public.org_visible_staff()
returns table(
  user_id uuid,
  username text,
  display_name text,
  role text,
  department_id uuid,
  active boolean
)
language sql stable security definer set search_path=public
as $$
  select u.id as user_id,
         coalesce(u.raw_user_meta_data->>'username', split_part(u.email,'@',1)) as username,
         coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', '') as display_name,
         r.code as role,
         m.department_id,
         m.active
  from auth.users u
  join public.org_memberships m on m.user_id=u.id and m.active=true
  join public.org_roles r on r.id=m.role_id and r.active=true
  where u.id in (select user_id from public.org_visible_member_ids(auth.uid()));
$$;

revoke all on function public.org_visible_staff() from public,anon,authenticated;
grant execute on function public.org_visible_staff() to authenticated;

commit;
