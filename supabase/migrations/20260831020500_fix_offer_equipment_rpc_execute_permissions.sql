begin;

-- Keep the offer-equipment RPC callable by logged-in administrators.
-- The function body remains authoritative and checks private.is_admin().
revoke all on function public.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text) from public, anon;
grant execute on function public.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text) to authenticated;

-- Keep related inventory RPC privileges aligned.
revoke all on function public.admin_set_offer_inventory_reserved(uuid,uuid,numeric) from public, anon;
grant execute on function public.admin_set_offer_inventory_reserved(uuid,uuid,numeric) to authenticated;

revoke all on function public.admin_get_offer_inventory(uuid) from public, anon;
grant execute on function public.admin_get_offer_inventory(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
