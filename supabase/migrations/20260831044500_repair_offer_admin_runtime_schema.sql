begin;

-- Production offer_items does not contain updated_at.
-- Keep browser-facing offer inventory RPCs aligned with the live schema.
create or replace function private.admin_upsert_offer_item_equipment(
  p_offer_id uuid,
  p_equipment_id uuid,
  p_quantity numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_available numeric;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
  end if;
  if p_quantity <= 0 then
    raise exception 'Miktar 0dan büyük olmalı.';
  end if;
  select available_quantity into v_available
  from public.equipment
  where id=p_equipment_id and active
  for update;
  if v_available is null then
    raise exception 'Ekipman bulunamadı.';
  end if;
  select id into v_id
  from public.offer_items
  where offer_id=p_offer_id and equipment_id=p_equipment_id
  limit 1;
  if v_id is null then
    insert into public.offer_items(
      offer_id,equipment_id,description,quantity,unit_price,unit_cost,notes,
      source_type,inventory_reserved_qty,inventory_available_qty
    )
    select p_offer_id,e.id,trim(concat_ws(' ',e.category,e.brand,e.model)),
           p_quantity,e.daily_price,e.daily_cost,p_notes,'inventory',0,v_available
    from public.equipment e
    where e.id=p_equipment_id
    returning id into v_id;
  else
    update public.offer_items
    set quantity=p_quantity,
        notes=p_notes,
        inventory_available_qty=v_available,
        source_type='inventory'
    where id=v_id;
  end if;
  return v_id;
end;
$$;

create or replace function private.admin_set_offer_inventory_reserved(
  p_offer_id uuid,
  p_equipment_id uuid,
  p_reserved_qty numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avail integer;
  v_old numeric;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
  end if;
  if p_reserved_qty < 0 then
    raise exception 'Rezerv miktarı negatif olamaz.';
  end if;
  select available_quantity,reserved_quantity into v_avail,v_old
  from public.equipment
  where id=p_equipment_id and active
  for update;
  if v_avail is null then
    raise exception 'Ekipman bulunamadı.';
  end if;
  select inventory_reserved_qty into v_old
  from public.offer_items
  where offer_id=p_offer_id and equipment_id=p_equipment_id
  for update;
  v_old := coalesce(v_old,0);
  if p_reserved_qty > v_old and p_reserved_qty-v_old > v_avail then
    raise exception 'Yetersiz stok: % adet kullanılabilir.',v_avail;
  end if;
  update public.equipment
  set reserved_quantity=greatest(0,reserved_quantity+(p_reserved_qty-v_old))
  where id=p_equipment_id;
  perform private.refresh_equipment_available(p_equipment_id);
  update public.offer_items
  set inventory_reserved_qty=p_reserved_qty,
      inventory_available_qty=(select available_quantity from public.equipment where id=p_equipment_id)
  where offer_id=p_offer_id and equipment_id=p_equipment_id;
  if not found then
    raise exception 'Teklif ekipman kalemi bulunamadı.';
  end if;
  return true;
end;
$$;

alter function public.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text)
  security definer set search_path=public,pg_temp;
alter function public.admin_set_offer_inventory_reserved(uuid,uuid,numeric)
  security definer set search_path=public,pg_temp;

grant execute on function public.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.admin_set_offer_inventory_reserved(uuid,uuid,numeric) to authenticated;

notify pgrst, 'reload schema';
commit;
