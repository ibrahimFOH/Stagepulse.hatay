/* Stagepulse Admin — deterministic route renderer fallback. Keeps shared shell and clears stale content. */
(() => {
  'use strict';
  const META = {
    'command-center':['Komuta Merkezi','Operasyon'],dashboard:['Genel Bakış','Satış ve operasyon'],analytics:['Analitik','Dönüşüm'],customers:['Müşteriler','Müşteri geçmişi'],offers:['Teklifler','Lead ve teklif yönetimi'],pricing:['Fiyatlandırma','Hizmet ve kurallar'],settlements:['Gelir · Gider','Anlaşılan → gider → paylaşım'],calendar:['İşler · Takvim','Kurulum ve etkinlik'],equipment:['Ekipman','Envanter'],personnel:['Personel','Portal hesapları'],finance:['Ödemeler','Tahsilat kayıtları'],notifications:['Bildirimler','Sistem uyarıları'],activity:['Aktivite','İşlem geçmişi'],media:['Medya','Yönetim'],settings:['Ayarlar','İşletme ve hesap']
  };
  const HANDLERS = {
    'command-center':'commandCenterView','dashboard':'dashboard','analytics':'analyticsView','customers':'customersView','offers':'offersView','pricing':'pricingView','settlements':'settlementsView','calendar':'calendarView','equipment':'equipmentView','personnel':'personnelView','finance':'financeView','notifications':'notificationsView','activity':'activityView','media':'mediaView','settings':'settingsView'
  };
  const $=s=>document.querySelector(s);
  function ensure(){
    const c=$('#content'); if(!c) return null;
    c.setAttribute('data-stagepulse-route-root','1');
    c.replaceChildren();
    return c;
  }
  async function render(view){
    const key=Object.prototype.hasOwnProperty.call(META,view)?view:'dashboard';
    const [title,sub]=META[key];
    $('#viewTitle') && ($('#viewTitle').textContent=title);
    $('#viewSubtitle') && ($('#viewSubtitle').textContent=sub);
    document.querySelectorAll('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===key));
    const c=ensure();
    const fnName=HANDLERS[key];
    const fn=fnName && window[fnName];
    try {
      if(typeof fn==='function'){ await fn(); return true; }
      if(key==='command-center' && window.CommandCenter?.render){ await window.CommandCenter.render(); return true; }
      if(key==='media' && window.SiteMediaManager?.render){ await window.SiteMediaManager.render(); return true; }
      if(c){ c.innerHTML='<div class="notice"><b>'+title+'</b><p>Bu modül için görünüm yükleyicisi bulunamadı.</p></div>'; }
      return false;
    } catch(e){
      console.error('[Stagepulse admin route]',key,e);
      if(c) c.innerHTML='<div class="notice"><b>Sistem hatası</b><p>'+String(e?.message||e).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]))+'</p></div>';
      return false;
    }
  }
  function bind(){
    if(window.__stagepulseAdminRoutingRepairBound) return;
    window.__stagepulseAdminRoutingRepairBound=true;
    const original=window.loadView;
    if(typeof original!=='function') return;
    window.loadView=async function(view){
      const key=Object.prototype.hasOwnProperty.call(META,view)?view:'dashboard';
      const c=$('#content');
      if(c) c.replaceChildren();
      const result=await original.apply(this,[key]);
      const after=$('#content');
      if(after && !after.children.length){ await render(key); }
      return result;
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
