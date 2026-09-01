begin;
do $$
declare r record;
begin
  for r in select p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and not p.prosecdef and p.proname in ('admin_create_price_rule','admin_create_service','admin_delete_offer','admin_org_bootstrap_check','admin_set_price_rule_active','admin_set_service_active','admin_update_ai_agent','admin_update_price_rule','admin_update_service_pricing','can_use_admin_capability','can_view_org_member','ensure_quote_public_code','get_owner_financial_summary','get_public_quote_by_code','is_active_staff','is_org_owner','offer_update_event_date','org_owner_catalog','org_panel_context','org_role_tier_for','org_scope','org_visible_member_ids','org_visible_staff','owner_set_admin_capability','owner_set_org_membership','register_webpush_subscription','respond_to_quote_code','staff_can_any','staff_capability','staff_create_customer','staff_create_offer','staff_delete_equipment','staff_delete_job','staff_delete_offer','staff_has_exact_perm','staff_has_perm','staff_list_jobs','staff_send_offer','staff_update_customer','staff_update_offer','staff_update_price_rule','staff_upsert_equipment','staff_upsert_service') loop
    execute format('alter function public.%I(%s) set search_path = ''''',r.proname,r.args);
  end loop;
end $$;
revoke execute on function public.sync_job_to_event_project() from public,anon,authenticated;
commit;
