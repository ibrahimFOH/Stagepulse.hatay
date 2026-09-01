begin;
create or replace function private.refresh_equipment_available(p_equipment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.equipment e
 set available_quantity=greatest(0,e.quantity-coalesce(e.faulty_quantity,0)-coalesce(e.maintenance_quantity,0)-coalesce(e.reserved_quantity,0)-coalesce(e.in_use_quantity,0))
 where e.id=p_equipment_id;
end;$$;
create or replace function private.admin_set_offer_inventory_reserved(p_offer_id uuid,p_equipment_id uuid,p_reserved_qty numeric)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_avail integer; v_old numeric;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_reserved_qty < 0 then raise exception 'Rezerv miktarı negatif olamaz.'; end if;
 select available_quantity,reserved_quantity into v_avail,v_old from public.equipment where id=p_equipment_id and active for update;
 if v_avail is null then raise exception 'Ekipman bulunamadı.'; end if;
 select inventory_reserved_qty into v_old from public.offer_items where offer_id=p_offer_id and equipment_id=p_equipment_id for update;
 v_old:=coalesce(v_old,0);
 if p_reserved_qty>v_old and p_reserved_qty-v_old>v_avail then raise exception 'Yetersiz stok: % adet kullanılabilir.',v_avail; end if;
 update public.equipment set reserved_quantity=greatest(0,reserved_quantity+(p_reserved_qty-v_old)) where id=p_equipment_id;
 perform private.refresh_equipment_available(p_equipment_id);
 update public.offer_items set inventory_reserved_qty=p_reserved_qty,inventory_available_qty=(select available_quantity from public.equipment where id=p_equipment_id),updated_at=now() where offer_id=p_offer_id and equipment_id=p_equipment_id;
 if not found then raise exception 'Teklif ekipman kalemi bulunamadı.'; end if;
 return true;
end;$$;
create or replace function private.admin_remove_offer_item_equipment(p_offer_id uuid,p_equipment_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_reserved numeric;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 select inventory_reserved_qty into v_reserved from public.offer_items where offer_id=p_offer_id and equipment_id=p_equipment_id for update;
 if not found then return false; end if;
 if coalesce(v_reserved,0)>0 then update public.equipment set reserved_quantity=greatest(0,reserved_quantity-v_reserved) where id=p_equipment_id; perform private.refresh_equipment_available(p_equipment_id); end if;
 delete from public.offer_items where offer_id=p_offer_id and equipment_id=p_equipment_id;
 return true;
end;$$;
commit;
