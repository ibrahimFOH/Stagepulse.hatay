begin;

drop function if exists public.admin_get_offer_inventory(uuid);

create function public.admin_get_offer_inventory(p_offer_id uuid)
returns table(
  item_id uuid,
  equipment_id uuid,
  category text,
  brand text,
  model text,
  requested_qty numeric,
  unit_price numeric,
  total numeric,
  available_qty numeric,
  reserved_qty numeric,
  source_type text,
  notes text
)
language sql
security definer
set search_path='public','pg_temp'
as $$
  select oi.id,
         oi.equipment_id,
         e.category,
         e.brand,
         e.model,
         oi.quantity,
         oi.unit_price,
         oi.total,
         coalesce(e.available_quantity,0),
         coalesce(oi.inventory_reserved_qty,0),
         oi.source_type,
         oi.notes
  from public.offer_items oi
  join public.equipment e on e.id=oi.equipment_id
  where oi.offer_id=p_offer_id
    and private.is_admin()
  order by e.category,e.brand,e.model;
$$;

grant execute on function public.admin_get_offer_inventory(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
