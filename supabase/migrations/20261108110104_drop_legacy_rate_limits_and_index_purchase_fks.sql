drop table if exists private.rate_limits;

create index if not exists sesm_purchase_requests_license_id_idx
  on public.sesm_purchase_requests(license_id);

create index if not exists sesm_purchase_requests_reviewed_by_idx
  on public.sesm_purchase_requests(reviewed_by);

create index if not exists sesm_store_settings_updated_by_idx
  on public.sesm_store_settings(updated_by);
