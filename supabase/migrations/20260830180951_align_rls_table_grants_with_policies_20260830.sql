begin;
do $$
declare r record;
begin
  for r in select distinct c.relname table_name,
    case when exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.roles @> array['authenticated']::name[] and p.cmd='SELECT') then 'select' end grant_select,
    case when exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.roles @> array['authenticated']::name[] and p.cmd='INSERT') then 'insert' end grant_insert,
    case when exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.roles @> array['authenticated']::name[] and p.cmd='UPDATE') then 'update' end grant_update,
    case when exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.roles @> array['authenticated']::name[] and p.cmd='DELETE') then 'delete' end grant_delete
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity loop
      if r.grant_select is not null then execute format('grant select on table public.%I to authenticated',r.table_name); end if;
      if r.grant_insert is not null then execute format('grant insert on table public.%I to authenticated',r.table_name); end if;
      if r.grant_update is not null then execute format('grant update on table public.%I to authenticated',r.table_name); end if;
      if r.grant_delete is not null then execute format('grant delete on table public.%I to authenticated',r.table_name); end if;
  end loop;
end $$;
commit;
