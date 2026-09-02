/* Stagepulse Personel — admin menu structure parity, permission filtered. */
(() => {
  'use strict';

  const MENU = [
    { label: 'Satış', items: [
      ['home', 'Genel Bakış', 'dashboard.view'],
      ['offers', 'Teklifler', 'offers.view'],
      ['customers', 'Müşteriler', 'customers.view'],
      ['settlements', 'Gelir · Gider', 'settlements.view'],
      ['pricing', 'Fiyatlandırma', 'pricing.view']
    ]},
    { label: 'Operasyon', items: [
      ['calendar', 'İşler · Takvim', 'calendar.view'],
      ['equipment', 'Ekipman', 'equipment.view'],
      ['personnel', 'Personel', 'personnel.view'],
      ['finance', 'Ödemeler', 'finance.view']
    ]},
    { label: 'Sistem', items: [
      ['notifications', 'Bildirimler', 'notifications.view'],
      ['activity', 'Aktivite', 'activity.view'],
      ['settings', 'Ayarlar', 'settings.view']
    ]}
  ];

  const can = (permission) => {
    try {
      if (typeof window.can === 'function') return window.can(permission);
      if (window.StagepulsePermissions?.can) return window.StagepulsePermissions.can(permission);
      const permissions = window.STAGEPULSE_PERMISSIONS || window.__stagepulsePermissions || [];
      return Array.isArray(permissions) && (permissions.includes('*') || permissions.includes(permission));
    } catch (_) { return false; }
  };

  function render() {
    const nav = document.getElementById('sideNav');
    if (!nav || nav.dataset.spPersonnelParity === '1') return;
    nav.dataset.spPersonnelParity = '1';

    const existing = new Map([...nav.querySelectorAll('button[data-view]')].map(b => [b.dataset.view, b]));
    const groups = MENU.map(group => ({
      ...group,
      items: group.items.filter(([, , permission]) => can(permission))
    })).filter(group => group.items.length);

    if (!groups.length) return;
    nav.innerHTML = '';
    for (const group of groups) {
      const label = document.createElement('p');
      label.className = 'nav-label';
      label.textContent = group.label;
      nav.appendChild(label);
      for (const [view, text] of group.items) {
        const button = existing.get(view) || document.createElement('button');
        button.type = 'button';
        button.dataset.view = view;
        button.textContent = text;
        nav.appendChild(button);
      }
    }
    const logout = existing.get('logout') || document.getElementById('logoutBtn') || document.createElement('button');
    logout.type = 'button';
    logout.id = 'logoutBtn';
    logout.className = 'nav-logout';
    logout.dataset.view = 'logout';
    logout.textContent = 'Çıkış';
    nav.appendChild(logout);
    nav.querySelectorAll('button[data-view]:not([data-sp-bound])').forEach(button => {
      button.dataset.spBound = '1';
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        if (view === 'logout') {
          window.StagepulseAdminSupabase?.getClient?.()?.auth.signOut().finally(() => location.reload());
        } else {
          window.loadView?.(view);
        }
      });
    });
  }

  const boot = () => setTimeout(render, 100);
  window.addEventListener('stagepulse-admin-ready', boot);
  window.addEventListener('stagepulse:admin-ready', boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
