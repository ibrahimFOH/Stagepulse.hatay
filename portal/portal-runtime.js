/* Stagepulse Portal — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_PORTAL_BOOTSTRAPPED) return;
  window.STAGEPULSE_PORTAL_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => event.preventDefault());
  }
  const scripts = [
    'session-isolation.js','portal.js','portal-modules.js','portal-permissions.js','admin-parity-v3.js',
    'portal-view-integrity.js','incoming-offers-ui.js','portal-auto-sync.js','portal-pricing-live.js',
    'password-recovery.js','fcm-config.js','/portal/vendor/firebase/firebase-app-compat.js',
    '/portal/vendor/firebase/firebase-messaging-compat.js','fcm-register-v3.js','live-sync.js',
    'inventory-ui-v3.js','portal-shell-parity.js','app-update.js','personnel-v2.js',
    'portal-crud.js','portal-crud-v2.js','personnel-v121.js','portal-menu-final.js','portal-jobs-fix.js',
    '/shared/notification-deeplink.js'
  ];
  const renderBootFailure = () => {
    const content = document.getElementById('content');
    if (!content) return;
    const login = document.getElementById('loginView');
    const app = document.getElementById('appView');
    if (login) { login.hidden = true; login.classList.add('is-hidden'); }
    if (app) { app.hidden = false; app.classList.remove('is-hidden'); }
    const offline = navigator.onLine === false;
    content.innerHTML = `<div class="panel" id="portalBootFailure" role="alert" aria-live="assertive" tabindex="-1"><h2>Portal yüklenemedi</h2><p>${offline ? 'İnternet bağlantınız çevrimdışı görünüyor. Bağlantı geri geldiğinde yeniden deneyin.' : 'Gerekli modüller yüklenemedi. Lütfen yeniden deneyin.'}</p><button class="btn btn-primary" id="portalBootRetry" type="button"${offline ? ' disabled' : ''}>Yeniden dene</button></div>`;
    const panel = document.getElementById('portalBootFailure');
    const retry = document.getElementById('portalBootRetry');
    retry?.addEventListener('click', () => location.reload());
    panel?.focus();
    if (offline) window.addEventListener('online', () => {
      const message = panel?.querySelector('p');
      if (message) message.textContent = 'Bağlantı geri geldi. Portalı yeniden yüklemeyi deneyebilirsiniz.';
      if (retry) retry.disabled = false;
      retry?.focus();
    }, { once: true });
  };
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
    renderBootFailure();
  });
})();
