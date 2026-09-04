/* Stagepulse Patron Center — keep exactly one navigation entry. */
(() => {
  'use strict';
  const normalize = () => {
    const nav = document.getElementById('sideNav');
    if (!nav) return;
    const matches = [...nav.querySelectorAll('button')].filter(b =>
      b.id === 'patronCenterNav' ||
      b.dataset.view === 'patron-center' ||
      (b.textContent || '').trim().toLocaleLowerCase('tr-TR') === 'patron merkezi'
    );
    if (!matches.length) return;
    const keep = matches.find(b => b.id === 'patronCenterNav' || b.dataset.view === 'patron-center') || matches[0];
    keep.id = 'patronCenterNav';
    keep.dataset.view = 'patron-center';
    keep.type = 'button';
    keep.textContent = 'Patron Merkezi';
    keep.onclick = () => { location.hash = 'patron-center'; };
    matches.filter(b => b !== keep).forEach(b => b.remove());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalize, { once: true });
  else normalize();
  new MutationObserver(normalize).observe(document.getElementById('sideNav') || document.body, { childList: true, subtree: true });
  window.addEventListener('stagepulse-admin-ready', normalize);
})();
