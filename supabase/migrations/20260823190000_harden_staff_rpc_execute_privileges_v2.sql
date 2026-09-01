-- Harden staff RPC execution privileges.
-- Anonymous/public callers must never be able to invoke staff SECURITY DEFINER RPCs.
-- Authenticated execution is preserved and each function continues to enforce its own permission checks.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'staff_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', r.nspname, r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
