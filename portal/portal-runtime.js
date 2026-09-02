/* Stagepulse Portal — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_PORTAL_BOOTSTRAPPED) return;
  window.STAGEPULSE_PORTAL_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());
  function fail(){ const c=document.getElementById('content'); if(!c)return; document.getElementById('loginView')?.classList.add('is-hidden'); const a=document.getElementById('appView'); if(a){a.hidden=false;a.classList.remove('is-hidden');} c.innerHTML='<div class="panel" role="alert"><h2>Portal yüklenemedi</h2><p>Personel çekirdeği başlatılamadı.</p><button class="btn btn-primary" type="button" onclick="location.reload()">Yeniden dene</button></div>'; }
  const tag=document.createElement('script'); tag.src='portal-bundle.js?v=20260902-canonical'; tag.async=false; tag.onload=()=>{ if(!window.loadView) fail(); else {window.STAGEPULSE_PORTAL_READY=true;window.dispatchEvent(new CustomEvent('stagepulse:portal-ready'));} }; tag.onerror=fail; document.body.appendChild(tag);
})();
