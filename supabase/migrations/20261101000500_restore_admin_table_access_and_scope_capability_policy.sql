begin;

-- Restore signed-in admin table access; RLS remains the row-level gate.
grant select, insert, update, delete on table public.teklifler to authenticated;
grant select, insert, update, delete on table public.settlements to authenticated;

-- Capability catalog is used by signed-in administration screens only.
drop policy if exists admin_capabilities_admin_all on public.admin_capabilities;
create policy admin_capabilities_admin_all
  on public.admin_capabilities
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

commit;
