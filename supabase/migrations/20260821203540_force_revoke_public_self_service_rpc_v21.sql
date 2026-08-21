REVOKE EXECUTE ON FUNCTION public.staff_update_notification_preferences(boolean, boolean, boolean, boolean, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_update_notification_preferences(boolean, boolean, boolean, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_update_notification_preferences(boolean, boolean, boolean, boolean, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_update_profile(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_update_profile(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_update_profile(text, text) TO authenticated;
