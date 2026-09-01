begin;
drop policy if exists org_memberships_self_or_owner_read on public.org_memberships;
create policy org_memberships_self_or_owner_read on public.org_memberships for select to authenticated using (user_id=(select auth.uid()) or public.is_org_owner());
commit;
