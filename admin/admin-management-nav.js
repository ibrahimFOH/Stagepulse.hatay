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

  const LEGACY_IDS = new Set([
    'patronCenterNav', 'orgDashboardNav', 'orgScopeNav', 'companyOrgNav',
    'orgAccountsNav', 'rbacNav'
  ]);
  const LEGACY_LABELS = new Set([
    'patron merkezi', 'şirket yönetimi', 'yönetim kapsamım',
    'şirket organizasyonu', 'yönetici hesapları', 'rol · yetki merkezi',
    'rol / yetki merkezi'
  ]);
  const VIEWS = new Set(ITEMS.map(x => x[0]));

  function nav() { return document.getElementById('sideNav'); }
  function isManagementButton(b) {
    const id = String(b.id || '');
    const view = String(b.dataset.view || '').toLowerCase();
    const text = String(b.textContent || '').trim().toLowerCase();
    return LEGACY_IDS.has(id) || VIEWS.has(view) || LEGACY_LABELS.has(text);
  }

  function open(view) {
    if (view === 'patron-center') {
      if (location.hash !== '#patron-center') history.pushState(null, '', '#patron-center');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    if (typeof window.loadView === 'function') {
      window.loadView(view).catch?.(() => {});
      history.replaceState(null, '', `#${view}`);
      return;
    }
    history.replaceState(null, '', `#${view}`);
  }

  function setActive() {
    const n = nav();
    if (!n) return;
    const active = (location.hash || '#dashboard').slice(1).split('?')[0].toLowerCase();
    n.querySelectorAll('button[data-sp-management]').forEach(b => {
      const on = b.dataset.view === active;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  function boot() {
    const n = nav();
    if (!n) return;
    const management = [...n.querySelectorAll('button')].filter(isManagementButton);
    management.forEach(b => b.remove());

    const label = [...n.querySelectorAll('.nav-label')].find(x =>
      String(x.textContent || '').trim().toLowerCase() === 'yönetim'
    );
    if (!label) return;

    const frag = document.createDocumentFragment();
    for (const [view, text] of ITEMS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.view = view;
      b.dataset.spManagement = '1';
      b.textContent = text;
      b.setAttribute('aria-label', text);
      b.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        open(view);
        setActive();
      });
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
