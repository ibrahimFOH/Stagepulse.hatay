/* Stagepulse Admin — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_BOOTSTRAPPED) return;
  window.STAGEPULSE_ADMIN_BOOTSTRAPPED = true;
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
    'admin-routing-repair-v1.js','admin-completion-guard-v1.js','admin-rbac-control-center-v1.js','admin-menu-final.js'
  ];
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
    const content = document.getElementById('content');
    if (content) content.innerHTML = '<div class="panel"><h2>Yönetim paneli yüklenemedi</h2><p>Lütfen sayfayı yenileyin.</p></div>';
  });
})();
