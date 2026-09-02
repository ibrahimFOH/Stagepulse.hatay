/* Stagepulse Admin — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_BOOTSTRAPPED) return;
  window.STAGEPULSE_ADMIN_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());
  function fail(){ const c=document.getElementById('content'); if(!c)return; document.getElementById('loginView')?.classList.add('is-hidden'); const a=document.getElementById('appView'); if(a){a.hidden=false;a.classList.remove('is-hidden');} c.innerHTML='<div class="panel" role="alert"><h2>Yönetim paneli yüklenemedi</h2><p>Yönetim çekirdeği başlatılamadı.</p><button class="btn btn-primary" type="button" onclick="location.reload()">Yeniden dene</button></div>'; }
  const tag=document.createElement('script'); tag.src='admin-bundle.js?v=20260902-canonical'; tag.async=false; tag.onload=()=>{ if(typeof window.loadView!=='function') fail(); else {window.STAGEPULSE_ADMIN_READY=true;window.dispatchEvent(new CustomEvent('stagepulse:admin-ready'));} }; tag.onerror=fail; document.body.appendChild(tag);
})();
