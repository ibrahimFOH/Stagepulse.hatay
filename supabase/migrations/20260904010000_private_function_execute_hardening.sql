begin;

-- Internal private helpers must never be callable by anon.
-- Privileged command RPCs remain blocked in public until a safe private wrapper
-- migration is reviewed/applied; no client-facing API contract is changed here.
revoke usage on schema private from anon;
revoke all on all functions in schema private from anon;

grant usage on schema private to authenticated;

-- Explicitly preserve least privilege for the known internal helpers.
revoke all on function private.admin_delete_offer_attachment(uuid) from public, anon, authenticated;
revoke all on function private.admin_get_offer_inventory(uuid) from public, anon, authenticated;
revoke all on function private.admin_has_capability(text) from public, anon, authenticated;
revoke all on function private.admin_reserve_offer_inventory(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function private.admin_set_offer_attachment_visibility(uuid, boolean) from public, anon, authenticated;
revoke all on function private.admin_set_offer_crew_count(uuid, integer) from public, anon, authenticated;
revoke all on function private.admin_set_offer_item_pricing(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function private.ensure_quote_public_code(uuid) from public, anon, authenticated;
revoke all on function private.is_active_staff() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.is_org_owner() from public, anon, authenticated;
revoke all on function private.is_user_assigned_to_event(uuid) from public, anon, authenticated;
revoke all on function private.staff_has_exact_perm(text) from public, anon, authenticated;
revoke all on function private.staff_has_perm(text[]) from public, anon, authenticated;

commit;
