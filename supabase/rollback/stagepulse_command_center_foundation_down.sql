-- CONTROLLED ROLLBACK for Stagepulse Command Center foundation.
-- DO NOT run automatically. This removes only the additive foundation introduced by
-- 20260829030000_stagepulse_command_center_foundation,
-- 20260829031000_stagepulse_av_equipment_taxonomy and
-- 20260829032000_stagepulse_staff_categories.
-- Existing offers, jobs, staff, notifications and current application flows remain untouched.

begin;

-- New tables, reverse dependency order.
drop table if exists public.automation_runs cascade;
drop table if exists public.automation_rules cascade;
drop table if exists public.ai_action_requests cascade;
drop table if exists public.ai_memory cascade;
drop table if exists public.ai_runs cascade;
drop table if exists public.ai_agents cascade;
drop table if exists public.event_financials cascade;
drop table if exists public.event_checklist_items cascade;
drop table if exists public.event_checklists cascade;
drop table if exists public.event_risks cascade;
drop table if exists public.event_resources cascade;
drop table if exists public.vehicle_assignments cascade;
drop table if exists public.vehicles cascade;
drop table if exists public.equipment_movements cascade;
drop table if exists public.warehouse_locations cascade;
drop table if exists public.staff_availability cascade;
drop table if exists public.staff_category_assignments cascade;
drop table if exists public.staff_skills cascade;
drop table if exists public.staff_skill_catalog cascade;
drop table if exists public.event_tasks cascade;
drop table if exists public.event_projects cascade;
drop table if exists public.equipment_subclasses cascade;
drop table if exists public.equipment_classes cascade;
drop table if exists public.staff_categories cascade;

-- Additive columns on existing equipment table.
alter table public.equipment drop column if exists asset_code;
alter table public.equipment drop column if exists serial_number;
alter table public.equipment drop column if exists subclass_id;
alter table public.equipment drop column if exists class_id;
alter table public.equipment drop column if exists status;

commit;
