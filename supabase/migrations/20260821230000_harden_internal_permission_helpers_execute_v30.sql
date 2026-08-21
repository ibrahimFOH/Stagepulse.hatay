REVOKE EXECUTE ON FUNCTION public.staff_capability(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_capability(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_capability(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_has_perm(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_has_perm(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_has_perm(text) FROM authenticated;
