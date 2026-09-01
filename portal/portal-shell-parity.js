/* Shared visual shell only: keep the staff data/permission model intact while matching Admin navigation chrome. */
(() => {
  const labels = {
    home: ['Genel Bakış', 'Özet'],
    jobs: ['İşler', 'Takvim ve operasyon'],
    equipment: ['Ekipman', 'Envanter'],
    offers: ['Teklifler', 'Satış talepleri'],
    customers: ['Müşteriler', 'Müşteri kayıtları'],
    finance: ['Ödemeler / Finans', 'Finans'],
    pricing: ['Fiyatlandırma', 'Hizmet taban fiyatları'],
    analytics: ['Analitik', 'Raporlar'],
    activity: ['Aktivite', 'Sistem hareketleri'],
    notifications: ['Bildirimler', 'Bildirim merkezi'],
    settings: ['Ayarlar', 'Hesap ve sistem']
  };
  const setTitle = view => {
    const pair = labels[view] || ['Stagepulse', 'Personel Portalı'];
    const title = document.querySelector('#portalViewTitle');
    const subtitle = document.querySelector('#portalViewSubtitle');
    if (title) title.textContent = pair[0];
    if (subtitle) subtitle.textContent = pair[1];
  };
  const boot = () => {
    if (window.__spShellParityWrapped || typeof window.loadView !== 'function') return;
    const original = window.loadView;
    window.loadView = async view => {
      setTitle(view);
      return original(view);
    };
    window.__spShellParityWrapped = true;
    setTitle((location.hash || '#home').slice(1) || 'home');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('stagepulse:permissions-ready', boot);
  window.addEventListener('hashchange', () => setTitle((location.hash || '#home').slice(1) || 'home'));
})();
