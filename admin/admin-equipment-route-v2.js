/* Stagepulse Admin — deterministic equipment navigation.
 * Equipment must render on the first navigation/initial hash, even when the
 * Supabase session becomes available after the page scripts have loaded.
 * Resolve the canonical renderer at call time and wait for appView visibility.
 */
(() => {
  const originalLoadView = window.loadView;
  const originalEquipment = window.equipmentView;
  if (typeof originalLoadView !== 'function') return;

  let rendering = false;
  let renderedHash = '';

  const setEquipmentShell = () => {
    document.querySelectorAll('#sideNav button[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === 'equipment');
    });
    const title = document.getElementById('viewTitle');
    const subtitle = document.getElementById('viewSubtitle');
    if (title) title.textContent = 'Ekipman';
    if (subtitle) subtitle.textContent = 'Envanter';
  };

  const appVisible = () => {
    const app = document.getElementById('appView');
    return !!app && !app.hidden && !app.classList.contains('is-hidden');
  };

  const renderEquipment = async () => {
    if (location.hash !== '#equipment' || !appVisible() || rendering) return false;
    const renderer = window.equipmentView || originalEquipment;
    if (typeof renderer !== 'function') return false;
    rendering = true;
    setEquipmentShell();
    try {
      await renderer();
      renderedHash = '#equipment';
      return true;
    } catch (e) {
      console.error('Equipment navigation failed:', e);
      try { window.toast?.(e.message || 'Ekipman yüklenemedi.', false); } catch (_) {}
      return false;
    } finally {
      rendering = false;
    }
  };

  window.loadView = async (view) => {
    if (view !== 'equipment') return originalLoadView(view);
    if (location.hash !== '#equipment') history.replaceState(null, '', '#equipment');
    renderedHash = '';
    setEquipmentShell();
    if (!appVisible()) return;
    await renderEquipment();
  };

  const scheduleBoot = () => {
    const attempts = [0, 50, 150, 300, 600, 1000, 2000, 4000, 8000];
    attempts.forEach((ms) => setTimeout(() => {
      if (location.hash === '#equipment' && renderedHash !== '#equipment') renderEquipment();
    }, ms));
  };

  const observeApp = () => {
    const app = document.getElementById('appView');
    if (!app) return;
    const observer = new MutationObserver(() => {
      if (location.hash === '#equipment' && renderedHash !== '#equipment') renderEquipment();
    });
    observer.observe(app, { attributes: true, attributeFilter: ['class', 'hidden'] });
    window.setTimeout(() => observer.disconnect(), 30000);
    scheduleBoot();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeApp, { once: true });
  } else {
    observeApp();
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#equipment') {
      renderedHash = '';
      scheduleBoot();
    }
  });
})();
