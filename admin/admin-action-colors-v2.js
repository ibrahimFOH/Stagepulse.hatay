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
  var boot=function(){
    scan(document);
    var o=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes&&m.addedNodes.forEach(function(n){if(n.nodeType===1){classify(n);scan(n);}});});});
    o.observe(document.body,{childList:true,subtree:true});
    load('media-manager-v2.js?v=20260905-2');
    load('admin-navigation-state-v2.js?v=20260905-1');
    load('jarvis/knowledge.js?v=20260905-1');
    load('jarvis/agent.js?v=20260905-1');
    load('jarvis/bootstrap.js?v=20260905-1');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
