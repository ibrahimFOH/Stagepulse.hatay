-- Enable realtime for staff-managed entities shared by admin and staff.
alter publication supabase_realtime add table public.staff_profiles;
alter publication supabase_realtime add table public.staff_permissions;
