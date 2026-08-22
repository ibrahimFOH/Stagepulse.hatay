-- Finalize private admin authorizer access for authenticated RLS/function paths.
-- The private schema remains inaccessible to anon. Only the boolean authorizer
-- is executable by authenticated users; other private functions remain denied.
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- Keep the canonical public authorizer available for new SECURITY DEFINER code.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
