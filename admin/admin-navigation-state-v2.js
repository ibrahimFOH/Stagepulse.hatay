/* Stagepulse Admin — canonical active navigation state. */
(() => {
  'use strict';
  if(window.STAGEPULSE_ADMIN_NAV_STATE_V2)return;
  window.STAGEPULSE_ADMIN_NAV_STATE_V2=true;
  const sync=view=>{
    const v=String(view||'').toLowerCase();
    document.querySelectorAll('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',(b.dataset.view||'').toLowerCase()===v));
    const settingsRelated=['organization','scope','accounts','rbac'];
    if(settingsRelated.includes(v)) document.querySelector('#sideNav button[data-view="settings"]')?.classList.remove('active');
    const org=document.getElementById('orgDashboardNav');if(org)org.classList.toggle('active',v==='organization');
  };
  const hook=()=>{
    const original=window.loadView;if(typeof original==='function'&&!original.__spNavStateV2){
      const wrapped=async function(v){const r=await original.apply(this,arguments);sync(v);return r;};wrapped.__spNavStateV2=true;window.loadView=wrapped;
    }
    sync((location.hash||'#dashboard').slice(1).split('?')[0]);
  };
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(hook,0));
  window.addEventListener('stagepulse-organization-open',()=>sync('organization'));
  window.addEventListener('hashchange',()=>setTimeout(()=>sync((location.hash||'').slice(1).split('?')[0]),0));
  document.addEventListener('DOMContentLoaded',hook);setTimeout(hook,1000);
})();