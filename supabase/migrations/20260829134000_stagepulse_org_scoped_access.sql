begin;

create or replace function public.org_scope(p_user_id uuid default auth.uid()) returns jsonb
language sql stable security definer set search_path=public as $$
select coalesce((select jsonb_build_object('user_id',om.user_id,'role',r.code,'tier',r.tier,'department_id',om.department_id,'region_id',om.region_id,'manager_user_id',om.manager_user_id,'is_owner',(r.code='owner'),'is_admin',r.is_admin_role,'active',om.active) from public.org_memberships om join public.org_roles r on r.id=om.role_id where om.user_id=p_user_id and om.active limit 1),'{}'::jsonb); $$;

create or replace function public.can_view_org_member(p_target_user_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
select public.is_org_owner() or p_target_user_id=auth.uid() or exists(
 select 1 from public.org_memberships me join public.org_roles mr on mr.id=me.role_id join public.org_memberships target on target.user_id=p_target_user_id and target.active
 where me.user_id=auth.uid() and me.active and mr.is_admin_role and (
  mr.code in ('super_admin','upper_admin','ceo')
  or (mr.code='department_manager' and me.department_id is not null and me.department_id=target.department_id)
  or (mr.code='regional_manager' and me.region_id is not null and me.region_id=target.region_id)
 )
); $$;

create or replace function public.can_use_admin_capability(p_capability_key text,p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
select case when public.is_org_owner() and p_user_id=auth.uid() then true else exists(
 select 1 from public.admin_capability_grants g join public.org_memberships om on om.user_id=g.user_id and om.active join public.org_roles r on r.id=om.role_id and r.is_admin_role join public.admin_capabilities c on c.key=g.capability_key and c.active
 where g.user_id=p_user_id and g.enabled and g.capability_key=p_capability_key
) end; $$;

create or replace function public.owner_set_org_membership(p_user_id uuid,p_role_code text,p_position_code text default null,p_department_id uuid default null,p_region_id uuid default null,p_manager_user_id uuid default null,p_active boolean default true) returns jsonb
language plpgsql security definer set search_path=public as $$
declare rid uuid; pid uuid; begin
 if not public.is_org_owner() then raise exception 'Yalnızca Patron / Owner değiştirebilir.'; end if;
 select id into rid from public.org_roles where code=p_role_code and active; if rid is null then raise exception 'Geçersiz rol.'; end if;
 select id into pid from public.org_positions where code=coalesce(p_position_code,p_role_code) and active; if pid is null then select id into pid from public.org_positions where code='employee' and active; end if;
 if p_role_code='owner' and p_user_id<>auth.uid() then raise exception 'İkinci Owner atanamaz.'; end if;
 insert into public.org_memberships(user_id,role_id,position_id,department_id,region_id,manager_user_id,active) values(p_user_id,rid,pid,p_department_id,p_region_id,p_manager_user_id,p_active)
 on conflict(user_id) do update set role_id=excluded.role_id,position_id=excluded.position_id,department_id=excluded.department_id,region_id=excluded.region_id,manager_user_id=excluded.manager_user_id,active=excluded.active,updated_at=now();
 return jsonb_build_object('ok',true,'user_id',p_user_id); end; $$;

create or replace function public.owner_set_admin_capability(p_user_id uuid,p_capability_key text,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_org_owner() then raise exception 'Yalnızca Patron / Owner yetki değiştirebilir.'; end if;
 if not exists(select 1 from public.admin_capabilities where key=p_capability_key and active) then raise exception 'Geçersiz Admin yetkisi.'; end if;
 if exists(select 1 from public.org_memberships om join public.org_roles r on r.id=om.role_id where om.user_id=p_user_id and r.code='owner') then raise exception 'Owner yetkisi kapatılamaz.'; end if;
 insert into public.admin_capability_grants(user_id,capability_key,enabled,granted_by,updated_at) values(p_user_id,p_capability_key,p_enabled,auth.uid(),now()) on conflict(user_id,capability_key) do update set enabled=excluded.enabled,granted_by=excluded.granted_by,updated_at=now();
 return jsonb_build_object('ok',true,'enabled',p_enabled); end; $$;

commit;
