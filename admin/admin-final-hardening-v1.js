/* Stagepulse Admin — legacy panel hardening shim.
 * Crew/inventory are owned by admin-offer-final-fields-v1.js.
 * Photo UI is owned by admin-offer-edit-media-fix-v1.js.
 * This file intentionally does not create duplicate offer panels.
 */
(() => {
  'use strict';
  const modal=()=>document.getElementById('offerModal');
  const currentOfferId=()=>{
    const m=modal();
    return m?.dataset.offerId||m?.dataset.spOfferId||m?.querySelector('[data-sp-offer-id]')?.dataset.spOfferId||window.__spLastOfferModalId||window.__spLastOfferId||null;
  };
  function remember(){
    const m=modal();
    const id=currentOfferId();
    if(!m||!id)return;
    m.dataset.spLegacyHardening='disabled-duplicate-panels';
  }
  window.addEventListener('hashchange',()=>setTimeout(remember,100));
  setInterval(remember,1000);
  remember();
})();
