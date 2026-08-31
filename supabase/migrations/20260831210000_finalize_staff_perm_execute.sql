begin;

-- Finalize legacy compatibility helpers so existing admin/portal code can call them
-- while authorization is evaluated only through canonical organization RBAC.
create or replace function private.staff_has_exact_perm(p_key text)
returns boolean
language sql
stable
security definer
set search_path to 'public, pg_temp'
as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.org_roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.active = true
      and r.active = true
      and r.code = 'owner'
  )
  or exists (
    select 1
    from public.org_memberships m
    join public.org_roles r on r.id = m.role_id
    join public.admin_capability_grants g on g.user_id = m.user_id and g.enabled = true
    join public.admin_capabilities c on c.key = g.capability_key and c.active = true
    where m.user_id = auth.uid()
      and m.active = true
      and r.active = true
      and c.key = p_key
  );
$$;

create or replace function private.staff_has_perm(p_keys text[])
returns boolean
language sql
stable
security definer
set search_path to 'public, pg_temp'
as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.org_roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.active = true
      and r.active = true
      and r.code = 'owner'
  )
  or exists (
    select 1
    from public.org_memberships m
    join public.org_roles r on r.id = m.role_id
    join public.admin_capability_grants g on g.user_id = m.user_id and g.enabled = true
    join public.admin_capabilities c on c.key = g.capability_key and c.active = true
    where m.user_id = auth.uid()
      and m.active = true
      and r.active = true
      and g.capability_key = any(p_keys)
  );
$$;

create or replace function public.staff_has_exact_perm(p_key text)
returns boolean
language sql
stable
security definer
set search_path to 'public, pg_temp'
as $$ select private.staff_has_exact_perm(p_key); $$;

create or replace function public.staff_has_perm(p_keys text[])
returns boolean
language sql
stable
security definer
set search_path to 'public, pg_temp'
as $$ select private.staff_has_perm(p_keys); $$;

create or replace function public.staff_has_perm(perm text)
returns boolean
language sql
stable
security definer
set search_path to 'public, pg_temp'
as $$ select private.staff_has_exact_perm(perm); $$;

revoke all on function public.staff_has_perm(text) from public, anon;
revoke all on function public.staff_has_perm(text[]) from public, anon;
revoke all on function public.staff_has_exact_perm(text) from public, anon;
grant execute on function public.staff_has_perm(text) to authenticated;
grant execute on function public.staff_has_perm(text[]) to authenticated;
grant execute on function public.staff_has_exact_perm(text) to authenticated;

revoke all on function private.staff_has_perm(text[]) from public, anon;
revoke all on function private.staff_has_exact_perm(text) from public, anon;
grant execute on function private.staff_has_perm(text[]) to authenticated;
grant execute on function private.staff_has_exact_perm(text) to authenticated;

notify pgrst, 'reload schema';
commit;