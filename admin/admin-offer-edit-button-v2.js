/* Stagepulse Admin — robust offer edit action */
(() => {
  'use strict';

  const cleanId = (v) => String(v || '').replace(/[^0-9a-fA-F-]/g, '');

  function resolveOfferId(row) {
    const direct = row.dataset.offerId || row.getAttribute('data-offer-id') || row.dataset.id || row.getAttribute('data-id');
    if (direct && direct.length >= 20) return cleanId(direct);

    for (const el of row.querySelectorAll('[data-offer-id],[data-id]')) {
      const v = el.dataset.offerId || el.getAttribute('data-offer-id') || el.dataset.id || el.getAttribute('data-id');
      if (v && v.length >= 20) return cleanId(v);
    }

    for (const el of row.querySelectorAll('[onclick],a[href]')) {
      const text = `${el.getAttribute('onclick') || ''} ${el.getAttribute('href') || ''}`;
      const m = text.match(/(?:openOffer|openOfferEditable)\s*\(\s*['\"]?([0-9a-fA-F-]{20,})/i);
      if (m?.[1]) return cleanId(m[1]);
      const uuid = text.match(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/);
      if (uuid?.[0]) return cleanId(uuid[0]);
    }

    const body = row.textContent || '';
    const uuid = body.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return uuid?.[0] || '';
  }

  function openEdit(id) {
    if (!id) return;
    if (typeof window.openOfferEditable === 'function') return window.openOfferEditable(id);
    if (typeof window.openOffer === 'function') return window.openOffer(id);
    window.__stagepulsePendingOfferEdit = id;
    setTimeout(() => {
      if (typeof window.openOfferEditable === 'function') window.openOfferEditable(id);
      else if (typeof window.openOffer === 'function') window.openOffer(id);
      else if (typeof window.toast === 'function') window.toast('Teklif düzenleme ekranı henüz hazır değil.', false);
    }, 150);
  }

  function addRenderedButtons() {
    if (location.hash !== '#offers') return;
    document.querySelectorAll('#content .row-item').forEach(row => {
      if (row.querySelector('[data-sp-edit-offer]')) return;
      const side = row.querySelector('.row-side') || row;
      const id = resolveOfferId(row);
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
        openEdit(id);
      });
      side.appendChild(b);
    });
  }

  function install() {
    if (window.__stagepulseOfferEditButtonRobust) return;
    window.__stagepulseOfferEditButtonRobust = true;
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-sp-edit-offer]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      openEdit(b.dataset.spEditOffer);
    }, true);
    const content = document.getElementById('content') || document.body;
    new MutationObserver(addRenderedButtons).observe(content, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setTimeout(addRenderedButtons, 80));
    window.addEventListener('stagepulse-admin-ready', () => setTimeout(addRenderedButtons, 80));
    setTimeout(addRenderedButtons, 150);
    setTimeout(addRenderedButtons, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
