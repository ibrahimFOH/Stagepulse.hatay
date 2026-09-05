/* Stagepulse Portal — one navigation integrity layer. */
(() => {
  'use strict';
  const ITEMS = [
    ['home','Genel Bakış','dashboard.view'],
    ['offers','Teklifler','offers.view'],
    ['customers','Müşteriler','customers.view'],
    ['settlements','Gelir · Gider','settlements.view'],
    ['finance','Ödemeler / Finans','payments.view'],
    ['pricing','Fiyatlandırma','pricing.view'],
    ['jobs','İşler','schedule.view'],
    ['equipment','Ekipman','equipment.view'],
    ['personnel','Personel','staff.view'],
    ['analytics','Analitik','analytics.view'],
    ['activity','Aktivite','activity.view'],
    ['notifications','Bildirimler','notifications.view'],
    ['settings','Ayarlar','settings.view']
  ];
  const GROUPS = [['SATIŞ',new Set(['home','offers','customers','settlements','finance','pricing'])],['OPERASYON',new Set(['jobs','equipment','personnel','analytics','activity','notifications'])],['SİSTEM',new Set(['settings'])]];
  const can = p => typeof window.can === 'function' && window.can(p) === true;
  const allowed = item => can(item[2]);
  const repair = () => {
    const nav=document.querySelector('#sideNav');
    if(!nav || typeof window.loadView!=='function') return;
    const existing=new Map([...nav.querySelectorAll('button[data-view]')].map(b=>[b.dataset.view,b]));
    const active=(location.hash||'#home').slice(1)||'home';
    const frag=document.createDocumentFragment();
    for(const [group,views] of GROUPS){
      const matches=ITEMS.filter(item=>views.has(item[0])&&allowed(item));
      if(!matches.length) continue;
      const label=document.createElement('div'); label.className='portal-nav-label'; label.textContent=group; frag.appendChild(label);
      for(const item of matches){
        let b=existing.get(item[0]);
        if(!b){
          b=document.createElement('button'); b.type='button'; b.dataset.view=item[0]; b.textContent=item[1]; b.setAttribute('aria-label',item[1]);
          b.addEventListener('click',e=>{e.preventDefault();window.loadView(item[0]);});
        }
        b.hidden=false; b.style.display=''; b.setAttribute('aria-hidden','false'); b.classList.toggle('active',item[0]===active); frag.appendChild(b);
      }
    }
    const badge=nav.querySelector('#portalPermissionBadge'); if(badge)frag.appendChild(badge);
    nav.replaceChildren(frag);
    nav.dataset.spNavigationIntegrity='v2';
  };
  const boot=()=>{
    repair();
    window.setTimeout(repair,100);
    window.setTimeout(repair,500);
    window.setTimeout(repair,1200);
    window.addEventListener('stagepulse:permissions-ready',repair);
    window.addEventListener('stagepulse:permissions-changed',repair);
    window.addEventListener('hashchange',repair);
    const nav=document.querySelector('#sideNav');
    if(nav){const observer=new MutationObserver(()=>{if(!nav.dataset.spNavigationRepairing){nav.dataset.spNavigationRepairing='1';queueMicrotask(()=>{nav.dataset.spNavigationRepairing='';repair();});}});observer.observe(nav,{childList:true,subtree:true});}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.StagepulseNavigationIntegrity={repair};
})();
