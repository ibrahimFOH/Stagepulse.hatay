-- Restore the complete admin UI's direct Supabase data path under strict admin-only RLS.
-- Public quote intake writes with the service role inside the Edge Function, so anon table INSERT is not required.

REVOKE INSERT ON TABLE public.teklifler FROM anon;
DROP POLICY IF EXISTS quotes_public_insert ON public.teklifler;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'teklifler','customers','equipment','jobs','job_equipment','job_staff',
    'offer_items','payments','settlements','services','price_rules','event_types',
    'business_settings','notifications','activity_logs','staff_profiles',
    'staff_notification_preferences','staff_permissions','permission_catalog',
    'permission_aliases','staff'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admin_full_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))',
      'admin_full_' || t, t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.teklifler, public.customers, public.equipment,
  public.jobs, public.job_equipment, public.job_staff, public.offer_items, public.payments,
  public.settlements, public.services, public.price_rules, public.event_types,
  public.business_settings, public.notifications, public.activity_logs, public.staff_profiles,
  public.staff_notification_preferences, public.staff_permissions, public.permission_catalog,
  public.permission_aliases, public.staff TO authenticated;

REVOKE ALL ON TABLE public.teklifler FROM anon;
