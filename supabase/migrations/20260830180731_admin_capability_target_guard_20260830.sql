begin;
create or replace function private.can_use_admin_capability(p_capability_key text,p_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select case when public.is_org_owner() and p_user_id=auth.uid() then true when not public.is_org_owner() and p_user_id<>auth.uid() then false else exists (select 1 from public.admin_capability_grants g join public.org_memberships om on om.user_id=g.user_id and om.active join public.org_roles r on r.id=om.role_id and r.is_admin_role join public.admin_capabilities c on c.key=g.capability_key and c.active where g.user_id=p_user_id and g.enabled and g.capability_key=p_capability_key) end;
$$;
revoke execute on function private.can_use_admin_capability(text,uuid) from public,anon,authenticated;
create or replace function public.can_use_admin_capability(p_capability_key text,p_user_id uuid default auth.uid()) returns boolean language sql stable security invoker set search_path='' as $$ select private.can_use_admin_capability(p_capability_key,p_user_id); $$;
commit;
