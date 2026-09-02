/* Stagepulse Admin — single canonical entrypoint. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_BOOTSTRAPPED) return;
  window.STAGEPULSE_ADMIN_BOOTSTRAPPED = true;
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());
  function fail(){ const c=document.getElementById('content'); if(!c)return; document.getElementById('loginView')?.classList.add('is-hidden'); const a=document.getElementById('appView'); if(a){a.hidden=false;a.classList.remove('is-hidden');} c.innerHTML='<div class="panel" role="alert"><h2>Yönetim paneli yüklenemedi</h2><p>Yönetim çekirdeği başlatılamadı.</p><button class="btn btn-primary btn-block" type="button" onclick="location.reload()">Yeniden dene</button></div>'; }
  function loadNotificationsTools(done){
    if(window.STAGEPULSE_ADMIN_NOTIFICATIONS_TOOLS) return done();
    const tool=document.createElement('script');
    tool.src='notifications-tools.js?v=20260902-notify1';
    tool.async=false;
    tool.onload=()=>{window.STAGEPULSE_ADMIN_NOTIFICATIONS_TOOLS=true;done();};
    tool.onerror=()=>done();
    document.body.appendChild(tool);
  }
  const tag=document.createElement('script');
  tag.src='admin-bundle.js?v=20260902-offerfix5';
  tag.async=false;
  tag.onload=()=>{
    if(typeof window.loadView!=='function') return fail();
    loadNotificationsTools(()=>{
      window.STAGEPULSE_ADMIN_READY=true;
      window.dispatchEvent(new CustomEvent('stagepulse:admin-ready'));
    });
  };
  tag.onerror=fail;
  document.body.appendChild(tag);
})();
