/* APK-only legacy portal appearance. Web portal keeps the current UI. */
(() => {
  'use strict';
  try {
    const apk = new URLSearchParams(location.search).get('apk');
    if (!apk) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/portal/apk-legacy.css?v=20260902-legacy1';
    link.dataset.stagepulseApkLegacy = '1';
    document.head.appendChild(link);
  } catch (_) {}
})();
