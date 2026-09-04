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

  if (document.querySelector('script[data-stagepulse-core]') ||
      document.documentElement.dataset.stagepulseCoreReady === '1') return;
  const script = document.createElement('script');
  script.src = '/core.js?v=20260904-nav5';
  script.async = false;
  script.dataset.stagepulseCore = '1';
  script.onerror = () => {
    console.error('[Stagepulse] Public form controller could not be loaded.');
  };
  document.head.appendChild(script);
})();
