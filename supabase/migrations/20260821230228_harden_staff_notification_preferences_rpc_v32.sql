ALTER FUNCTION public.staff_update_notification_preferences(boolean,boolean,boolean,boolean,boolean) SECURITY INVOKER;
ALTER FUNCTION public.staff_update_notification_preferences(boolean,boolean,boolean,boolean,boolean) SET search_path = '';
REVOKE ALL ON FUNCTION public.staff_update_notification_preferences(boolean,boolean,boolean,boolean,boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_update_notification_preferences(boolean,boolean,boolean,boolean,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_update_notification_preferences(boolean,boolean,boolean,boolean,boolean) TO authenticated;
