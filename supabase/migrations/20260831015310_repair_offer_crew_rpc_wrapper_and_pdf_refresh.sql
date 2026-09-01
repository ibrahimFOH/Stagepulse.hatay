begin;

-- The exposed crew wrapper was INVOKER while its implementation lives in private.
-- This made the browser receive "permission denied for function admin_set_offer_crew_count".
create or replace function public.admin_set_offer_crew_count(p_offer_id uuid, p_crew_count integer)
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  select private.admin_set_offer_crew_count(p_offer_id,p_crew_count);
$$;

revoke all on function public.admin_set_offer_crew_count(uuid,integer) from public;
grant execute on function public.admin_set_offer_crew_count(uuid,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
