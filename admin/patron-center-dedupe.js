/* Stagepulse Patron Center — exactly one navigation entry, race-safe. */
(() => {
  'use strict';
  if (window.STAGEPULSE_PATRON_CENTER_DEDUPE_V2) return;
  window.STAGEPULSE_PATRON_CENTER_DEDUPE_V2 = true;

  const normalize = () => {
    const nav = document.getElementById('sideNav');
    if (!nav) return;
    const matches = [...nav.querySelectorAll('button')].filter(b => {
      const text = (b.textContent || '').trim().toLocaleLowerCase('tr-TR');
      return b.id === 'patronCenterNav' || b.dataset.view === 'patron-center' || text === 'patron merkezi';
    });
    if (!matches.length) return;

    const keep = matches.find(b => b.id === 'patronCenterNav' || b.dataset.view === 'patron-center') || matches[0];
    keep.id = 'patronCenterNav';
    keep.dataset.view = 'patron-center';
    keep.type = 'button';
    keep.textContent = 'Patron Merkezi';
    keep.onclick = () => { location.hash = 'patron-center'; };

    for (const duplicate of matches) {
      if (duplicate !== keep) duplicate.remove();
    }
  };

  const boot = () => {
    normalize();
    const observer = new MutationObserver(normalize);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('stagepulse-admin-ready', normalize);
    window.addEventListener('hashchange', normalize);
    window.setInterval(normalize, 500);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
