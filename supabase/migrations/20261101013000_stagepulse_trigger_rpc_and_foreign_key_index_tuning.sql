begin;

-- Trigger functions are invoked by PostgreSQL triggers, not by Data API callers.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.normalize_settlement_finance() from public, anon, authenticated;
revoke all on function public.app_versions_set_updated_at() from public, anon, authenticated;

-- Cover foreign-key lookups flagged by the Supabase performance advisor.
create index if not exists idx_activity_logs_actor_id on public.activity_logs(actor_id);
create index if not exists idx_admin_capability_grants_capability_key on public.admin_capability_grants(capability_key);
create index if not exists idx_admin_capability_grants_granted_by on public.admin_capability_grants(granted_by);
create index if not exists idx_job_equipment_equipment_id on public.job_equipment(equipment_id);
create index if not exists idx_job_staff_staff_id on public.job_staff(staff_id);
create index if not exists idx_jobs_offer_id on public.jobs(offer_id);
create index if not exists idx_notifications_offer_id on public.notifications(offer_id);
create index if not exists idx_offer_items_offer_id on public.offer_items(offer_id);
create index if not exists idx_offer_items_service_id on public.offer_items(service_id);
create index if not exists idx_org_departments_manager_user_id on public.org_departments(manager_user_id);
create index if not exists idx_org_memberships_position_id on public.org_memberships(position_id);
create index if not exists idx_org_regions_manager_user_id on public.org_regions(manager_user_id);
create index if not exists idx_payments_offer_id on public.payments(offer_id);
create index if not exists idx_sesm_audit_events_actor_user_id on public.sesm_audit_events(actor_user_id);
create index if not exists idx_sesm_audit_events_license_id on public.sesm_audit_events(license_id);
create index if not exists idx_sesm_audit_events_subject_user_id on public.sesm_audit_events(subject_user_id);
create index if not exists idx_sesm_license_keys_created_by on public.sesm_license_keys(created_by);
create index if not exists idx_sesm_progress_marked_by on public.sesm_progress(marked_by);
create index if not exists idx_sesm_students_license_id on public.sesm_students(license_id);
create index if not exists idx_settlements_offer_id on public.settlements(offer_id);
create index if not exists idx_stagepulse_license_admin_config_owner_user_id on public.stagepulse_license_admin_config(owner_user_id);
create index if not exists idx_teklifler_customer_id on public.teklifler(customer_id);

-- Evaluate auth.uid() once per statement for these per-user RLS policies.
drop policy if exists admin_capability_grants_self_read on public.admin_capability_grants;
create policy admin_capability_grants_self_read
  on public.admin_capability_grants
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists org_memberships_self_read on public.org_memberships;
create policy org_memberships_self_read
  on public.org_memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists staff_profiles_self on public.staff_profiles;
create policy staff_profiles_self
  on public.staff_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) and active = true);

notify pgrst, 'reload schema';
commit;
