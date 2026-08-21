CREATE OR REPLACE FUNCTION public.staff_has_perm(perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path='public, pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_profiles a WHERE a.user_id=(SELECT auth.uid()) AND a.active=true)
  OR EXISTS (SELECT 1 FROM public.staff_permissions sp JOIN public.permission_catalog pc ON pc.key=sp.permission_key AND pc.active=true WHERE sp.user_id=(SELECT auth.uid()) AND sp.enabled=true AND sp.permission_key=perm);
$$;
REVOKE ALL ON FUNCTION public.staff_has_perm(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_has_perm(text) TO authenticated;
NOTIFY pgrst,'reload schema';
