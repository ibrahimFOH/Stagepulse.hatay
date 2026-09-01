UPDATE public.staff_permissions sp
SET enabled=false
WHERE sp.permission_key='staff.permissions.manage'
  AND NOT EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id=sp.user_id AND ap.active=true);
NOTIFY pgrst,'reload schema';
