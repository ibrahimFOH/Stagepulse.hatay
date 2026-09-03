begin;

do $$
declare
  r record;
begin
  for r in
    select p.oid,
           n.nspname as schema_name,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = 'admin_delete_offer'
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon', r.schema_name, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to authenticated', r.schema_name, r.proname, r.args);
  end loop;
end $$;

commit;
