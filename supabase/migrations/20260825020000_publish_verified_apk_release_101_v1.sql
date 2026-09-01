UPDATE public.app_versions
SET web_version = '1.0.101',
    apk_version = 100101,
    minimum_version = 100101,
    apk_url = CASE platform
      WHEN 'admin' THEN 'https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v1.0.101/Stagepulse-Admin-v1.0.101.apk'
      WHEN 'staff' THEN 'https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v1.0.101/Stagepulse-Personel-v1.0.101.apk'
    END,
    apk_sha256 = CASE platform
      WHEN 'admin' THEN '271b78c0baf89f741e333c4b2bfddc8a6db32549a39b2a031ab3a7b50e1c1a38'
      WHEN 'staff' THEN '5e6d1c1b5c1759b12a04a8e0ccf5bbfe40134127305f33ba75f883d2dd9b3679'
    END,
    notes = CASE platform
      WHEN 'admin' THEN 'Verified release v1.0.101; Admin APK'
      WHEN 'staff' THEN 'Verified release v1.0.101; Personel APK'
    END,
    updated_at = now()
WHERE platform IN ('admin', 'staff');
