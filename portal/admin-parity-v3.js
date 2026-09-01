/* Stagepulse Personel Portal — Admin menu visual parity. Visual only; permission filtering is authoritative. */
(() => {
  const GROUPS = [
    ['SATIŞ', ['home', 'offers', 'customers', 'finance', 'pricing']],
    ['OPERASYON', ['jobs', 'equipment', 'analytics', 'activity', 'notifications']],
    ['SİSTEM', ['settings']]
  ];

  function closeMenu() {
    document.querySelector('#sidebar')?.classList.remove('open');
    const overlay = document.querySelector('#mobileOverlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('open');
    }
  }

  function ensureHeader(sidebar) {
    const brand = sidebar.querySelector(':scope > .side-brand');
    if (!brand) return;
    brand.classList.add('portal-brand-header');
    let close = brand.querySelector('.portal-sidebar-close');
    if (!close) {
      close = document.createElement('button');
      close.type = 'button';
      close.className = 'portal-sidebar-close';
      close.setAttribute('aria-label', 'Menüyü kapat');
      close.textContent = '×';
      brand.appendChild(close);
      close.addEventListener('click', closeMenu);
    }
  }

  function decorateNav() {
    const nav = document.querySelector('#sideNav');
    const sidebar = document.querySelector('#sidebar');
    if (!nav || !sidebar) return false;

    const buttons = [...nav.querySelectorAll('button[data-view]')];
    if (!buttons.length) return false;
    ensureHeader(sidebar);

    const visible = buttons.filter(b => !b.hidden && b.getAttribute('aria-hidden') !== 'true' && b.style.display !== 'none');
    const signature = visible.map(b => b.dataset.view).join('|');
    if (nav.dataset.adminParitySignature === signature) return true;

    const badge = nav.querySelector('#portalPermissionBadge');
    const fragment = document.createDocumentFragment();

    for (const [label, views] of GROUPS) {
      const matches = views.map(view => visible.find(b => b.dataset.view === view)).filter(Boolean);
      if (!matches.length) continue;
      const title = document.createElement('div');
      title.className = 'portal-nav-label';
      title.textContent = label;
      fragment.appendChild(title);
      matches.forEach(b => fragment.appendChild(b));
    }

    if (badge) fragment.appendChild(badge);
    nav.replaceChildren(fragment);
    nav.dataset.adminParitySignature = signature;
    return true;
  }

  function boot() {
    const sidebar = document.querySelector('#sidebar');
    const nav = document.querySelector('#sideNav');
    if (!sidebar || !nav) return;
    sidebar.classList.add('admin-visual-menu');
    if (decorateNav()) return;

    const observer = new MutationObserver(() => {
      if (decorateNav()) observer.disconnect();
    });
    observer.observe(nav, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
