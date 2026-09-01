/* Stagepulse Admin — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_BOOTSTRAPPED) return;
  window.STAGEPULSE_ADMIN_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => event.preventDefault());
  }
  const scripts = [
    'admin-module-renderers-v2.js','admin.js','admin-dashboard-runtime-v1.js','admin-supabase-bridge-v1.js',
    'admin-company-organization-v1.js','admin-org-accounts-v1.js','admin-org-scope-v1.js','auth-layer.js',
    'error-handling.js','event-date-sync.js','live-sync.js','../portal/inventory-ui-v3.js',
    'admin-equipment-route-v2.js','admin-equipment-parity-v1.js','admin-service-bom.js','admin-offer-wa-edit.js',
    'admin-offer-pdf-v1.js','admin-core-ui-v1.js','customer-offer-binding-v1.js','admin-offer-edit-media-fix-v1.js',
    'admin-offer-media-final-v1.js','admin-offer-edit-button-v2.js','admin-offer-crew-count-fix-v1.js',
    'admin-personnel-count-live-v1.js','admin-live-summary-counts-v1.js','admin-apk-input-fix-v1.js',
    'admin-offer-web-apk-final-fix-v1.js','site-media-manager.js','personel-yetki-v2.js','admin-business-flow-v1.js',
    'command-center-single-route.js','command-center-ai-v1.js','whatsapp-message-fix-v1.js','admin-final-hardening-v1.js',
    'admin-offer-final-fields-v1.js','admin-offer-pdf-auto-sync-v2.js','admin-runtime-repair-v1.js',
    'admin-routing-repair-v1.js','admin-completion-guard-v1.js','admin-rbac-control-center-v1.js','admin-menu-final.js',
    '../shared/notification-deeplink.js'
  ];
  const renderBootFailure = () => {
    const content = document.getElementById('content');
    if (!content) return;
    const login = document.getElementById('loginView');
    const app = document.getElementById('appView');
    if (login) { login.hidden = true; login.classList.add('is-hidden'); }
    if (app) { app.hidden = false; app.classList.remove('is-hidden'); }
    const offline = navigator.onLine === false;
    content.innerHTML = `<div class="panel" id="adminBootFailure" role="alert" aria-live="assertive" tabindex="-1"><h2>Yönetim paneli yüklenemedi</h2><p>${offline ? 'İnternet bağlantınız çevrimdışı görünüyor. Bağlantı geri geldiğinde yeniden deneyin.' : 'Gerekli modüller yüklenemedi. Lütfen yeniden deneyin.'}</p><button class="btn btn-primary" id="adminBootRetry" type="button"${offline ? ' disabled' : ''}>Yeniden dene</button></div>`;
    const panel = document.getElementById('adminBootFailure');
    const retry = document.getElementById('adminBootRetry');
    retry?.addEventListener('click', () => location.reload());
    panel?.focus();
    if (offline) window.addEventListener('online', () => {
      const message = panel?.querySelector('p');
      if (message) message.textContent = 'Bağlantı geri geldi. Paneli yeniden yüklemeyi deneyebilirsiniz.';
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
    tag.onerror = () => reject(new Error(`Admin module failed: ${path}`));
    document.body.appendChild(tag);
  }));
  chain.then(() => {
    window.STAGEPULSE_ADMIN_READY = true;
    window.dispatchEvent(new CustomEvent('stagepulse:admin-ready'));
  }).catch((error) => {
    console.error(error);
    renderBootFailure();
  });
})();
