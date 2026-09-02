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
      customers:{table:'customers',title:'Müşteri düzenle',fields:[['name','Müşteri'],['company','Firma'],['phone','Telefon'],['email','E-posta']]},
      pricing:{table:'services',title:'Fiyatlandırma düzenle',fields:[['name','Hizmet'],['description','Açıklama'],['active','Aktif']]},
      settlements:{table:'settlements',title:'Gelir · gider düzenle',fields:[['title','İş'],['event_date','Tarih'],['agreed_amount','Anlaşılan'],['expense_amount','Gider'],['status','Durum']]},
      calendar:{table:'jobs',title:'İş / takvim düzenle',fields:[['title','İş'],['location','Konum'],['setup_at','Kurulum'],['event_at','Etkinlik'],['teardown_at','Söküm'],['status','Durum']]},
      finance:{table:'payments',title:'Ödeme düzenle',fields:[['description','Açıklama'],['amount','Tutar'],['due_date','Vade'],['paid_at','Ödeme tarihi'],['status','Durum']]}
    };
    const tableFor = view => specs[view]?.table;
    const orderFor = view => view==='pricing' ? 'name' : (view==='calendar' ? 'event_start_at' : 'created_at');
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const db = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;
    const statusMap = {yeni:'new',new:'new',incelemede:'reviewing',reviewing:'reviewing',hazırlanıyor:'preparing',preparing:'preparing',gönderildi:'sent',sent:'sent',kabul:'accepted',accepted:'accepted',red:'rejected',rejected:'rejected',iptal:'cancelled',cancelled:'cancelled',aktif:'accepted',active:'accepted',pasif:'rejected',inactive:'rejected',ödendi:'accepted',paid:'accepted',bekliyor:'new',pending:'new'};
    const numeric = new Set(['total','agreed_amount','expense_amount','amount']);
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
        wrap.querySelector('[data-save]').onclick=async()=>{const patch={};wrap.querySelectorAll('[data-k]').forEach(i=>{const k=i.dataset.k;if(i.type==='checkbox')patch[k]=i.checked;else if(numeric.has(k))patch[k]=i.value===''?null:Number(i.value);else patch[k]=i.value.trim()||null;});try{const {error}=await client.from(spec.table).update(patch).eq('id',id);if(error)throw error;wrap.remove();window.toast?.('Kaydedildi.',true);setTimeout(()=>location.reload(),120);}catch(e){window.toast?.(e.message||'Kayıt kaydedilemedi.',false);}};
      }catch(e){window.toast?.(e.message||'Kayıt yüklenemedi.',false);}
    }
    async function bind(root){
      if(!root)return;decorateStatuses(root);
      const view=(location.hash||'#dashboard').slice(1).split('?')[0], tableName=tableFor(view), client=db();
      if(!tableName||!client)return;
      const tables=[...root.querySelectorAll('.admin-table')].filter(t=>!t.dataset.spRuntimeActions);
      if(!tables.length)return;
      let records=[];try{let q=client.from(tableName).select('id');const ord=orderFor(view);if(ord)q=q.order(ord,{ascending:view==='pricing'||view==='calendar'});const r=await q.limit(250);records=r.data||[];}catch(e){console.warn('[stagepulse-admin-actions]',e);return;}
      tables.forEach(t=>{t.dataset.spRuntimeActions='1';const head=t.tHead?.rows[0];if(head&&!head.querySelector('.sp-runtime-actions')){const th=document.createElement('th');th.className='sp-runtime-actions';th.textContent='İşlem';head.appendChild(th);}t.querySelectorAll('tbody tr').forEach((tr,i)=>{if(tr.querySelector('.sp-runtime-edit'))return;const id=tr.dataset.spRowId||records[i]?.id;if(!id)return;tr.dataset.spRowId=id;const td=document.createElement('td');td.className='sp-runtime-actions';td.innerHTML='<button type="button" class="sp-runtime-edit">Düzenle</button>';td.querySelector('button').onclick=()=>{if(view==='offers'){(window.openOfferEditable||window.openOffer)?.(id);return;}openEditor(view,id);};tr.appendChild(td);});});
    }
    const run=()=>{const c=document.getElementById('content');if(c)bind(c)};
    const observer=new MutationObserver(()=>setTimeout(run,30));
    const start=()=>{const c=document.getElementById('content');if(c){observer.observe(c,{childList:true,subtree:true});run();}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
    window.addEventListener('hashchange',()=>setTimeout(()=>{const c=document.getElementById('content');if(c)c.querySelectorAll('.admin-table').forEach(t=>delete t.dataset.spRuntimeActions);run();},50));
  }

  async function boot() {
    try {
      await loadScript('admin-bundle.js?v=20260902-webfix6');
      if (typeof window.loadView !== 'function') throw new Error('Canonical admin bundle did not expose loadView');
      await loadScript('notifications-tools.js?v=20260902-notify1');
      installUxRecovery();
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
