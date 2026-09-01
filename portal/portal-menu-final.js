/* Stagepulse personnel shell: single authoritative hamburger interaction. */
(() => {
  const close = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    side?.classList.remove('open');
    if (overlay) { overlay.hidden = true; overlay.classList.remove('open'); }
    document.body.classList.remove('portal-menu-open');
    document.body.style.overflow = '';
    if (menu) { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menüyü aç'); menu.textContent = '☰'; }
  };
  const open = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    if (!side) return;
    side.classList.add('open');
    if (overlay) { overlay.hidden = false; overlay.classList.add('open'); }
    document.body.classList.add('portal-menu-open');
    document.body.style.overflow = 'hidden';
    if (menu) { menu.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-label', 'Menüyü kapat'); menu.textContent = '×'; }
  };
  const bind = () => {
    const menu = document.getElementById('menuBtn');
    if (!menu || menu.dataset.spFinalMenuBound === '1') return;
    menu.dataset.spFinalMenuBound = '1';
    menu.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const side = document.getElementById('sidebar');
      side?.classList.contains('open') ? close() : open();
    }, { capture: true });
    document.getElementById('mobileOverlay')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) close();
    }, { capture: true });
    document.getElementById('sideNav')?.addEventListener('click', (event) => {
      if (event.target.closest('button[data-view]')) close();
    }, { capture: true });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    window.addEventListener('hashchange', close);
    close();

    if (!document.querySelector('script[data-sp-personnel-menu-parity]')) {
      const script = document.createElement('script');
      // Cache-bust the permission menu after the login freeze fix.
      script.src = '/portal/personnel-admin-menu-parity.js?v=20260825-03';
      script.defer = true;
      script.dataset.spPersonnelMenuParity = '1';
      document.head.appendChild(script);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
  window.StagepulseFinalMenu = { open, close, bind };
})();
