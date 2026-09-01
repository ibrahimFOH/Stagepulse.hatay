/* Stagepulse Admin shell: single authoritative hamburger interaction. */
(() => {
  const close = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    side?.classList.remove('open');
    if (overlay) { overlay.hidden = true; overlay.classList.remove('open'); }
    document.body.classList.remove('admin-menu-open');
    document.body.style.overflow = '';
    if (menu) {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Menüyü aç');
      menu.textContent = '☰';
    }
  };

  const open = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    if (!side) return;
    side.classList.add('open');
    if (overlay) { overlay.hidden = false; overlay.classList.add('open'); }
    document.body.classList.add('admin-menu-open');
    document.body.style.overflow = 'hidden';
    if (menu) {
      menu.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-label', 'Menüyü kapat');
      menu.textContent = '×';
    }
  };

  const loadAdminUi = () => {
    if (document.querySelector('script[data-sp-admin-core-ui],script[src*="admin-core-ui-v1.js"]')) return;
    const script = document.createElement('script');
    script.src = '/admin/admin-core-ui-v1.js?v=20260827-01';
    script.defer = true;
    script.dataset.spAdminCoreUi = '1';
    document.head.appendChild(script);
  };

  const loadModuleRegistry = () => {
    if (document.querySelector('script[data-sp-admin-module-registry],script[src*="admin-module-renderers-v2.js"]')) return;
    const script = document.createElement('script');
    script.src = '/admin/admin-module-renderers-v2.js?v=20260831-232';
    script.dataset.spAdminModuleRegistry = '1';
    document.head.appendChild(script);
  };

  const bind = () => {
    const menu = document.getElementById('menuBtn');
    if (!menu || menu.dataset.spAdminFinalMenuBound === '1') return;
    menu.dataset.spAdminFinalMenuBound = '1';

    menu.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const side = document.getElementById('sidebar');
      side?.classList.contains('open') ? close() : open();
    }, { capture: true });

    document.getElementById('sidebarClose')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }, { capture: true });

    document.getElementById('mobileOverlay')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) close();
    }, { capture: true });

    document.getElementById('sideNav')?.addEventListener('click', (event) => {
      if (event.target.closest('button[data-view], #logoutBtn')) close();
    }, { capture: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    window.addEventListener('hashchange', close);
    close();
    loadAdminUi();
    loadModuleRegistry();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.StagepulseAdminFinalMenu = { open, close, bind };
})();
