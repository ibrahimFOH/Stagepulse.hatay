(() => {
  'use strict';
  if (window.STAGEPULSE_PRODUCTION_OS) return;
  window.STAGEPULSE_PRODUCTION_OS = true;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const fmt=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(Number(n)||0);
  const pct=n=>`${Math.round(Number(n)||0)}%`;

  function nav(){
    const n=q('#sideNav'); if(!n||q('[data-view="production-os"]'))return;
    const label=document.createElement('p'); label.className='nav-label'; label.textContent='Operasyon OS';
    const b=document.createElement('button'); b.type='button'; b.dataset.view='production-os'; b.textContent='Üretim Merkezi';
    b.onclick=()=>{location.hash='#production-os';render();};
    n.insertBefore(label,q('#logoutBtn')); n.insertBefore(b,q('#logoutBtn'));
  }
  async function count(table,filter){const c=db();if(!c)return 0;let x=c.from(table).select('*',{count:'exact',head:true});if(filter)x=filter(x);const r=await x;return r.error?0:r.count||0;}
  async function rows(table,columns='*',limit=20){const c=db();if(!c)return[];const r=await c.from(table).select(columns).order('created_at',{ascending:false}).limit(limit);return r.error?[]:(r.data||[]);}
  async function render(){
    if((location.hash||'').split('?')[0].replace('#','').toLowerCase()!=='production-os')return;
    nav(); const c=q('#content'); if(!c)return;
    c.innerHTML='<div class="panel"><h2>Üretim Merkezi</h2><p>Operasyon verileri yükleniyor…</p></div>';
    const [leads,timesheets,scans,warehouse,proofs,incidents,maintenance,purchases,readiness]=await Promise.all([
      count('sp_crm_leads',x=>x.in('stage',['new','qualified','meeting','quoted'])),
      count('sp_staff_timesheets',x=>x.eq('status','submitted')),
      count('sp_equipment_scans'),
      count('sp_warehouse_jobs',x=>x.in('status',['picking','qc','packed','loaded','on_site','returning'])),
      count('sp_field_proofs'),
      count('sp_equipment_incidents',x=>x.in('status',['open','investigating','repair'])),
      count('sp_maintenance_work_orders',x=>x.in('status',['due','locked','in_progress'])),
      count('sp_purchase_orders',x=>x.in('status',['requested','approved','ordered'])),
      rows('sp_event_readiness','job_id,readiness_percent,crew_percent,equipment_percent,logistics_percent,safety_percent,finance_percent,blockers,last_calculated_at',12)
    ]);
    const avg=readiness.length?readiness.reduce((a,x)=>a+Number(x.readiness_percent||0),0)/readiness.length:0;
    c.innerHTML=`<div class="sp-os"><div class="page-head"><div><h2>Üretim Merkezi</h2><p>Satıştan sahaya kadar operasyon görünümü.</p></div></div>
      <div class="sp-os-banner"><strong>Akış:</strong> Lead → Teklif → Onay → Planlama → Personel → Ekipman → Depo → Araç → Saha → Kapanış → Finans</div>
      <div class="sp-os-grid">
        ${card('Açık satış fırsatı',leads,'CRM pipeline')}
        ${card('Operasyon hazırlığı',pct(avg),'Etkinlik readiness')}
        ${card('Bekleyen puantaj',timesheets,'Onay bekleyen kayıt')}
        ${card('Açık ekipman olayı',incidents,'İnceleme / onarım')}
        ${card('Bakım işi',maintenance,'Bekleyen bakım')}
        ${card('Satın alma',purchases,'Aktif satın alma akışı')}
        ${card('Depo akışı',warehouse,'Aktif depo işleri')}
        ${card('Saha kanıtı',proofs,'Fotoğraf · imza · GPS · checklist')}
      </div>
      <div class="sp-os-card"><h3>Etkinlik hazırlığı</h3>${readinessHtml(readiness)}</div>
      <div class="sp-os-card"><h3>Saha taramaları</h3><div class="sp-os-value">${fmt(scans)}</div><div class="sp-os-muted">Toplam ekipman taraması</div></div>
    </div>`;
  }
  function card(title,value,note){return `<div class="sp-os-card"><h3>${esc(title)}</h3><div class="sp-os-value">${esc(value)}</div><div class="sp-os-muted">${esc(note)}</div></div>`;}
  function readinessHtml(items){if(!items.length)return'<div class="sp-os-empty">Henüz readiness kaydı yok.</div>';return`<table class="sp-os-table"><thead><tr><th>İş</th><th>Hazırlık</th><th>Ekip</th><th>Ekipman</th><th>Logistik</th><th>Güvenlik</th><th>Finans</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.job_id||'—')}</td><td>${pct(x.readiness_percent)}</td><td>${pct(x.crew_percent)}</td><td>${pct(x.equipment_percent)}</td><td>${pct(x.logistics_percent)}</td><td>${pct(x.safety_percent)}</td><td>${pct(x.finance_percent)}</td></tr>`).join('')}</tbody></table>`;}
  const style=document.createElement('style');style.textContent='.sp-os{display:grid;gap:16px}.sp-os-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.sp-os-card{background:#11151b;border:1px solid #2b3039;border-radius:14px;padding:16px}.sp-os-card h3{margin:0 0 8px;font-size:13px}.sp-os-value{font-size:28px;font-weight:900;color:#fff}.sp-os-muted{color:#aeb5c0;font-size:12px}.sp-os-banner{padding:11px 13px;border-radius:10px;background:#171b22;border:1px solid #343a45}.sp-os-table{width:100%;border-collapse:collapse}.sp-os-table th,.sp-os-table td{padding:10px;border-bottom:1px solid #292f38;text-align:left}.sp-os-table th{font-size:11px;color:#929aa8}.sp-os-empty{padding:18px;color:#8e97a7;text-align:center}@media(max-width:900px){.sp-os-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.sp-os-grid{grid-template-columns:1fr}.sp-os-table{font-size:12px;display:block;overflow:auto}}';
  if(!document.getElementById('sp-os-style')){style.id='sp-os-style';document.head.appendChild(style);}
  window.addEventListener('hashchange',render); if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();