/* Stagepulse Admin — offer edit button bridge v3 */
(() => {
  'use strict';

  function addEditButtons() {
    if (location.hash !== '#offers') return;
    document.querySelectorAll('.row-item').forEach(row => {
      if (row.querySelector('[data-sp-edit-offer]')) return;
      const side = row.querySelector('.row-side');
      if (!side) return;

      const attrs = [...row.querySelectorAll('[onclick]')]
        .map(el => el.getAttribute('onclick') || '').join(' ');
      const m = attrs.match(/(?:openOffer|openOfferEditable)\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/i);
      const id = m?.[1] || row.dataset.offerId || row.getAttribute('data-offer-id') || row.dataset.id || row.getAttribute('data-id');
      if (!id) return;

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-primary';
      b.dataset.spEditOffer = id;
      b.textContent = 'Düzenle';
      b.setAttribute('aria-label', 'Teklifi düzenle');
      b.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openOffer === 'function') window.openOffer(id);
        else if (typeof window.openOfferEditable === 'function') window.openOfferEditable(id);
      });
      side.appendChild(b);
    });
  }

  function init() {
    addEditButtons();
    const content = document.getElementById('content') || document.body;
    new MutationObserver(addEditButtons).observe(content, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setTimeout(addEditButtons, 100));
    window.addEventListener('stagepulse-admin-ready', addEditButtons);
    window.addEventListener('load', addEditButtons);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();