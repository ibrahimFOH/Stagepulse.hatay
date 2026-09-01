begin;

drop policy if exists admin_full_teklifler_delete on public.teklifler;

create policy admin_full_teklifler_delete
on public.teklifler
for delete
to authenticated
using (
  private.is_admin()
  or public.staff_has_perm('offers.delete')
);

commit;
