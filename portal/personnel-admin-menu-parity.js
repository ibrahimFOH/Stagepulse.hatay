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
      ['equipment', 'Ekipman', 'equipment.view'],
      ['jobs', 'Takvim', 'schedule.view'],
      ['finance', 'Ödemeler', 'payments.view'],
      ['personnel', 'Personel', 'staff.view'],
      ['analytics', 'Analitik', 'analytics.view'],
      ['activity', 'Aktivite', 'activity.view'],
      ['notifications', 'Bildirimler', 'notifications.view']
    ]},
    { label: 'Sistem', items: [
      ['settings', 'Ayarlar', 'settings.view']
    ]}
  ];

  let remotePermissions = null;
  let lastSignature = '';
  let rendering = false;

  const canUse = (permission) => {
    if (remotePermissions) return remotePermissions[permission] === true;
    return typeof window.can === 'function' && window.can(permission);
  };

  function render() {
    const nav = document.getElementById('sideNav');
    if (!nav || typeof window.can !== 'function' || rendering) return;
    rendering = true;
    try {
      const previousView = (location.hash || '#home').slice(1) || 'home';
      nav.innerHTML = '';
      for (const group of MENU) {
        const allowed = group.items.filter(([, , permission]) => canUse(permission));
        if (!allowed.length) continue;
        const heading = document.createElement('p');
        heading.className = 'nav-label';
        heading.textContent = group.label;
        nav.appendChild(heading);
        for (const [view, label] of allowed) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.view = view;
          button.textContent = label;
          button.setAttribute('aria-label', label);
          if (view === previousView) button.classList.add('active');
          button.addEventListener('click', () => {
            if (typeof window.loadView === 'function') window.loadView(view);
          });
          nav.appendChild(button);
        }
      }
      const badge = document.createElement('small');
      badge.id = 'portalPermissionBadge';
      const perms = remotePermissions || (typeof window.perms === 'function' ? window.perms() : {});
      badge.textContent = `${Object.values(perms).filter(Boolean).length} aktif yetki`;
      nav.appendChild(badge);
    } finally {
      rendering = false;
    }
    window.dispatchEvent(new CustomEvent('stagepulse:menu-rendered'));
  }

  async function refreshFromServer() {
    if (document.hidden || typeof window.can !== 'function' || !window.supabase) return;
    try {
      const baseUrl = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : '';
      const publishableKey = (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '';
      if (!baseUrl || !publishableKey) return;
      const client = window.supabase.createClient(baseUrl, publishableKey);
      const { data: { session } } = await client.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch(`${baseUrl}/functions/v1/staff-session`, {
        method: 'POST',
        headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'session' })
      });
      if (!response.ok) return;
      const body = await response.json();
      const permissions = body.permissions || {};
      const signature = JSON.stringify(Object.keys(permissions).filter(k => permissions[k] === true).sort());
      if (signature !== lastSignature) {
        lastSignature = signature;
        remotePermissions = permissions;
        render();
        window.dispatchEvent(new CustomEvent('stagepulse:permissions-changed'));
      }
    } catch (_) {
      // Existing canonical session guard remains authoritative.
    }
  }

  function boot() {
    window.addEventListener('stagepulse:permissions-ready', () => { render(); refreshFromServer(); });
    window.addEventListener('stagepulse:permissions-changed', render);
    if (typeof window.can === 'function' && document.getElementById('appView') && !document.getElementById('appView').hidden) render();
    window.setInterval(refreshFromServer, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.StagepulsePersonnelAdminMenu = { render, refreshFromServer };
})();
