CREATE OR REPLACE FUNCTION public.guard_staff_equipment_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    IF NEW.category IS DISTINCT FROM OLD.category
       OR NEW.brand IS DISTINCT FROM OLD.brand
       OR NEW.model IS DISTINCT FROM OLD.model
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.daily_cost IS DISTINCT FROM OLD.daily_cost
       OR NEW.daily_price IS DISTINCT FROM OLD.daily_price
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Personel yalnızca envanter durum adetlerini değiştirebilir';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_equipment_inventory_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.faulty_quantity IS DISTINCT FROM OLD.faulty_quantity
     OR NEW.maintenance_quantity IS DISTINCT FROM OLD.maintenance_quantity
     OR NEW.reserved_quantity IS DISTINCT FROM OLD.reserved_quantity
     OR NEW.in_use_quantity IS DISTINCT FROM OLD.in_use_quantity THEN
    INSERT INTO public.equipment_inventory_history (
      equipment_id, actor_user_id,
      previous_faulty_quantity, previous_maintenance_quantity, previous_reserved_quantity, previous_in_use_quantity,
      faulty_quantity, maintenance_quantity, reserved_quantity, in_use_quantity
    ) VALUES (
      NEW.id, auth.uid(),
      OLD.faulty_quantity, OLD.maintenance_quantity, OLD.reserved_quantity, OLD.in_use_quantity,
      NEW.faulty_quantity, NEW.maintenance_quantity, NEW.reserved_quantity, NEW.in_use_quantity
    );
  END IF;
  RETURN NEW;
END;
$$;
