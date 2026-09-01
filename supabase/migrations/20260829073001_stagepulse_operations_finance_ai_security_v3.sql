begin;

do $$ declare t text; begin foreach t in array array['event_projects','event_tasks','staff_skill_catalog','staff_skills','staff_availability','equipment_classes','equipment_subclasses','warehouse_locations','equipment_movements','vehicles','vehicle_assignments','event_resources','event_risks','event_checklists','event_checklist_items','event_financials','ai_agents','ai_runs','ai_memory','ai_action_requests','automation_rules','automation_runs'] loop execute format('drop policy if exists %I on public.%I', 'admin_full', t); execute format('create policy %I on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())', 'admin_full', t); end loop; end $$;

drop policy if exists staff_skill_catalog_read on public.staff_skill_catalog;
create policy staff_skill_catalog_read on public.staff_skill_catalog for select to authenticated using (public.is_active_staff() or private.is_admin());

drop policy if exists staff_skills_self_read on public.staff_skills;
create policy staff_skills_self_read on public.staff_skills for select to authenticated using (user_id = auth.uid() or private.is_admin());

drop policy if exists staff_availability_self_read on public.staff_availability;
create policy staff_availability_self_read on public.staff_availability for select to authenticated using (user_id = auth.uid() or private.is_admin());

drop policy if exists event_projects_assigned_read on public.event_projects;
create policy event_projects_assigned_read on public.event_projects for select to authenticated using (private.is_admin() or exists (select 1 from public.event_resources er where er.event_id = event_projects.id and er.resource_type='staff' and er.staff_user_id=auth.uid()) or exists (select 1 from public.event_tasks et where et.event_id=event_projects.id and et.assigned_user_id=auth.uid()));

drop policy if exists event_tasks_assigned_read on public.event_tasks;
create policy event_tasks_assigned_read on public.event_tasks for select to authenticated using (assigned_user_id=auth.uid() or private.is_admin());

drop policy if exists event_resources_assigned_read on public.event_resources;
create policy event_resources_assigned_read on public.event_resources for select to authenticated using (staff_user_id=auth.uid() or private.is_admin());

drop policy if exists event_checklists_assigned_read on public.event_checklists;
create policy event_checklists_assigned_read on public.event_checklists for select to authenticated using (private.is_admin() or exists (select 1 from public.event_resources er where er.event_id=event_checklists.event_id and er.resource_type='staff' and er.staff_user_id=auth.uid()));

drop policy if exists event_checklist_items_assigned_read on public.event_checklist_items;
create policy event_checklist_items_assigned_read on public.event_checklist_items for select to authenticated using (assigned_user_id=auth.uid() or private.is_admin());

comment on table public.ai_action_requests is 'AI can propose actions only; execution requires explicit authorized approval.';
commit;
