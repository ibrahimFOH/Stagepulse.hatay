begin;

-- Reconcile exposed ACLs with the canonical admin/RBAC runtime.
-- These functions are never public intake APIs; anonymous execution is forbidden.
revoke execute on function public.admin_set_offer_crew_pricing(uuid,integer,numeric) from anon;
revoke execute on function public.recalculate_offer_total(uuid) from anon;
revoke execute on function public.trg_recalculate_offer_total_crew() from anon;
revoke execute on function public.trg_recalculate_offer_total_items() from anon;

commit;
