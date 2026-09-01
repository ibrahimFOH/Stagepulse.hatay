begin;

-- Browser-facing offer inventory RPCs delegate to private SECURITY DEFINER
-- functions. The public entry points must therefore also execute as their
-- owner; the private functions continue to enforce auth.uid() + is_admin().
alter function public.admin_set_offer_inventory_reserved(uuid,uuid,numeric)
  security definer
  set search_path = public, pg_temp;

alter function public.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text)
  security definer
  set search_path = public, pg_temp;

notify pgrst, 'reload schema';
commit;
