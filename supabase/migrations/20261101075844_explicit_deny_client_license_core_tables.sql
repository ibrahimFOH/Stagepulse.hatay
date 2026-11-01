begin;
drop policy if exists license_core_deny_client_access on public.license_core;
create policy license_core_deny_client_access on public.license_core
  for all to anon, authenticated using (false) with check (false);

drop policy if exists license_core_audit_deny_client_access on public.license_core_audit;
create policy license_core_audit_deny_client_access on public.license_core_audit
  for all to anon, authenticated using (false) with check (false);

drop policy if exists license_core_devices_deny_client_access on public.license_core_devices;
create policy license_core_devices_deny_client_access on public.license_core_devices
  for all to anon, authenticated using (false) with check (false);

drop policy if exists license_entitlements_deny_client_access on public.license_entitlements;
create policy license_entitlements_deny_client_access on public.license_entitlements
  for all to anon, authenticated using (false) with check (false);

drop policy if exists license_product_entitlements_deny_client_access on public.license_product_entitlements;
create policy license_product_entitlements_deny_client_access on public.license_product_entitlements
  for all to anon, authenticated using (false) with check (false);

drop policy if exists license_products_deny_client_access on public.license_products;
create policy license_products_deny_client_access on public.license_products
  for all to anon, authenticated using (false) with check (false);
commit;
