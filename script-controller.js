/* Stagepulse public controller compatibility entrypoint. */
(() => {
  'use strict';

  /* Canonical delegated mobile navigation handler. The legacy script.js
     already binds the hamburger directly; never toggle the same menu twice. */
  function bindMobileNavigation() {
    if (document.documentElement.dataset.stagepulseMobileNavReady === '1') return;
    document.documentElement.dataset.stagepulseMobileNavReady = '1';
    document.addEventListener('click', (event) => {
      const hamburger = event.target?.closest?.('#hamburger, .hamburger');
      if (hamburger) {
        /* script.js is the primary handler when it has already bound the
           concrete button. A second toggle here would open then immediately
           close the menu in the same click event. */
        if (hamburger.dataset.spMenuReady === '1') return;
        const navLinks = document.getElementById('navLinks');
        if (!navLinks) return;
        event.preventDefault();
        event.stopPropagation();
        const isOpen = !navLinks.classList.contains('active');
        navLinks.classList.toggle('active', isOpen);
        hamburger.classList.toggle('open', isOpen);
        hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const icon = hamburger.querySelector('#hamburger-icon, i');
        icon?.classList.toggle('fa-bars', !isOpen);
        icon?.classList.toggle('fa-xmark', isOpen);
        return;
      }

      const link = event.target?.closest?.('#navLinks a');
      if (link) {
        const hamburgerButton = document.getElementById('hamburger');
        const navLinks = document.getElementById('navLinks');
        navLinks?.classList.remove('active');
        hamburgerButton?.classList.remove('open');
        hamburgerButton?.setAttribute('aria-expanded', 'false');
        const icon = hamburgerButton?.querySelector('#hamburger-icon, i');
        icon?.classList.add('fa-bars');
        icon?.classList.remove('fa-xmark');
      }
    }, true);
  }

  bindMobileNavigation();

  if (document.querySelector('script[data-stagepulse-core]') ||
      document.documentElement.dataset.stagepulseCoreReady === '1') return;
  const script = document.createElement('script');
  script.src = '/core.js?v=20260827-nav3';
  script.async = false;
  script.dataset.stagepulseCore = '1';
  script.onerror = () => {
    console.error('[Stagepulse] Public form controller could not be loaded.');
  };
  document.head.appendChild(script);
})();
