begin;

grant execute on function public.admin_set_offer_pdf_visibility(uuid,boolean) to authenticated;
grant execute on function public.admin_set_offer_crew_count(uuid,integer) to authenticated;
grant execute on function public.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.admin_set_offer_inventory_reserved(uuid,uuid,numeric) to authenticated;
grant execute on function public.admin_get_offer_inventory(uuid) to authenticated;
grant execute on function public.admin_remove_offer_item_equipment(uuid,uuid) to authenticated;

commit;
