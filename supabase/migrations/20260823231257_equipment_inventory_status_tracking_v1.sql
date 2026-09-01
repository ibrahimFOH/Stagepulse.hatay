ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS faulty_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_use_quantity integer NOT NULL DEFAULT 0;

UPDATE public.equipment
SET faulty_quantity = COALESCE(faulty_quantity, 0),
    maintenance_quantity = COALESCE(maintenance_quantity, 0),
    reserved_quantity = COALESCE(reserved_quantity, 0),
    in_use_quantity = COALESCE(in_use_quantity, 0)
WHERE faulty_quantity IS NULL
   OR maintenance_quantity IS NULL
   OR reserved_quantity IS NULL
   OR in_use_quantity IS NULL;

ALTER TABLE public.equipment
  DROP CONSTRAINT IF EXISTS equipment_inventory_counts_valid;

ALTER TABLE public.equipment
  ADD CONSTRAINT equipment_inventory_counts_valid CHECK (
    quantity >= 0
    AND faulty_quantity >= 0
    AND maintenance_quantity >= 0
    AND reserved_quantity >= 0
    AND in_use_quantity >= 0
    AND faulty_quantity + maintenance_quantity + reserved_quantity + in_use_quantity <= quantity
  );

CREATE TABLE IF NOT EXISTS public.equipment_inventory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  actor_user_id uuid NULL,
  previous_faulty_quantity integer NOT NULL,
  previous_maintenance_quantity integer NOT NULL,
  previous_reserved_quantity integer NOT NULL,
  previous_in_use_quantity integer NOT NULL,
  faulty_quantity integer NOT NULL,
  maintenance_quantity integer NOT NULL,
  reserved_quantity integer NOT NULL,
  in_use_quantity integer NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_inventory_history_equipment_created_idx
  ON public.equipment_inventory_history (equipment_id, created_at DESC);

ALTER TABLE public.equipment_inventory_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_read_equipment_inventory_history ON public.equipment_inventory_history;
CREATE POLICY admin_read_equipment_inventory_history
  ON public.equipment_inventory_history
  FOR SELECT TO authenticated
  USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS staff_read_equipment_inventory_history ON public.equipment_inventory_history;
CREATE POLICY staff_read_equipment_inventory_history
  ON public.equipment_inventory_history
  FOR SELECT TO authenticated
  USING (
    staff_has_perm('equipment.view'::text)
    AND actor_user_id = auth.uid()
  );

DROP POLICY IF EXISTS staff_update_equipment_status ON public.equipment;
CREATE POLICY staff_update_equipment_status
  ON public.equipment
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_admin())
    OR staff_has_perm('equipment.update'::text)
  )
  WITH CHECK (
    (SELECT private.is_admin())
    OR staff_has_perm('equipment.update'::text)
  );

CREATE OR REPLACE FUNCTION public.guard_staff_equipment_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

DROP TRIGGER IF EXISTS trg_guard_staff_equipment_status_update ON public.equipment;
CREATE TRIGGER trg_guard_staff_equipment_status_update
BEFORE UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.guard_staff_equipment_status_update();

CREATE OR REPLACE FUNCTION public.log_equipment_inventory_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

DROP TRIGGER IF EXISTS trg_log_equipment_inventory_status_change ON public.equipment;
CREATE TRIGGER trg_log_equipment_inventory_status_change
AFTER UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.log_equipment_inventory_status_change();

DROP VIEW IF EXISTS public.equipment_staff;
CREATE VIEW public.equipment_staff AS
SELECT id, category, brand, model, quantity, active, notes, created_at, updated_at,
       faulty_quantity, maintenance_quantity, reserved_quantity, in_use_quantity,
       GREATEST(quantity - faulty_quantity - maintenance_quantity - reserved_quantity - in_use_quantity, 0) AS available_quantity,
       GREATEST(quantity - faulty_quantity - maintenance_quantity, 0) AS healthy_quantity
FROM public.equipment e
WHERE active = true AND staff_has_perm('equipment.view'::text);

GRANT SELECT ON public.equipment_staff TO authenticated;

INSERT INTO public.permission_catalog (key, category, label, description, sort_order, active, created_at, updated_at)
VALUES (
  'equipment.update', 'Ekipman', 'Ekipman durum adedi güncelleme',
  'Sağlam, arızalı, bakımda, rezerve ve kullanımda adetlerini güncelleme',
  450, true, now(), now()
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  active = true,
  updated_at = now();
