begin;
grant usage on schema private to anon, authenticated;
do $$
declare r record;
begin
  for r in select p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and exists(select 1 from pg_proc w join pg_namespace wn on wn.oid=w.pronamespace where wn.nspname='public' and w.proname=p.proname and pg_get_function_identity_arguments(w.oid)=pg_get_function_identity_arguments(p.oid)) loop
    execute format('grant execute on function private.%I(%s) to anon, authenticated',r.proname,r.args);
  end loop;
end $$;
commit;
