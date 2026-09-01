-- Unify legacy staff permission names with the canonical RBAC names.
create or replace function public.staff_has_perm(perm text)
returns boolean
language sql
stable
security invoker
set search_path='public, pg_temp'
as $$
  with aliases(canonical, legacy) as (
    values
      ('schedule.view','jobs'),('schedule.view','view_assigned_jobs'),
      ('jobs.accept','accept_job'),('jobs.reject','reject_job'),
      ('jobs.status.update','update_job_status'),('jobs.notes.update','update_job_notes'),
      ('jobs.equipment.manage','manage_job_equipment'),('jobs.documents.view','view_job_documents'),
      ('equipment.view','equipment'),('equipment.checkout','equipment_checkout'),('equipment.return','equipment_return'),
      ('offers.view','offers'),('offers.approve','offer_approve'),
      ('customers.view','customers'),('payments.view','finance'),
      ('pricing.view','pricing'),('pricing.manage','pricing_manage'),
      ('financials.view','financials'),('notifications.view','notifications_view'),
      ('notifications.send','whatsapp_send'),('staff.view','personnel_view'),('staff.manage','personnel_manage'),
      ('analytics.view','analytics'),('activity.view','activity_view'),('dashboard.view','dashboard_view'),
      ('settings.update','settings_manage'),('profile.update','profile_update'),('files.upload','file_upload'),
      ('team.view','view_team'),('issues.create','report_issue'),('settlements.view','settlements_view')
  )
  select exists (select 1 from public.admin_profiles a where a.user_id=(select auth.uid()) and a.active=true)
  or exists (
    select 1 from public.staff_permissions sp
    join public.permission_catalog pc on pc.key=sp.permission_key and pc.active=true
    where sp.user_id=(select auth.uid()) and sp.enabled=true
      and (sp.permission_key=perm or sp.permission_key in (select legacy from aliases where canonical=perm))
  )
  or exists (
    select 1 from public.staff_profiles p
    where p.user_id=(select auth.uid()) and p.active=true
      and (coalesce((p.permissions ->> perm)::boolean,false)
        or exists (select 1 from aliases a where a.canonical=perm and coalesce((p.permissions ->> a.legacy)::boolean,false)))
  );
$$;
revoke all on function public.staff_has_perm(text) from public, anon;
grant execute on function public.staff_has_perm(text) to authenticated;
notify pgrst,'reload schema';
