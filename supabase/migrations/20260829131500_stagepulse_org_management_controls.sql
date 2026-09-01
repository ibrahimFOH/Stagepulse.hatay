begin;

-- Owner-only mutation RPCs for the company hierarchy and delegated admin access.
-- These are intentionally separate from staff permissions.
create or replace function public.owner_set_org_membership(
  p_user_id uuid,
  p_role_code text,
  p_position_code text default null,
  p_department_id uuid default null,
  p_region_id uuid default null,
  p_manager_user_id uuid default null,
  p_active boolean default true
)
returns public.org_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_position_id uuid;
  v_result public.org_memberships;
begin
  if not public.is_org_owner() then
    raise exception 'Only the organization owner can change memberships';
  end if;
  if p_user_id is null then raise exception 'user_id is required'; end if;
  if p_user_id = auth.uid() and p_role_code <> 'owner' then
    raise exception 'Owner cannot demote themselves';
  end if;
  select id into v_role_id from public.org_roles where code=p_role_code and active=true;
  if v_role_id is null then raise exception 'Unknown active role: %',p_role_code; end if;
  if p_position_code is not null then
    select id into v_position_id from public.org_positions where code=p_position_code and active=true;
    if v_position_id is null then raise exception 'Unknown active position: %',p_position_code; end if;
  end if;
  if p_manager_user_id = p_user_id then raise exception 'A user cannot manage themselves'; end if;
  if p_role_code='owner' and p_user_id <> auth.uid() then
    raise exception 'Only the current owner can hold the Owner role';
  end if;
  insert into public.org_memberships(user_id,role_id,position_id,department_id,region_id,manager_user_id,active)
  values(p_user_id,v_role_id,v_position_id,p_department_id,p_region_id,p_manager_user_id,p_active)
  on conflict(user_id) do update set
    role_id=excluded.role_id, position_id=excluded.position_id,
    department_id=excluded.department_id, region_id=excluded.region_id,
    manager_user_id=excluded.manager_user_id, active=excluded.active, updated_at=now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.owner_set_admin_capability(
  p_user_id uuid,
  p_capability_key text,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_is_admin_role boolean;
begin
  if not public.is_org_owner() then raise exception 'Only the organization owner can change delegated admin capabilities'; end if;
  if p_user_id = auth.uid() then raise exception 'Owner capabilities are implicit and cannot be disabled'; end if;
  select r.is_admin_role into v_is_admin_role
  from public.org_memberships om join public.org_roles r on r.id=om.role_id
  where om.user_id=p_user_id and om.active=true;
  if coalesce(v_is_admin_role,false) is not true then raise exception 'Target user is not an active administrative member'; end if;
  if not exists(select 1 from public.admin_capabilities where key=p_capability_key and active=true) then raise exception 'Unknown active capability: %',p_capability_key; end if;
  insert into public.admin_capability_grants(user_id,capability_key,enabled,granted_by,updated_at)
  values(p_user_id,p_capability_key,p_enabled,auth.uid(),now())
  on conflict(user_id,capability_key) do update set enabled=excluded.enabled,granted_by=auth.uid(),updated_at=now();
  return p_enabled;
end;
$$;

grant execute on function public.owner_set_org_membership(uuid,text,text,uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.owner_set_admin_capability(uuid,text,boolean) to authenticated;

commit;
