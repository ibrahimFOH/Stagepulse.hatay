/* Stagepulse Admin — canonical Management navigation. */
(() => {
  'use strict';
  if (window.STAGEPULSE_MANAGEMENT_NAV) return;
  window.STAGEPULSE_MANAGEMENT_NAV = true;

  const ITEMS = [
    ['patron-center', 'Patron Merkezi'],
    ['command-center', 'Komuta Merkezi'],
    ['dashboard', 'Genel Bakış'],
    ['analytics', 'Analitik'],
    ['scope', 'Yönetim Kapsamım'],
    ['organization', 'Şirket Organizasyonu'],
    ['accounts', 'Yönetici Hesapları'],
    ['rbac', 'Rol · Yetki Merkezi']
  ];
  const META = {
    'patron-center':['Patron Merkezi','Executive cockpit'],
    'command-center':['Komuta Merkezi','Operasyon'],
    dashboard:['Genel Bakış','Satış ve operasyon'],
    analytics:['Analitik','Dönüşüm'],
    scope:['Yönetim Kapsamım','Yetki ve kapsam'],
    organization:['Şirket Organizasyonu','Organizasyon ve hiyerarşi'],
    accounts:['Yönetici Hesapları','Yönetici hesapları'],
    rbac:['Rol · Yetki Merkezi','Roller ve yetkiler']
  };
  const LEGACY_IDS = new Set(['patronCenterNav','orgDashboardNav','orgScopeNav','companyOrgNav','orgAccountsNav','rbacNav']);
  const LEGACY_LABELS = new Set(['patron merkezi','şirket yönetimi','yönetim kapsamım','şirket organizasyonu','yönetici hesapları','rol · yetki merkezi','rol / yetki merkezi']);
  const VIEWS = new Set(ITEMS.map(x => x[0]));
  const nav = () => document.getElementById('sideNav');

  function isManagementButton(b) {
    return LEGACY_IDS.has(String(b.id || '')) || VIEWS.has(String(b.dataset.view || '').toLowerCase()) || LEGACY_LABELS.has(String(b.textContent || '').trim().toLowerCase());
  }

  function syncHeader(active) {
    const meta=META[active];
    if(!meta)return;
    const title=document.getElementById('viewTitle');
    const subtitle=document.getElementById('viewSubtitle');
    if(title)title.textContent=meta[0];
    if(subtitle)subtitle.textContent=meta[1];
  }

  function open(view) {
    if (view === 'patron-center') {
      if (location.hash !== '#patron-center') location.hash = 'patron-center';
      else window.dispatchEvent(new Event('hashchange'));
      return;
    }
    history.replaceState(null, '', `#${view}`);
    syncHeader(view);
    if (typeof window.loadView === 'function') {
      try { Promise.resolve(window.loadView(view)).catch(() => {}); } catch (_) {}
    }
  }

  function setActive() {
    const n = nav();
    if (!n) return;
    const active = (location.hash || '#dashboard').slice(1).split('?')[0].toLowerCase();
    n.querySelectorAll('button[data-sp-management]').forEach(b => {
      const on = b.dataset.view === active;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    syncHeader(active);
  }

  function boot() {
    const n = nav();
    if (!n) return;
    [...n.querySelectorAll('button')].filter(isManagementButton).forEach(b => b.remove());
    const label = [...n.querySelectorAll('.nav-label')].find(x => String(x.textContent || '').trim().toLowerCase() === 'yönetim');
    if (!label) return;
    const frag = document.createDocumentFragment();
    for (const [view,text] of ITEMS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.view = view;
      b.dataset.spManagement = '1';
      if (view === 'patron-center') b.dataset.patronBound = '1';
      b.textContent = text;
      b.setAttribute('aria-label', text);
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); open(view); setActive(); });
      frag.appendChild(b);
    }
    label.after(frag);
    setActive();
  }

  window.addEventListener('hashchange', setActive);
  window.addEventListener('stagepulse-admin-ready', boot, { once: true });
  window.addEventListener('stagepulse:admin-ready', boot, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
