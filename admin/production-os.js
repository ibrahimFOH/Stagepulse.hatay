(() => {
  'use strict';
  if (window.STAGEPULSE_PRODUCTION_OS) return;
  window.STAGEPULSE_PRODUCTION_OS = true;

  const q = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const db = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;
  const toast = (m, ok = true) => window.toast?.(m, ok);
  const fmt = n => new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(Number(n)||0);
  const pct = n => `${Math.round(Number(n)||0)}%`;
  const localKey = 'stagepulse.production-os.offline.v1';
  const getQueue = () => { try { return JSON.parse(localStorage.getItem(localKey)||'[]'); } catch { return []; } };
  const setQueue = x => localStorage.setItem(localKey, JSON.stringify(x.slice(-100)));

  const styles = `
    .sp-os{display:grid;gap:16px}.sp-os-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.sp-os-card{background:#11151b;border:1px solid #2b3039;border-radius:14px;padding:16px}.sp-os-card h3{margin:0 0 8px;font-size:13px}.sp-os-value{font-size:28px;font-weight:900;color:#fff}.sp-os-muted{color:#aeb5c0;font-size:12px}.sp-os-progress{height:8px;background:#252a32;border-radius:99px;overflow:hidden}.sp-os-progress>i{display:block;height:100%;background:#ffb000}.sp-os-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.sp-os-actions{display:flex;gap:8px;flex-wrap:wrap}.sp-os-tabs{display:flex;gap:8px;flex-wrap:wrap}.sp-os-tabs button{border:1px solid #343a45;background:#171b22;color:#e8ebf0;border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer}.sp-os-tabs button.active{background:#ffb000;color:#111;border-color:#ffb000}.sp-os-table{width:100%;border-collapse:collapse}.sp-os-table th,.sp-os-table td{padding:10px;border-bottom:1px solid #292f38;text-align:left;vertical-align:top}.sp-os-table th{font-size:11px;color:#929aa8}.sp-os-pill{display:inline-flex;padding:4px 8px;border-radius:999px;border:1px solid #3b4048;font-size:11px;font-weight:800}.sp-os-danger{color:#ff8c9f}.sp-os-ok{color:#6ee7a0}.sp-os-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sp-os-form label{display:grid;gap:5px;font-size:11px;color:#aeb5c0;font-weight:800}.sp-os-form input,.sp-os-form select,.sp-os-form textarea{width:100%;box-sizing:border-box;padding:9px;background:#0c0f14;color:#fff;border:1px solid #343a45;border-radius:9px}.sp-os-form textarea{min-height:80px}.sp-os-span-3{grid-column:1/-1}.sp-os-empty{padding:18px;color:#8e97a7;text-align:center}.sp-os-banner{padding:11px 13px;border-radius:10px;background:#171b22;border:1px solid #343a45}.sp-os-banner strong{color:#fff}@media(max-width:900px){.sp-os-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-os-form{grid-template-columns:1fr 1fr}}@media(max-width:600px){.sp-os-grid{grid-template-columns:1fr}.sp-os-form{grid-template-columns:1fr}.sp-os-span-3{grid-column:auto}.sp-os-table{font-size:12px}}
  `;
  const injectStyle = () => { if(q('#sp-os-style')) return; const s=document.createElement('style'); s.id='sp-os-style'; s.textContent=styles; document.head.appendChild(s); };

  function nav() {
    const n=q('#sideNav'); if(!n || q('[data-view="production-os"]')) return;
    const label=document.createElement('p'); label.className='nav-label'; label.textContent='Operasyon OS';
    const b=document.createElement('button'); b.type='button'; b.dataset.view='production-os'; b.textContent='Üretim Merkezi';
    b.addEventListener('click',()=>{location.hash='#production-os'; render();});
    n.insertBefore(label,q('#logoutBtn')); n.insertBefore(b,q('#logoutBtn'));
  }

  async function count(table, filter) {
    const c=db(); if(!c) return 0;
    let x=c.from(table).select('*',{count:'exact',head:true});
    if(filter) x=filter(x);
    const r=await x; return r.count||0;
  }
  async function rows(table, columns='*', limit=20) {
    const c=db(); if(!c) return [];
    const r=await c.from(table).select(columns).order('created_at',{ascending:false}).limit(limit);
    if(r.error) { console.warn('[production-os]',r.error); return []; }
    return r.data||[];
  }
  async function pending() {
    const c=db(); if(!c) return {followups:0,ai:0,incidents:0,maintenance:0,po:0};
    const [followups,ai,incidents,maintenance,po]=await Promise.all([
      count('sp_quote_followups',x=>x.eq('status','scheduled').lte('scheduled_at',new Date().toISOString())),
      count('sp_ai_recommendations',x=>x.in('status',['pending','approved'])),
      count('sp_equipment_incidents',x=>x.in('status',['open','investigating','repair'])),
      count('sp_maintenance_work_orders',x=>x.in('status',['due','locked','in_progress'])),
      count('sp_purchase_orders',x=>x.in('status',['requested','approved','ordered']))
    ]); return {followups,ai,incidents,maintenance,po};
  }

  async function render() {
    if((location.hash||'').split('?')[0].replace('#','').toLowerCase()!=='production-os') return;
    injectStyle(); nav();
    const c=q('#content'); if(!c) return;
    c.innerHTML='<div class="panel"><h2>Üretim Merkezi</h2><p class="sp-os-muted">Bağlı operasyon zinciri yükleniyor…</p></div>';
    const p=await pending();
    const [leads,timesheets,scans,warehouse,proofs,readiness,ai]=await Promise.all([
      count('sp_crm_leads',x=>x.in('stage',['new','qualified','meeting','quoted'])),
      count('sp_staff_timesheets',x=>x.eq('status','submitted')),
      count('sp_equipment_scans'),
      count('sp_warehouse_jobs',x=>x.in('status',['picking','qc','packed','loaded','on_site','returning'])),
      count('sp_field_proofs'),
      rows('sp_event_readiness','job_id,readiness_percent,crew_percent,equipment_percent,logistics_percent,safety_percent,finance_percent,blockers,last_calculated_at',8),
      rows('sp_ai_recommendations','id,type,priority,title,rationale,status,proposed_action,created_at',8)
    ]);
    const avgRead=readiness.length?readiness.reduce((a,x)=>a+Number(x.readiness_percent||0),0)/readiness.length:0;
    c.innerHTML=`<div class="sp-os">
      <div class="page-head"><div><h2>Üretim Merkezi</h2><p>Satıştan sahaya kadar tek operasyon görünümü.</p></div><div class="actions"><button class="btn" id="spOsSync">Offline kuyruğu senkronize et</button><button class="btn btn-primary" id="spOsNewLead">Yeni lead</button></div></div>
      <div class="sp-os-banner"><strong>Akış:</strong> Lead → Teklif → Onay → Planlama → Personel → Ekipman → Depo → Araç → Saha → Kapanış → Finans</div>
      <div class="sp-os-grid">
        <div class="sp-os-card"><h3>Açık satış fırsatı</h3><div class="sp-os-value">${fmt(leads)}</div><div class="sp-os-muted">CRM pipeline</div></div>
        <div class="sp-os-card"><h3>Operasyon hazırlığı</h3><div class="sp-os-value">${pct(avgRead)}</div><div class="sp-os-progress"><i style="width:${Math.min(100,Math.max(0,avgRead))}%"></i></div></div>
        <div class="sp-os-card"><h3>Bekleyen AI aksiyonu</h3><div class="sp-os-value">${fmt(p.ai)}</div><div class="sp-os-muted">Onay gerektiren öneriler</div></div>
        <div class="sp-os-card"><h3>Saha kanıtı</h3><div class="sp-os-value">${fmt(proofs)}</div><div class="sp-os-muted">Fotoğraf · imza · GPS · checklist</div></div>
      </div>
      <div class="sp-os-tabs"><button class="active" data-tab="overview">Genel</button><button data-tab="risk">Risk & AI</button><button data-tab="field">Saha</button><button data-tab="sales">Satış</button></div>
      <section id="spOsTab"></section>
    </div>`;
    q('#spOsSync').onclick=syncQueue; q('#spOsNewLead').onclick=()=>newLead();
    qa('.sp-os-tabs button').forEach(b=>b.onclick=()=>{qa('.sp-os-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTab(b.dataset.tab,{p,readiness,ai,leads,timesheets,scans,warehouse,proofs});});
    renderTab('overview',{p,readiness,ai,leads,timesheets,scans,warehouse,proofs});
  }
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];

  function renderTab(tab,d){
    const host=q('#spOsTab'); if(!host) return;
    if(tab==='risk'){
      host.innerHTML=`<div class="sp-os-card"><div class="sp-os-row"><div><h3>AI operasyon önerileri</h3><div class="sp-os-muted">Öneri → onay → uygulama → denetim modeli.</div></div><button class="btn" id="spAiRefresh">Yenile</button></div><div id="spAiList">${aiHtml(d.ai)}</div></div><div class="sp-os-card"><h3>Açık riskler</h3><p>${d.p.incidents} ekipman olayı, ${d.p.maintenance} bakım işi, ${d.p.po} satın alma akışı bekliyor.</p></div>`;
      q('#spAiRefresh').onclick=render;
    } else if(tab==='field'){
      host.innerHTML=`<div class="sp-os-grid"><div class="sp-os-card"><h3>Bekleyen puantaj</h3><div class="sp-os-value">${d.timesheets}</div></div><div class="sp-os-card"><h3>Depo akışı</h3><div class="sp-os-value">${d.warehouse}</div></div><div class="sp-os-card"><h3>QR tarama</h3><div class="sp-os-value">${d.scans}</div></div><div class="sp-os-card"><h3>Saha kanıtı</h3><div class="sp-os-value">${d.proofs}</div></div></div><div class="sp-os-card"><h3>Hızlı saha işlemi</h3><div class="sp-os-form"><label>QR / ekipman kodu<input id="spScanCode" autocomplete="off"></label><label>İşlem<select id="spScanAction"><option value="inspect">Kontrol</option><option value="check_out">Çıkış</option><option value="load">Yükle</option><option value="deliver">Teslim</option><option value="return">İade</option></select></label><label>İş ID<input id="spScanJob"></label><div class="sp-os-span-3 sp-os-actions"><button class="btn btn-primary" id="spScanSave">Taramayı kaydet</button></div></div></div>`;
      q('#spScanSave').onclick=submitScan;
    } else if(tab==='sales'){
      host.innerHTML=`<div class="sp-os-card"><div class="sp-os-row"><div><h3>CRM pipeline</h3><div class="sp-os-muted">Lead → toplantı → teklif → takip → kazanıldı/kaybedildi.</div></div><button class="btn btn-primary" id="spLeadBtn">Lead ekle</button></div><div id="spLeadTable"></div></div><div class="sp-os-card"><h3>Teklif takip kuyruğu</h3><p>${d.p.followups} zamanı gelmiş takip bulunuyor.</p></div>`;
      q('#spLeadBtn').onclick=newLead; loadLeads();
    } else {
      host.innerHTML=`<div class="sp-os-grid"><div class="sp-os-card"><h3>Takip</h3><div class="sp-os-value">${d.p.followups}</div></div><div class="sp-os-card"><h3>Bakım</h3><div class="sp-os-value">${d.p.maintenance}</div></div><div class="sp-os-card"><h3>Satın alma</h3><div class="sp-os-value">${d.p.po}</div></div><div class="sp-os-card"><h3>Ekipman olayları</h3><div class="sp-os-value">${d.p.incidents}</div></div></div><div class="sp-os-card"><h3>Etkinlik hazırlığı</h3>${readinessHtml(d.readiness)}</div>`;
    }
  }

  function aiHtml(items){ if(!items?.length) return '<div class="sp-os-empty">Bekleyen AI önerisi yok.</div>'; return `<table class="sp-os-table"><thead><tr><th>Öncelik</th><th>Öneri</th><th>Durum</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td><span class="sp-os-pill">${esc(x.priority)}</span></td><td><strong>${esc(x.title)}</strong><br><span class="sp-os-muted">${esc(x.rationale||'')}</span></td><td>${esc(x.status)}</td><td><button class="btn" data-ai-id="${esc(x.id)}">Onayla</button></td></tr>`).join('')}</tbody></table>`; }
  function readinessHtml(items){ if(!items?.length) return '<div class="sp-os-empty">Henüz readiness kaydı yok.</div>'; return `<table class="sp-os-table"><thead><tr><th>İş</th><th>Hazırlık</th><th>Ekip</th><th>Ekipman</th><th>Logistik</th><th>Güvenlik</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.job_id||'—')}</td><td>${pct(x.readiness_percent)}</td><td>${pct(x.crew_percent)}</td><td>${pct(x.equipment_percent)}</td><td>${pct(x.logistics_percent)}</td><td>${pct(x.safety_percent)}</td></tr>`).join('')}</tbody></table>`; }

  async function loadLeads(){ const host=q('#spLeadTable'); if(!host)return; const data=await rows('sp_crm_leads','id,name,company,stage,estimated_value,next_follow_up_at,created_at',30); host.innerHTML=data.length?`<table class="sp-os-table"><thead><tr><th>Lead</th><th>Aşama</th><th>Değer</th><th>Takip</th></tr></thead><tbody>${data.map(x=>`<tr><td><strong>${esc(x.name)}</strong><br><span class="sp-os-muted">${esc(x.company||x.email||'')}</span></td><td>${esc(x.stage)}</td><td>${fmt(x.estimated_value)} ₺</td><td>${x.next_follow_up_at?new Date(x.next_follow_up_at).toLocaleString('tr-TR'):'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="sp-os-empty">Lead bulunmuyor.</div>'; }

  function newLead(){
    const w=document.createElement('div'); w.className='sp-runtime-modal'; w.innerHTML=`<div class="sp-runtime-modal-card"><h2>Yeni lead</h2><div class="sp-os-form"><label>Ad / Yetkili<input id="spLeadName" required></label><label>Firma<input id="spLeadCompany"></label><label>E-posta<input id="spLeadEmail" type="email"></label><label>Telefon<input id="spLeadPhone"></label><label>Tahmini değer<input id="spLeadValue" type="number" min="0"></label><label>Kaynak<input id="spLeadSource" placeholder="web, referans, sosyal medya…"></label><label class="sp-os-span-3">Not<textarea id="spLeadNote"></textarea></label></div><div class="sp-runtime-modal-actions"><button class="btn" data-cancel>Vazgeç</button><button class="btn btn-primary" data-save>Kaydet</button></div></div>`;
    document.body.appendChild(w); q('[data-cancel]',w).onclick=()=>w.remove(); q('[data-save]',w).onclick=async()=>{const c=db();const payload={name:q('#spLeadName',w).value.trim(),company:q('#spLeadCompany',w).value.trim()||null,email:q('#spLeadEmail',w).value.trim()||null,phone:q('#spLeadPhone',w).value.trim()||null,estimated_value:Number(q('#spLeadValue',w).value)||0,source:q('#spLeadSource',w).value.trim()||null,notes:q('#spLeadNote',w).value.trim()||null};if(!payload.name)return toast('Lead adı gerekli.',false);const r=await c.from('sp_crm_leads').insert(payload);if(r.error)return toast(r.error.message,false);w.remove();toast('Lead oluşturuldu.');render();};
  }

  async function submitScan(){
    const code=q('#spScanCode')?.value.trim(); if(!code)return toast('Ekipman kodu gerekli.',false);
    const payload={code,scan_action:q('#spScanAction').value,job_id:q('#spScanJob').value.trim()||null,client_event_id:crypto.randomUUID()};
    if(navigator.onLine===false){const x=getQueue();x.push({type:'equipment_scan',payload});setQueue(x);return toast('Offline kuyruğa alındı.');}
    const c=db(); const r=await c.from('sp_equipment_scans').insert({code,action:payload.scan_action,job_id:payload.job_id,scanned_by:(await c.auth.getUser()).data.user?.id,client_event_id:payload.client_event_id}); if(r.error)return toast(r.error.message,false);toast('Tarama kaydedildi.');render();
  }

  async function syncQueue(){
    const queue=getQueue(); if(!queue.length)return toast('Offline kuyruğu boş.'); if(!navigator.onLine)return toast('Bağlantı yok.',false);
    const c=db(); const user=(await c.auth.getUser()).data.user; const remaining=[];
    for(const item of queue){ if(item.type==='equipment_scan'){const p=item.payload;const r=await c.from('sp_equipment_scans').insert({code:p.code,action:p.scan_action,job_id:p.job_id,scanned_by:user?.id||null,client_event_id:p.client_event_id});if(r.error)remaining.push(item);} }
    setQueue(remaining);toast(remaining.length?`${remaining.length} kayıt bekliyor.`:'Offline kuyruğu senkronize edildi.');render();
  }

  function start(){
    injectStyle(); nav();
    window.addEventListener('hashchange',render);
    window.addEventListener('online',syncQueue);
    if((location.hash||'').includes('production-os')) render();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
