-- Stagepulse RLS performance hardening.
-- Keep the same authorization semantics while avoiding duplicate permissive policies
-- and per-row auth.uid()/current_setting() evaluation.

DROP POLICY IF EXISTS admin_full_equipment_update ON public.equipment;
DROP POLICY IF EXISTS staff_update_equipment_status ON public.equipment;
CREATE POLICY equipment_authenticated_update
  ON public.equipment
  FOR UPDATE TO authenticated
  USING ((select private.is_admin()) OR (select public.staff_has_perm('equipment.update'::text)))
  WITH CHECK ((select private.is_admin()) OR (select public.staff_has_perm('equipment.update'::text)));

DROP POLICY IF EXISTS admin_read_equipment_inventory_history ON public.equipment_inventory_history;
DROP POLICY IF EXISTS staff_read_equipment_inventory_history ON public.equipment_inventory_history;
CREATE POLICY equipment_inventory_history_authenticated_select
  ON public.equipment_inventory_history
  FOR SELECT TO authenticated
  USING (
    (select private.is_admin())
    OR ((select public.staff_has_perm('equipment.view'::text)) AND actor_user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS job_assignments_admin ON public.job_assignments;
DROP POLICY IF EXISTS job_assignments_self_select ON public.job_assignments;
CREATE POLICY job_assignments_authenticated_select
  ON public.job_assignments
  FOR SELECT TO authenticated
  USING ((select private.is_admin()) OR user_id = (select auth.uid()));

DROP POLICY IF EXISTS jobs_select ON public.jobs;
DROP POLICY IF EXISTS jobs_staff_select ON public.jobs;
CREATE POLICY jobs_authenticated_select
  ON public.jobs
  FOR SELECT TO authenticated
  USING (
    (select private.is_admin())
    OR (
      (select public.is_active_staff())
      AND (
        (select public.staff_has_exact_perm('jobs.view'::text))
        OR (select public.staff_has_exact_perm('schedule.view'::text))
        OR (select public.staff_has_exact_perm('schedule.manage'::text))
        OR (
          (select public.staff_has_exact_perm('view_assigned_jobs'::text))
          AND EXISTS (
            SELECT 1 FROM public.job_assignments ja
            WHERE ja.job_id = jobs.id
              AND ja.user_id = (select auth.uid())
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS admin_full_settlements ON public.settlements;
CREATE POLICY admin_full_settlements
  ON public.settlements
  FOR ALL TO authenticated
  USING ((select private.is_admin()) OR (select public.staff_has_perm('settlements.manage'::text)))
  WITH CHECK ((select private.is_admin()) OR (select public.staff_has_perm('settlements.manage'::text)));

DROP POLICY IF EXISTS site_media_admin_insert ON public.site_media;
CREATE POLICY site_media_admin_insert
  ON public.site_media
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_admin()) AND created_by = (select auth.uid()));

DROP POLICY IF EXISTS admin_full_teklifler_insert ON public.teklifler;
CREATE POLICY admin_full_teklifler_insert
  ON public.teklifler
  FOR INSERT TO authenticated
  WITH CHECK ((select private.is_admin()) OR (select public.staff_has_perm('offers.create'::text)));

DROP POLICY IF EXISTS admin_full_teklifler_update ON public.teklifler;
CREATE POLICY admin_full_teklifler_update
  ON public.teklifler
  FOR UPDATE TO authenticated
  USING ((select private.is_admin()) OR (select public.staff_has_perm('offers.update'::text)))
  WITH CHECK ((select private.is_admin()) OR (select public.staff_has_perm('offers.update'::text)));
