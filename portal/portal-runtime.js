/* Stagepulse Portal — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_PORTAL_BOOTSTRAPPED) return;
  window.STAGEPULSE_PORTAL_BOOTSTRAPPED = true;

  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());

  const scripts = [
    'session-isolation.js','portal.js','portal-modules.js','portal-permissions.js','admin-parity-v3.js',
    'portal-view-integrity.js','incoming-offers-ui.js','portal-auto-sync.js','portal-pricing-live.js',
    'password-recovery.js','fcm-config.js','/portal/vendor/firebase/firebase-app-compat.js',
    '/portal/vendor/firebase/firebase-messaging-compat.js','fcm-register-v3.js','live-sync.js',
    'inventory-ui-v3.js','portal-shell-parity.js','app-update.js','personnel-v2.js',
    'portal-crud.js','portal-crud-v2.js','personnel-v121.js','portal-menu-final.js','portal-jobs-fix.js',
    '/shared/notification-deeplink.js'
  ];

  function renderBootFailure(failedPath) {
    const content = document.getElementById('content');
    if (!content) return;
    document.getElementById('loginView')?.classList.add('is-hidden');
    const app = document.getElementById('appView');
    if (app) { app.hidden = false; app.classList.remove('is-hidden'); }
    content.innerHTML = `<div class="panel" id="portalBootFailure" role="alert" aria-live="assertive" tabindex="-1"><h2>Portal yüklenemedi</h2><p>Gerekli personel modülü başlatılamadı${failedPath ? `: ${failedPath}` : '.'}</p><button class="btn btn-primary" id="portalBootRetry" type="button">Yeniden dene</button></div>`;
    document.getElementById('portalBootRetry')?.addEventListener('click', () => location.reload());
    document.getElementById('portalBootFailure')?.focus();
  }

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = `${path}?v=20260901-canonical`;
      tag.async = false;
      tag.onload = () => resolve(path);
      tag.onerror = () => reject(new Error(`Portal module failed: ${path}`));
      document.body.appendChild(tag);
    });
  }

  // Keep the existing module order. A non-critical module must not blank
  // the entire personnel portal; the canonical permissions gateway remains authoritative.
  let chain = Promise.resolve();
  for (const path of scripts) {
    chain = chain.then(() => loadScript(path).catch((error) => {
      console.warn('[Stagepulse portal] optional module skipped:', error.message);
      return path;
    }));
  }

  chain.then(() => {
    if (!window.loadView) {
      renderBootFailure('portal-permissions.js');
      return;
    }
    window.STAGEPULSE_PORTAL_READY = true;
    window.dispatchEvent(new CustomEvent('stagepulse:portal-ready'));
  }).catch((error) => {
    console.error('[Stagepulse portal boot]', error);
    renderBootFailure(error?.message || 'unknown');
  });
})();
