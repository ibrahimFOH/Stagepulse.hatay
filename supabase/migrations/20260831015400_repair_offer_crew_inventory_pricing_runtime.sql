begin;

grant execute on function private.admin_set_offer_crew_count(uuid,integer) to authenticated;

drop function if exists public.admin_get_offer_inventory(uuid);
create function public.admin_get_offer_inventory(p_offer_id uuid)
returns table(item_id uuid,equipment_id uuid,category text,brand text,model text,requested_qty numeric,available_qty numeric,reserved_qty numeric,source_type text,notes text,unit_price numeric,total numeric)
language sql set search_path='' as $$
select oi.id,oi.equipment_id,e.category,e.brand,e.model,oi.quantity,coalesce(e.available_quantity,0),oi.inventory_reserved_qty,oi.source_type,oi.notes,coalesce(oi.unit_price,0),coalesce(oi.total,0)
from public.offer_items oi join public.equipment e on e.id=oi.equipment_id
where oi.offer_id=p_offer_id and private.is_admin()
order by e.category,e.brand,e.model;
$$;
grant execute on function public.admin_get_offer_inventory(uuid) to authenticated;

create or replace function private.admin_set_offer_item_pricing(p_offer_id uuid,p_equipment_id uuid,p_quantity numeric,p_unit_price numeric)
returns boolean language plpgsql security definer set search_path='public','pg_temp' as $$
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_quantity<=0 then raise exception 'Adet 0dan büyük olmalı.'; end if;
 if p_unit_price<0 then raise exception 'Birim fiyat negatif olamaz.'; end if;
 update public.offer_items set quantity=p_quantity,unit_price=p_unit_price,total=p_quantity*p_unit_price where offer_id=p_offer_id and equipment_id=p_equipment_id;
 if not found then raise exception 'Teklif ekipman kalemi bulunamadı.'; end if;
 return true;
end;
$$;

create or replace function public.admin_set_offer_item_pricing(p_offer_id uuid,p_equipment_id uuid,p_quantity numeric,p_unit_price numeric)
returns boolean language sql security definer set search_path='public','pg_temp' as $$ select private.admin_set_offer_item_pricing(p_offer_id,p_equipment_id,p_quantity,p_unit_price); $$;

grant execute on function private.admin_set_offer_item_pricing(uuid,uuid,numeric,numeric) to authenticated;
grant execute on function public.admin_set_offer_item_pricing(uuid,uuid,numeric,numeric) to authenticated;
notify pgrst,'reload schema';
commit;
