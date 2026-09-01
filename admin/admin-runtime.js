/* Stagepulse Admin — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_BOOTSTRAPPED) return;
  window.STAGEPULSE_ADMIN_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());
  const scripts = ['admin-module-renderers-v2.js','admin.js','admin-dashboard-runtime-v1.js','admin-supabase-bridge-v1.js','admin-company-organization-v1.js','admin-org-accounts-v1.js','admin-org-scope-v1.js','auth-layer.js','error-handling.js','event-date-sync.js','live-sync.js','inventory-ui-v4.js','admin-service-bom.js','admin-offer-wa-edit.js','admin-offer-pdf-v1.js','admin-core-ui-v1.js','customer-offer-binding-v1.js','admin-offer-edit-media-fix-v1.js','admin-offer-media-final-v1.js','admin-offer-edit-button-v2.js','admin-offer-crew-count-fix-v1.js','admin-personnel-count-live-v1.js','admin-live-summary-counts-v1.js','admin-apk-input-fix-v1.js','admin-offer-web-apk-final-fix-v1.js','site-media-manager.js','personel-yetki-v2.js','admin-business-flow-v1.js','command-center-single-route.js','command-center-ai-v1.js','whatsapp-message-fix-v1.js','admin-final-hardening-v1.js','admin-offer-final-fields-v1.js','admin-offer-pdf-auto-sync-v2.js','admin-runtime-repair-v1.js','admin-completion-guard-v1.js','admin-rbac-control-center-v1.js','admin-menu-final.js','../shared/notification-deeplink.js'];
  function renderBootFailure(failedPath) {
    const content = document.getElementById('content');
    if (!content) return;
    const offline = navigator.onLine === false;
    document.getElementById('loginView')?.classList.add('is-hidden');
    const app = document.getElementById('appView');
    if (app) { app.hidden = false; app.classList.remove('is-hidden'); }
    const reason = offline ? 'İnternet bağlantısı yok. Bağlantıyı kontrol edip yeniden deneyin.' : `Gerekli yönetim çekirdeği başlatılamadı${failedPath ? `: ${failedPath}` : '.'}`;
    content.innerHTML = `<div class="panel" id="adminBootFailure" role="alert" aria-live="assertive" tabindex="-1"><h2>${offline ? 'Bağlantı yok' : 'Yönetim paneli yüklenemedi'}</h2><p>${reason}</p><button class="btn btn-primary" id="adminBootRetry" type="button">Yeniden dene</button></div>`;
    document.getElementById('adminBootRetry')?.addEventListener('click', () => location.reload());
    document.getElementById('adminBootFailure')?.focus();
  }
  function loadScript(path) { return new Promise((resolve, reject) => { const tag = document.createElement('script'); tag.src = `${path}?v=20260902-canonical`; tag.async = false; tag.onload = () => resolve(path); tag.onerror = () => reject(new Error(`Admin module failed: ${path}`)); document.body.appendChild(tag); }); }
  let chain = Promise.resolve();
  for (const path of scripts) chain = chain.then(() => loadScript(path).catch((error) => { console.warn('[Stagepulse admin] optional module skipped:', error.message); return path; }));
  chain.then(() => { if (typeof window.loadView !== 'function') { renderBootFailure('admin.js'); return; } window.STAGEPULSE_ADMIN_READY = true; window.dispatchEvent(new CustomEvent('stagepulse:admin-ready')); }).catch((error) => { console.error('[Stagepulse admin boot]', error); renderBootFailure(error?.message || 'unknown'); });
})();
