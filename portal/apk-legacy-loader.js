/* Stagepulse legacy portal appearance — APK and portal web. */
(() => {
  'use strict';
  try {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/portal/legacy-portal.css?v=20260902-legacy2';
    link.dataset.stagepulseLegacyPortal = '1';
    document.head.appendChild(link);
  } catch (_) {}
})();
