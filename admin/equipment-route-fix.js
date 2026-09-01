/* Stagepulse Admin — equipment route boot fix. */
(() => {
  let done = false;
  const run = async () => {
    if (done || location.hash !== '#equipment' || typeof window.equipmentView !== 'function') return;
    const app = document.getElementById('appView');
    if (!app || app.classList.contains('is-hidden') || app.hidden) return;
    done = true;
    try {
      await window.equipmentView();
    } catch (e) {
      done = false;
      console.error('Equipment route boot failed:', e);
    }
  };
  const observe = () => {
    const app = document.getElementById('appView');
    if (!app) return;
    const mo = new MutationObserver(() => run());
    mo.observe(app, { attributes: true, attributeFilter: ['class', 'hidden'] });
    run();
    setTimeout(() => mo.disconnect(), 15000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})();
