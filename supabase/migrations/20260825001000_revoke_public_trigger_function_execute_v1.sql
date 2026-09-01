REVOKE EXECUTE ON FUNCTION public.guard_staff_equipment_status_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_staff_equipment_status_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_staff_equipment_status_update() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.log_equipment_inventory_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_equipment_inventory_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_equipment_inventory_status_change() FROM authenticated;
