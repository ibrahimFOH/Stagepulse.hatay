begin;

create or replace view public.stagepulse_job_command_view as
select j.id as job_id,j.offer_id,j.title,j.status,j.location,j.setup_at,j.event_at,j.teardown_at,j.event_start_at,j.event_end_at,
 t.customer_id,t.name as customer_name,t.company as customer_company,t.phone as customer_phone,t.email as customer_email,
 t.status as offer_status,t.total as offer_total,t.estimated_cost as offer_cost,t.margin as offer_margin,
 ep.id as event_id,ep.title as event_title,ep.status as event_status,ep.venue,ep.city,
 ef.estimated_revenue,ef.estimated_cost,ef.estimated_margin,ef.actual_revenue,ef.actual_cost,ef.actual_margin
from public.jobs j
left join public.teklifler t on t.id=j.offer_id
left join public.event_projects ep on ep.job_id=j.id
left join public.event_financials ef on ef.event_id=ep.id;

create or replace view public.stagepulse_finance_command_view as
select ef.event_id,ep.job_id,ep.offer_id,ep.title as event_title,ep.status as event_status,ep.event_start_at,
 t.customer_id,t.company as customer_company,t.name as customer_name,
 ef.estimated_revenue,ef.estimated_cost,ef.estimated_margin,ef.actual_revenue,ef.actual_cost,ef.actual_margin,ef.currency
from public.event_financials ef
join public.event_projects ep on ep.id=ef.event_id
left join public.teklifler t on t.id=ep.offer_id;

create or replace view public.stagepulse_ai_command_view as
select ar.id as ai_run_id,ar.agent_id,ar.actor_user_id,ar.event_id,ar.action_type,ar.status,ar.input_summary,ar.output_summary,ar.created_at,ar.completed_at,
 ep.job_id,ep.title as event_title,ep.status as event_status,ep.event_start_at
from public.ai_runs ar left join public.event_projects ep on ep.id=ar.event_id;

create or replace view public.stagepulse_resource_command_view as
select er.id as resource_id,er.event_id,er.resource_type,er.quantity,er.required,er.status,er.notes,
 ep.job_id,ep.title as event_title,ep.event_start_at,
 sp.user_id as staff_user_id,sp.display_name as staff_name,sp.role as staff_role,
 eq.id as equipment_id,eq.category as equipment_category,eq.brand as equipment_brand,eq.model as equipment_model,eq.quantity as equipment_total,
 v.id as vehicle_id,v.name as vehicle_name,v.plate as vehicle_plate,v.vehicle_type
from public.event_resources er
join public.event_projects ep on ep.id=er.event_id
left join public.staff_profiles sp on sp.user_id=er.staff_user_id
left join public.equipment eq on eq.id=er.equipment_id
left join public.vehicles v on v.id=er.vehicle_id;

create or replace view public.stagepulse_command_summary_view as
select
 (select count(*) from public.customers) as customers,
 (select count(*) from public.teklifler) as offers,
 (select count(*) from public.jobs) as jobs,
 (select count(*) from public.event_projects) as events,
 (select count(*) from public.staff_profiles where active=true) as active_staff,
 (select count(*) from public.equipment where active=true) as active_equipment,
 (select count(*) from public.event_tasks where status not in ('done','cancelled')) as open_tasks,
 (select count(*) from public.event_financials) as financial_records,
 (select count(*) from public.ai_runs) as ai_runs,
 (select count(*) from public.approval_requests where status='pending') as pending_approvals,
 (select count(*) from public.equipment_maintenance_plans where status in ('due','overdue')) as maintenance_due,
 (select count(*) from public.vehicle_assignments where status not in ('completed','cancelled')) as active_vehicle_assignments;

commit;
