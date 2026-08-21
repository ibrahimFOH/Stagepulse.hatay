-- Stagepulse: fix staff capability checks for authenticated portal users.
-- Additive migration: no files or tables are removed.
-- The helper reads only the current user's canonical permissions and uses a
-- fixed search_path. EXECUTE is limited to authenticated users.

CREATE OR REPLACE FUNCTION public.staff_has_perm(perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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
