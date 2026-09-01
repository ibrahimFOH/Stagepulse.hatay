begin;
create schema if not exists private;

do $$
declare r record; arg_sql text; call_sql text; result_sql text; wrapper_sql text; volatility_sql text; i integer; arg_name text; private_exists boolean;
begin
  for r in select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) identity_args,pg_get_function_arguments(p.oid) function_args,pg_get_function_result(p.oid) result_type,p.proretset,p.provolatile,p.proisstrict,p.pronargs,p.proargnames from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosecdef and has_function_privilege('authenticated',p.oid,'execute') and p.proname not in ('sync_job_to_event_project','can_use_admin_capability') loop
    arg_sql:=r.function_args; call_sql:='';
    if r.pronargs>0 and r.proargnames is not null then for i in 1..r.pronargs loop arg_name:=r.proargnames[i]; if i>1 then call_sql:=call_sql||', '; end if; call_sql:=call_sql||format('%I',arg_name); end loop; end if;
    volatility_sql:=case r.provolatile when 'i' then 'IMMUTABLE' when 's' then 'STABLE' else 'VOLATILE' end;
    select exists(select 1 from pg_proc pp join pg_namespace pn on pn.oid=pp.pronamespace where pn.nspname='private' and pp.proname=r.proname and pg_get_function_identity_arguments(pp.oid)=r.identity_args) into private_exists;
    if not private_exists then execute format('alter function public.%I(%s) set schema private',r.proname,r.identity_args); end if;
    if r.proretset then result_sql:=format('select * from private.%I(%s)',r.proname,call_sql); else result_sql:=format('select private.%I(%s)',r.proname,call_sql); end if;
    wrapper_sql:=format('create or replace function public.%I(%s) returns %s language sql %s security invoker as $fn$ %s; $fn$',r.proname,arg_sql,r.result_type,volatility_sql,result_sql);
    execute wrapper_sql;
    if r.proisstrict then execute format('alter function public.%I(%s) strict',r.proname,r.identity_args); end if;
    execute format('revoke execute on function private.%I(%s) from public, anon, authenticated',r.proname,r.identity_args);
  end loop;
end $$;
commit;
