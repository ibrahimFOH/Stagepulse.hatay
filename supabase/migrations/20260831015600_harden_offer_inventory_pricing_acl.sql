begin;
revoke all on function private.admin_set_offer_item_pricing(uuid,uuid,numeric,numeric) from anon;
revoke all on function public.admin_set_offer_item_pricing(uuid,uuid,numeric,numeric) from anon;
revoke all on function public.admin_get_offer_inventory(uuid) from anon;
grant execute on function private.admin_set_offer_item_pricing(uuid,uuid,numeric,numeric) to authenticated;
grant execute on function public.admin_set_offer_item_pricing(uuid,uuid,numeric,numeric) to authenticated;
grant execute on function public.admin_get_offer_inventory(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
