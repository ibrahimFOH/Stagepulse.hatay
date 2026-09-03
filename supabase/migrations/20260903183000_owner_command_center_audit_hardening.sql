-- Patron command-center hardening applied to production.
-- Keeps the owner-only field schema, complete module list/report mapping,
-- and authenticated-only RPC surface reproducible in repository history.

create or replace function public.stagepulse_command_list(p_entity text,p_limit integer default 100) returns jsonb language plpgsql stable security definer set search_path=public,private,auth,pg_temp as $$
declare t text; r jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_entity='system' then return public.stagepulse_command_report('system','{}'); end if;
  t:=case p_entity
    when 'company' then 'business_settings' when 'customers' then 'customers' when 'offers' then 'teklifler' when 'offer_items' then 'offer_items'
    when 'jobs' then 'jobs' when 'events' then 'event_projects' when 'staff' then 'staff' when 'equipment' then 'equipment'
    when 'warehouse' then 'warehouse_locations' when 'equipment_movements' then 'equipment_movements' when 'vehicles' then 'vehicles'
    when 'vehicle_assignments' then 'vehicle_assignments' when 'event_resources' then 'event_resources' when 'payments' then 'payments'
    when 'settlements' then 'settlements' when 'event_financials' then 'event_financials' when 'business_risks' then 'business_risks'
    when 'event_risks' then 'event_risks' when 'contracts' then 'contracts' when 'suppliers' then 'stagepulse_suppliers'
    when 'marketing' then 'marketing_campaigns' when 'lead_sources' then 'lead_sources' when 'customer_segments' then 'customer_segments'
    when 'kpis' then 'executive_kpis' when 'goals' then 'executive_goals' when 'initiatives' then 'strategic_initiatives'
    when 'ai_tasks' then 'stagepulse_ai_tasks' when 'ai_actions' then 'ai_action_requests' when 'automation' then 'automation_rules'
    when 'approval_requests' then 'approval_requests' when 'risks' then 'stagepulse_risks' when 'decisions' then 'stagepulse_decisions'
    when 'app_versions' then 'app_versions' when 'site_media' then 'site_media' else null end;
  if t is null then raise exception 'ENTITY_NOT_SUPPORTED'; end if;
  if not private.is_org_owner() and not private.staff_has_exact_perm(p_entity||'.view') and not private.staff_has_exact_perm('reports.view') then raise exception 'PERMISSION_DENIED'; end if;
  execute format('select coalesce(jsonb_agg(x),''[]''::jsonb) from (select to_jsonb(t) x from public.%I t limit %s) q',t,greatest(1,least(coalesce(p_limit,100),500))) into r;
  return r;
end $$;

create or replace function public.stagepulse_command_form_schema(p_entity text) returns jsonb language plpgsql stable security definer set search_path=public,information_schema,pg_catalog,pg_temp as $$
declare v_table text; v_cols jsonb;
begin
  if not private.is_org_owner() then raise exception 'OWNER_REQUIRED'; end if;
  v_table:=case p_entity
    when 'company' then 'business_settings' when 'customers' then 'customers' when 'offers' then 'teklifler' when 'offer_items' then 'offer_items'
    when 'jobs' then 'jobs' when 'events' then 'event_projects' when 'staff' then 'staff' when 'equipment' then 'equipment'
    when 'warehouse' then 'warehouse_locations' when 'equipment_movements' then 'equipment_movements' when 'vehicles' then 'vehicles'
    when 'vehicle_assignments' then 'vehicle_assignments' when 'event_resources' then 'event_resources' when 'payments' then 'payments'
    when 'settlements' then 'settlements' when 'event_financials' then 'event_financials' when 'business_risks' then 'business_risks'
    when 'event_risks' then 'event_risks' when 'contracts' then 'contracts' when 'suppliers' then 'stagepulse_suppliers'
    when 'marketing' then 'marketing_campaigns' when 'lead_sources' then 'lead_sources' when 'customer_segments' then 'customer_segments'
    when 'kpis' then 'executive_kpis' when 'goals' then 'executive_goals' when 'initiatives' then 'strategic_initiatives'
    when 'ai_tasks' then 'stagepulse_ai_tasks' when 'ai_actions' then 'ai_action_requests' when 'automation' then 'automation_rules'
    when 'approval_requests' then 'approval_requests' when 'risks' then 'stagepulse_risks' when 'decisions' then 'stagepulse_decisions'
    when 'app_versions' then 'app_versions' when 'site_media' then 'site_media' else null end;
  if v_table is null then raise exception 'ENTITY_NOT_SUPPORTED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',c.column_name,'type',c.data_type,'udt',c.udt_name,'nullable',c.is_nullable='YES','default',c.column_default,'ordinal',c.ordinal_position) order by c.ordinal_position),'[]'::jsonb)
  into v_cols from information_schema.columns c where c.table_schema='public' and c.table_name=v_table and c.column_name<>'id' and c.column_name not in ('created_at','updated_at');
  return jsonb_build_object('entity',p_entity,'table_name',v_table,'fields',v_cols);
end $$;
