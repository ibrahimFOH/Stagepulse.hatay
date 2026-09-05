/* Stagepulse Admin — semantic action button colors + recovery loaders */
(function(){
  'use strict';
  if(window.STAGEPULSE_ACTION_COLORS_V2)return;
  window.STAGEPULSE_ACTION_COLORS_V2=true;
  var normalize=function(v){return String(v||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();};
  var classify=function(b){
    if(!b||b.dataset.spActionColored==='1')return;
    var t=normalize([b.textContent,b.getAttribute('aria-label'),b.getAttribute('title'),b.dataset.action,b.dataset.view].filter(Boolean).join(' '));
    if(!t)return;
    var cls='';
    if(/pdf|belge indir|pdf indir|pdf oluştur|pdf öniz/.test(t)) cls='sp-btn-pdf';
    else if(/sil|kaldır|iptal|reddet|pasif|devre dışı|çıkış|delete|remove|cancel|reject/.test(t)) cls='sp-btn-danger';
    else if(/düzenle|duzenle|aç|ac|görüntüle|incele|detay|yönet|manage|edit|open|view/.test(t)) cls='sp-btn-edit';
    else if(/onayla|kaydet|ekle|oluştur|olustur|gönder|gonder|ata|başlat|baslat|aktif/.test(t)) cls='sp-btn-primary';
    if(cls){b.classList.add(cls);b.dataset.spActionColored='1';}
  };
  var scan=function(root){(root||document).querySelectorAll('button,.btn,a[role="button"],input[type="button"],input[type="submit"]').forEach(classify);};
  var load=function(src){var s=document.createElement('script');s.src=src;s.async=false;s.onload=function(){window.dispatchEvent(new CustomEvent('stagepulse-admin-recovery-ready'));};s.onerror=function(){console.warn('[stagepulse-admin] optional recovery layer failed',src);};document.body.appendChild(s);};
  function pricingRepair(){
    if(!location.hash.toLowerCase().startsWith('#pricing'))return;
    var head=document.querySelector('#content .page-head .actions');
    if(head&&!head.querySelector('[data-sp-new-service]')){
      var b=document.createElement('button');b.type='button';b.className='btn btn-primary sp-btn-primary';b.dataset.spActionColored='1';b.dataset.spNewService='1';b.textContent='+ Yeni Hizmet';
      b.addEventListener('click',openServiceForm);head.prepend(b);
    }
    var table=document.querySelector('#content .admin-table');
    if(table&&!table.dataset.spPricingTable){table.dataset.spPricingTable='1';table.classList.add('sp-pricing-table');}
  }
  function openServiceForm(){
    if(document.querySelector('#spPricingNewService'))return;
    var w=document.createElement('div');w.id='spPricingNewService';w.className='sp-runtime-modal';
    w.innerHTML='<div class="sp-runtime-modal-card sp-pricing-form-card"><h2>Yeni hizmet</h2><div class="sp-runtime-modal-grid"><label>Hizmet adı<input data-sp-name maxlength="160" required></label><label>Temel fiyat<input data-sp-price type="number" min="0" step="1" inputmode="numeric" value="0"></label><label>Açıklama<input data-sp-desc maxlength="500"></label><label>Sıra<input data-sp-sort type="number" min="0" step="1" inputmode="numeric" value="0"></label></div><div class="sp-runtime-modal-actions"><button type="button" class="btn" data-sp-cancel>Vazgeç</button><button type="button" class="btn btn-primary sp-btn-primary" data-sp-save>Kaydet</button></div></div>';
    document.body.appendChild(w);
    w.querySelector('[data-sp-cancel]').onclick=function(){w.remove();};
    w.querySelector('[data-sp-save]').onclick=async function(){
      var db=window.__stagepulseAdminClient||window.sb||window.supabaseClient;
      var name=w.querySelector('[data-sp-name]').value.trim();
      if(!name){w.querySelector('[data-sp-name]').focus();return;}
      if(!db){window.toast?.('Supabase bağlantısı hazır değil.',false);return;}
      var res=await db.rpc('staff_upsert_service',{p_id:null,p_name:name,p_description:w.querySelector('[data-sp-desc]').value.trim()||null,p_base_price:Number(w.querySelector('[data-sp-price]').value)||0,p_sort_order:Number(w.querySelector('[data-sp-sort]').value)||0});
      if(res.error){window.toast?.(res.error.message||'Hizmet eklenemedi.',false);return;}
      w.remove();window.toast?.('Hizmet eklendi.',true);setTimeout(function(){location.reload();},180);
    };
  }
  function installPricingCss(){
    if(document.getElementById('sp-pricing-responsive-css'))return;
    var s=document.createElement('style');s.id='sp-pricing-responsive-css';s.textContent='@media (max-width:1100px){.admin-body #content .sp-pricing-table{min-width:0!important;width:100%!important;table-layout:auto!important;border-spacing:0 8px!important}.admin-body #content .sp-pricing-table thead{display:none!important}.admin-body #content .sp-pricing-table tbody tr{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:0!important;border:1px solid #292f3b!important;border-radius:12px!important;overflow:hidden!important;margin-bottom:8px!important}.admin-body #content .sp-pricing-table tbody td{display:block!important;min-width:0!important;width:auto!important;padding:10px 12px!important;border:0!important;border-radius:0!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:left!important}.admin-body #content .sp-pricing-table tbody td::before{content:attr(data-label);display:block!important;margin-bottom:3px!important;color:#737d8e!important;font-size:10px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:.06em!important}.admin-body #content .sp-pricing-table tbody td:last-child{grid-column:1/-1!important;border-top:1px solid #242a34!important;display:flex!important;gap:8px!important;flex-wrap:wrap!important;align-items:stretch!important}.admin-body #content .sp-pricing-table tbody td:last-child .btn{flex:1 1 140px!important;min-width:0!important;width:auto!important;white-space:normal!important}.admin-body #content .page-head>.actions{width:100%!important;justify-content:flex-end!important;flex-wrap:wrap!important}.admin-body #content .page-head>.actions .btn{min-width:150px!important;max-width:100%!important}}@media(max-width:520px){.admin-body #content .sp-pricing-table tbody tr{grid-template-columns:1fr!important}.admin-body #content .sp-pricing-table tbody td:last-child{grid-column:auto!important}.admin-body #content .page-head>.actions{justify-content:stretch!important}.admin-body #content .page-head>.actions .btn{width:100%!important;min-width:0!important}}';document.head.appendChild(s);
  }
  var boot=function(){
    scan(document);installPricingCss();pricingRepair();
    var o=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes&&m.addedNodes.forEach(function(n){if(n.nodeType===1){classify(n);scan(n);}});});pricingRepair();});
    o.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',function(){setTimeout(pricingRepair,30);});
    load('media-manager-v2.js?v=20260905-2');
    load('admin-navigation-state-v2.js?v=20260905-2');
    load('admin-offer-pricing-v3.js?v=20260905-2');
    load('jarvis/knowledge.js?v=20260905-1');
    load('jarvis/agent.js?v=20260905-1');
    load('jarvis/bootstrap.js?v=20260905-1');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
