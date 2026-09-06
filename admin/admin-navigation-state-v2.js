/* Stagepulse Admin — canonical active navigation state. */
(() => {
  'use strict';
  if(window.STAGEPULSE_ADMIN_NAV_STATE_V2)return;
  window.STAGEPULSE_ADMIN_NAV_STATE_V2=true;

  const normalize=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('tr-TR');
  const MANAGEMENT=[
    ['scope','Yönetim Kapsamım'],
    ['organization','Şirket Organizasyonu'],
    ['accounts','Yönetici Hesapları'],
    ['rbac','Rol · Yetki Merkezi']
  ];

  const dedupeManagement=()=>{
    const nav=document.getElementById('sideNav');
    if(!nav)return;
    const seenView=new Set(),seenLabel=new Set();
    [...nav.querySelectorAll('button')].forEach(b=>{
      if(b.id==='logoutBtn'||b.classList.contains('nav-logout'))return;
      const view=normalize(b.dataset.view),label=normalize(b.textContent);
      const isManagement=MANAGEMENT.some(([v,l])=>v===view||normalize(l)===label);
      if(!isManagement)return;
      if((view&&seenView.has(view))||(label&&seenLabel.has(label))){b.remove();return;}
      if(view)seenView.add(view);if(label)seenLabel.add(label);
    });
  };

  const ensureMissingNav=()=>{
    const nav=document.getElementById('sideNav');
    if(!nav)return;
    const settings=nav.querySelector('button[data-view="settings"]');
    const logout=nav.querySelector('#logoutBtn,button.nav-logout');
    const add=(view,label,after)=>{
      if(nav.querySelector(`button[data-view="${view}"]`))return;
      const b=document.createElement('button');
      b.type='button';b.dataset.view=view;b.textContent=label;
      if(after&&after.parentNode)after.parentNode.insertBefore(b,after.nextSibling);
      else if(logout)nav.insertBefore(b,logout);else nav.appendChild(b);
    };
    add('scope','Yönetim Kapsamım',settings);
    const scope=nav.querySelector('button[data-view="scope"]');
    add('organization','Şirket Organizasyonu',scope);
    const organization=nav.querySelector('button[data-view="organization"]');
    add('accounts','Yönetici Hesapları',organization);
    const accounts=nav.querySelector('button[data-view="accounts"]');
    add('rbac','Rol · Yetki Merkezi',accounts);
    if(!nav.querySelector('[data-nav-section="production-os"]')&&!nav.querySelector('button[data-view="production-os"]')){
      const label=document.createElement('p');
      label.className='nav-label';label.dataset.navSection='production-os';label.textContent='Operasyon OS';
      if(logout)nav.insertBefore(label,logout);else nav.appendChild(label);
    }
    dedupeManagement();
    [scope,organization,accounts,rbac].filter(Boolean).forEach(b=>b.classList.add('nav-management-entry'));
  };

  const sync=view=>{
    ensureMissingNav();
    const v=String(view||'').toLowerCase();
    document.querySelectorAll('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',(b.dataset.view||'').toLowerCase()===v));
    const settingsRelated=['organization','scope','accounts','rbac'];
    if(settingsRelated.includes(v))document.querySelector('#sideNav button[data-view="settings"]')?.classList.remove('active');
    document.getElementById('orgDashboardNav')?.classList.toggle('active',v==='organization');
  };

  const hook=()=>{
    ensureMissingNav();
    const original=window.loadView;
    if(typeof original==='function'&&!original.__spNavStateV2){
      const wrapped=async function(v){const r=await original.apply(this,arguments);sync(v);return r;};
      wrapped.__spNavStateV2=true;window.loadView=wrapped;
    }
    sync((location.hash||'#dashboard').slice(1).split('?')[0]);
  };

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#sideNav button[data-view]');
    if(!b)return;
    const view=b.dataset.view;
    if(['scope','organization','accounts','rbac'].includes(view)){
      e.preventDefault();e.stopImmediatePropagation();
      location.hash='#'+view;
      if(typeof window.loadView==='function')window.loadView(view);
    }
  },true);
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(hook,0));
  window.addEventListener('stagepulse-organization-open',()=>sync('organization'));
  window.addEventListener('hashchange',()=>setTimeout(()=>sync((location.hash||'').slice(1).split('?')[0]),0));
  document.addEventListener('DOMContentLoaded',hook);setTimeout(hook,1000);
})();
