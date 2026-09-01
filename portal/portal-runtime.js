/* Stagepulse Portal — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_PORTAL_BOOTSTRAPPED) return;
  window.STAGEPULSE_PORTAL_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.method = 'post';
    loginForm.action = '/portal/';
    loginForm.addEventListener('submit', (event) => event.preventDefault());
  }
  const scripts = [
    'session-isolation.js','portal.js','portal-modules.js','portal-permissions.js','admin-parity-v3.js',
    'portal-view-integrity.js','incoming-offers-ui.js','portal-auto-sync.js','portal-pricing-live.js',
    'password-recovery.js','fcm-config.js','/portal/vendor/firebase/firebase-app-compat.js',
    '/portal/vendor/firebase/firebase-messaging-compat.js','fcm-register-v3.js','live-sync.js',
    'inventory-ui-v3.js','inventory-ui-v4.js','portal-shell-parity.js','app-update.js','personnel-v2.js',
    'portal-crud.js','portal-crud-v2.js','personnel-v121.js','portal-menu-final.js','portal-jobs-fix.js',
    '/shared/notification-deeplink.js'
  ];
  let chain = Promise.resolve();
  for (const path of scripts) chain = chain.then(() => new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = `${path}?v=20260831-canonical`;
    tag.async = false;
    tag.onload = resolve;
    tag.onerror = () => reject(new Error(`Portal module failed: ${path}`));
    document.body.appendChild(tag);
  }));
  chain.then(() => {
    window.STAGEPULSE_PORTAL_READY = true;
    window.dispatchEvent(new CustomEvent('stagepulse:portal-ready'));
  }).catch((error) => {
    console.error(error);
    const content = document.getElementById('content');
    if (content) content.innerHTML = '<div class="panel"><h2>Portal yüklenemedi</h2><p>Lütfen sayfayı yenileyin.</p></div>';
  });
})();
