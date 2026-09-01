begin;

create table if not exists public.org_panel_rules (
  role_code text primary key references public.org_roles(code) on delete cascade,
  panel_code text not null,
  scope_mode text not null check (scope_mode in ('company','department','region','self','none')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.org_panel_rules(role_code,panel_code,scope_mode,active) values
('owner','owner','company',true),
('super_admin','admin','company',true),
('upper_admin','admin','company',true),
('ceo','executive','company',true),
('department_manager','department','department',true),
('regional_manager','region','region',true),
('employee','employee','self',true)
on conflict (role_code) do update set panel_code=excluded.panel_code,scope_mode=excluded.scope_mode,active=true,updated_at=now();

create unique index if not exists org_panel_rules_role_panel_uidx
  on public.org_panel_rules(role_code, panel_code);

create or replace function public.org_panel_context(p_user_id uuid default auth.uid())
returns table(role_code text, position_name text, department_id uuid, region_id uuid, manager_user_id uuid, panel_code text, scope_mode text, is_owner boolean)
language sql stable security definer set search_path=public
as $$
  select r.code, p.name, m.department_id, m.region_id, m.manager_user_id, pr.panel_code, pr.scope_mode, (r.code='owner')
  from public.org_memberships m
  join public.org_roles r on r.id=m.role_id
  left join public.org_positions p on p.id=m.position_id
  left join public.org_panel_rules pr on pr.role_code=r.code
  where m.user_id=p_user_id and m.active=true
  limit 1;
$$;

create or replace function public.org_visible_member_ids(p_user_id uuid default auth.uid())
returns table(user_id uuid)
language sql stable security definer set search_path=public
as $$
  with me as (
    select m.user_id,m.department_id,m.region_id,r.code as role_code
    from public.org_memberships m join public.org_roles r on r.id=m.role_id
    where m.user_id=p_user_id and m.active=true limit 1
  )
  select m.user_id
  from public.org_memberships m, me
  where m.active=true
    and (
      me.role_code='owner'
      or me.role_code in ('super_admin','upper_admin','ceo')
      or (me.role_code='department_manager' and m.department_id=me.department_id)
      or (me.role_code='regional_manager' and m.region_id=me.region_id)
      or (me.role_code='employee' and m.user_id=me.user_id)
    );
$$;

revoke all on public.org_panel_rules from anon, authenticated;
grant select on public.org_panel_rules to authenticated;
revoke all on function public.org_panel_context(uuid) from anon;
grant execute on function public.org_panel_context(uuid) to authenticated;
revoke all on function public.org_visible_member_ids(uuid) from anon;
grant execute on function public.org_visible_member_ids(uuid) to authenticated;

revoke execute on function public.is_org_owner() from anon;
revoke execute on function public.org_role_tier_for(uuid) from anon;
revoke execute on function public.org_scope(uuid) from anon;
revoke execute on function public.org_visible_member_ids(uuid) from anon;
revoke execute on function public.can_view_org_member(uuid) from anon;
revoke execute on function public.can_use_admin_capability(text, uuid) from anon;
revoke execute on function public.org_panel_context(uuid) from anon;
revoke execute on function public.owner_set_admin_capability(uuid,text,boolean) from anon;
revoke execute on function public.owner_set_org_membership(uuid,text,text,uuid,uuid,uuid,boolean) from anon;

commit;
