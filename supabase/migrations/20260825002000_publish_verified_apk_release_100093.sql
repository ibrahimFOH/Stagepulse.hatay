UPDATE public.app_versions
SET web_version = '1.0.93',
    apk_version = 100093,
    minimum_version = 100093,
    apk_url = CASE platform
      WHEN 'admin' THEN 'https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v1.0.93/Stagepulse-Admin-v1.0.93.apk'
      WHEN 'staff' THEN 'https://github.com/ibrahimFOH/Stagepulse.hatay/releases/download/v1.0.93/Stagepulse-Personel-v1.0.93.apk'
    END,
    apk_sha256 = CASE platform
      WHEN 'admin' THEN '78af1c2f2646ca73c4cb9ffd871dabc8356c492d05490865d9429cde9b6c3b80'
      WHEN 'staff' THEN '6c0db6fdbe5ed48be422c33fe2107b94c08e5141a554531232fe8fe9c7d98323'
    END,
    notes = CASE platform
      WHEN 'admin' THEN 'Verified release v1.0.93; Admin APK'
      WHEN 'staff' THEN 'Verified release v1.0.93; Personel APK'
    END,
    updated_at = now()
WHERE platform IN ('admin', 'staff');
