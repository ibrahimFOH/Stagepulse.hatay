/* Stagepulse Admin — Personnel route bridge.
 * Legacy admin.js keeps loadView/personnelView in lexical scope, so replacing
 * window.loadView from the v2 module is not enough. Capture the Personnel menu
 * click and route it directly to the v2 implementation.
 */
(() => {
  'use strict';

  let installed = false;

  function showPersonnel() {
    if (typeof window.personnelView !== 'function') return false;
    const button = document.querySelector('#sideNav button[data-view="personnel"]');
    document.querySelectorAll('#sideNav button[data-view]').forEach((b) => {
      b.classList.toggle('active', b === button);
    });
    const title = document.querySelector('#viewTitle');
    const subtitle = document.querySelector('#viewSubtitle');
    if (title) title.textContent = 'Personel';
    if (subtitle) subtitle.textContent = 'Personeller, görevler ve yetkiler';
    if (location.hash !== '#personnel') history.replaceState(null, '', '#personnel');
    Promise.resolve(window.personnelView()).catch((error) => {
      console.error('Stagepulse personnel v2:', error);
    });
    return true;
  }

  function install() {
    if (installed || typeof window.personnelView !== 'function') return false;
    installed = true;
    document.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('#sideNav button[data-view="personnel"]')
        : null;
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showPersonnel();
    }, true);
    window.addEventListener('hashchange', () => {
      if (location.hash === '#personnel') showPersonnel();
    });
    if (location.hash === '#personnel') setTimeout(showPersonnel, 0);
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 100) clearInterval(timer);
  }, 100);
  install();
})();
