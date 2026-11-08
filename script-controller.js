/* Stagepulse public controller compatibility entrypoint. */
(() => {
  'use strict';

  /* script.js owns the hamburger click. This controller must never install a
     second hamburger toggle because capture/bubble ordering can cancel it. */
  function bindMobileNavigation() {
    if (document.documentElement.dataset.stagepulseMobileNavReady === '1') return;
    document.documentElement.dataset.stagepulseMobileNavReady = '1';
    document.addEventListener('click', (event) => {
      const link = event.target?.closest?.('#navLinks a');
      if (!link) return;
      const hamburgerButton = document.getElementById('hamburger');
      const navLinks = document.getElementById('navLinks');
      navLinks?.classList.remove('active');
      hamburgerButton?.classList.remove('open');
      hamburgerButton?.setAttribute('aria-expanded', 'false');
      const icon = hamburgerButton?.querySelector('#hamburger-icon, i');
      icon?.classList.add('fa-bars');
      icon?.classList.remove('fa-xmark');
    });
  }

  bindMobileNavigation();

  // Public form submission is owned by script.js; the retired duplicate core.js is not loaded.
})();
