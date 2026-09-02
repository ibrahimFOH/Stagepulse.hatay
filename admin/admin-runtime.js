/* Stagepulse Admin — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_BOOTSTRAPPED) return;
  window.STAGEPULSE_ADMIN_BOOTSTRAPPED = true;

  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());

  function fail(error) {
    console.error('[stagepulse-admin-boot]', error);
    const content = document.getElementById('content');
    if (!content) return;
    document.getElementById('loginView')?.classList.add('is-hidden');
    const app = document.getElementById('appView');
    if (app) { app.hidden = false; app.classList.remove('is-hidden'); }
    const offline = navigator.onLine === false;
    content.innerHTML = `<div class="panel" role="alert" aria-live="assertive"><h2>Yönetim paneli yüklenemedi</h2><p>${offline ? 'İnternet bağlantısı yok.' : 'Yönetim çekirdeği başlatılamadı.'}</p><button id="adminBootRetry" class="btn btn-primary btn-block" type="button">Yeniden dene</button></div>`;
    document.getElementById('adminBootRetry')?.addEventListener('click', () => location.reload());
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = false;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error(`Admin module failed: ${src}`));
      document.body.appendChild(tag);
    });
  }

  async function boot() {
    try {
      await loadScript('admin-bundle.js?v=20260902-offerfix5');
      if (typeof window.loadView !== 'function') throw new Error('Canonical admin bundle did not expose loadView');
      await loadScript('notifications-tools.js?v=20260902-notify1');
      window.STAGEPULSE_ADMIN_READY = true;
      window.dispatchEvent(new CustomEvent('stagepulse:admin-ready'));
      window.dispatchEvent(new CustomEvent('stagepulse-admin-ready'));
    } catch (error) {
      fail(error);
    }
  }

  window.addEventListener('online', () => {
    if (!window.STAGEPULSE_ADMIN_READY) boot();
  }, { once: true });
  boot();
})();
