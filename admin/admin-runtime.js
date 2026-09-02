/* Stagepulse Admin — single canonical entrypoint. */
/* 2026-09-02 repository audit: boot, cache, notification parity, action controls and visual recovery. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_BOOTSTRAPPED) return;
  window.STAGEPULSE_ADMIN_BOOTSTRAPPED = true;

  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', (event) => event.preventDefault());

  function fail(error) {
    console.error('[stagepulse-admin-boot]', error);
    const content = document.getElementById('content');
    if (!content) return;
    document.getElementById('loginView')?.classList.add('is-hidden');
    const app = document.getElementById('appView');
    if (app) { app.hidden = false; app.classList.remove('is-hidden'); }
    const offline = navigator.onLine === false;
    content.innerHTML = `<div class="panel" role="alert" aria-live="assertive"><h2>Yönetim paneli yüklenemedi</h2><p>${offline ? 'İnternet bağlantısı yok.' : 'Yönetim çekirdeği başlatılamadı.'}</p><button id="adminBootRetry" class="btn btn-primary btn-block" type="button">Yeniden dene</button></div>`;
    document.getElementById('adminBootRetry')?.addEventListener('click', () => location.reload());
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = false;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error(`Admin module failed: ${src}`));
      document.body.appendChild(tag);
    });
  }

  function installUxRecovery() {
    if (window.__STAGEPULSE_ADMIN_UX_RECOVERY) return;
    window.__STAGEPULSE_ADMIN_UX_RECOVERY = true;
    const style = document.createElement('style');
    style.id = 'stagepulse-admin-ux-recovery';
    style.textContent = `
      .admin-body .sp-runtime-actions{width:120px;text-align:right!important;white-space:nowrap}
      .admin-body .sp-runtime-edit{display:inline-flex!important;align-items:center;justify-content:center;min-width:92px!important;padding:9px 12px!important;border-radius:10px!important;background:#ffb000!important;color:#111!important;border:1px solid #ffb000!important;font-weight:800!important;cursor:pointer!important}
      .admin-body .sp-runtime-edit:hover{background:#ffc12a!important;transform:translateY(-1px)}
      .admin-body .sp-runtime-status{display:inline-flex!important;align-items:center;justify-content:center;padding:4px 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:700!important;border:1px solid #4a4a4a!important;background:#171717!important;color:#ddd!important}
      .admin-body .sp-runtime-status.new{color:#ffd166!important;border-color:#6b5000!important;background:rgba(255,176,0,.10)!important}
      .admin-body .sp-runtime-status.reviewing{color:#c7a7ff!important;border-color:#4d3a9a!important;background:rgba(109,93,252,.10)!important}
      .admin-body .sp-runtime-status.sent,.admin-body .sp-runtime-status.preparing{color:#75aaff!important;border-color:#34578f!important;background:rgba(93,140,255,.10)!important}
      .admin-body .sp-runtime-status.accepted{color:#6ee7a0!important;border-color:#245439!important;background:rgba(0,214,143,.10)!important}
      .admin-body .sp-runtime-status.rejected,.admin-body .sp-runtime-status.cancelled{color:#ff7777!important;border-color:#633030!important;background:rgba(255,92,122,.10)!important}
      .sp-runtime-editor-backdrop{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(0,0,0,.78);backdrop-filter:blur(5px)}
      .sp-runtime-editor{width:min(680px,100%);max-height:92svh;overflow:auto;box-sizing:border-box;background:#111214;color:#f4f4f4;border:1px solid #34373e;border-radius:16px;padding:20px;box-shadow:0 25px 80px rgba(0,0,0,.55)}
      .sp-runtime-editor h2{margin:0 0 4px;font-size:20px}.sp-runtime-editor .sub{margin:0 0 16px;color:#a8a8a8;font-size:13px}.sp-runtime-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sp-runtime-editor label{display:grid;gap:5px;min-width:0;color:#a8a8a8;font-size:12px;font-weight:700}.sp-runtime-editor input{width:100%;box-sizing:border-box;padding:10px 11px;border-radius:9px;border:1px solid #34383f;background:#0c0d10;color:#f4f4f4}.sp-runtime-editor-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid #292c32}
      @media(max-width:700px){.sp-runtime-editor-grid{grid-template-columns:1fr}.sp-runtime-editor{padding:15px}.admin-body .sp-runtime-actions{width:auto}.admin-body .sp-runtime-edit{width:100%!important}}
    `;
    document.head.appendChild(style);

    const specs = {
      customers:{table:'customers',title:'Müşteri düzenle',fields:[['name','Müşteri'],['company','Firma'],['phone','Telefon'],['email','E-posta'],['notes','Notlar'],['active','Aktif']]},
      pricing:{table:'services',title:'Fiyatlandırma düzenle',fields:[['name','Hizmet'],['description','Açıklama'],['base_cost','Temel maliyet'],['base_price','Temel fiyat'],['crew_min','Min. ekip'],['crew_max','Maks. ekip'],['default_crew','Varsayılan ekip'],['crew_unit_price','Ekip birim fiyatı'],['setup_fee','Kurulum ücreti'],['teardown_fee','Söküm ücreti'],['margin_pct','Marj %'],['active','Aktif']]},
      settlements:{table:'settlements',title:'Gelir · gider düzenle',fields:[['title','İş'],['event_date','Tarih'],['location','Konum'],['agreed_amount','Anlaşılan'],['expense_amount','Gider'],['owner_pct','Patron %'],['status','Durum'],['notes','Notlar']]},
      calendar:{table:'jobs',title:'İş / takvim düzenle',fields:[['title','İş'],['location','Konum'],['setup_at','Kurulum'],['event_at','Etkinlik'],['teardown_at','Söküm'],['status','Durum'],['notes','Notlar']]},
      finance:{table:'payments',title:'Ödeme düzenle',fields:[['description','Açıklama'],['amount','Tutar'],['due_date','Vade'],['paid_at','Ödeme tarihi'],['status','Durum']]}
    };
    const tableFor = view => specs[view]?.table;
    const orderFor = view => view==='pricing' ? 'name' : (view==='calendar' ? 'event_start_at' : 'created_at');
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const db = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;
    const statusMap = {yeni:'new',new:'new',incelemede:'reviewing',reviewing:'reviewing',hazırlanıyor:'preparing',preparing:'preparing',gönderildi:'sent',sent:'sent',kabul:'accepted',accepted:'accepted',red:'rejected',rejected:'rejected',iptal:'cancelled',cancelled:'cancelled',aktif:'accepted',active:'accepted',pasif:'rejected',inactive:'rejected',ödendi:'accepted',paid:'accepted',bekliyor:'new',pending:'new'};
    const numeric = new Set(['total','agreed_amount','expense_amount','amount','base_cost','base_price','crew_min','crew_max','default_crew','crew_unit_price','setup_fee','teardown_fee','margin_pct','owner_pct']);
    function decorateStatuses(root){
      root.querySelectorAll('.status').forEach(el=>{const raw=(el.textContent||'').trim().toLowerCase();el.className='status sp-runtime-status '+(statusMap[raw]||'');});
      root.querySelectorAll('.admin-table tbody tr').forEach(tr=>{const table=tr.closest('table');const heads=[...table.querySelectorAll('thead th')];[...tr.cells].forEach((td,i)=>{if((heads[i]?.textContent||'').trim().toLowerCase()==='durum'&&!td.querySelector('.sp-runtime-status')){const raw=(td.textContent||'').trim();if(raw&&raw!=='—'){td.textContent='';const el=document.createElement('span');el.className='sp-runtime-status '+(statusMap[raw.toLowerCase()]||'');el.textContent=raw;td.appendChild(el);}}});});
    }
    async function openEditor(view,id){
      const spec=specs[view], client=db(); if(!spec||!client||!id)return;
      const old=document.getElementById('spRuntimeEditor');old?.remove();
      try{const {data,error}=await client.from(spec.table).select('*').eq('id',id).maybeSingle();if(error)throw error;if(!data)throw new Error('Kayıt bulunamadı.');
        const wrap=document.createElement('div');wrap.id='spRuntimeEditor';wrap.className='sp-runtime-editor-backdrop';
        wrap.innerHTML=`<div class="sp-runtime-editor" role="dialog" aria-modal="true"><h2>${esc(spec.title)}</h2><p class="sub">Değişiklikleri kaydet</p><div class="sp-runtime-editor-grid">${spec.fields.map(([k,l])=>`<label>${esc(l)}<input data-k="${k}" type="${k==='active'?'checkbox':numeric.has(k)?'number':'text'}" ${k==='active'?(data[k]===true?'checked':''):`value="${esc(data[k]??'')}"`}></label>`).join('')}</div><div class="sp-runtime-editor-actions"><button type="button" class="btn" data-cancel>Vazgeç</button><button type="button" class="btn btn-primary" data-save>Kaydet</button></div></div>`;
        document.body.appendChild(wrap);wrap.querySelector('[data-cancel]').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
        wrap.querySelector('[data-save]').onclick=async()=>{const patch={};wrap.querySelectorAll('[data-k]').forEach(i=>{const k=i.dataset.k;if(i.type==='checkbox')patch[k]=i.checked;else if(numeric.has(k))patch[k]=i.value===''?null:Number(i.value);else patch[k]=i.value.trim()||null;});patch.updated_at=new Date().toISOString();try{const {error}=await client.from(spec.table).update(patch).eq('id',id);if(error)throw error;wrap.remove();window.toast?.('Kaydedildi.',true);setTimeout(()=>location.reload(),120);}catch(e){window.toast?.(e.message||'Kayıt kaydedilemedi.',false);}};
      }catch(e){window.toast?.(e.message||'Kayıt yüklenemedi.',false);}
    }
    async function bind(root){
      if(!root)return;decorateStatuses(root);
      const view=(location.hash||'#dashboard').slice(1).split('?')[0], tableName=tableFor(view), client=db();
      if(!tableName||!client)return;
      const tables=[...root.querySelectorAll('.admin-table')].filter(t=>!t.dataset.spRuntimeActions);
      if(!tables.length)return;
      let records=[];try{let q=client.from(tableName).select('id');const ord=orderFor(view);if(ord)q=q.order(ord,{ascending:view==='pricing'||view==='calendar'});const r=await q.limit(250);records=r.data||[];}catch(e){console.warn('[stagepulse-admin-actions]',e);return;}
      tables.forEach(t=>{t.dataset.spRuntimeActions='1';const head=t.tHead?.rows[0];if(head&&!head.querySelector('.sp-runtime-actions')){const th=document.createElement('th');th.className='sp-runtime-actions';th.textContent='İşlem';head.appendChild(th);}t.querySelectorAll('tbody tr').forEach((tr,i)=>{if(tr.querySelector('.sp-runtime-edit'))return;const id=tr.dataset.spRowId||tr.querySelector('[data-id]')?.dataset.id||records[i]?.id;if(!id)return;tr.dataset.spRowId=id;const td=document.createElement('td');td.className='sp-runtime-actions';td.innerHTML='<button type="button" class="sp-runtime-edit">Düzenle</button>';td.querySelector('button').onclick=()=>{if(view==='offers'){(window.openOfferEditable||window.openOffer)?.(id);return;}openEditor(view,id);};tr.appendChild(td);});});
    }
    const run=()=>{const c=document.getElementById('content');if(c)bind(c)};
    const observer=new MutationObserver(()=>setTimeout(run,30));
    const start=()=>{const c=document.getElementById('content');if(c){observer.observe(c,{childList:true,subtree:true});run();}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
    window.addEventListener('hashchange',()=>setTimeout(()=>{const c=document.getElementById('content');if(c)c.querySelectorAll('.admin-table').forEach(t=>delete t.dataset.spRuntimeActions);run();},50));
  }

  function installVisualParity() {
    if (window.__STAGEPULSE_ADMIN_VISUAL_PARITY) return;
    window.__STAGEPULSE_ADMIN_VISUAL_PARITY = true;
    const style = document.createElement('style');
    style.id = 'stagepulse-admin-visual-parity';
    style.textContent = `
      .admin-body .btn{border:1px solid #3b3e45!important;background:#17191e!important;color:#f4f4f4!important;font-weight:800!important;cursor:pointer!important;transition:.15s ease}
      .admin-body .btn:hover{transform:translateY(-1px);border-color:#ffb000!important;box-shadow:0 6px 18px rgba(255,176,0,.12)}
      .admin-body .btn.btn-primary,.admin-body .sp-runtime-edit{background:#ffb000!important;border-color:#ffb000!important;color:#111!important}
      .admin-body .btn.btn-primary:hover,.admin-body .sp-runtime-edit:hover{background:#ffc12a!important;border-color:#ffc12a!important}
      .admin-body .sp-cc-tabs button{border:1px solid rgba(255,255,255,.08)!important;background:rgba(255,255,255,.025)!important;color:#cfd3db!important;opacity:1!important}
      .admin-body .sp-cc-tabs button:hover{border-color:rgba(255,176,0,.45)!important;color:#fff!important}
      .admin-body .sp-cc-tabs button.active{background:#ffb000!important;border-color:#ffb000!important;color:#111!important;font-weight:900!important}
      .admin-body .sp-cc-card{position:relative;overflow:hidden;background:#12151b!important;border-color:#2b3039!important}
      .admin-body .sp-cc-card:nth-child(4n+1){border-top:2px solid #ffb000!important}
      .admin-body .sp-cc-card:nth-child(4n+2){border-top:2px solid #6d5dfc!important}
      .admin-body .sp-cc-card:nth-child(4n+3){border-top:2px solid #5d8cff!important}
      .admin-body .sp-cc-card:nth-child(4n){border-top:2px solid #00d68f!important}
      .admin-body .sp-cc-card strong{color:#fff!important}
      .admin-body .sp-cc-card button{background:#ffb000!important;color:#111!important;border:1px solid #ffb000!important;font-weight:900!important}
      .admin-body .sp-cc-card button:hover{background:#ffc12a!important}
      .admin-body .sp-cc-section{background:#11151b!important;border-color:#2b3039!important}
      .admin-body .sp-cc-section h3{color:#f4f4f4!important}
      .admin-body .sp-cc-tag{border:1px solid #343a45!important;background:#191d24!important;color:#dfe3ea!important}
      .admin-body .sp-cc-health>div{background:#12151b!important;border-color:#2b3039!important}
      .admin-body .sp-cc-health>div:nth-child(1) b{color:#ffb000!important}.admin-body .sp-cc-health>div:nth-child(2) b{color:#6d5dfc!important}.admin-body .sp-cc-health>div:nth-child(3) b{color:#5d8cff!important}.admin-body .sp-cc-health>div:nth-child(4) b{color:#00d68f!important}
      .admin-body .sp-cc-flow span{background:#15181e!important;border-color:#2b3039!important}
      .admin-body .sp-cc-mini{background:#12151b!important;border-color:#2b3039!important}
      .admin-body .sp-cc-mini strong{color:#ffb000!important}
      .admin-body .sp-ai-card{background:#12151b!important;border-color:#2b3039!important}
      .admin-body .sp-ai-approval-actions .ok{background:#00d68f!important;color:#07130e!important;border-color:#00d68f!important;font-weight:900!important}
      .admin-body .sp-ai-approval-actions .no{background:#ff5c7a!important;color:#21070c!important;border-color:#ff5c7a!important;font-weight:900!important}
      .admin-body .sp-ai-status{display:inline-flex!important;padding:5px 9px!important;border-radius:999px!important;background:rgba(255,176,0,.12)!important;border:1px solid rgba(255,176,0,.35)!important;color:#ffd166!important;font-size:10px!important;font-weight:900!important}
      .admin-body .admin-table tbody tr,.admin-body .data-table tbody tr{transition:.15s ease}
      .admin-body .admin-table tbody tr:hover,.admin-body .data-table tbody tr:hover{transform:translateY(-1px)}
      .admin-body .sp-runtime-actions{vertical-align:middle!important}
      .admin-body .sp-runtime-edit{box-shadow:0 5px 15px rgba(255,176,0,.12)!important}
      /* Canonical visual coverage: every existing admin/personnel component gets a styled state. */
      .admin-body .admin-card,.admin-body .card,.admin-body .panel{background:#11151b!important;border:1px solid #2b3039!important;color:#f4f4f4!important;box-shadow:0 10px 30px rgba(0,0,0,.18)}
      .admin-body .admin-card h2,.admin-body .admin-card h3,.admin-body .card h2,.admin-body .card h3,.admin-body .panel h2,.admin-body .panel h3{color:#fff!important}
      .admin-body .cards{gap:14px!important}
      .admin-body .card.kpi-accent{position:relative;overflow:hidden}
      .admin-body .card.kpi-accent:nth-child(4n+1){border-top:3px solid #ffb000!important}.admin-body .card.kpi-accent:nth-child(4n+2){border-top:3px solid #6d5dfc!important}.admin-body .card.kpi-accent:nth-child(4n+3){border-top:3px solid #5d8cff!important}.admin-body .card.kpi-accent:nth-child(4n){border-top:3px solid #00d68f!important}
      .admin-body .card-label{color:#aeb5c0!important}.admin-body .card-value{color:#fff!important}
      .admin-body .admin-table,.admin-body .data-table{width:100%!important;border-collapse:separate!important;border-spacing:0!important;background:#11151b!important;color:#e8ebf0!important;border:1px solid #2b3039!important;border-radius:12px!important;overflow:hidden!important}
      .admin-body .admin-table th,.admin-body .data-table th{background:#181c23!important;color:#aeb5c0!important;border-bottom:1px solid #343a45!important;padding:12px 13px!important;text-align:left!important;font-weight:900!important;white-space:nowrap}
      .admin-body .admin-table td,.admin-body .data-table td{background:#11151b!important;color:#e8ebf0!important;border-bottom:1px solid #252a32!important;padding:11px 13px!important;vertical-align:middle!important}
      .admin-body .admin-table tbody tr:nth-child(even) td,.admin-body .data-table tbody tr:nth-child(even) td{background:#13171e!important}
      .admin-body .admin-table tbody tr:hover td,.admin-body .data-table tbody tr:hover td{background:#191e26!important}
      .admin-body .admin-table a,.admin-body .data-table a{color:#ffd166!important}.admin-body .admin-table a:hover,.admin-body .data-table a:hover{color:#fff!important}
      .admin-body .staff-card,.admin-body .org-member-row,.admin-body .rbac-member-list,.admin-body .org-members{background:#11151b!important;border:1px solid #2b3039!important;color:#e8ebf0!important;border-radius:14px!important}
      .admin-body .staff-card{padding:15px!important;box-shadow:0 8px 24px rgba(0,0,0,.18);border-top:3px solid #6d5dfc!important}
      .admin-body .staff-card:nth-child(3n+1){border-top-color:#ffb000!important}.admin-body .staff-card:nth-child(3n+2){border-top-color:#5d8cff!important}.admin-body .staff-card:nth-child(3n){border-top-color:#00d68f!important}
      .admin-body .staff-card-top,.admin-body .staff-card-meta,.admin-body .org-member-row>*{color:#dfe3ea!important}
      .admin-body .staff-card-meta{color:#9da5b2!important}
      .admin-body .rbac-center,.admin-body .rbac-row{background:#11151b!important;border-color:#2b3039!important;color:#e8ebf0!important}
      .admin-body .rbac-row{border-radius:10px!important;margin:6px 0!important}.admin-body .rbac-row:hover,.admin-body .org-member-row:hover{border-color:#ffb000!important;background:#171b22!important}
      .admin-body .rbac-member-list{padding:10px!important}.admin-body .rbac-member-list button,.admin-body .staff-card button,.admin-body .org-member-row button{border:1px solid #3b3e45!important;background:#191d24!important;color:#f4f4f4!important;border-radius:9px!important;font-weight:800!important;cursor:pointer!important}.admin-body .rbac-member-list button:hover,.admin-body .staff-card button:hover,.admin-body .org-member-row button:hover{background:#ffb000!important;border-color:#ffb000!important;color:#111!important}
      .admin-body .sp-media-card,.admin-body .sp-inv-card{background:#11151b!important;border:1px solid #2b3039!important;color:#e8ebf0!important;border-radius:14px!important;box-shadow:0 8px 24px rgba(0,0,0,.18);overflow:hidden}
      .admin-body .sp-media-card:hover,.admin-body .sp-inv-card:hover{border-color:#ffb000!important;transform:translateY(-1px)}
      .admin-body .sp-media-card button,.admin-body .sp-inv-card button{border:1px solid #3b3e45!important;background:#191d24!important;color:#f4f4f4!important;border-radius:9px!important;font-weight:800!important}.admin-body .sp-media-card button:hover,.admin-body .sp-inv-card button:hover{background:#ffb000!important;color:#111!important;border-color:#ffb000!important}
      .admin-body .sp-inv-status,.admin-body .sp-inv-status-grid>*,.admin-body .sp-gh-status{border:1px solid #2b3039!important;background:#171b22!important;color:#dfe3ea!important;border-radius:10px!important}
      .admin-body .sp-inv-status-grid>div:nth-child(1) b{color:#ffb000!important}.admin-body .sp-inv-status-grid>div:nth-child(2) b{color:#5d8cff!important}.admin-body .sp-inv-status-grid>div:nth-child(3) b{color:#00d68f!important}.admin-body .sp-inv-status-grid>div:nth-child(4) b{color:#6d5dfc!important}
      .admin-body .org-table-scroll{background:#0f1217!important;border:1px solid #2b3039!important;border-radius:12px!important;overflow:auto}
      .admin-body .sp-staff-modal,.admin-body .modal-card{background:#11151b!important;color:#f4f4f4!important;border:1px solid #343a45!important;border-radius:16px!important;box-shadow:0 25px 80px rgba(0,0,0,.55)}
      .admin-body input,.admin-body select,.admin-body textarea{background:#0c0f14!important;color:#f4f4f4!important;border:1px solid #343a45!important;border-radius:9px!important}.admin-body input:focus,.admin-body select:focus,.admin-body textarea:focus{border-color:#ffb000!important;outline:none!important;box-shadow:0 0 0 2px rgba(255,176,0,.12)!important}
      .admin-body .status.new,.admin-body .status.pending{background:rgba(255,176,0,.12)!important;border-color:#6b5000!important;color:#ffd166!important}.admin-body .status.reviewing{background:rgba(109,93,252,.12)!important;border-color:#4d3a9a!important;color:#c7a7ff!important}.admin-body .status.sent,.admin-body .status.preparing{background:rgba(93,140,255,.12)!important;border-color:#34578f!important;color:#75aaff!important}.admin-body .status.accepted,.admin-body .status.paid,.admin-body .status.active{background:rgba(0,214,143,.12)!important;border-color:#245439!important;color:#6ee7a0!important}.admin-body .status.rejected,.admin-body .status.cancelled,.admin-body .status.inactive{background:rgba(255,92,122,.12)!important;border-color:#633030!important;color:#ff7777!important}
      .admin-body .tabs,.admin-body .tab-list{border-bottom:1px solid #2b3039!important}.admin-body .tabs button,.admin-body .tab-list button{background:#171b22!important;color:#aeb5c0!important;border:1px solid #2b3039!important;border-radius:9px!important;font-weight:800!important}.admin-body .tabs button.active,.admin-body .tab-list button.active{background:#ffb000!important;color:#111!important;border-color:#ffb000!important}
      .admin-body .sp-cc-grid,.admin-body .sp-ai-grid{gap:14px!important}.admin-body .sp-ai-card-top{color:#fff!important}.admin-body .sp-ai-payload{background:#0c0f14!important;border:1px solid #2b3039!important;color:#dfe3ea!important;border-radius:10px!important}.admin-body .sp-ai-perms{color:#bfc5cf!important}
      @media(max-width:700px){.admin-body .admin-table,.admin-body .data-table{display:block;overflow-x:auto!important}.admin-body .admin-table th,.admin-body .admin-table td,.admin-body .data-table th,.admin-body .data-table td{min-width:110px}.admin-body .staff-card,.admin-body .sp-media-card,.admin-body .sp-inv-card{width:100%!important;box-sizing:border-box}.admin-body .sp-runtime-edit{min-width:100px!important}}
    `;
    document.head.appendChild(style);

    const navTargets = {
      customers: 'Müşteriler', offers: 'Teklifler', calendar: 'İşler / Takvim', personnel: 'Personel',
      equipment: 'Ekipman', finance: 'Finans', 'command-center': 'Komuta Merkezi'
    };
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-sp-nav]');
      if (!b) return;
      const view = b.dataset.spNav;
      if (view === 'ai') {
        window.openStagepulseCommandCenter?.('ai');
        return;
      }
      if (view && navTargets[view]) {
        e.preventDefault();
        if (typeof window.loadView === 'function') window.loadView(view);
      }
    }, true);

    function bindExtraTables(root) {
      if (!root) return;
      decorateStatuses(root);
      const view = (location.hash || '#dashboard').slice(1).split('?')[0];
      const spec = specs[view];
      const client = db();
      if (!spec || !client) return;
      const tables = [...root.querySelectorAll('.admin-table,.data-table')].filter(t => !t.dataset.spRuntimeParity);
      if (!tables.length) return;
      tables.forEach(t => {
        t.dataset.spRuntimeParity = '1';
        const head = t.tHead?.rows[0];
        if (head && !head.querySelector('.sp-runtime-actions')) {
          const th = document.createElement('th');
          th.className = 'sp-runtime-actions';
          th.textContent = 'İşlem';
          head.appendChild(th);
        }
      });
      Promise.resolve().then(async () => {
        let records = [];
        try {
          let q = client.from(spec.table).select('id');
          const ord = orderFor(view);
          if (ord) q = q.order(ord, {ascending:view === 'pricing' || view === 'calendar'});
          const r = await q.limit(250);
          if (r.error) throw r.error;
          records = r.data || [];
        } catch (e) {
          console.warn('[stagepulse-admin-parity]', e);
          return;
        }
        tables.forEach(t => t.querySelectorAll('tbody tr').forEach((tr,i) => {
          if (tr.querySelector('.sp-runtime-edit')) return;
          const id = tr.dataset.spRowId || tr.querySelector('[data-id]')?.dataset.id || records[i]?.id;
          if (!id) return;
          tr.dataset.spRowId = id;
          const td = document.createElement('td');
          td.className = 'sp-runtime-actions';
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'sp-runtime-edit';
          b.textContent = 'Düzenle';
          b.addEventListener('click', () => openEditor(view,id));
          td.appendChild(b);
          tr.appendChild(td);
        }));
      });
    }
    const root = document.getElementById('content');
    if (root) {
      const observer = new MutationObserver(() => setTimeout(() => bindExtraTables(root), 20));
      observer.observe(root, {childList:true, subtree:true});
      bindExtraTables(root);
    }
  }

  async function boot() {
    try {
      await loadScript('admin-bundle.js?v=20260902-webfix6');
      if (typeof window.loadView !== 'function') throw new Error('Canonical admin bundle did not expose loadView');
      await loadScript('notifications-tools.js?v=20260902-notify1');
      installUxRecovery();
      installVisualParity();
      window.STAGEPULSE_ADMIN_READY = true;
      window.dispatchEvent(new CustomEvent('stagepulse:admin-ready'));
      window.dispatchEvent(new CustomEvent('stagepulse-admin-ready'));
    } catch (error) {
      fail(error);
    }
  }

  window.addEventListener('online', () => {
    if (!window.STAGEPULSE_ADMIN_READY) boot();
  }, { once: true });
  boot();
})();
