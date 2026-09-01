/* Route authenticated notification clicks to the matching offer without crossing portal boundaries. */
(() => {
  'use strict';
  if (window.STAGEPULSE_NOTIFICATION_DEEPLINK) return;
  window.STAGEPULSE_NOTIFICATION_DEEPLINK = true;
  const params = new URLSearchParams(location.search);
  const offerId = params.get('offer');
  if (!offerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(offerId)) return;
  let routed = false;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function route() {
    if (routed || typeof window.loadView !== 'function') return;
    routed = true;
    await window.loadView('offers');
    if (location.pathname.startsWith('/admin/')) {
      for (let i = 0; i < 40; i += 1) {
        const open = window.openOfferEditable || window.openOffer;
        if (typeof open === 'function') { await open(offerId); return; }
        await wait(100);
      }
      window.toast?.('Bildirimdeki teklif açılamadı.', false);
      return;
    }
    for (let i = 0; i < 40; i += 1) {
      const card = document.querySelector(`[data-offer-id="${CSS.escape(offerId)}"]`);
      if (card) {
        card.scrollIntoView({behavior:'smooth', block:'center'});
        card.style.outline = '2px solid #ffb000';
        card.style.outlineOffset = '3px';
        return;
      }
      await wait(100);
    }
    window.toast?.('Bildirimdeki teklif görüntülenemedi.', false);
  }
  window.addEventListener('stagepulse:logged-in', () => void route());
  window.addEventListener('stagepulse:admin-ready', () => void route());
  window.addEventListener('stagepulse:portal-ready', () => void route());
  window.addEventListener('stagepulse:permissions-ready', () => void route());
  queueMicrotask(() => void route());
})();