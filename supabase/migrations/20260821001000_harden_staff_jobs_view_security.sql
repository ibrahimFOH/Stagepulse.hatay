-- Stagepulse: harden staff jobs view security without changing data.
-- The view must use the querying user's RLS policies.
ALTER VIEW public.my_jobs_staff SET (security_invoker = true);

-- staff_has_perm only evaluates the current authenticated user's own permissions.
-- Keep it SECURITY INVOKER so RLS remains enforced for the caller.
CREATE OR REPLACE FUNCTION public.staff_has_perm(perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles a
    WHERE a.user_id = auth.uid()
      AND a.active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.staff_permissions sp
    JOIN public.permission_catalog pc ON pc.key = sp.permission_key
    WHERE sp.user_id = auth.uid()
      AND sp.enabled = true
      AND pc.active = true
      AND pc.key = perm
  );
$$;

REVOKE ALL ON FUNCTION public.staff_has_perm(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_has_perm(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
