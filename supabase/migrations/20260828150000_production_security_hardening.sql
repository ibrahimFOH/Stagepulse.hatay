-- Stagepulse production security hardening
-- Safe/idempotent: only tightens exposed privileges, view execution mode,
-- reference-data read policy, and adds missing FK indexes.

ALTER VIEW public.equipment_staff SET (security_invoker = true);
ALTER VIEW public.my_jobs_staff SET (security_invoker = true);
ALTER VIEW public.offers_staff SET (security_invoker = true);
ALTER VIEW public.owner_financial_summary SET (security_invoker = true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.equipment_staff FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.my_jobs_staff FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.offers_staff FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.owner_financial_summary FROM anon, authenticated;
GRANT SELECT ON public.equipment_staff, public.my_jobs_staff, public.offers_staff TO authenticated;

REVOKE EXECUTE ON FUNCTION public.dispatch_notification_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_business_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_job_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_offer_change() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ensure_job_for_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_financial_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_staff() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_webpush_subscription(text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_has_perm(text[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ensure_job_for_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_financial_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_webpush_subscription(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_perm(text[]) TO authenticated;

ALTER FUNCTION public.normalize_settlement_finance() SET search_path = pg_catalog;

DROP POLICY IF EXISTS departments_authenticated_select ON public.departments;
CREATE POLICY departments_authenticated_select
  ON public.departments
  FOR SELECT
  TO authenticated
  USING (active = true);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_department_id
  ON public.staff_profiles (department_id);
CREATE INDEX IF NOT EXISTS idx_site_media_created_by
  ON public.site_media (created_by);
