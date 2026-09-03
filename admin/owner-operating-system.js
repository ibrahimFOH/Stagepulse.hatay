/* Stagepulse Owner Operating System — executive cockpit + real command actions. */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const labels={company:'Şirket',customers:'Müşteri',offers:'Teklif',jobs:'İş',events:'Etkinlik',staff:'Personel',equipment:'Ekipman',warehouse:'Depo',vehicles:'Araç',payments:'Finans',settlements:'Kârlılık',business_risks:'Risk',contracts:'Sözleşme',suppliers:'Tedarikçi',marketing:'Pazarlama',kpis:'KPI',goals:'Strateji / Hedef',initiatives:'Stratejik Girişim',ai_tasks:'AI',automation:'Otomasyon',approval_requests:'Onay',decisions:'Karar / Denetim',app_versions:'APK / Web',site_media:'Web Medya',system:'Sistem Sağlığı'};
  let catalog=[];
  async function owner(){const c=db();if(!c)return false;const r=await c.rpc('is_org_owner');return !r.error&&r.data===true}
  async function call(name,args){const c=db();if(!c)throw Error('Supabase istemcisi hazır değil.');const r=await c.rpc(name,args);if(r.error)throw r.error;return r.data}
  async function foundation(){const d=await call('owner_executive_foundation');if(!d?.authorized)throw Error('Patron yetkisi gerekli.');return d}
  function card(title,value,sub,kind=''){return `<div class="sp-os-card ${kind}"><small>${esc(title)}</small><strong>${esc(value)}</strong><span>${esc(sub||'')}</span></div>`}
  function dashboard(d){
    const a=d.alerts||{},s=d.sales||{},o=d.operations||{},f=d.financial||{},st=d.strategic||{},ai=d.ai||{},au=d.automation||{};
    return `<div class="sp-os-head"><div><span>OWNER OPERATING SYSTEM</span><h3>Patron karar merkezi</h3><p>Şirket, satış, operasyon, finans, risk, strateji ve AI tek kontrol katmanında.</p></div><button class="btn" data-os-refresh>Verileri yenile</button></div>
      <div class="sp-os-alerts">${card('Gecikmiş ödeme',a.overdue_payments,'Acil finans kontrolü',a.overdue_payments?'danger':'ok')}${card('Düşük stok',a.low_stock,'Ekipman kontrolü',a.low_stock?'warn':'ok')}${card('Onay bekleyen',a.open_approvals,'Karar bekleyen işlem',a.open_approvals?'warn':'ok')}${card('Okunmamış',a.unread_notifications,'Bildirim merkezi',a.unread_notifications?'warn':'ok')}</div>
      <div class="sp-os-grid"><article><h4>Ticari motor</h4><div class="sp-os-stats">${card('Toplam teklif',s.offers_total,'Tüm dönem')}${card('Açık teklif',s.offers_open,'Takip gerekiyor')}${card('Kabul edilen',s.offers_accepted,'Kazanılan işler','ok')}${card('Müşteri',s.customers,'Aktif müşteri tabanı')}</div></article>
      <article><h4>Operasyon motoru</h4><div class="sp-os-stats">${card('Toplam iş',o.jobs_total,'Tüm işler')}${card('Aktif iş',o.jobs_active,'Devam eden operasyon')}${card('Etkinlik',o.events,'Event DNA')}${card('Ekipman',o.equipment,'Envanter')}</div></article></div>
      <div class="sp-os-grid"><article><h4>Finans motoru</h4><div class="sp-os-finance"><b>Bekleyen</b><strong>${money(f.payments_pending)}</strong><b>Gecikmiş</b><strong>${money(f.payments_overdue)}</strong><span>${esc(f.settlements||0)} settlement kaydı</span></div></article>
      <article><h4>Strateji + AI</h4><div class="sp-os-stats">${card('Hedefler',st.goals,'Yönetim hedefleri')}${card('KPI',st.kpis,'Ölçüm sistemi')}${card('Girişimler',st.initiatives,'Stratejik projeler')}${card('Riskler',st.risks,'Risk kaydı',st.risks?'warn':'ok')}${card('AI görevleri',ai.tasks,'AI operasyonları')}${card('AI çalışmaları',ai.runs,'AI run geçmişi')}</div></article></div>
      <div class="sp-os-footer"><span><b>${esc(au.rules||0)}</b> aktif otomasyon</span><span><b>${esc(au.runs||0)}</b> otomasyon çalışması</span><span>Son veri: ${new Date(d.generated_at||Date.now()).toLocaleString('tr-TR')}</span></div>`;
  }
  function jsonEditor(value){return `<textarea data-os-json style="width:100%;min-height:260px;font:13px ui-monospace,monospace">${esc(JSON.stringify(value||{},null,2))}</textarea>`}
  function modal(title,body){let m=$('#spOsModal');if(m)m.remove();m=document.createElement('div');m.id='spOsModal';m.className='sp-os-modal';m.innerHTML=`<div class="sp-os-modal-box"><div class="sp-os-modal-head"><h3>${esc(title)}</h3><button type="button" data-os-close>×</button></div><div class="sp-os-modal-body">${body}</div></div>`;document.body.appendChild(m);$('[data-os-close]',m).onclick=()=>m.remove();return m}
  async function workbench(root){
    const c=await call('stagepulse_command_catalog');catalog=c?.modules||[];
    root.innerHTML=`<div class="sp-os-head"><div><span>COMMAND WORKBENCH</span><h3>Patron operasyon merkezi</h3><p>Her modül için gerçek kayıt oluşturma, düzenleme, silme, ilişkilendirme, onay ve raporlama işlemleri.</p></div><button class="btn" data-os-refresh-all>Yenile</button></div><div class="sp-os-module-grid">${catalog.map(x=>`<button class="sp-os-module" data-os-module="${esc(x.key)}"><b>${esc(x.label)}</b><span>${esc((x.actions||[]).join(' · '))}</span></button>`).join('')}</div><div id="spOsModuleView"></div>`;
    $$('[data-os-module]',root).forEach(b=>b.onclick=()=>openModule(b.dataset.osModule));
    $('[data-os-refresh-all]',root).onclick=()=>workbench(root).catch(showError);
  }
  async function openModule(entity){
    const view=$('#spOsModuleView');if(!view)return;
    try{const rows=await call('stagepulse_command_list',{p_entity:entity,p_limit:100});const arr=Array.isArray(rows)?rows:[];view.innerHTML=`<div class="sp-os-table-head"><div><h4>${esc(labels[entity]||entity)}</h4><small>${arr.length} kayıt</small></div><div class="sp-os-actions">${entity!=='system'?`<button class="btn" data-new>Yeni</button>`:''}<button class="btn" data-report>Rapor</button></div></div><div class="sp-os-records">${arr.length?arr.map((r,i)=>`<div class="sp-os-record"><code>${esc(r.id||r.code||r.key||i+1)}</code><span>${esc(r.name||r.title||r.description||r.status||r.email||JSON.stringify(r).slice(0,180))}</span><button data-edit="${esc(r.id||'')}">Düzenle</button>${r.id?`<button data-delete="${esc(r.id)}">Sil</button>`:''}</div>`).join(''):'<div class="sp-os-empty">Kayıt yok.</div>'}</div>`;
      $('[data-new]',view)?.addEventListener('click',()=>editRecord(entity,null,{}));
      $$('[data-edit]',view).forEach(b=>b.onclick=()=>{const r=arr.find(x=>String(x.id)===b.dataset.edit);editRecord(entity,r?.id||null,r||{})});
      $$('[data-delete]',view).forEach(b=>b.onclick=()=>deleteRecord(entity,b.dataset.delete));
      $('[data-report]',view).onclick=()=>report(entity);
    }catch(e){showError(e)}
  }
  async function editRecord(entity,id,row){
    const m=modal(`${id?'Düzenle':'Yeni'} · ${labels[entity]||entity}`,`<p>Kaydın alanlarını JSON olarak düzenleyin. Sistem yalnızca izin verilen işlem ve tabloyu çalıştırır.</p>${jsonEditor(row)}<div class="sp-os-form-actions"><button class="btn" data-save>Kaydet</button></div>`);
    $('[data-save]',m).onclick=async()=>{try{const payload=JSON.parse($('[data-os-json]',m).value||'{}');await call('stagepulse_command_action',{p_action:id?'update':'create',p_entity:entity,p_id:id,p_payload:payload});m.remove();await openModule(entity)}catch(e){showError(e)}};
  }
  async function deleteRecord(entity,id){if(!confirm(`${labels[entity]||entity} kaydı silinsin mi? Bu işlem denetlenir.`))return;try{await call('stagepulse_command_action',{p_action:'delete',p_entity:entity,p_id:id,p_payload:{}});await openModule(entity)}catch(e){showError(e)}}
  async function report(entity){try{const r=await call('stagepulse_command_report',{p_entity:entity,p_filters:{}});modal(`Rapor · ${labels[entity]||entity}`,`<pre class="sp-os-report">${esc(JSON.stringify(r,null,2))}</pre>`)}catch(e){showError(e)}}
  function showError(e){window.toast?.(e?.message||String(e)||'İşlem başarısız.',false)||alert(e?.message||String(e)||'İşlem başarısız.')}
  async function boot(){if(!location.hash.slice(1).startsWith('patron-center'))return;try{if(!(await owner()))return;const root=$('#content');if(!root)return;let os=$('#spOwnerOperatingSystem');if(!os){os=document.createElement('section');os.id='spOwnerOperatingSystem';os.className='sp-os';root.appendChild(os)}const d=await foundation();os.innerHTML=dashboard(d);$('[data-os-refresh]',os).onclick=async()=>{try{os.innerHTML=dashboard(await foundation());$('[data-os-refresh]',os).onclick=()=>boot()}catch(e){showError(e)}};let wb=$('#spOwnerWorkbench');if(!wb){wb=document.createElement('section');wb.id='spOwnerWorkbench';wb.className='sp-os';root.appendChild(wb)}await workbench(wb)}catch(e){console.error('[owner-os]',e)}}
  window.addEventListener('hashchange',boot);window.addEventListener('stagepulse-admin-ready',boot);document.addEventListener('DOMContentLoaded',boot);setTimeout(boot,1500);
})();
