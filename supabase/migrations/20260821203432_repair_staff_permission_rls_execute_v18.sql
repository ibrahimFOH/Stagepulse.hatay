CREATE OR REPLACE FUNCTION public.staff_has_perm(perm text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT EXISTS (SELECT 1 FROM public.admin_profiles a WHERE a.user_id = auth.uid() AND a.active = true) OR EXISTS (SELECT 1 FROM public.staff_permissions sp JOIN public.permission_catalog pc ON pc.key = sp.permission_key AND pc.active = true WHERE sp.user_id = auth.uid() AND sp.enabled = true AND sp.permission_key = perm); $$;
CREATE OR REPLACE FUNCTION public.staff_capability(p_capability text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT public.staff_has_perm(p_capability); $$;
REVOKE ALL ON FUNCTION public.staff_has_perm(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_capability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_has_perm(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_capability(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_has_perm(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_capability(text) FROM anon;
