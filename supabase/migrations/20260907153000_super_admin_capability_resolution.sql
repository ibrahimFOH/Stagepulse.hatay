begin;

create or replace function private.admin_has_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    private.is_org_owner()
    or exists (
      select 1
      from public.org_memberships om
      join public.org_roles r on r.id = om.role_id
      where om.user_id = auth.uid()
        and om.active = true
        and r.active = true
        and r.is_admin_role = true
        and r.tier <= 1
    )
    or exists (
      select 1
      from public.admin_capability_grants g
      join public.admin_capabilities c
        on c.key = g.capability_key
       and c.active = true
      where g.user_id = auth.uid()
        and g.enabled = true
        and g.capability_key = p_capability
    );
$function$;

revoke all on function private.admin_has_capability(text) from public;

after commit;
