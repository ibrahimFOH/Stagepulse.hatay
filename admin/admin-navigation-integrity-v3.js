/* Stagepulse Admin — canonical navigation integrity layer. */
(() => {
  'use strict';
  if(window.__STAGEPULSE_ADMIN_NAV_INTEGRITY_V3__)return;
  window.__STAGEPULSE_ADMIN_NAV_INTEGRITY_V3__=true;

  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR');
  const canonical=new Map([
    ['yönetim kapsamım','scope'],
    ['şirket organizasyonu','organization'],
    ['yönetici hesapları','accounts'],
    ['rol · yetki merkezi','rbac']
  ]);

  function retireCommandCenter(){
    const nav=document.getElementById('sideNav');
    if(nav)[...nav.querySelectorAll('button')].forEach(b=>{
      if(norm(b.dataset.view)==='command-center'||norm(b.textContent)==='komuta merkezi')b.remove();
    });
    if(norm((location.hash||'').slice(1).split('?')[0])==='command-center'){
      if(location.hash!=='#patron-center')location.hash='#patron-center';
    }
  }

  function repair(){
    retireCommandCenter();
    const nav=document.getElementById('sideNav');
    if(!nav)return;
    const seen=new Set();
    [...nav.querySelectorAll('button')].forEach(button=>{
      if(button.id==='logoutBtn'||button.classList.contains('nav-logout'))return;
      const label=norm(button.textContent);
      const view=norm(button.dataset.view);
      const canonicalView=canonical.get(label);
      const key=canonicalView?`management:${canonicalView}`:(view?`view:${view}`:`label:${label}`);
      if(!key||key==='label:')return;
      if(seen.has(key)){button.remove();return;}
      seen.add(key);
      if(canonicalView)button.dataset.view=canonicalView;
    });

    const sectionSeen=new Set();
    [...nav.querySelectorAll('.nav-label')].forEach(label=>{
      const key=norm(label.textContent);
      if(!key)return;
      if(sectionSeen.has(key)){label.remove();return;}
      sectionSeen.add(key);
    });
    nav.querySelectorAll('#orgDashboardNav').forEach(node=>node.remove());
  }

  function protectProductionRoute(){
    const original=window.loadView;
    if(typeof original!=='function'||original.__spProductionRouteGuard)return;
    const wrapped=async function(view){
      if(norm(view)==='production-os'){
        if(location.hash!=='#production-os')location.hash='#production-os';
        return true;
      }
      return original.apply(this,arguments);
    };
    wrapped.__spProductionRouteGuard=true;
    window.loadView=wrapped;
  }

  const run=()=>{repair();protectProductionRoute();setTimeout(repair,50);setTimeout(repair,500);};
  document.addEventListener('DOMContentLoaded',run);
  window.addEventListener('stagepulse-admin-ready',run);
  window.addEventListener('hashchange',run);
  setInterval(()=>{repair();protectProductionRoute();},1000);
  window.StagepulseAdminNavigationIntegrity={repair};
})();
