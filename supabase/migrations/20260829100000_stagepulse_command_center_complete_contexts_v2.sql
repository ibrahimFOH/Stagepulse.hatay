begin;

insert into public.ai_agents(code,name,purpose,scope,active,can_read,can_propose,can_execute)
values
('executive','Stagepulse Executive AI','Patron/company-wide management, KPIs, risks and strategic decisions','executive',true,true,true,false),
('operations','Stagepulse Operations AI','Event planning, tasks, staffing, equipment, vehicles and logistics','operations',true,true,true,false),
('sales','Stagepulse Sales AI','Customers, offers, pipeline and conversion analysis','commercial',true,true,true,false),
('finance','Stagepulse Finance AI','Revenue, cost, margin, cash-flow and event financial analysis','finance',true,true,true,false),
('people','Stagepulse People AI','Staff skills, availability, workload, training and assignment analysis','people',true,true,true,false),
('asset','Stagepulse Asset AI','Equipment stock, utilization, maintenance and lifecycle analysis','assets',true,true,true,false),
('marketing','Stagepulse Marketing AI','Campaign, lead source, segment and attribution analysis','marketing',true,true,true,false),
('technical','Stagepulse Technical Production AI','Audio, lighting, video, stage, rigging, power and technical readiness','technical',true,true,true,false),
('site-assistant','Site AI','Controlled customer-facing site assistance and information','site',true,true,true,false)
on conflict(code) do update set name=excluded.name,purpose=excluded.purpose,scope=excluded.scope,active=true,can_read=true,can_propose=true,can_execute=false,updated_at=now();
update public.ai_agents set active=false,updated_at=now() where code in ('stagepulse-command','operations-planner','sales-assistant','staff-assistant','inventory-assistant');

create or replace view public.stagepulse_staff_command_view as
select sp.user_id,sp.display_name,sp.username,sp.role,sp.phone,sp.active,
coalesce((select count(*) from public.staff_skills ss where ss.user_id=sp.user_id),0) skill_count,
coalesce((select count(*) from public.staff_availability sa where sa.user_id=sp.user_id),0) availability_records,
coalesce((select count(*) from public.event_resources er where er.staff_user_id=sp.user_id and er.resource_type='staff' and er.status<>'cancelled'),0) active_assignments,
coalesce((select count(*) from public.event_tasks et where et.assigned_user_id=sp.user_id and et.status not in ('done','cancelled')),0) open_tasks,
coalesce((select count(*) from public.staff_training_records tr where tr.user_id=sp.user_id and tr.status='completed'),0) completed_training
from public.staff_profiles sp;

create or replace view public.stagepulse_equipment_command_view as
select e.id,e.asset_code,e.serial_number,e.category,e.brand,e.model,e.quantity,e.available_quantity,e.reserved_quantity,e.in_use_quantity,e.faulty_quantity,e.maintenance_quantity,e.status,e.active,
coalesce(ec.name,e.category) class_name,coalesce(esc.name,'') subclass_name,
coalesce((select wl.name from public.warehouse_locations wl join public.equipment_movements em on em.to_location_id=wl.id where em.equipment_id=e.id order by em.moved_at desc nulls last limit 1),'') current_location,
coalesce((select count(*) from public.equipment_maintenance_plans mp where mp.equipment_id=e.id and mp.status in ('due','overdue')),0) maintenance_due,
coalesce((select count(*) from public.event_resources er where er.equipment_id=e.id and er.resource_type='equipment' and er.status<>'cancelled'),0) event_assignments
from public.equipment e left join public.equipment_classes ec on ec.id=e.class_id left join public.equipment_subclasses esc on esc.id=e.subclass_id;

create or replace view public.stagepulse_vehicle_command_view as
select v.id,v.name,v.plate,v.vehicle_type,v.capacity_kg,v.active,v.notes,
coalesce((select count(*) from public.vehicle_assignments va where va.vehicle_id=v.id),0) assignment_count,
coalesce((select count(*) from public.event_resources er where er.vehicle_id=v.id and er.resource_type='vehicle' and er.status<>'cancelled'),0) event_assignments
from public.vehicles v;

create or replace view public.stagepulse_checklist_command_view as
select ec.id checklist_id,ec.event_id,ec.name,ec.phase,ec.status,ec.created_at,ec.completed_at,
count(eci.id) item_count,count(*) filter (where eci.status='done') completed_items,
count(*) filter (where eci.required=true and eci.status<>'done') required_open_items
from public.event_checklists ec left join public.event_checklist_items eci on eci.checklist_id=ec.id group by ec.id;

create or replace view public.stagepulse_risk_command_view as
select er.id,er.event_id,ep.title event_title,er.category,er.title,er.severity,er.likelihood,er.status,er.mitigation,er.detected_by,er.created_at,er.resolved_at
from public.event_risks er join public.event_projects ep on ep.id=er.event_id;

create or replace view public.stagepulse_automation_command_view as
select ar.id rule_id,ar.code,ar.name,ar.trigger_type,ar.condition,ar.action,ar.active,ar.updated_at,
coalesce((select count(*) from public.automation_runs run where run.rule_id=ar.id),0) run_count,
coalesce((select count(*) from public.automation_runs run where run.rule_id=ar.id and run.status='completed'),0) completed_runs,
(select max(run.created_at) from public.automation_runs run where run.rule_id=ar.id) last_run_at
from public.automation_rules ar;

create or replace function public.approve_ai_action_request(p_request_id uuid,p_approve boolean)
returns public.ai_action_requests language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.ai_action_requests;
begin
 if not private.is_admin() then raise exception 'admin_required'; end if;
 update public.ai_action_requests set status=case when p_approve then 'approved' else 'rejected' end,approved_by=auth.uid(),approved_at=now() where id=p_request_id and status='pending' returning * into r;
 if r.id is null then raise exception 'ai_action_request_not_pending'; end if;
 return r;
end; $$;
revoke all on function public.approve_ai_action_request(uuid,boolean) from public;
grant execute on function public.approve_ai_action_request(uuid,boolean) to authenticated;

create index if not exists event_resources_staff_event_idx on public.event_resources(staff_user_id,event_id,status) where resource_type='staff';
create index if not exists event_resources_equipment_event_idx on public.event_resources(equipment_id,event_id,status) where resource_type='equipment';
create index if not exists event_resources_vehicle_event_idx on public.event_resources(vehicle_id,event_id,status) where resource_type='vehicle';
create index if not exists event_tasks_assignee_status_idx on public.event_tasks(assigned_user_id,status,due_at);
create index if not exists ai_runs_agent_created_idx on public.ai_runs(agent_id,created_at desc);
create index if not exists ai_action_requests_status_created_idx on public.ai_action_requests(status,created_at desc);

commit;
