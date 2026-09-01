-- Publish the verified GitHub Release v1.0.172 to the OTA manifest.
-- SHA-256 values are taken from the immutable GitHub release assets.
update public.app_versions
set web_version = '1.0.172',
    apk_version = 1000172,
    minimum_version = 1000169,
    apk_url = 'https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v1.0.172/Stagepulse-Admin-v1.0.172.apk',
    apk_sha256 = 'dd1be2b895879f9cd42b6e1ff6c0c0ca9a9402e69a922807a852489bc76547b2',
    notes = 'Verified Admin APK v1.0.172',
    updated_at = now()
where platform = 'admin';

update public.app_versions
set web_version = '1.0.172',
    apk_version = 1000172,
    minimum_version = 1000169,
    apk_url = 'https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v1.0.172/Stagepulse-Personel-v1.0.172.apk',
    apk_sha256 = '2995a5d5cf73d0578d4d294e61757e9f950449de8ae5785538e21764aa345bab',
    notes = 'Verified Personel APK v1.0.172',
    updated_at = now()
where platform = 'staff';

-- Fail the migration rather than silently publishing incomplete OTA metadata.
do $$
begin
  if exists (
    select 1 from public.app_versions
    where platform in ('admin','staff')
      and (apk_version <> 1000172 or apk_url is null or apk_sha256 is null or length(apk_sha256) <> 64)
  ) then
    raise exception 'v1.0.172 OTA metadata verification failed';
  end if;
end $$;
