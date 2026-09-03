/* Stagepulse Owner Operating System — owner-only decision layer. */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  async function owner(){const c=db();if(!c)return false;const r=await c.rpc('is_org_owner');return !r.error&&r.data===true}
  async function load(){const c=db();if(!c)return; if(!(await owner()))return;const r=await c.rpc('owner_executive_foundation');if(r.error)throw r.error;const d=r.data||{};if(!d.authorized)return;render(d)}
  function card(title,value,sub,kind=''){return `<div class="sp-os-card ${kind}"><small>${esc(title)}</small><strong>${esc(value)}</strong><span>${esc(sub||'')}</span></div>`}
  function render(d){
    const root=$('#content');if(!root)return;
    const a=d.alerts||{},s=d.sales||{},o=d.operations||{},f=d.financial||{},st=d.strategic||{},ai=d.ai||{},au=d.automation||{};
    let old=$('#spOwnerOperatingSystem');if(old)old.remove();
    const el=document.createElement('section');el.id='spOwnerOperatingSystem';el.className='sp-os';
    el.innerHTML=`<div class="sp-os-head"><div><span>OWNER OPERATING SYSTEM</span><h3>Patron karar merkezi</h3><p>Şirketin finansal, ticari, operasyonel ve stratejik durumunu tek bakışta değerlendir.</p></div><button class="btn" data-os-refresh>Verileri yenile</button></div>
      <div class="sp-os-alerts">${card('Gecikmiş ödeme',a.overdue_payments,'Acil finans kontrolü',a.overdue_payments?'danger':'ok')}${card('Düşük stok',a.low_stock,'Ekipman kontrolü',a.low_stock?'warn':'ok')}${card('Onay bekleyen',a.open_approvals,'Karar bekleyen işlem',a.open_approvals?'warn':'ok')}${card('Okunmamış',a.unread_notifications,'Bildirim merkezi',a.unread_notifications?'warn':'ok')}</div>
      <div class="sp-os-grid"><article><h4>Ticari motor</h4><div class="sp-os-stats">${card('Toplam teklif',s.offers_total,'Tüm dönem')}${card('Açık teklif',s.offers_open,'Takip gerekiyor')}${card('Kabul edilen',s.offers_accepted,'Kazanılan işler','ok')}${card('Müşteri',s.customers,'Aktif müşteri tabanı')}</div></article>
      <article><h4>Operasyon motoru</h4><div class="sp-os-stats">${card('Toplam iş',o.jobs_total,'Tüm işler')}${card('Aktif iş',o.jobs_active,'Devam eden operasyon')}${card('Etkinlik',o.events,'Event DNA')}${card('Ekipman',o.equipment,'Envanter')}</div></article></div>
      <div class="sp-os-grid"><article><h4>Finans motoru</h4><div class="sp-os-finance"><b>Bekleyen</b><strong>${money(f.payments_pending)}</strong><b>Gecikmiş</b><strong>${money(f.payments_overdue)}</strong><span>${esc(f.settlements||0)} settlement kaydı</span></div></article>
      <article><h4>Strateji + AI</h4><div class="sp-os-stats">${card('Hedefler',st.goals,'Yönetim hedefleri')}${card('KPI',st.kpis,'Ölçüm sistemi')}${card('Girişimler',st.initiatives,'Stratejik projeler')}${card('Riskler',st.risks,'Risk kaydı',st.risks?'warn':'ok')}${card('AI görevleri',ai.tasks,'AI operasyonları')}${card('AI çalışmaları',ai.runs,'AI run geçmişi')}</div></article></div>
      <div class="sp-os-footer"><span><b>${esc(au.rules||0)}</b> aktif otomasyon</span><span><b>${esc(au.runs||0)}</b> otomasyon çalışması</span><span>Son veri: ${new Date(d.generated_at||Date.now()).toLocaleString('tr-TR')}</span></div>`;
    root.appendChild(el); $('[data-os-refresh]',el)?.addEventListener('click',()=>load().catch(e=>window.toast?.(e.message||'Yüklenemedi.',false)));
  }
  async function boot(){if(!location.hash.slice(1).startsWith('patron-center'))return;try{await load()}catch(e){console.error('[owner-os]',e)}}
  window.addEventListener('hashchange',boot);window.addEventListener('stagepulse-admin-ready',boot);document.addEventListener('DOMContentLoaded',boot);setTimeout(boot,1500);
})();
