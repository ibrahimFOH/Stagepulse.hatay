-- Canonical security ACL reconciliation recorded in production migration history.
revoke execute on function public.admin_set_offer_crew_pricing(uuid,integer,numeric) from public, anon;
revoke execute on function public.recalculate_offer_total(uuid) from public, anon;
revoke execute on function public.trg_recalculate_offer_total_crew() from public, anon;
revoke execute on function public.trg_recalculate_offer_total_items() from public, anon;
grant execute on function public.admin_set_offer_crew_pricing(uuid,integer,numeric) to authenticated;
grant execute on function public.recalculate_offer_total(uuid) to authenticated;
