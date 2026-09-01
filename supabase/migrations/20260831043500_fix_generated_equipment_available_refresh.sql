begin;

-- available_quantity is generated from the inventory source fields.
-- Never update the generated column directly; touching updated_at is enough
-- to persist the inventory change while PostgreSQL recalculates availability.
create or replace function private.refresh_equipment_available(p_equipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.equipment
  set updated_at = now()
  where id = p_equipment_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
