/* Stagepulse Portal — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_PORTAL_BOOTSTRAPPED) return;
  window.STAGEPULSE_PORTAL_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());
  function fail(error){
    console.error('[stagepulse-portal-boot]', error);
    const c=document.getElementById('content'); if(!c)return;
    document.getElementById('loginView')?.classList.add('is-hidden');
    const a=document.getElementById('appView'); if(a){a.hidden=false;a.classList.remove('is-hidden');}
    const offline=navigator.onLine===false;
    c.innerHTML=`<div class="panel" role="alert" aria-live="assertive"><h2>Portal yüklenemedi</h2><p>${offline?'İnternet bağlantısı yok.':'Personel çekirdeği başlatılamadı.'}</p><button id="portalBootRetry" class="btn btn-primary" type="button">Yeniden dene</button></div>`;
    document.getElementById('portalBootRetry')?.addEventListener('click',()=>location.reload());
  }
  const tag=document.createElement('script');
  tag.src='portal-bundle.js?v=20260902-canonical';
  tag.async=false;
  tag.onload=()=>{ if(!window.loadView) fail(new Error('Canonical portal bundle did not expose loadView')); else {window.STAGEPULSE_PORTAL_READY=true;window.dispatchEvent(new CustomEvent('stagepulse:portal-ready'));window.dispatchEvent(new CustomEvent('stagepulse-portal-ready'));} };
  tag.onerror=()=>fail(new Error('Portal bundle failed to load'));
  document.body.appendChild(tag);
})();
