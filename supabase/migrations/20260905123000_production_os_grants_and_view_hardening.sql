begin;

grant select, insert, update, delete on public.sp_crm_leads, public.sp_quote_followups, public.sp_quote_revisions, public.sp_quote_packages, public.sp_staff_timesheets, public.sp_staff_availability, public.sp_equipment_scans, public.sp_warehouse_jobs, public.sp_field_proofs, public.sp_equipment_incidents, public.sp_maintenance_work_orders, public.sp_vehicle_assignments, public.sp_event_readiness, public.sp_purchase_orders, public.sp_supplier_requests, public.sp_marketing_attribution, public.sp_customer_metrics, public.sp_ai_recommendations, public.sp_workflow_events to authenticated;

alter view public.sp_production_readiness set (security_invoker = true);

commit;
