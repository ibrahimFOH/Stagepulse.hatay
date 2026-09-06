begin;

-- Canonical RBAC permission path:
-- client/RLS -> public staff_has_perm wrapper -> private.staff_has_perm -> private.staff_has_exact_perm.
-- Keep the text overload temporarily because existing views/policies depend on it; its implementation
-- is now a compatibility shim rather than a second authorization implementation.
create or replace function public.staff_has_perm(p_keys text[])
returns boolean
language sql stable security invoker
set search_path to 'public, private, pg_temp'
as $$
  select private.staff_has_perm(p_keys);
$$;

create or replace function public.staff_has_perm(perm text)
returns boolean
language sql stable security invoker
set search_path to 'public, private, pg_temp'
as $$
  select private.staff_has_perm(array[perm]);
$$;

-- Private security-definer functions must never bounce back through the public compatibility layer.
do $$
declare r record;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.prosrc like '%public.staff_has_perm(%'
  loop
    execute replace(r.definition, 'public.staff_has_perm(', 'private.staff_has_perm(');
  end loop;
end $$;

-- Canonical command layer remains the single high-level authenticated action surface.
revoke execute on function public.stagepulse_command_action(text,text,uuid,jsonb) from anon;
grant execute on function public.stagepulse_command_action(text,text,uuid,jsonb) to authenticated;

-- Private schema is never a client API.
revoke usage on schema private from anon;
revoke usage on schema private from authenticated;

-- Record the consolidation contract without rewriting immutable historical migration rows.
comment on schema private is 'Stagepulse canonical security core. Client access only through explicit public wrappers/command RPCs; no direct client usage.';
comment on function public.staff_has_perm(text) is 'Compatibility wrapper only. Canonical implementation: private.staff_has_perm(text[]) -> private.staff_has_exact_perm(text).';
comment on function public.staff_has_perm(text[]) is 'Canonical public RBAC wrapper. Delegates to private.staff_has_perm(text[]).';

commit;
