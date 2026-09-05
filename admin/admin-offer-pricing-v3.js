/* Stagepulse Admin — offer pricing v3 */
(function(){
  'use strict';
  if(window.__STAGEPULSE_OFFER_PRICING_V3__) return;
  window.__STAGEPULSE_OFFER_PRICING_V3__=true;
  var css=document.createElement('link');css.rel='stylesheet';css.href='admin-offer-pricing-v3.css?v=20260905-1';document.head.appendChild(css);
  var money=function(v){return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0)};
  var n=function(v){var x=Number(v);return Number.isFinite(x)?x:0};
  var client=function(){return window.__stagepulseAdminClient||window.sb||window.supabaseClient||null};
  var toast=function(msg,ok){if(typeof window.toast==='function')window.toast(msg,ok);else console[ok===false?'error':'log'](msg)};
  var offerId=function(m){return m&&((m.dataset&&m.dataset.offerId)||(m.dataset&&m.dataset.spOfferId)||m.querySelector('[data-sp-offer-id]')?.dataset.spOfferId||window.__spLastOfferModalId||window.__spLastOfferId)};
  var modal=function(){return document.getElementById('offerModal')};
  function dedupeInventory(m){
    var root=m&&m.querySelector('#spFinalOfferInventory'); if(!root)return;
    var rows=[].slice.call(root.querySelectorAll('[data-sp-inventory-row]')),seen=new Set();
    rows.forEach(function(row){var id=row.getAttribute('data-sp-inventory-row');if(!id)return;if(seen.has(id))row.remove();else seen.add(id)});
  }
  async function refreshCrew(m,id){
    var c=client();if(!c||!id)return;
    try{var r=await c.from('teklifler').select('crew_count,crew_unit_price,crew_total,total').eq('id',id).maybeSingle();if(r.error||!r.data)return;r.data.crew_count=n(r.data.crew_count);r.data.crew_unit_price=n(r.data.crew_unit_price);r.data.crew_total=n(r.data.crew_total||r.data.crew_count*r.data.crew_unit_price);var q=m.querySelector('#spOfferCrewPricingV3');if(q){q.querySelector('[data-sp-crew-count]').value=String(r.data.crew_count);q.querySelector('[data-sp-crew-unit]').value=String(r.data.crew_unit_price);q.querySelector('[data-sp-crew-total]').textContent=money(r.data.crew_total);q.querySelector('[data-sp-grand-total]').textContent=money(r.data.total)}}catch(e){console.warn('[stagepulse] crew pricing refresh failed',e)}
  }
  function installCrewPricing(m){
    var id=offerId(m);if(!id)return;
    var input=m.querySelector('#spOfferCrewCount');if(!input)return;
    if(m.querySelector('#spOfferCrewPricingV3')){refreshCrew(m,id);return;}
    var label=input.closest('label');if(!label)return;
    var box=document.createElement('div');box.id='spOfferCrewPricingV3';
    box.innerHTML='<label><span class="small">Personel sayısı</span><input type="number" min="0" max="99" step="1" data-sp-crew-count value="'+Math.max(0,Math.floor(n(input.value)))+'"></label>'+
      '<label><span class="small">Kişi başı ücret</span><input type="number" min="0" step="1" data-sp-crew-unit value="0"></label>'+
      '<div><span class="small muted">Personel toplamı</span><div class="sp-crew-total" data-sp-crew-total>₺0</div><span class="small muted">Genel toplam</span><div class="sp-crew-total" data-sp-grand-total>₺0</div></div>'+
      '<button type="button" class="btn btn-primary" data-sp-crew-pricing-save>Personel fiyatını kaydet</button>';
    label.insertAdjacentElement('afterend',box);
    var count=box.querySelector('[data-sp-crew-count]'),unit=box.querySelector('[data-sp-crew-unit]'),crewTotal=box.querySelector('[data-sp-crew-total]');
    var calc=function(){crewTotal.textContent=money(n(count.value)*n(unit.value))};count.addEventListener('input',calc);unit.addEventListener('input',calc);
    box.querySelector('[data-sp-crew-pricing-save]').onclick=async function(){
      var c=client(),cc=Math.max(0,Math.floor(n(count.value))),up=Math.max(0,n(unit.value));if(!c)return toast('Admin bağlantısı hazır değil.',false);
      try{var r=await c.rpc('admin_set_offer_crew_pricing',{p_offer_id:id,p_crew_count:cc,p_crew_unit_price:up});if(r.error)throw r.error;var d=r.data||{};crewTotal.textContent=money(n(d.crew_total||cc*up));box.querySelector('[data-sp-grand-total]').textContent=money(n(d.total));input.value=String(cc);input.dataset.spHydrated='1';toast('Personel fiyatı kaydedildi.');window.stagepulseRegenerateOfferPdf?.(id);}catch(e){toast(e.message||String(e),false)}
    };
    refreshCrew(m,id);
  }
  function observe(){
    var m=modal();if(!m)return;
    var id=offerId(m);if(!id)return;
    installCrewPricing(m);dedupeInventory(m);
    var root=m.querySelector('#spFinalOfferInventory');
    if(root&&!root.dataset.spDedupeObserver){root.dataset.spDedupeObserver='1';new MutationObserver(function(){dedupeInventory(m)}).observe(root,{childList:true,subtree:true})}
  }
  setInterval(observe,500);
})();
