/* Stagepulse public controller compatibility entrypoint. */
(() => {
  'use strict';
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