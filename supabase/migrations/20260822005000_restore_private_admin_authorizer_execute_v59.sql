REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION private.is_admin() FROM anon;
