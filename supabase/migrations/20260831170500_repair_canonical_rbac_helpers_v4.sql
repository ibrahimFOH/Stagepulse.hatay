begin;

-- Canonical admin identity: active organization membership + admin role.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path to 'public, pg_temp'
as $$
  select exists (
    select 1 from public.org_memberships m
    join public.org_roles r on r.id=m.role_id
    where m.user_id=auth.uid() and m.active=true and r.active=true
      and coalesce(r.is_admin_role,false)=true
  );
$$;

create or replace function private.is_active_staff()
returns boolean language sql stable security definer set search_path to 'public, pg_temp'
as $$ select exists (select 1 from public.org_memberships where user_id=auth.uid() and active=true); $$;

create or replace function private.staff_has_exact_perm(p_key text)
returns boolean language sql stable security definer set search_path to 'public, pg_temp'
as $$
  with actor as (
    select m.user_id,r.code role_code from public.org_memberships m
    join public.org_roles r on r.id=m.role_id and r.active=true
    where m.user_id=auth.uid() and m.active=true
  )
  select exists(select 1 from actor where role_code='owner') or exists(
    select 1 from actor a
    join public.admin_capability_grants g on g.user_id=a.user_id and g.enabled=true
    join public.admin_capabilities c on c.key=g.capability_key and c.active=true
    where g.capability_key=p_key
  );
$$;

create or replace function private.staff_has_perm(p_keys text[])
returns boolean language sql stable security definer set search_path to 'public, pg_temp'
as $$
  with actor as (
    select m.user_id,r.code role_code from public.org_memberships m
    join public.org_roles r on r.id=m.role_id and r.active=true
    where m.user_id=auth.uid() and m.active=true
  )
  select exists(select 1 from actor where role_code='owner') or exists(
    select 1 from actor a
    join public.admin_capability_grants g on g.user_id=a.user_id and g.enabled=true
    join public.admin_capabilities c on c.key=g.capability_key and c.active=true
    where g.capability_key=any(p_keys)
  );
$$;

create or replace function public.staff_has_exact_perm(p_key text)
returns boolean language sql stable security definer set search_path to 'public, pg_temp'
as $$ select private.staff_has_exact_perm(p_key); $$;

create or replace function public.staff_has_perm(p_keys text[])
returns boolean language sql stable security definer set search_path to 'public, pg_temp'
as $$ select private.staff_has_perm(p_keys); $$;

create or replace function public.staff_has_perm(perm text)
returns boolean language sql stable security definer set search_path to 'public, pg_temp'
as $$ select private.staff_has_exact_perm(perm); $$;

revoke all on function private.is_admin() from anon, public;
revoke all on function private.is_active_staff() from anon, public;
revoke all on function private.is_org_owner() from anon, public;
revoke all on function private.staff_has_exact_perm(text) from anon, public;
revoke all on function private.staff_has_perm(text[]) from anon, public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_org_owner() to authenticated;
grant execute on function private.staff_has_exact_perm(text) to authenticated;
grant execute on function private.staff_has_perm(text[]) to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_org_owner() to authenticated;
grant execute on function public.staff_has_exact_perm(text) to authenticated;
grant execute on function public.staff_has_perm(text[]) to authenticated;
grant execute on function public.staff_has_perm(text) to authenticated;
notify pgrst,'reload schema';
commit;