begin;
create or replace function private.admin_set_offer_item_pricing(p_offer_id uuid,p_equipment_id uuid,p_quantity numeric,p_unit_price numeric)
returns boolean language plpgsql security definer set search_path='public','pg_temp' as $$
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_quantity<=0 then raise exception 'Adet 0dan büyük olmalı.'; end if;
 if p_unit_price<0 then raise exception 'Birim fiyat negatif olamaz.'; end if;
 update public.offer_items set quantity=p_quantity,unit_price=p_unit_price where offer_id=p_offer_id and equipment_id=p_equipment_id;
 if not found then raise exception 'Teklif ekipman kalemi bulunamadı.'; end if;
 return true;
end;
$$;
notify pgrst,'reload schema';
commit;
