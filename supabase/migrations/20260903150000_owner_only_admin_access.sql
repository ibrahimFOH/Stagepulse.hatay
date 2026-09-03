begin;

-- Patron / Owner is the only unconditional admin.
-- CEO, Super Admin and all other users are capability-based and can be restricted by the Patron.

create or replace function private.admin_has_capability(p_capability text)
returns boolean language sql stable security definer
set search_path = 'public, pg_temp'
as $$
  select private.is_org_owner()
      or exists (
        select 1 from public.admin_capability_grants g
        join public.admin_capabilities c on c.key=g.capability_key and c.active=true
        where g.user_id=auth.uid() and g.enabled=true and g.capability_key=p_capability
      );
$$;

create or replace function private.staff_has_exact_perm(p_key text)
returns boolean language sql stable security definer set search_path = 'public, pg_temp'
as $$ select private.admin_has_capability(p_key); $$;

create or replace function private.staff_has_perm(p_keys text[])
returns boolean language sql stable security definer set search_path = 'public, pg_temp'
as $$ select coalesce(bool_or(private.admin_has_capability(k)),false) from unnest(p_keys) k; $$;

create or replace function private.staff_capability(p_capability text)
returns boolean language sql stable security definer set search_path = 'public, private'
as $$ select private.admin_has_capability(p_capability); $$;

-- Only the Patron can change capability assignments.
create or replace function private.can_use_admin_capability(p_capability_key text,p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_org_owner() and exists (select 1 from public.admin_capabilities c where c.key=p_capability_key and c.active); $$;

create or replace function public.staff_capabilities(p_user_id uuid default null)
returns jsonb language sql stable security definer set search_path = 'public, private'
as $$
  select coalesce(jsonb_object_agg(c.key,case when private.is_org_owner() then true else coalesce(g.enabled,false) end),'{}'::jsonb)
  from public.admin_capabilities c
  left join public.admin_capability_grants g on g.capability_key=c.key and g.user_id=coalesce(p_user_id,auth.uid())
  where c.active=true and (private.is_org_owner() or coalesce(p_user_id,auth.uid())=auth.uid());
$$;

-- Replace every blanket admin-role gate in private admin operations with its required capability.
do $$ declare v text; begin
  v:=replace(pg_get_functiondef('private.admin_delete_offer(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.delete'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_update_ai_agent(text,boolean,boolean,boolean,boolean)'::regprocedure),'private.is_admin()','private.admin_has_capability(''ai.update'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_update_price_rule(uuid,numeric,boolean,text)'::regprocedure),'private.is_admin()','private.admin_has_capability(''pricing.manage'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_update_service_pricing(uuid,numeric,numeric,integer,integer,integer,numeric,numeric,numeric,numeric,boolean)'::regprocedure),'private.is_admin()','private.admin_has_capability(''external_services.manage'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_service_active(uuid,boolean)'::regprocedure),'private.is_admin()','private.admin_has_capability(''external_services.manage'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_price_rule_active(uuid,boolean)'::regprocedure),'private.is_admin()','private.admin_has_capability(''pricing.manage'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_create_service(text,text,numeric,numeric,integer,integer,integer,numeric,numeric,numeric,numeric)'::regprocedure),'private.is_admin()','private.admin_has_capability(''external_services.manage'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_create_price_rule(text,text,numeric,text)'::regprocedure),'private.is_admin()','private.admin_has_capability(''pricing.manage'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_offer_pdf_visibility(uuid,boolean)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.pdf.visibility'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.equipment'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_offer_crew_count(uuid,integer)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.crew'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_offer_inventory_reserved(uuid,uuid,numeric)'::regprocedure),'private.is_admin()','private.admin_has_capability(''inventory.manage'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_remove_offer_pdf_asset(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.pdf.generate'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_offer_pdf_current(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.pdf.generate'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_remove_offer_item_equipment(uuid,uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.equipment'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_offer_pdf_url(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.pdf.download'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_offer_item_pricing(uuid,uuid,numeric,numeric)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.equipment'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_get_offer_inventory(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''inventory.view'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_delete_offer_attachment(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.attachments'')'); execute v;
  v:=replace(pg_get_functiondef('private.admin_set_offer_attachment_visibility(uuid,boolean)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.attachments'')'); execute v;
end $$;

-- Public admin entry points that previously used blanket admin-role checks.
do $$ declare v text; begin
  v:=replace(pg_get_functiondef('public.admin_update_business_settings(jsonb)'::regprocedure),'private.is_admin()','private.admin_has_capability(''admin.accounts.manage'')'); execute v;
  v:=replace(pg_get_functiondef('public.admin_get_offer_pdf_assets(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.pdf.download'')'); execute v;
  v:=replace(pg_get_functiondef('public.admin_get_offer_pdf_state(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.pdf.preview'')'); execute v;
  v:=replace(pg_get_functiondef('public.admin_get_offer_attachments(uuid)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.attachments'')'); execute v;
  v:=replace(pg_get_functiondef('public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean)'::regprocedure),'private.is_admin()','private.admin_has_capability(''offers.attachments'')'); execute v;
end $$;

create or replace function private.staff_can_any(p_keys text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(bool_or(private.admin_has_capability(k)),false) from unnest(p_keys) k; $$;

create or replace function private.staff_list_jobs()
returns setof public.jobs language plpgsql stable security definer set search_path = 'public, private'
as $$
begin
  if private.admin_has_capability('jobs.view') or private.admin_has_capability('schedule.view') or private.admin_has_capability('schedule.manage') then
    return query select j.* from public.jobs j order by j.event_at nulls last,j.created_at desc nulls last; return;
  end if;
  if not public.is_active_staff() then return; end if;
  if private.admin_has_capability('view_assigned_jobs') then
    return query select j.* from public.jobs j join public.job_assignments ja on ja.job_id=j.id where ja.user_id=auth.uid() order by j.event_at nulls last,j.created_at desc nulls last;
  end if;
end;
$$;

create or replace function private.get_owner_financial_summary()
returns table(total_revenue numeric,total_expense numeric,total_net numeric,owner_revenue numeric,owner_expense numeric,owner_profit numeric,job_count integer)
language sql stable security definer set search_path = 'public, private'
as $$ select total_revenue,total_expense,total_net,owner_revenue,owner_expense,owner_profit,job_count from public.owner_financial_summary where private.admin_has_capability('finance.view'); $$;

create or replace function public.approve_ai_action_request(p_request_id uuid,p_approve boolean)
returns public.ai_action_requests language plpgsql set search_path = 'public, pg_temp'
as $$ declare r public.ai_action_requests; begin
  if not private.admin_has_capability('ai.approvals.manage') then raise exception 'admin_required'; end if;
  update public.ai_action_requests set status=case when p_approve then 'approved' else 'rejected' end,approved_by=auth.uid(),approved_at=now() where id=p_request_id and status='pending' returning * into r;
  if r.id is null then raise exception 'ai_action_request_not_pending'; end if; return r;
end; $$;

create or replace function public.admin_org_bootstrap_check()
returns jsonb language sql stable security definer set search_path = ''
as $$ select case when private.admin_has_capability('admin.accounts.manage') then jsonb_build_object('supabase_url','https://mtjcqqrogjqaxkagwkti.supabase.co','org_roles_count',(select count(*) from public.org_roles where active),'org_departments_count',(select count(*) from public.org_departments where active),'org_regions_count',(select count(*) from public.org_regions where active),'admin_capabilities_count',(select count(*) from public.admin_capabilities where active)) else jsonb_build_object('authorized',false) end; $$;

grant execute on function public.staff_capabilities(uuid) to authenticated;
grant execute on function public.staff_capability(text) to authenticated;

commit;
