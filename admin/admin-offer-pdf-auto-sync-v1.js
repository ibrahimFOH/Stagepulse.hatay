/* Stagepulse Admin — keep customer PDF synchronized with offer edits. */
(() => {
  'use strict';
  const client = () => window.sb || window.__stagepulseAdminClient || window.supabaseClient;
  const offerId = () => {
    const m = document.getElementById('offerModal');
    return m?.dataset.offerId || m?.dataset.spOfferId || m?.querySelector('[data-sp-offer-id]')?.dataset.spOfferId || window.__spLastOfferModalId || window.__spLastOfferId || null;
  };
  let timer = null;
  async function regenerate(id) {
    const c = client(); if (!c || !id || !c.functions?.invoke) return;
     try { const { error } = await c.functions.invoke('offer-pdf', { body: { offer_id: id } }); if (error) throw error; if (typeof window.toast === 'function') window.toast('PDF güncellendi.'); }
    catch (e) { console.error('[Stagepulse PDF sync]', e); if (typeof window.toast === 'function') window.toast('PDF güncellenemedi: ' + (e.message || e), false); }
  }
  function schedule(id = offerId()) { if (!id) return; clearTimeout(timer); timer = setTimeout(() => regenerate(id), 700); }
  window.stagepulseRegenerateOfferPdf = regenerate;
  document.addEventListener('click', e => { const t=e.target?.closest?.('button'); if(!t)return; if(t.id==='spOfferCrewSave'||t.id==='spOfferEqAdd'||t.matches('[data-sp-reserve-save]')) schedule(); }, true);
  document.addEventListener('change', e => { const t=e.target; if(t?.id==='spFinalOfferPhotoInput'||t?.matches?.('#spFinalOfferPhotoInput, #spFinalOfferPhotos input[type="checkbox"]')) schedule(); }, true);
})();
