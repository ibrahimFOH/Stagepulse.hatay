begin;

do $$ declare t text; begin foreach t in array array['executive_kpis','executive_goals','strategic_initiatives','approval_policies','approval_requests','business_risks','decision_log','marketing_campaigns','lead_sources','customer_segments','staff_training_records','equipment_maintenance_plans','supplier_records','contracts'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

do $$ declare t text; begin foreach t in array array['executive_kpis','executive_goals','strategic_initiatives','approval_policies','approval_requests','business_risks','decision_log','marketing_campaigns','lead_sources','customer_segments','staff_training_records','equipment_maintenance_plans','supplier_records','contracts'] loop execute format('drop policy if exists %I on public.%I', 'admin_full_'||t, t); execute format('create policy %I on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())', 'admin_full_'||t, t); end loop; end $$;

drop policy if exists staff_training_self_select on public.staff_training_records;
create policy staff_training_self_select on public.staff_training_records for select to authenticated using (user_id = auth.uid() or private.is_admin());

drop policy if exists approval_request_self_select on public.approval_requests;
create policy approval_request_self_select on public.approval_requests for select to authenticated using (requested_by = auth.uid() or approved_by = auth.uid() or private.is_admin());

drop policy if exists approval_request_self_insert on public.approval_requests;
create policy approval_request_self_insert on public.approval_requests for insert to authenticated with check (requested_by = auth.uid() and status = 'pending');

create index if not exists executive_goals_owner_idx on public.executive_goals(owner_user_id);
create index if not exists strategic_initiatives_owner_idx on public.strategic_initiatives(owner_user_id);
create index if not exists business_risks_owner_idx on public.business_risks(owner_user_id);
create index if not exists staff_training_user_idx on public.staff_training_records(user_id);
create index if not exists equipment_maintenance_due_idx on public.equipment_maintenance_plans(next_due_at,status);
create index if not exists marketing_campaign_status_idx on public.marketing_campaigns(status,created_at desc);

commit;
