/* Stagepulse Admin — consolidated canonical bundle. */
/* ===== BEGIN admin/admin-module-renderers-v2.js ===== */
/* Stagepulse Admin — canonical fallback renderers. */
(() => {
  'use strict';
  const client = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = (v) => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const date = (v) => v ? new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}) : '—';
  const content = () => document.getElementById('content');
  const table = async (name, select='*', order='created_at', ascending=false) => { const db=client(); if(!db) throw new Error('Supabase bağlantısı hazır değil.'); let q=db.from(name).select(select); if(order) q=q.order(order,{ascending}); const {data,error}=await q.limit(250); if(error) throw error; return data||[]; };
  const fail = (title,error) => { const el=content(); if(el) el.innerHTML=`<div class="notice"><b>${esc(title)}</b><p>${esc(error?.message||error||'Bilinmeyen hata')}</p></div>`; };
  const shell = (title,sub,actions='') => { const el=content(); if(!el) return null; el.innerHTML=`<div class="page-head"><div><h1>${esc(title)}</h1><p class="muted">${esc(sub)}</p></div><div class="actions">${actions}</div></div><div id="moduleBody"></div>`; return el; };
  const rows = (items, cols, empty='Kayıt bulunamadı') => items.length ? `<div class="panel" style="overflow:auto"><table class="admin-table"><thead><tr>${cols.map((x)=>`<th>${esc(x[0])}</th>`).join('')}</tr></thead><tbody>${items.map((r)=>`<tr>${cols.map((x)=>`<td>${x[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="panel"><p class="muted empty">${esc(empty)}</p></div>`;
  const setView = (name, fn) => { if(typeof window[name+'View'] !== 'function') window[name+'View']=fn; };

  async function customersView(){ try { const el=shell('Müşteriler','Müşteri geçmişi','<button class="btn btn-primary" data-new-customer>+ Yeni müşteri</button>'); const data=await table('customers'); if(!el) return; const body=el.querySelector('#moduleBody'); if(!body) return; body.innerHTML=rows(data,[['Müşteri',r=>`<strong>${esc(r.name||'—')}</strong><br><span class="muted">${esc(r.company||'')}</span>`],['Telefon',r=>esc(r.phone||'—')],['E-posta',r=>esc(r.email||'—')],['Son temas',r=>date(r.last_contact_at)]],'Henüz müşteri yok'); el.querySelector('[data-new-customer]')?.addEventListener('click',()=>window.newCustomer?.()||window.toast?.('Müşteri formu yüklenemedi.',false)); } catch(e){ fail('Müşteriler yüklenemedi',e); } }
  async function offersView(){ try { const el=shell('Teklifler','Lead → teklif → onay','<button class="btn btn-primary" data-new-offer>+ Yeni Teklif</button>'); if(!el) return; const data=await table('teklifler'); const body=el.querySelector('#moduleBody'); if(!body) throw new Error('Teklifler ekranı hazırlanamadı.'); body.innerHTML=`<div class="toolbar"><input id="offerSearch" class="input" placeholder="Ara…"><select id="offerStatus" class="input"><option value="">Tüm durumlar</option><option>new</option><option>reviewing</option><option>preparing</option><option>sent</option><option>accepted</option><option>rejected</option></select></div><div id="offerRows"></div>`; const search=body.querySelector('#offerSearch'); const status=body.querySelector('#offerStatus'); const offerRows=body.querySelector('#offerRows'); const render=()=>{const q=(search?.value||'').toLowerCase(); const s=status?.value||''; const list=data.filter((x)=>(!s||x.status===s)&&(!q||`${x.quote_number||''} ${x.name||''} ${x.location||''}`.toLowerCase().includes(q))); if(offerRows) offerRows.innerHTML=rows(list,[['Teklif',r=>`<strong>${esc(r.quote_number||'—')}</strong><br><span class="muted">${esc(r.name||'')} · ${esc(r.location||'')}</span>`],['Tarih',r=>esc(r.event_date||'—')],['Durum',r=>`<span class="status ${esc(r.status||'')}">${esc(r.status||'—')}</span>`],['Tutar',r=>money(r.total)],['İşlem',r=>`<button class="btn btn-primary" data-open-offer="${esc(r.id)}">Düzenle</button>`]]); offerRows?.querySelectorAll('[data-open-offer]').forEach((b)=>b.addEventListener('click',()=>{const fn=window.openOfferEditable||window.openOffer; if(typeof fn==='function') fn(b.dataset.openOffer); else window.toast?.('Teklif düzenleme ekranı yüklenemedi.',false);})); }; search?.addEventListener('input',render); status?.addEventListener('change',render); el.querySelector('[data-new-offer]')?.addEventListener('click',()=>window.newOffer?.()); render(); } catch(e){ fail('Teklifler yüklenemedi',e); } }
  async function analyticsView(){ try { const el=shell('Analitik','Dönüşüm ve satış özeti'); const o=await table('teklifler'); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=`<div class="cards"><div class="card"><span class="card-label">Teklif</span><div class="metric">${o.length}</div></div><div class="card"><span class="card-label">Kabul</span><div class="metric">${o.filter((x)=>x.status==='accepted').length}</div></div><div class="card"><span class="card-label">Dönüşüm</span><div class="metric">${(()=>{const s=o.filter((x)=>['sent','accepted','rejected'].includes(x.status)).length;return s?Math.round(o.filter((x)=>x.status==='accepted').length/s*100):0})()}%</div></div></div>`; } catch(e){ fail('Analitik yüklenemedi',e); } }
  async function pricingView(){ try { const el=shell('Fiyatlandırma','Hizmet ve kurallar'); const data=await table('services','id,name,description,active','name',true); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['Hizmet',r=>esc(r.name||'—')],['Açıklama',r=>esc(r.description||'—')],['Durum',r=>r.active===false?'Pasif':'Aktif']],'Hizmet kaydı bulunamadı'); } catch(e){ fail('Fiyatlandırma yüklenemedi',e); } }
  async function settlementsView(){ try { const el=shell('Gelir · Gider','Anlaşılan → gider → paylaşım'); const data=await table('settlements'); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['İş',r=>esc(r.title||'—')],['Tarih',r=>date(r.event_date)],['Anlaşılan',r=>money(r.agreed_amount)],['Gider',r=>money(r.expense_amount)],['Durum',r=>esc(r.status||'—')]]); } catch(e){ fail('Gelir · Gider yüklenemedi',e); } }
  async function calendarView(){ try { const el=shell('İşler · Takvim','Kurulum ve etkinlik'); const data=await table('jobs','*','event_start_at',true); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['İş',r=>`<strong>${esc(r.title||'—')}</strong><br><span class="muted">${esc(r.location||'')}</span>`],['Kurulum',r=>date(r.setup_start_at||r.setup_at)],['Etkinlik',r=>date(r.event_start_at||r.event_at)],['Söküm',r=>date(r.teardown_end_at||r.teardown_at)],['Durum',r=>esc(r.status||'—')]],'Takvimde iş yok'); } catch(e){ fail('Takvim yüklenemedi',e); } }
  async function equipmentView(){ try { if(typeof window.StagepulseEquipmentView?.render==='function'){await window.StagepulseEquipmentView.render();return;} const el=shell('Ekipman','Envanter'); const data=await table('equipment'); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['Ekipman',r=>`<strong>${esc([r.brand,r.model].filter(Boolean).join(' ')||'—')}</strong><br><span class="muted">${esc(r.category||'')}</span>`],['Adet',r=>String(r.quantity??0)],['Kullanılabilir',r=>String(r.available_quantity??r.quantity??0)],['Durum',r=>esc(r.status||'—')],['Günlük fiyat',r=>money(r.daily_price)]]); } catch(e){ fail('Ekipman yüklenemedi',e); } }
  async function personnelView(){ try { const el=shell('Personel','Organizasyon üyeleri'); const data=await table('org_memberships','user_id,role_id,position_id,department_id,region_id,manager_user_id,active,created_at','created_at',true); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['Kullanıcı',r=>esc(r.user_id)],['Rol',r=>esc(r.role_id)],['Pozisyon',r=>esc(r.position_id)],['Departman',r=>esc(r.department_id||'—')],['Bölge',r=>esc(r.region_id||'—')],['Durum',r=>r.active===false?'Pasif':'Aktif']],'Personel kaydı yok'); } catch(e){ fail('Personel yüklenemedi',e); } }
  async function financeView(){ try { const el=shell('Ödemeler','Tahsilat kayıtları'); const data=await table('payments'); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['İş',r=>esc(r.offer_id||r.job_id||'—')],['Tutar',r=>money(r.amount||r.total_amount||r.paid_amount)],['Durum',r=>esc(r.status||'—')],['Tarih',r=>date(r.created_at)]],'Ödeme kaydı yok'); } catch(e){ fail('Ödemeler yüklenemedi',e); } }
  async function notificationsView(){ try { const el=shell('Bildirimler','Sistem uyarıları'); const data=await table('notifications','*','created_at',false); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['Bildirim',r=>`<strong>${esc(r.title||'—')}</strong><br><span class="muted">${esc(r.body||'')}</span>`],['Tür',r=>esc(r.kind||'—')],['Durum',r=>r.read_at?'Okundu':'Okunmadı'],['Tarih',r=>date(r.created_at)]],'Bildirim yok'); } catch(e){ fail('Bildirimler yüklenemedi',e); } }
  async function activityView(){ try { const el=shell('Aktivite','İşlem geçmişi'); const data=await table('activity_logs','*','created_at',false); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML=rows(data,[['İşlem',r=>esc(r.action||r.event||r.type||'—')],['Detay',r=>esc(r.description||r.message||r.entity_type||'')],['Tarih',r=>date(r.created_at)]],'Aktivite kaydı bulunamadı'); } catch(e){ fail('Aktivite yüklenemedi',e); } }
  async function mediaView(){ try { if(window.SiteMediaManager?.render){await window.SiteMediaManager.render();return;} const el=shell('Medya','Dosya yönetimi'); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML='<div class="panel"><p class="muted">Medya yöneticisi yüklenemedi.</p></div>'; } catch(e){ fail('Medya yüklenemedi',e); } }
  async function settingsView(){ try { const el=shell('Ayarlar','İşletme ve hesap'); const body=el?.querySelector('#moduleBody'); if(body) body.innerHTML='<div class="panel"><h3>Yönetici oturumu</h3><p class="muted">Aktif yönetici hesabı ile bağlısınız.</p><button class="btn" id="settingsRefresh">Yetki durumunu yenile</button></div>'; el?.querySelector('#settingsRefresh')?.addEventListener('click',()=>location.reload()); } catch(e){ fail('Ayarlar yüklenemedi',e); } }

  setView('customers',customersView); setView('offers',offersView); setView('analytics',analyticsView); setView('pricing',pricingView); setView('settlements',settlementsView); setView('calendar',calendarView); setView('equipment',equipmentView); setView('personnel',personnelView); setView('finance',financeView); setView('notifications',notificationsView); setView('activity',activityView); setView('media',mediaView); setView('settings',settingsView);
})();

/* ===== END admin/admin-module-renderers-v2.js ===== */

/* ===== BEGIN admin/admin.js ===== */
/* Stagepulse Admin — canonical shell, auth bootstrap, navigation and view dispatch. */
(() => {
  'use strict';
  const R = window.STAGEPULSE_RUNTIME || {};
  const SUPABASE_URL = R.supabaseUrl || '';
  const KEY = R.supabasePublishableKey || '';
  if (!window.supabase || !SUPABASE_URL || !KEY) {
    document.body.innerHTML = '<div style="padding:40px;font-family:system-ui;color:#fff;background:#090909;min-height:100vh">Supabase yapılandırması yüklenemedi.</div>';
    return;
  }
  const client = window.__stagepulseAdminClient || window.supabase.createClient(SUPABASE_URL, KEY, {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:false,
      storageKey:'stagepulse-admin-auth-v2',
      storage:window.sessionStorage
    }
  });
  window.__stagepulseAdminClient = client;
  window.sb = window.sb || client;
  window.supabaseClient = window.supabaseClient || client;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const viewMeta = {
    'command-center':['Komuta Merkezi','Operasyon'],dashboard:['Genel Bakış','Satış ve operasyon'],analytics:['Analitik','Dönüşüm'],customers:['Müşteriler','Müşteri geçmişi'],offers:['Teklifler','Lead ve teklif yönetimi'],pricing:['Fiyatlandırma','Hizmet ve kurallar'],settlements:['Gelir · Gider','Anlaşılan → gider → paylaşım'],calendar:['İşler · Takvim','Kurulum ve etkinlik'],equipment:['Ekipman','Envanter'],personnel:['Personel','Portal hesapları'],finance:['Ödemeler','Tahsilat kayıtları'],notifications:['Bildirimler','Sistem uyarıları'],activity:['Aktivite','İşlem geçmişi'],media:['Medya','Yönetim'],settings:['Ayarlar','İşletme ve hesap']
  };
  function showLogin(){const l=$('#loginView'),a=$('#appView');if(l){l.classList.remove('is-hidden');l.hidden=false}if(a){a.classList.add('is-hidden');a.hidden=true}}
  function showApp(){const l=$('#loginView'),a=$('#appView');if(l){l.classList.add('is-hidden');l.hidden=true}if(a){a.classList.remove('is-hidden');a.hidden=false}}
  function toast(msg,ok=true){let t=$('#adminToast');if(!t){t=document.createElement('div');t.id='adminToast';t.className='admin-toast';document.body.appendChild(t)}t.textContent=msg;t.className=`admin-toast ${ok?'ok':'err'} show`;setTimeout(()=>t.classList.remove('show'),2800)}
  window.toast = window.toast || toast;
  const authUrlKeys=['code','type','token','token_hash','access_token','refresh_token','expires_at','expires_in','provider_token','provider_refresh_token','error','error_code','error_description','password','passwd','pass','pwd'];
  function parseParams(value){
    const params=new Map();
    for(const part of String(value||'').replace(/^[?#]/,'').split('&')){
      if(!part)continue;
      const split=part.indexOf('='),rawKey=split<0?part:part.slice(0,split),rawValue=split<0?'':part.slice(split+1);
      try{params.set(decodeURIComponent(rawKey.replace(/\+/g,' ')),decodeURIComponent(rawValue.replace(/\+/g,' ')))}catch{continue}
    }
    return params;
  }
  function encodeParams(params){
    return [...params].map(([key,value])=>`${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  }
  function cleanAuthUrl(query,hash){
    authUrlKeys.forEach(key=>query.delete(key));
    authUrlKeys.forEach(key=>hash.delete(key));
    const cleanQuery=encodeParams(query),cleanHash=encodeParams(hash);
    history.replaceState(null,document.title,location.pathname+(cleanQuery?`?${cleanQuery}`:'')+(cleanHash?`#${cleanHash}`:''));
  }
  async function recoverAdminSessionFromUrl(){
    const query=parseParams(location.search),hash=/^#[^#]*=/.test(location.hash)?parseParams(location.hash):new Map();
    const code=query.get('code');
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    const type=query.get('type')||hash.get('type');
    const hasAuthUrl=authUrlKeys.some(key=>query.has(key)||hash.has(key));
    if(!hasAuthUrl)return false;
    try{
      if(query.get('error'))throw new Error(query.get('error_description')||'Kimlik doğrulama bağlantısı geçersiz.');
      if(code){const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw error;}
      else if(accessToken&&refreshToken){const {error}=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(error)throw error;}
      else throw new Error('Kimlik doğrulama bağlantısı eksik veya geçersiz.');
      window.__stagepulseAdminRecovery=type==='recovery';
      return true;
    }finally{cleanAuthUrl(query,hash);}
  }
  function closeMobileNav(){const s=$('#sidebar'),o=$('#mobileOverlay');s?.classList.remove('open');if(o){o.hidden=true;o.classList.remove('open')}}
  function routeView(v){if((location.hash||'').slice(1)!==v)history.replaceState(null,'','#'+v)}
  async function guard(session){
    const r=await fetch(`${SUPABASE_URL}/functions/v1/org-admin-control`,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:'my_context'}),cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.membership||j.membership.active!==true||j.is_admin!==true){await client.auth.signOut();showLogin();$('#loginError').textContent='Bu hesap için aktif yönetim yetkisi bulunmuyor.';return false}
    window.__stagepulseAdminContext=j;showApp();const p=j.profile||{};$('#adminUser').textContent='@'+(p.username||session.user?.email?.split('@')[0]||'admin');$('#sideAdminName').textContent=p.display_name||p.username||'Yönetici';window.dispatchEvent(new CustomEvent('stagepulse:logged-in',{detail:{portal:'admin'}}));return true;
  }
  const handlers={
    'command-center':()=>window.commandCenterView?.(),dashboard:()=>window.dashboard?.(),analytics:()=>window.analyticsView?.(),customers:()=>window.customersView?.(),offers:()=>window.offersView?.(),pricing:()=>window.pricingView?.(),settlements:()=>window.settlementsView?.(),calendar:()=>window.calendarView?.(),equipment:()=>window.equipmentView?.(),personnel:()=>window.personnelView?.(),finance:()=>window.financeView?.(),notifications:()=>window.notificationsView?.(),activity:()=>window.activityView?.(),media:()=>window.mediaView?.(),settings:()=>window.settingsView?.()
  };
  window.loadView = async function(v){
    if(!viewMeta[v])v='dashboard';
    const m=viewMeta[v];
    $('#viewTitle').textContent=m[0];
    $('#viewSubtitle').textContent=m[1];
    routeView(v);
    closeMobileNav();
    $$('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
    const content=$('#content');
    if(content) content.replaceChildren();
    try {
      const fn=handlers[v];
      if(typeof fn==='function'){
        const result=await fn();
        if(result!==false) return result;
      }
      if(v==='command-center'&&window.CommandCenter?.render) return await window.CommandCenter.render();
      if(v==='media'&&window.SiteMediaManager?.render) return await window.SiteMediaManager.render();
      if(content) content.innerHTML=`<div class="notice"><b>${esc(m[0])}</b><p>Bu bölümün ekran bileşeni yüklenemedi.</p></div>`;
      return false;
    } catch(e){
      console.error('[Stagepulse admin view]',v,e);
      if(content) content.innerHTML=`<div class="notice"><b>Sistem hatası</b><p>${esc(e?.message||e)}</p></div>`;
      return false;
    }
  };
  function bindShell(){
    $('#menuBtn')?.addEventListener('click',()=>{const s=$('#sidebar'),o=$('#mobileOverlay');s?.classList.add('open');if(o){o.hidden=false;o.classList.add('open')}});
    $('#sidebarClose')?.addEventListener('click',closeMobileNav);$('#mobileOverlay')?.addEventListener('click',closeMobileNav);$('#logoutBtn')?.addEventListener('click',async()=>{await client.auth.signOut();location.reload()});
    $$('#sideNav button[data-view]').forEach(b=>b.addEventListener('click',()=>window.loadView(b.dataset.view)));
  }
  async function init(){bindShell();try{await recoverAdminSessionFromUrl()}catch(error){await client.auth.signOut().catch(()=>{});showLogin();const box=$('#loginError');if(box)box.textContent=error?.message||'Kimlik doğrulama bağlantısı geçersiz.';return}const {data:{session}}=await client.auth.getSession();if(session){if(await guard(session)){const h=(location.hash||'#dashboard').slice(1);await window.loadView(viewMeta[h]?h:'dashboard')} } else showLogin()}
  window.getAdminClient=()=>client;
  window.StagepulseAdminSupabase=window.StagepulseAdminSupabase||{getClient:()=>client};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* ===== END admin/admin.js ===== */

/* ===== BEGIN admin/admin-dashboard-runtime-v1.js ===== */
/* Stagepulse Admin — canonical dashboard renderer.
 * Replaces stale/legacy dashboard content and uses the current Supabase client.
 */
(() => {
  'use strict';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v) => Number(v) || 0;
  const money = (v) => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }).format(num(v));
  const client = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;

  async function read(table, select='*') {
    const c = client();
    if (!c) throw new Error('Supabase bağlantısı hazır değil.');
    const { data, error } = await c.from(table).select(select);
    if (error) throw error;
    return data || [];
  }

  function rowOffer(o) {
    const status = {new:'Yeni',reviewing:'İnceleniyor',preparing:'Hazırlanıyor',sent:'Gönderildi',accepted:'Kabul',rejected:'Red',cancelled:'İptal',archived:'Arşiv',expired:'Süresi doldu'}[o.status] || o.status || '—';
    return `<div class="row-item"><div class="row-main"><strong>${esc(o.quote_number || 'Teklif')}</strong><span class="muted">${esc(o.name || '')} · ${esc(o.location || '-')} · ${esc(o.event_date || '-')}</span></div><div class="row-side"><span class="status ${esc(o.status || '')}">${esc(status)}</span><span class="row-price">${money(o.total)}</span><button class="btn" type="button" data-dashboard-offer="${esc(o.id)}">Aç</button></div></div>`;
  }

  function renderError(error) {
    const c = document.getElementById('content');
    if (!c) return;
    c.innerHTML = `<div class="notice"><b>Genel Bakış yüklenemedi</b><p>${esc(error?.message || error || 'Bilinmeyen hata')}</p><p class="muted">Supabase bağlantısı veya bu hesabın erişim kapsamı kontrol edilmeli.</p></div>`;
  }

  async function dashboard() {
    const c = document.getElementById('content');
    if (!c) return;
    c.replaceChildren();
    try {
      const [offers, settlements] = await Promise.all([
        read('teklifler','*'),
        read('settlements','*')
      ]);
      const active = settlements.filter(s => s.status !== 'cancelled');
      const agreed = active.reduce((a,s)=>a+num(s.agreed_amount),0);
      const expense = active.reduce((a,s)=>a+num(s.expense_amount),0);
      const ownerRevenue = active.reduce((a,s)=>a+num(s.owner_revenue ?? (num(s.agreed_amount)*num(s.owner_pct)/100)),0);
      const ownerProfit = active.reduce((a,s)=>a+num(s.owner_share),0);
      const supplier = active.reduce((a,s)=>a+num(s.supplier_share),0);
      const potential = offers.filter(x=>!['archived','cancelled','expired','rejected'].includes(x.status)).reduce((a,x)=>a+num(x.total ?? x.estimated_price),0);
      const revenue = offers.filter(x=>x.status==='accepted').reduce((a,x)=>a+num(x.total),0);

      c.innerHTML = `<div class="page-head"><div><h1>Genel Bakış</h1><p class="muted">Tüm operasyon tek ekranda</p></div><div class="actions"><button class="btn btn-primary" type="button" data-dashboard-new-offer>+ Teklif</button><button class="btn" type="button" data-dashboard-settlements>Gelir · Gider</button></div></div>
      <div class="cards">
        <div class="card kpi-accent"><span class="card-label">Yeni lead</span><div class="metric">${offers.filter(x=>x.status==='new').length}</div></div>
        <div class="card"><span class="card-label">Potansiyel teklif</span><div class="metric">${money(potential)}</div></div>
        <div class="card"><span class="card-label">Kabul ciro</span><div class="metric">${money(revenue)}</div></div>
        <div class="card"><span class="card-label">Senin ciro</span><div class="metric">${money(ownerRevenue)}</div></div>
        <div class="card"><span class="card-label">Senin kârın</span><div class="metric">${money(ownerProfit)}</div></div>
      </div>
      <div class="grid2" style="margin-top:16px">
        <div class="panel"><div class="panel-head"><h3>Son teklifler</h3><button class="btn" type="button" data-dashboard-offers>Tümü</button></div>${offers.slice(0,8).map(rowOffer).join('') || '<p class="muted empty">Teklif yok</p>'}</div>
        <div class="panel"><div class="panel-head"><h3>Gelir · Gider özeti</h3><button class="btn" type="button" data-dashboard-settlements>Aç</button></div><div class="settle-kpi"><div><span>Anlaşılan</span><b>${money(agreed)}</b></div><div><span>Gider</span><b>${money(expense)}</b></div><div><span>Senin ciro</span><b class="ok">${money(ownerRevenue)}</b></div><div><span>Senin kârın</span><b class="ok">${money(ownerProfit)}</b></div><div><span>Diğer pay</span><b>${money(supplier)}</b></div></div>${active.slice(0,5).map(s=>`<div class="row-item"><div class="row-main"><strong>${esc(s.title || 'Mutabakat')}</strong><span class="muted">${esc(s.event_date || '-')} · ${esc(s.location || '-')}</span></div><div class="row-side"><span class="status ${esc(s.status || '')}">${esc(s.status || 'Açık')}</span><span class="row-price">${money(s.agreed_amount)}</span></div></div>`).join('') || '<p class="muted empty">Gelir/gider kaydı yok</p>'}</div>
      </div>`;

      c.querySelectorAll('[data-dashboard-offer]').forEach(b => b.addEventListener('click',()=>window.openOffer?.(b.dataset.dashboardOffer)));
      c.querySelectorAll('[data-dashboard-new-offer]').forEach(b => b.addEventListener('click',()=>window.newOffer?.()));
      c.querySelectorAll('[data-dashboard-offers]').forEach(b => b.addEventListener('click',()=>window.loadView?.('offers')));
      c.querySelectorAll('[data-dashboard-settlements]').forEach(b => b.addEventListener('click',()=>window.loadView?.('settlements')));
    } catch (e) { renderError(e); }
  }

  window.dashboard = dashboard;
  window.StagepulseAdminDashboard = { render: dashboard };
})();

/* ===== END admin/admin-dashboard-runtime-v1.js ===== */

/* ===== BEGIN admin/admin-supabase-bridge-v1.js ===== */
/* Stagepulse Admin — canonical Supabase client bridge. */
(() => {
  'use strict';
  const runtime = window.STAGEPULSE_RUNTIME || {};
  const create = () => {
    if (!window.supabase || !runtime.supabaseUrl || !runtime.supabasePublishableKey) return null;
    return window.supabase.createClient(runtime.supabaseUrl, runtime.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'stagepulse-admin-auth-v2', storage: window.sessionStorage }
    });
  };
  try {
    if (!window.__stagepulseAdminClient) {
      if (typeof sb !== 'undefined' && sb && typeof sb.from === 'function') window.__stagepulseAdminClient = sb;
      else window.__stagepulseAdminClient = create();
    }
    window.StagepulseAdminSupabase = window.StagepulseAdminSupabase || {
      getClient() {
        if (!window.__stagepulseAdminClient) window.__stagepulseAdminClient = create();
        if (!window.__stagepulseAdminClient) throw new Error('Supabase istemcisi hazır değil.');
        return window.__stagepulseAdminClient;
      }
    };
    if (!window.sb && window.__stagepulseAdminClient) window.sb = window.__stagepulseAdminClient;
    if (!window.supabaseClient && window.__stagepulseAdminClient) window.supabaseClient = window.__stagepulseAdminClient;
  } catch (e) { console.error('[Stagepulse Supabase bridge]', e); }
})();

/* ===== END admin/admin-supabase-bridge-v1.js ===== */

/* ===== BEGIN admin/admin-company-organization-v1.js ===== */
/* Stagepulse — Company Organization Center v9 */
(function(){'use strict';
function runtime(){return window.STAGEPULSE_RUNTIME||{};}
function client(){if(window.StagepulseAdminSupabase&&typeof window.StagepulseAdminSupabase.getClient==='function')return window.StagepulseAdminSupabase.getClient();if(window.AdminSupabase&&typeof window.AdminSupabase.getClient==='function')return window.AdminSupabase.getClient();if(window.__stagepulseAdminClient)return window.__stagepulseAdminClient;throw new Error('Supabase istemcisi hazır değil. Sayfayı tamamen yenileyip tekrar deneyin.');}
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch];});}
async function callAdminControl(action,payload){var db=client(),me=await db.auth.getSession(),token=me.data&&me.data.session&&me.data.session.access_token;if(!token)throw new Error('Oturum bulunamadı. Yönetici olarak tekrar giriş yapın.');var r=runtime(),res=await fetch((r.supabaseUrl||'')+'/functions/v1/org-admin-control',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':r.supabasePublishableKey||''},body:JSON.stringify(Object.assign({action:action},payload||{})),cache:'no-store'});var j=await res.json().catch(function(){return {};});if(!res.ok)throw new Error(j.error||'Organizasyon kontrolü başarısız.');return j||{};}
async function render(){var c=document.getElementById('content');if(!c)return;c.innerHTML='<section class="admin-card"><h2>Şirket Organizasyonu</h2><p>Yükleniyor…</p></section>';try{var data=await callAdminControl('catalog'),list=await callAdminControl('members'),members=list.members||[],roles=data.roles||[],positions=data.positions||[],deps=data.departments||[],regions=data.regions||[],caps=data.capabilities||[];var activeRegions=regions.filter(function(x){return x.active!==false;});c.innerHTML='<section class="org-wrap"><div class="org-head"><div><h2>Şirket Organizasyonu</h2><p>Patron / Owner kontrol merkezi</p></div><div class="org-stat"><b>Owner</b><span>Tam erişim</span></div></div><div class="admin-card"><h3>Şirket Hiyerarşisi</h3><div class="org-tree">'+roles.map(function(r){return '<div class="org-node '+(r.code==='owner'?'root':'')+'"><b>'+esc(r.name)+'</b><span>Seviye '+esc(r.tier)+'</span><small>'+esc(r.code)+'</small></div>';}).join('')+'</div></div><div class="org-grid"><div class="admin-card"><h3>Departmanlar ('+deps.length+')</h3><p>'+((deps.map(function(d){return esc(d.name);}).join(' · '))||'Tanımlı departman yok')+'</p></div><div class="admin-card"><h3>Bölgeler ('+activeRegions.length+')</h3><p>Aktif bölge: <b>'+activeRegions.length+'/'+regions.length+'</b></p><div class="region-add"><input id="regionName" placeholder="Yeni bölge adı" maxlength="80"><input id="regionCode" placeholder="Kod (örn. izmir)" maxlength="80"><button class="btn btn-primary" id="regionAddBtn" type="button">Bölge Ekle</button></div><p id="regionMsg" class="form-error"></p><div class="region-list">'+regions.sort(function(a,b){return a.name.localeCompare(b.name,'tr');}).map(function(g){return '<div class="region-row '+(g.active===false?'is-disabled':'')+'"><span>'+esc(g.name)+'</span><small>'+esc(g.code)+'</small><button type="button" class="region-toggle" data-region-id="'+esc(g.id)+'" data-active="'+(g.active!==false)+'">'+(g.active===false?'Aktifleştir':'Pasifleştir')+'</button></div>';}).join('')+'</div></div></div><div class="admin-card"><h3>Organizasyon Üyeleri ('+members.length+')</h3><div class="org-members">'+(members.map(function(m){var p=m.profile||{},role=m.role||{},pos=m.position||{},dep=m.department||{},reg=m.region||{};var enabled=(m.capabilities||[]).length;return '<div class="org-member-row"><div><b>'+esc(p.display_name||p.email||m.user_id)+'</b><small>'+esc(p.email||'')+'</small></div><span>'+esc(role.name||role.code||'—')+'</span><span>'+esc(pos.name||pos.code||'—')+'</span><span>'+esc(dep.name||'—')+'</span><span>'+esc(reg.name||'—')+'</span><span>'+enabled+' yetki</span></div>';}).join('')||'<p>Henüz organizasyon üyesi yok.</p>')+'</div></div><div class="admin-card"><h3>Admin Yetkileri</h3><p><b>'+caps.length+'</b> aktif canonical yönetim yetkisi.</p></div></section>';var add=document.getElementById('regionAddBtn');add.addEventListener('click',async function(){var msg=document.getElementById('regionMsg'),name=document.getElementById('regionName').value.trim(),code=document.getElementById('regionCode').value.trim().toLowerCase().replace(/\s+/g,'-');msg.textContent='';if(!name||!code){msg.textContent='Bölge adı ve kodu gerekli.';return;}msg.textContent='Ekleniyor…';try{await callAdminControl('save_region',{name:name,code:code,active:true});await render();}catch(e){msg.textContent=e.message||'Bölge eklenemedi.';}});document.querySelectorAll('.region-toggle').forEach(function(btn){btn.addEventListener('click',async function(){var id=btn.getAttribute('data-region-id'),active=btn.getAttribute('data-active')==='true';btn.disabled=true;try{var region=regions.find(function(x){return x.id===id;});await callAdminControl('save_region',{id:id,name:region?region.name:'Bölge',code:region?region.code:'region',active:!active,manager_user_id:region?region.manager_user_id:null});await render();}catch(e){btn.disabled=false;alert(e.message||'Bölge güncellenemedi.');}});});if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Şirket Organizasyonu','Hiyerarşi · Departmanlar · Bölgeler · Yetkiler');}catch(e){c.innerHTML='<section class="admin-card"><h2>Şirket Organizasyonu</h2><p class="form-error">'+esc(e&&e.message||'Yüklenemedi.')+'</p></section>';}}
function boot(){var nav=document.getElementById('sideNav');if(!nav||document.getElementById('companyOrgNav'))return;var b=document.createElement('button');b.id='companyOrgNav';b.type='button';b.textContent='Şirket Organizasyonu';b.addEventListener('click',render);var out=document.getElementById('logoutBtn');nav.insertBefore(b,out||null);}
document.addEventListener('DOMContentLoaded',boot);window.addEventListener('stagepulse-admin-ready',boot);setTimeout(boot,1200);window.StagepulseCompanyOrganization={render:render};
})();

/* ===== END admin/admin-company-organization-v1.js ===== */

/* ===== BEGIN admin/admin-org-accounts-v1.js ===== */
/* Stagepulse — Owner-only organization account manager v7, canonical RBAC */
(function(){'use strict';
function cfg(){var r=window.STAGEPULSE_RUNTIME||{};return {supabaseUrl:r.supabaseUrl||'',supabasePublishableKey:r.supabasePublishableKey||''};}
function client(){if(window.StagepulseAdminSupabase&&StagepulseAdminSupabase.getClient)return StagepulseAdminSupabase.getClient();if(window.__stagepulseAdminClient&&window.__stagepulseAdminClient.auth)return window.__stagepulseAdminClient;if(window.sb&&sb.auth)return sb;throw Error('Supabase bağlantısı hazırlanamadı.');}
async function call(db,body){var s=await db.auth.getSession(),token=s.data&&s.data.session&&s.data.session.access_token;if(!token)throw Error('Oturum bulunamadı.');var c=cfg(),r=await fetch(c.supabaseUrl+'/functions/v1/org-admin-control',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':c.supabasePublishableKey},body:JSON.stringify(body),cache:'no-store'}),j=await r.json().catch(function(){return {}});if(!r.ok)throw Error(j.error||'İşlem başarısız.');return j;}
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
var S={db:null,cat:null,members:[]};function optsCode(a,selected){return (a||[]).map(function(x){return '<option value="'+esc(x.code)+'" '+(x.code===selected?'selected':'')+'>'+esc(x.name)+'</option>';}).join('');}function optsId(a,selected){return (a||[]).map(function(x){return '<option value="'+esc(x.id)+'" '+(x.id===selected?'selected':'')+'>'+esc(x.name)+'</option>';}).join('');}
function memberForm(m){var r=m.role||{},p=m.position||{},d=m.department||{},g=m.region||{},u=m.profile||{};var roles=(S.cat.roles||[]).filter(function(x){return x.code!=='owner';}),positions=(S.cat.positions||[]).filter(function(x){return x.code!=='owner';});return '<div class="admin-card" id="orgEditCard"><div class="panel-head"><div><h3>Yönetici hesabını düzenle</h3><p class="muted">'+esc(u.display_name||u.email||m.user_id)+'</p></div><button class="btn" type="button" id="orgEditClose">Kapat</button></div><form id="orgEditForm" class="org-form"><div class="org-form-grid"><label>Ad Soyad<input id="oeName" value="'+esc(u.display_name)+'" required></label><label>E-posta<input id="oeEmail" type="email" value="'+esc(u.email)+'" required></label><label>Yeni Şifre <span class="muted">(boş bırakılabilir)</span><input id="oePass" type="password" minlength="10"></label><label>Rol<select id="oeRole">'+optsCode(roles,r.code)+'</select></label><label>Pozisyon<select id="oePos">'+optsCode(positions,p.code||r.code)+'</select></label><label>Departman<select id="oeDep"><option value="">— Yok —</option>'+optsId(S.cat.departments,d.id)+'</select></label><label>Bölge<select id="oeReg"><option value="">— Yok —</option>'+optsId(S.cat.regions,g.id)+'</select></label></div><div class="actions"><button class="btn btn-primary" type="submit">Değişiklikleri Kaydet</button><button class="btn btn-danger" type="button" id="orgEditDelete">Kalıcı Olarak Sil</button></div><p id="orgEditMsg" class="form-error"></p></form></div>';}
async function render(){var c=document.getElementById('content');if(!c)return;c.innerHTML='<section class="admin-card"><h2>Yönetici Hesapları</h2><p>Yükleniyor…</p></section>';try{S.db=S.db||client();S.cat=await call(S.db,{action:'catalog'});var x=await call(S.db,{action:'members'});S.members=x.members||[];var roles=(S.cat.roles||[]).filter(function(r){return r.code!=='owner';});var positions=(S.cat.positions||[]).filter(function(p){return p.code!=='owner';});var members=S.members.map(function(m){var r=m.role||{},p=m.position||{},d=m.department||{},g=m.region||{},u=m.profile||{};return '<tr><td><b>'+esc(u.display_name||u.email||m.user_id)+'</b><small>'+esc(u.email||'')+'</small></td><td>'+esc(r.name||'')+'</td><td>'+esc(p.name||'')+'</td><td>'+esc(d.name||'—')+'</td><td>'+esc(g.name||'—')+'</td><td>'+((m.active)?'Aktif':'Pasif')+'</td><td><button class="btn org-edit-btn" type="button" data-user-id="'+esc(m.user_id)+'">Düzenle</button></td></tr>';}).join('');c.innerHTML='<section class="org-wrap"><div class="org-head"><div><h2>Yönetici Hesapları</h2><p>Patron / Owner tarafından oluşturulur, düzenlenir ve silinir.</p></div><div class="org-stat"><b>'+S.members.length+'</b><span>organizasyon üyesi</span></div></div><div class="admin-card"><h3>Yeni Yönetici Hesabı</h3><form id="orgCreateForm" class="org-form"><div class="org-form-grid"><label>Ad Soyad<input id="oaName" required></label><label>Kullanıcı adı<input id="oaUsername" required></label><label>Geçici Şifre<input id="oaPass" type="password" minlength="10" required></label><label>Rol<select id="oaRole">'+optsCode(roles)+'</select></label><label>Pozisyon<select id="oaPos">'+optsCode(positions)+'</select></label><label>Departman<select id="oaDep"><option value="">— Yok —</option>'+optsId(S.cat.departments)+'</select></label><label>Bölge<select id="oaReg"><option value="">— Yok —</option>'+optsId(S.cat.regions)+'</select></label></div><button class="btn btn-primary" type="submit">Hesap Oluştur</button><p id="orgCreateMsg" class="form-error"></p></form></div><div id="orgEditHost"></div><div class="admin-card"><h3>Mevcut Organizasyon</h3><div class="org-table-scroll"><table><thead><tr><th>Kişi</th><th>Rol</th><th>Pozisyon</th><th>Departman</th><th>Bölge</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>'+members+'</tbody></table></div></div></section>';
document.getElementById('orgCreateForm').addEventListener('submit',async function(e){e.preventDefault();var b=document.getElementById('orgCreateMsg');b.className='form-error';b.textContent='Oluşturuluyor…';try{var username=document.getElementById('oaUsername').value.trim().toLowerCase();if(!/^[a-z0-9._-]{3,64}$/.test(username))throw Error('Kullanıcı adı 3-64 karakter olmalı; yalnızca küçük harf, rakam, nokta, alt çizgi ve tire kullanılabilir.');await call(S.db,{action:'create_member',username:username,display_name:document.getElementById('oaName').value,password:document.getElementById('oaPass').value,role_code:document.getElementById('oaRole').value,position_code:document.getElementById('oaPos').value,department_id:document.getElementById('oaDep').value||null,region_id:document.getElementById('oaReg').value||null});await render();}catch(e){b.textContent=e.message||'İşlem başarısız.';}});
document.querySelectorAll('.org-edit-btn').forEach(function(btn){btn.addEventListener('click',function(){var m=S.members.find(function(x){return x.user_id===btn.dataset.userId;});if(!m)return;var host=document.getElementById('orgEditHost');host.innerHTML=memberForm(m);host.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('orgEditClose').onclick=function(){host.innerHTML='';};document.getElementById('orgEditForm').addEventListener('submit',async function(e){e.preventDefault();var msg=document.getElementById('orgEditMsg');msg.textContent='Kaydediliyor…';try{await call(S.db,{action:'save_membership',user_id:m.user_id,role_code:document.getElementById('oeRole').value,position_code:document.getElementById('oePos').value,department_id:document.getElementById('oeDep').value||null,region_id:document.getElementById('oeReg').value||null,active:m.active!==false});if(document.getElementById('oePass').value)await call(S.db,{action:'reset_password',user_id:m.user_id,password:document.getElementById('oePass').value});await render();}catch(e){msg.textContent=e.message||'İşlem başarısız.';}});document.getElementById('orgEditDelete').onclick=async function(){if(!confirm('Bu yönetici hesabı kalıcı olarak silinecek. Devam edilsin mi?'))return;var msg=document.getElementById('orgEditMsg');msg.textContent='Siliniyor…';try{await call(S.db,{action:'delete_member',user_id:m.user_id});await render();}catch(e){msg.textContent=e.message||'Silme işlemi başarısız.';}};});});if(window.AdminUI&&AdminUI.setTitle)AdminUI.setTitle('Yönetici Hesapları','Patron kontrolü · Organizasyon · Hesaplar');}catch(e){c.innerHTML='<section class="admin-card"><h2>Yönetici Hesapları</h2><p class="form-error">'+esc(e.message||'Yüklenemedi.')+'</p></section>';}}
function boot(){var nav=document.getElementById('sideNav');if(!nav||document.getElementById('orgAccountsNav'))return;var b=document.createElement('button');b.id='orgAccountsNav';b.type='button';b.textContent='Yönetici Hesapları';b.addEventListener('click',render);nav.insertBefore(b,document.getElementById('logoutBtn'));}
document.addEventListener('DOMContentLoaded',boot);window.addEventListener('stagepulse-admin-ready',boot);setTimeout(boot,1500);window.StagepulseOrgAccounts={render:render};})();
/* ===== END admin/admin-org-accounts-v1.js ===== */

/* ===== BEGIN admin/admin-org-scope-v1.js ===== */
/* Stagepulse — Scoped organization dashboard v6 */
(function(){'use strict';
function runtime(){return window.STAGEPULSE_RUNTIME||{};}
function getClient(){if(window.StagepulseAdminSupabase&&typeof window.StagepulseAdminSupabase.getClient==='function')return window.StagepulseAdminSupabase.getClient();if(window.AdminSupabase&&typeof window.AdminSupabase.getClient==='function')return window.AdminSupabase.getClient();if(window.__stagepulseAdminClient)return window.__stagepulseAdminClient;throw new Error('Supabase bağlantısı hazırlanamadı. Sayfayı tamamen yenileyin.');}
async function callPanelContext(db){var s=await db.auth.getSession(),token=s.data&&s.data.session&&s.data.session.access_token;if(!token)throw new Error('Oturum gerekli. Yönetici olarak tekrar giriş yapın.');var r=runtime(),res=await fetch((r.supabaseUrl||'')+'/functions/v1/org-admin-control',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':r.supabasePublishableKey||''},body:JSON.stringify({action:'my_context'})});var j=await res.json().catch(function(){return {};});if(!res.ok)throw new Error(j.error||'Yönetim kapsamı alınamadı.');return j||{};}
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]});}
function boot(){if(document.getElementById('orgScopeNav'))return;var nav=document.getElementById('sideNav');if(!nav)return;var b=document.createElement('button');b.id='orgScopeNav';b.type='button';b.textContent='Yönetim Kapsamım';b.addEventListener('click',render);nav.insertBefore(b,document.getElementById('companyOrgNav')||document.getElementById('logoutBtn'));}
async function render(){var ctn=document.getElementById('content');if(!ctn)return;ctn.innerHTML='<section class="admin-card"><h2>Yönetim Kapsamım</h2><p>Yükleniyor…</p></section>';try{var db=getClient(),me=await db.auth.getUser();if(me.error)throw me.error;if(!me.data||!me.data.user)throw new Error('Oturum gerekli.');var data=await callPanelContext(db),v=data.membership||null;if(!v)throw new Error('Organizasyon üyeliği bulunamadı.');var role=(v.role&&v.role.code)||'employee',isOwner=role==='owner';var scope=isOwner?'Tüm şirket':((v.department&&v.department.name)?v.department.name:((v.region&&v.region.name)?v.region.name:'Kapsam tanımlı değil'));var grants=data.capabilities||[];var permHtml=isOwner?'<span class="org-perm-pill">Patron · tüm yönetim yetkileri</span>':(grants.map(function(x){return '<span class="org-perm-pill">'+esc(x.name||x.key||x.capability_key)+'</span>';}).join('')||'<p>Bu hesapta atanmış yönetim yetkisi yok.</p>');var scopeRule=isOwner?'Patron olarak şirketin tamamına erişirsiniz.':(v.department?'Bu hesap kendi departmanı ile sınırlıdır.':(v.region?'Bu hesap kendi bölgesi ile sınırlıdır.':'Bu hesap kendi hesabı ve atanmış izinleri ile çalışır.'));ctn.innerHTML='<section class="org-scope-wrap"><div class="org-head"><div><h2>Yönetim Kapsamım</h2><p>Rol, görev ve erişim kapsamınız.</p></div><div class="org-stat"><b>'+esc(v.role_name||v.role?.name||'Çalışan')+'</b><span>Rol</span></div><div class="org-stat"><b>'+esc(scope)+'</b><span>Kapsam</span></div><div class="org-stat"><b>'+esc(isOwner?'Tam':String(grants.length))+'</b><span>Admin yetkisi</span></div></div><div class="org-scope-grid"><div class="admin-card"><h3>Görev bilgileri</h3><dl><div><dt>Rol</dt><dd>'+esc(v.role_name||v.role?.name||'—')+'</dd></div><div><dt>Pozisyon</dt><dd>'+esc(v.position_name||v.position?.name||'—')+'</dd></div><div><dt>Departman</dt><dd>'+esc((v.department&&v.department.name)||v.department_name||'—')+'</dd></div><div><dt>Bölge</dt><dd>'+esc((v.region&&v.region.name)||v.region_name||'—')+'</dd></div><div><dt>Bağlı yönetici</dt><dd>'+esc(v.manager_user_id||'—')+'</dd></div></dl></div><div class="admin-card"><h3>Aktif yönetim yetkileri</h3><div class="org-perm-list">'+permHtml+'</div></div></div><div class="admin-card"><h3>Kapsam kuralı</h3><p>'+esc(scopeRule)+'</p></div></section>';if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Yönetim Kapsamım','Rol · Departman · Bölge · Yetkiler');}catch(e){ctn.innerHTML='<section class="admin-card"><h2>Yönetim Kapsamım</h2><p class="form-error">'+esc(e&&e.message||'Kapsam yüklenemedi.')+'</p></section>';}}
window.addEventListener('stagepulse-admin-ready',boot);document.addEventListener('DOMContentLoaded',boot);setTimeout(boot,1200);window.StagepulseOrgScope={render:render};})();

/* ===== END admin/admin-org-scope-v1.js ===== */

/* ===== BEGIN admin/auth-layer.js ===== */
/* Stagepulse Admin — canonical Auth + RBAC */
(() => {
  'use strict';
  const loginForm=document.getElementById('loginForm'),forgot=document.getElementById('forgotPasswordBtn'),errorBox=document.getElementById('loginError'),noticeBox=document.getElementById('resetNotice'),resetUrl=`${location.origin}/admin/`;
  const strong=p=>typeof p==='string'&&p.length>=10&&p.length<=128&&/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p)&&/\d/.test(p);const R=window.STAGEPULSE_RUNTIME||{};const URL=(R.supabaseUrl||window.SUPABASE_URL||'').replace(/\/$/,'');const KEY=R.supabasePublishableKey||window.SUPABASE_KEY||'';const client=()=>window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;const sb=client();if(!sb)throw Error('Yönetici istemcisi hazır değil.');const adminLoginUrl=`${URL}/functions/v1/admin-login`;const edge=`${URL}/functions/v1/org-admin-control`;
  async function canonicalAdminLogin(username,password){const r=await fetch(adminLoginUrl,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({action:'login',username:String(username||'').trim().toLowerCase(),password}),cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||!j?.session?.access_token)throw new Error(j?.error||'Geçersiz kullanıcı adı veya şifre.');return j;}
  async function verifyAdminSession(session){if(!session?.access_token)throw new Error('Yönetici oturumu bulunamadı.');const r=await fetch(edge,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:'my_context'}),cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||!j.membership||j.membership.active!==true||j.is_admin!==true){await sb.auth.signOut().catch(()=>{});throw new Error('Bu hesap için aktif yönetim yetkisi bulunmuyor.');}window.__stagepulseAdminContext=j;return j;}
  async function authenticate(username,password){const login=await canonicalAdminLogin(username,password);const {error}=await sb.auth.setSession({access_token:login.session.access_token,refresh_token:login.session.refresh_token});if(error)throw new Error('Yönetici oturumu oluşturulamadı.');const current=await sb.auth.getSession();if(!current.data?.session)throw new Error('Yönetici oturumu oluşturulamadı.');const context=await verifyAdminSession(current.data.session);return {session:current.data.session,context};}
  async function forgotFlow(){forgot.disabled=true;if(noticeBox)noticeBox.textContent='Sıfırlama bağlantısı gönderiliyor…';if(errorBox)errorBox.textContent='';try{const email=document.getElementById('loginUsername')?.value?.trim().toLowerCase()||'';if(!email.includes('@'))throw new Error('Şifre sıfırlamak için kullanıcı adı alanına e-posta adresinizi yazın.');const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:resetUrl});if(error)throw error;if(noticeBox)noticeBox.textContent='Eğer bu e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi.';}catch(e){if(errorBox)errorBox.textContent=e?.message||'Şifre sıfırlama başarısız.';if(noticeBox)noticeBox.textContent='';}finally{forgot.disabled=false;}}
  function resetModal(){document.getElementById('spResetModal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="spResetModal"><div class="modal-card"><button class="close" type="button" id="spResetClose">×</button><div class="auth-mark">SP</div><h2>Yeni şifre</h2><p class="muted">En az 10 karakter, bir harf ve bir rakam kullanın.</p><label>Yeni şifre<input id="spNewPassword" type="password" minlength="10" autocomplete="new-password"></label><label>Yeni şifre tekrar<input id="spNewPassword2" type="password" minlength="10" autocomplete="new-password"></label><div class="modal-actions"><button class="btn btn-primary" id="spResetSave" type="button">Şifreyi güncelle</button></div><p id="spResetError" class="form-error"></p></div></div>`);document.getElementById('spResetClose')?.addEventListener('click',()=>document.getElementById('spResetModal')?.remove());document.getElementById('spResetSave')?.addEventListener('click',async()=>{const a=document.getElementById('spNewPassword')?.value||'',b=document.getElementById('spNewPassword2')?.value||'',e=document.getElementById('spResetError');if(!strong(a)){e.textContent='Şifre en az 10 karakter, bir harf ve bir rakam içermeli.';return;}if(a!==b){e.textContent='Şifreler eşleşmiyor.';return;}const {error}=await sb.auth.updateUser({password:a});if(error){e.textContent=error.message;return;}await sb.auth.signOut();document.getElementById('spResetModal')?.remove();if(noticeBox)noticeBox.textContent='Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.';});}
  async function loginV3(e){e.preventDefault();e.stopImmediatePropagation();const username=document.getElementById('loginUsername')?.value?.trim().toLowerCase()||'',password=document.getElementById('loginPassword')?.value||'';if(errorBox)errorBox.textContent='';if(noticeBox)noticeBox.textContent='';if(!username||!password){if(errorBox)errorBox.textContent='Kullanıcı adı ve şifre zorunludur.';return;}const btn=document.getElementById('loginBtn');if(btn){btn.disabled=true;btn.textContent='Giriş…';}try{const result=await authenticate(username,password);window.__stagepulseAdminContext=result.context;await window.guardAdminSession?.(result.session);}catch(ex){if(errorBox)errorBox.textContent=ex?.message||'Giriş başarısız.';}finally{if(btn){btn.disabled=false;btn.textContent='Giriş Yap';}}}
  window.guardAdminSession=async session=>{const context=await verifyAdminSession(session),login=document.getElementById('loginView'),app=document.getElementById('appView');if(login){login.classList.add('is-hidden');login.hidden=true;}if(app){app.classList.remove('is-hidden');app.hidden=false;}const m=context.membership||{},role=m.role||{},p=context.profile||{},adminUser=document.getElementById('adminUser'),adminName=document.getElementById('sideAdminName');if(adminUser)adminUser.textContent='@'+(p.username||session.user?.user_metadata?.username||session.user?.email?.split('@')[0]||'admin');if(adminName)adminName.textContent=p.display_name||session.user?.user_metadata?.display_name||session.user?.email?.split('@')[0]||role.name||'Yönetici';if(typeof window.loadView==='function')await window.loadView((location.hash||'#dashboard').slice(1)||'dashboard');return true;};
  forgot?.addEventListener('click',forgotFlow);loginForm?.addEventListener('submit',loginV3,true);sb.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')resetModal();});if(window.__stagepulseAdminRecovery)resetModal();
})();
/* ===== END admin/auth-layer.js ===== */

/* ===== BEGIN admin/error-handling.js ===== */
/* Stagepulse Admin — production error presentation layer
 * Keeps legacy admin.js intact while replacing misleading generic diagnostics.
 * 2026-08-21
 */
(function () {
  'use strict';

  const LEGACY_SETTLEMENT_TEXT = 'Supabase migration / RLS / settlements tablosunu kontrol et.';

  function classify(message) {
    const m = String(message || '').toLowerCase();
    if (/permission denied|row-level security|rls|42501/.test(m)) {
      return 'Bu işlem için yetkiniz yok. Admin oturumunu ve ilgili yetkiyi kontrol edin.';
    }
    if (/schema cache|could not find the table|relation .* does not exist|pgrst/.test(m)) {
      return 'Veritabanı şeması güncel değil veya ilgili kaynak bulunamadı. Sayfayı yenileyin; sorun sürerse Supabase migration durumunu kontrol edin.';
    }
    if (/duplicate|unique|23505/.test(m)) {
      return 'Bu kayıt zaten mevcut. Farklı bir değer kullanın.';
    }
    if (/violates.*constraint|23514|not-null|23502|foreign key|23503/.test(m)) {
      return 'Girilen bilgiler veritabanı kurallarına uymuyor. Form alanlarını kontrol edin.';
    }
    if (/jwt|auth|session|token|401|403/.test(m)) {
      return 'Oturum veya yetki süresi dolmuş olabilir. Yeniden giriş yapmayı deneyin.';
    }
    if (/failed to fetch|network|fetch|bağlantı/.test(m)) {
      return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
    }
    return 'İşlem sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  }

  function repairNotice(root) {
    if (!root) return;
    root.querySelectorAll('.notice').forEach((notice) => {
      const text = notice.textContent || '';
      if (!text.includes(LEGACY_SETTLEMENT_TEXT)) return;
      const paragraphs = notice.querySelectorAll('p');
      const detail = paragraphs.length ? paragraphs[0].textContent : text;
      const replacement = classify(detail);
      if (paragraphs.length > 1) {
        paragraphs[1].textContent = replacement;
      } else {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = replacement;
        notice.appendChild(p);
      }
    });
  }

  const start = () => {
    const content = document.getElementById('content');
    if (!content) return;
    repairNotice(content);
    new MutationObserver(() => repairNotice(content)).observe(content, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

/* ===== END admin/error-handling.js ===== */

/* ===== BEGIN admin/event-date-sync.js ===== */
/* Stagepulse Admin — event date sync */
(() => {
  const __cfg = (typeof globalThis !== 'undefined' ? globalThis : window).STAGEPULSE_RUNTIME || {};
  const URL = __cfg.supabaseUrl || '';
  const KEY = __cfg.supabasePublishableKey || '';
  if (!URL || !KEY) return;
  const client = window.StagepulseAdminSupabase?.getClient?.() || window.__stagepulseAdminClient;
  if (!client) return;

  let lastOfferId = null;
  let originalSaveOffer = null;

  async function getOffer(id) {
    const { data, error } = await client.from('teklifler').select('id,event_date').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  function addDateField(modal, offer) {
    if (!modal || !offer || modal.querySelector('#editEventDate')) return;
    const validity = modal.querySelector('#editValid');
    const label = document.createElement('label');
    label.innerHTML = 'Etkinlik tarihi<input type="date" id="editEventDate" value="' + String(offer.event_date || '') + '">';
    if (validity?.closest('label')) validity.closest('label').before(label);
    else modal.querySelector('.panel')?.appendChild(label);
  }

  async function enhanceModal() {
    const modal = document.getElementById('offerModal');
    if (!modal || modal.dataset.eventDateReady === '1') return;
    const match = modal.querySelector('[onclick*="saveOffer(\'"]');
    const onclick = match?.getAttribute('onclick') || '';
    const m = onclick.match(/saveOffer\('([^']+)'\)/);
    const id = m?.[1];
    if (!id) return;
    try {
      const offer = await getOffer(id);
      addDateField(modal, offer);
      modal.dataset.eventDateReady = '1';
      lastOfferId = id;
    } catch (e) {
      console.error('event date load', e);
    }
  }

  function installSaveWrapper() {
    if (typeof window.saveOffer !== 'function' || window.saveOffer.__eventDateWrapped) return;
    originalSaveOffer = window.saveOffer;
    const wrapped = async function(id) {
      const input = document.getElementById('editEventDate');
      let changed = false;
      if (input?.value) {
        try {
          const current = await getOffer(id);
          changed = current?.event_date !== input.value;
          if (changed) {
            const { error } = await client.rpc('staff_update_offer_event_date', {
              p_offer_id: id,
              p_event_date: input.value
            });
            if (error) throw error;
          }
        } catch (e) {
          const toastFn = window.toast;
          if (typeof toastFn === 'function') toastFn(e.message || 'Etkinlik tarihi değiştirilemedi.', false);
          else alert(e.message || 'Etkinlik tarihi değiştirilemedi.');
          return;
        }
      }
      await originalSaveOffer(id);
      if (changed) {
        const toastFn = window.toast;
        if (typeof toastFn === 'function') toastFn('Etkinlik tarihi güncellendi; bağlı işler yeni tarihe taşındı.');
      }
    };
    wrapped.__eventDateWrapped = true;
    window.saveOffer = wrapped;
  }

  const observer = new MutationObserver(() => {
    enhanceModal();
    installSaveWrapper();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => {
    installSaveWrapper();
    enhanceModal();
  });
})();

/* ===== END admin/event-date-sync.js ===== */

/* ===== BEGIN admin/live-sync.js ===== */
/* Stagepulse admin — realtime sync + visual dashboard enhancements. */
(() => {
  const client = window.StagepulseAdminSupabase?.getClient?.() || window.__stagepulseAdminClient;
  if (!client) return;
  let channel=null,timer=null,observer=null;
  const currentView=()=> (location.hash||'#dashboard').slice(1)||'dashboard';
  const editing=()=>{const el=document.activeElement;return !!el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);};
  const refresh=()=>{timer=null;if(editing()){if(typeof window.toast==='function')window.toast('Yeni değişiklik geldi. Açık formu kaydettikten sonra ekran yenilenecek.',true);return;}const v=currentView();const btn=document.querySelector(`#sideNav button[data-view="${CSS.escape(v)}"]`);if(btn)btn.click();};
  const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(refresh,450);};
  const notify=p=>{const n=p?.new||{};if(n.title&&typeof window.toast==='function')window.toast(`${n.title}: ${n.body||''}`.trim(),true);if(currentView()==='notifications')schedule();};
  async function deleteAllNotifications(){if(!confirm('Tüm bildirimler kalıcı olarak silinsin mi? Bu işlem geri alınamaz.'))return;const {error}=await client.from('notifications').delete().not('id','is',null);if(error){if(typeof window.toast==='function')window.toast(error.message,false);return;}if(typeof window.toast==='function')window.toast('Tüm bildirimler silindi');if(typeof window.loadView==='function')window.loadView('notifications');}
  function enhanceNotifications(){if(currentView()!=='notifications')return;const content=document.querySelector('#content');if(!content)return;const head=content.querySelector('.page-head');if(!head||head.dataset.spEnhanced==='1')return;head.dataset.spEnhanced='1';const actions=document.createElement('div');actions.className='sp-notification-toolbar';const count=document.createElement('div');count.className='sp-notification-count';count.innerHTML=`Bildirim merkezi · <b>${content.querySelectorAll('.row-item').length}</b> kayıt`;const mark=document.createElement('button');mark.className='btn';mark.textContent='✓ Tümünü okundu say';mark.onclick=()=>window.markAllNotificationsRead?.();const del=document.createElement('button');del.className='btn btn-danger sp-danger-all';del.textContent='⌫ Tümünü sil';del.onclick=deleteAllNotifications;actions.append(count,mark,del);head.parentNode.insertBefore(actions,head.nextSibling);const panel=content.querySelector('.panel');if(panel){const rows=[...panel.querySelectorAll('.row-item')];if(rows.length){panel.classList.add('notifications-grid');rows.forEach(r=>{r.classList.add('notification-card');if(r.style.opacity!=='0.65')r.classList.add('unread');const dot=document.createElement('i');dot.className='notification-dot';r.prepend(dot);});}}}
  async function enhanceAnalytics(){if(currentView()!=='analytics')return;const content=document.querySelector('#content');if(!content||content.dataset.spAnalytics==='1')return;const chart=content.querySelector('.chart');if(!chart)return;content.dataset.spAnalytics='1';const offerRows=(typeof offers!=='undefined'&&Array.isArray(offers))?offers:[];const accepted=offerRows.filter(x=>x.status==='accepted').length;const rejected=offerRows.filter(x=>['rejected','cancelled','expired'].includes(x.status)).length;const pending=Math.max(0,offerRows.length-accepted-rejected);const monthMap={};offerRows.forEach(o=>{const k=(o.created_at||'').slice(0,7);if(k)monthMap[k]=(monthMap[k]||0)+1;});const keys=Object.keys(monthMap).sort().slice(-12);const max=Math.max(1,...keys.map(k=>monthMap[k]));const flow=document.createElement('div');flow.className='sp-flow';flow.innerHTML=`<div class="sp-flow-step" style="--flow:#00d9ff"><b>Müşteri</b><span>${offerRows.length} teklif kaynağı</span></div><div class="sp-flow-arrow">→</div><div class="sp-flow-step" style="--flow:#7c4dff"><b>Teklif</b><span>${offerRows.length} toplam teklif</span></div><div class="sp-flow-arrow">→</div><div class="sp-flow-step" style="--flow:#00e5a0"><b>Kabul</b><span>${accepted} iş kazanıldı</span></div>`;const grid=document.createElement('div');grid.className='sp-analytics-grid';const monthly=document.createElement('div');monthly.className='panel';monthly.innerHTML=`<div class="panel-head"><h3>Aylık teklif trafiği</h3><span class="muted small">Son 12 ay</span></div><div class="sp-mini-bars">${keys.map(k=>`<div><div class="sp-mini-bar" style="height:${Math.max(8,Math.round((monthMap[k]/max)*118))}px"></div><div class="sp-mini-label">${k.slice(5)}</div></div>`).join('')||'<span class="muted">Henüz veri yok</span>'}</div>`;const status=document.createElement('div');status.className='panel';status.innerHTML=`<div class="panel-head"><h3>Teklif durumu</h3><span class="muted small">Canlı veri</span></div><div class="sp-stat-list"><div class="sp-stat"><span>Bekleyen / aktif</span><b>${pending}</b></div><div class="sp-stat"><span>Kabul edilen</span><b style="color:#69df91">${accepted}</b></div><div class="sp-stat"><span>Red / iptal</span><b style="color:#ff7373">${rejected}</b></div><div class="sp-stat"><span>Dönüşüm</span><b>${offerRows.length?Math.round(accepted/offerRows.length*100):0}%</b></div></div>`;grid.append(monthly,status);const oldPanel=chart.closest('.panel');if(oldPanel)oldPanel.replaceWith(grid);const pageHead=content.querySelector('.page-head');if(pageHead)pageHead.insertAdjacentElement('afterend',flow);}
  function enhance(){try{enhanceNotifications();enhanceAnalytics();}catch(e){console.warn('Stagepulse UI enhancement failed:',e);}}
  async function start(){try{const {data}=await client.auth.getUser();const uid=data?.user?.id;if(!uid)return;if(channel)await client.removeChannel(channel);channel=client.channel(`stagepulse-admin-live-${uid}`).on('postgres_changes',{event:'*',schema:'public',table:'teklifler'},()=>{enhance();schedule();}).on('postgres_changes',{event:'*',schema:'public',table:'jobs'},schedule).on('postgres_changes',{event:'*',schema:'public',table:'equipment'},schedule).on('postgres_changes',{event:'*',schema:'public',table:'customers'},()=>{enhance();schedule();}).on('postgres_changes',{event:'*',schema:'public',table:'settlements'},()=>{enhance();schedule();}).on('postgres_changes',{event:'*',schema:'public',table:'payments'},()=>{enhance();schedule();}).on('postgres_changes',{event:'*',schema:'public',table:'services'},()=>{enhance();schedule();}).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`recipient_user_id=eq.${uid}`},notify).subscribe();}catch(e){console.warn('Stagepulse realtime admin sync failed:',e);}}
  window.addEventListener('load',()=>{setTimeout(start,1200);setTimeout(enhance,1600);setTimeout(enhance,3000);});window.addEventListener('hashchange',()=>setTimeout(enhance,120));document.addEventListener('visibilitychange',()=>{if(!document.hidden){start();setTimeout(enhance,250);}});document.addEventListener('DOMContentLoaded',()=>{const root=document.querySelector('#content');if(root){observer=new MutationObserver(()=>{if(currentView()==='notifications'||currentView()==='analytics')setTimeout(enhance,30);});observer.observe(root,{childList:true,subtree:true});}});window.stagepulseDeleteAllNotifications=deleteAllNotifications;
})();
/* ===== END admin/live-sync.js ===== */

/* ===== BEGIN admin/inventory-ui-v4.js ===== */
/* Inventory UI v5 — canonical quantity + fresh editor. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const SIZE=50; let page=0,total=0,q='',active=''; let rows=[];
  const n=v=>Math.max(0,Number(v)||0), esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const healthy=e=>Math.max(0,n(e.quantity)-n(e.faulty_quantity)-n(e.maintenance_quantity));
  const available=e=>Math.max(0,n(e.quantity)-n(e.faulty_quantity)-n(e.maintenance_quantity)-n(e.reserved_quantity)-n(e.in_use_quantity));
  const render=()=>{const tq=rows.reduce((a,e)=>a+n(e.quantity),0),fq=rows.reduce((a,e)=>a+n(e.faulty_quantity),0),mq=rows.reduce((a,e)=>a+n(e.maintenance_quantity),0),hq=rows.reduce((a,e)=>a+available(e),0);$('#content').innerHTML=`<div class="page-head"><div><h1>Ekipman</h1><p class="muted">Envanter · fiziksel durumlar ve stok yönetimi</p></div><button class="btn btn-primary" onclick="window.spInventoryModal()">+ Ekipman ekle</button></div><div class="sp-inv-toolbar"><input id="spInvQ" placeholder="Kategori, marka veya model ara…" value="${esc(q)}"><select id="spInvA" class="sp-inv-active-filter"><option value="">Aktif + Pasif</option><option value="true" ${active==='true'?'selected':''}>Aktif</option><option value="false" ${active==='false'?'selected':''}>Pasif</option></select><button class="btn" id="spInvR" type="button">Yenile</button></div><div class="sp-inv-summary"><div class="sp-inv-stat"><span>Bu sayfa toplam</span><b>${tq}</b></div><div class="sp-inv-stat"><span>Arızalı</span><b>${fq}</b></div><div class="sp-inv-stat"><span>Bakımda</span><b>${mq}</b></div><div class="sp-inv-stat"><span>Sağlam / boşta</span><b>${hq}</b></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Ekipman</th><th>Toplam</th><th>Fiziksel durum</th><th>Aktif</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td><strong>${esc([e.category,e.brand].filter(Boolean).join(' · '))}</strong><div class="muted small">${esc(e.model||'—')}</div></td><td><b>${n(e.quantity)}</b></td><td><div class="sp-inv-status"><span class="sp-inv-chip healthy">Sağlam <strong>${healthy(e)}</strong></span><span class="sp-inv-chip faulty">Arıza <strong>${n(e.faulty_quantity)}</strong></span><span class="sp-inv-chip maintenance">Bakım <strong>${n(e.maintenance_quantity)}</strong></span><span class="sp-inv-chip reserved">Rezerve <strong>${n(e.reserved_quantity)}</strong></span><span class="sp-inv-chip inuse">Kullanımda <strong>${n(e.in_use_quantity)}</strong></span></div></td><td><span class="sp-active-badge ${e.active===false?'passive':'active'}">${e.active===false?'Pasif':'Aktif'}</span></td><td><button class="btn" type="button" onclick="window.spInventoryModal('${e.id}')">Düzenle</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted" style="text-align:center;padding:30px">Kayıt bulunamadı.</td></tr>'}</tbody></table></div></div><div class="sp-inv-pager"><button class="btn" id="spInvPrev" type="button" ${page===0?'disabled':''}>‹ Önceki</button><span>${total?page*SIZE+1:0}–${Math.min((page+1)*SIZE,total)} / ${total}</span><button class="btn" id="spInvNext" type="button" ${page+1>=Math.ceil(total/SIZE)?'disabled':''}>Sonraki ›</button></div>`;$('#spInvQ')?.addEventListener('input',()=>{q=$('#spInvQ').value.trim();page=0;clearTimeout(window.__spInvT);window.__spInvT=setTimeout(load,300)});$('#spInvA')?.addEventListener('change',()=>{active=$('#spInvA').value;page=0;load()});$('#spInvR')?.addEventListener('click',load);$('#spInvPrev')?.addEventListener('click',()=>{if(page){page--;load()}});$('#spInvNext')?.addEventListener('click',()=>{if((page+1)*SIZE<total){page++;load()}})};
  async function load(){if(!window.sb)return toast('Veritabanı bağlantısı hazır değil.',false);let x=sb.from('equipment').select('id,category,brand,model,quantity,active,notes,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,updated_at',{count:'exact'}).order('category').order('brand',{nullsFirst:true}).order('model',{nullsFirst:true}).range(page*SIZE,page*SIZE+SIZE-1);if(q)x=x.or(`category.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`);if(active!=='')x=x.eq('active',active==='true');const r=await x;if(r.error){console.error('Inventory load failed',r.error);return toast('Envanter yüklenemedi: '+r.error.message,false)}rows=r.data||[];total=r.count||0;render()}
  async function loadOne(id){const {data,error}=await sb.from('equipment').select('id,category,brand,model,quantity,active,notes,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,updated_at').eq('id',id).maybeSingle();if(error)throw error;if(!data)throw new Error('Ekipman kaydı bulunamadı. Listeyi yenileyin.');return data;}
  window.spInventoryModal=async function(id){let e=null;if(id){try{e=await loadOne(id)}catch(err){console.error('Inventory editor load failed',err);return toast(err.message||'Ekipman yeniden okunamadı.',false)}}const s=e||{category:'',brand:'',model:'',quantity:1,active:true,notes:'',faulty_quantity:0,maintenance_quantity:0,reserved_quantity:0,in_use_quantity:0};document.getElementById('spInvModal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="sp-inv-modal" id="spInvModal"><div class="sp-inv-card"><div class="sp-inv-head"><div><p class="muted small">${e?'ENVANTER DÜZENLE':'YENİ ENVANTER'}</p><h2>${esc(e?[e.brand,e.model].filter(Boolean).join(' ')||e.category:'Yeni ekipman')}</h2>${e?`<p class="muted">Kayıt stok miktarı: <strong>${n(s.quantity)}</strong> adet</p>`:''}</div><button class="sp-inv-close" type="button" onclick="window.spInventoryClose()">×</button></div><div class="sp-inv-grid"><label>Kategori *<input id="spEqCat" value="${esc(s.category)}"></label><label>Marka<input id="spEqBrand" value="${esc(s.brand||'')}"></label><label>Model<input id="spEqModel" value="${esc(s.model||'')}"></label><label>Toplam adet<input id="spEqQty" type="number" min="0" value="${n(s.quantity)}"></label><label>Aktif / Pasif<select id="spEqActive" class="sp-inv-active-select"><option value="1" ${s.active!==false?'selected':''}>Aktif</option><option value="0" ${s.active===false?'selected':''}>Pasif</option></select></label></div><div class="sp-inv-section"><h3>Fiziksel durum adetleri</h3><div class="sp-inv-status-grid"><label>Arızalı<input id="spEqFault" type="number" min="0" max="${n(s.quantity)}" value="${n(s.faulty_quantity)}"></label><label>Bakımda<input id="spEqMaint" type="number" min="0" max="${n(s.quantity)}" value="${n(s.maintenance_quantity)}"></label><label>Rezerve<input id="spEqReserved" type="number" min="0" max="${n(s.quantity)}" value="${n(s.reserved_quantity)}"></label><label>Kullanımda<input id="spEqUse" type="number" min="0" max="${n(s.quantity)}" value="${n(s.in_use_quantity)}"></label></div><div class="sp-inv-live"><div><span>Toplam stok</span><b id="spEqTL">${n(s.quantity)}</b></div><div><span>Arızalı</span><b id="spEqSL">${n(s.faulty_quantity)}</b></div><div><span>Sağlam</span><b id="spEqAL">${healthy(s)}</b></div><div><span>Boşta</span><b id="spEqAV">${available(s)}</b></div></div></div><label style="display:block;margin-top:14px">Not<textarea id="spEqNotes" rows="3">${esc(s.notes||'')}</textarea></label><div class="sp-inv-actions"><button class="btn btn-primary" type="button" onclick="window.spInventorySave('${e?.id||''}')">Kaydet</button>${e?`<button class="btn btn-danger" type="button" onclick="window.spInventoryDelete('${e.id}')">Sil</button>`:''}<button class="btn" type="button" onclick="window.spInventoryClose()">İptal</button></div></div></div>`);['spEqQty','spEqFault','spEqMaint','spEqReserved','spEqUse'].forEach(k=>$('#'+k)?.addEventListener('input',()=>{const t=n($('#spEqQty').value),f=n($('#spEqFault').value),m=n($('#spEqMaint').value),r=n($('#spEqReserved').value),u=n($('#spEqUse').value);$('#spEqTL').textContent=t;$('#spEqSL').textContent=f;$('#spEqAL').textContent=Math.max(0,t-f-m);$('#spEqAV').textContent=Math.max(0,t-f-m-r-u)}))};
  window.spInventoryClose=()=>document.getElementById('spInvModal')?.remove();
  window.spInventorySave=async id=>{try{const p={category:$('#spEqCat').value.trim(),brand:$('#spEqBrand').value.trim()||null,model:$('#spEqModel').value.trim()||null,quantity:n($('#spEqQty').value),active:$('#spEqActive').value==='1',notes:$('#spEqNotes').value.trim()||null,faulty_quantity:n($('#spEqFault').value),maintenance_quantity:n($('#spEqMaint').value),reserved_quantity:n($('#spEqReserved').value),in_use_quantity:n($('#spEqUse').value),updated_at:new Date().toISOString()};if(!p.category)return toast('Kategori zorunlu',false);if(p.faulty_quantity+p.maintenance_quantity+p.reserved_quantity+p.in_use_quantity>p.quantity)return toast('Durum adetleri toplam adedi aşamaz.',false);const r=id?await sb.from('equipment').update(p).eq('id',id):await sb.from('equipment').insert([p]);if(r.error){console.error('Inventory save failed',r.error);return toast('Kaydedilemedi: '+r.error.message,false)}toast(id?'Ekipman güncellendi.':'Ekipman eklendi.');window.spInventoryClose();window.dispatchEvent(new CustomEvent('stagepulse:inventory-changed'));await load()}catch(err){console.error('Inventory save exception',err);toast('Kaydetme hatası: '+(err?.message||String(err)),false)}};
  window.spInventoryDelete=async id=>{if(!confirm('Bu ekipman kaydı silinsin mi?'))return;const r=await sb.from('equipment').delete().eq('id',id);if(r.error)return toast('Silinemedi: '+r.error.message,false);toast('Ekipman silindi.');window.spInventoryClose();await load()};
  window.equipmentView=async()=>{page=0;await load()};
  window.addEventListener('stagepulse:inventory-changed',()=>{if(location.hash==='#equipment')load()});
})();

/* ===== END admin/inventory-ui-v4.js ===== */

/* ===== BEGIN admin/admin-service-bom.js ===== */
/* Admin Fiyatlandırma: hizmet altına varsayılan malzeme adedi */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  async function loadBom(serviceId) {
    const { data } = await sb.from('service_equipment_defaults').select('id,equipment_id,quantity,notes').eq('service_id', serviceId);
    return data || [];
  }

  async function ensureBomPanel() {
    const content = document.querySelector('#content');
    if (!content || !/Fiyatlandırma/.test(content.innerHTML || '')) return;
    if (document.querySelector('#spServiceBomPanel')) return;

    const { data: eq } = await sb.from('equipment').select('id,category,brand,model').eq('active', true).order('category');
    const equipment = eq || [];
    const services = window.services || [];
    if (!services.length) return;

    const host = document.createElement('div');
    host.id = 'spServiceBomPanel';
    host.className = 'panel';
    host.style.marginTop = '16px';
    host.innerHTML = `
      <h3>Hizmet malzeme varsayılanları</h3>
      <p class="muted small">Ses / Işık / Truss için işe gidecek tahmini malzeme. Portal fiyat listesinde görünür.</p>
      <div id="spBomRows"></div>
      <div class="actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <label style="flex:1;min-width:140px">Hizmet
          <select id="spBomSvc">${services.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        </label>
        <label style="flex:1;min-width:160px">Ekipman
          <select id="spBomEq">${equipment.map((e) => `<option value="${e.id}">${esc([e.category, e.brand, e.model].filter(Boolean).join(' · '))}</option>`).join('')}</select>
        </label>
        <label>Adet<input id="spBomQty" type="number" min="0.5" step="0.5" value="1" style="width:80px"></label>
        <button type="button" class="btn btn-primary" id="spBomAdd">Ekle</button>
      </div>`;
    content.appendChild(host);

    async function renderList() {
      const svcId = document.querySelector('#spBomSvc')?.value;
      const rows = await loadBom(svcId);
      const box = document.querySelector('#spBomRows');
      if (!box) return;
      box.innerHTML = rows.map((r) => {
        const e = equipment.find((x) => x.id === r.equipment_id);
        const label = e ? [e.category, e.brand, e.model].filter(Boolean).join(' · ') : r.equipment_id;
        return `<div class="price-row" style="gap:8px"><span style="flex:1">${esc(label)}</span><b>× ${num(r.quantity)}</b>
          <button type="button" class="btn btn-danger" data-del="${r.id}">×</button></div>`;
      }).join('') || '<p class="muted small">Bu hizmet için malzeme yok.</p>';
      box.querySelectorAll('[data-del]').forEach((btn) => {
        btn.onclick = async () => {
          await sb.from('service_equipment_defaults').delete().eq('id', btn.dataset.del);
          if (typeof toast === 'function') toast('Silindi');
          renderList();
        };
      });
    }

    document.querySelector('#spBomSvc')?.addEventListener('change', renderList);
    document.querySelector('#spBomAdd')?.addEventListener('click', async () => {
      const service_id = document.querySelector('#spBomSvc')?.value;
      const equipment_id = document.querySelector('#spBomEq')?.value;
      const quantity = num(document.querySelector('#spBomQty')?.value) || 1;
      if (!service_id || !equipment_id) return;
      const { error } = await sb.from('service_equipment_defaults').upsert(
        { service_id, equipment_id, quantity },
        { onConflict: 'service_id,equipment_id' }
      );
      if (error) return typeof toast === 'function' && toast(error.message, false);
      if (typeof toast === 'function') toast('Malzeme eklendi');
      renderList();
    });
    renderList();
  }

  window.addEventListener('load', () => {
    const c = document.querySelector('#content');
    if (c) new MutationObserver(() => setTimeout(ensureBomPanel, 250)).observe(c, { childList: true, subtree: true });
    setTimeout(ensureBomPanel, 600);
  });
})();

/* ===== END admin/admin-service-bom.js ===== */

/* ===== BEGIN admin/admin-offer-wa-edit.js ===== */
/* Admin: teklif düzenleme + ekip fiyat + müşteri WhatsApp + takvim işi */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>'\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[c]));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const money = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(v) || 0);
  function waPhone(raw) { let d=String(raw||'').replace(/\D/g,''); if(!d)return ''; if(d.startsWith('00'))d=d.slice(2); if(d.startsWith('0')&&d.length===11)d='90'+d.slice(1); if(d.length===10&&d.startsWith('5'))d='90'+d; if(!d.startsWith('90')&&d.length>=10)d='90'+d.replace(/^0+/,''); return d; }
  function statusMap() { return (typeof statuses==='object'&&statuses)||{new:'Yeni',reviewing:'İncelemede',preparing:'Hazırlanıyor',sent:'Gönderildi',accepted:'Kabul',rejected:'Red',cancelled:'İptal',archived:'Arşiv',expired:'Süresi doldu'}; }
  let offerStore = [];
  async function getOffers() { if (typeof sb === 'undefined' || !sb) throw new Error('Yönetim bağlantısı hazır değil.'); const { data, error } = await sb.from('teklifler').select('*').order('created_at', { ascending: false }).limit(1000); if (error) throw error; offerStore = Array.isArray(data) ? data : []; window.offers = offerStore; return offerStore; }
  function currentOffers() { return offerStore; }
  async function newOffer() { await getOffers(); const services = await loadPricingContext(); document.getElementById('offerModal')?.remove(); const serviceOpts = ['<option value="">— Hizmet seç —</option>'].concat((services.services||[]).map(s=>`<option value="${esc(s.name)}">${esc(s.name)} (${money(s.base_price)})</option>`)).join(''); document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal"><div class="modal-card" style="max-width:820px;max-height:92vh;overflow:auto"><button class="close" type="button" data-offer-close aria-label="Kapat">×</button><div class="modal-top"><div><div class="muted small">YENİ TEKLİF</div><h2>Yeni Teklif</h2></div></div><div class="grid2"><div class="panel"><h3>Müşteri</h3><label>Ad<input id="newOfferName" required></label><label>Telefon<input id="newOfferPhone" inputmode="tel" required></label><label>Firma<input id="newOfferCompany"></label><label>E-posta<input id="newOfferEmail" type="email"></label><label>Lokasyon<input id="newOfferLocation"></label><label>Seyirci / katılımcı<input id="newOfferPeople" type="number" min="0"></label></div><div class="panel"><h3>Etkinlik & fiyat</h3><label>Etkinlik tarihi<input id="newOfferEventDate" type="date"></label><label>Etkinlik türü<input id="newOfferEventType" placeholder="Düğün, konser…"></label><label>Hizmet<select id="newOfferType">${serviceOpts}</select></label><label>Toplam (₺)<input id="newOfferTotal" type="number" min="0" step="100" value="0"></label><label>Geçerlilik<input id="newOfferValid" type="date"></label></div></div><div class="panel"><label>Talep / not<textarea id="newOfferMessage" rows="4"></textarea></label></div><div class="modal-actions"><button class="btn btn-primary" type="button" id="newOfferSave">Teklifi oluştur</button><button class="btn" type="button" data-offer-close>İptal</button></div></div></div>`); const m=document.getElementById('offerModal'); const close=()=>m?.remove(); m?.querySelectorAll('[data-offer-close]').forEach(b=>b.addEventListener('click',close)); m?.querySelector('#newOfferSave')?.addEventListener('click',async()=>{const name=$('#newOfferName')?.value.trim(),phone=$('#newOfferPhone')?.value.trim();if(!name||!phone)return toast?.('Ad ve telefon zorunlu.',false);const total=num($('#newOfferTotal')?.value),eventDate=$('#newOfferEventDate')?.value||null,valid=$('#newOfferValid')?.value||null;const payload={name,phone,company:$('#newOfferCompany')?.value.trim()||null,email:$('#newOfferEmail')?.value.trim()||null,location:$('#newOfferLocation')?.value.trim()||null,people:num($('#newOfferPeople')?.value)||null,event_date:eventDate,event_type:$('#newOfferEventType')?.value.trim()||null,type:$('#newOfferType')?.value||null,total,estimated_price:total,margin:0,status:'new',valid_until:valid,message:$('#newOfferMessage')?.value.trim()||null,services:[]};const {data,error}=await sb.from('teklifler').insert([payload]).select('*').single();if(error)return toast?.(error.message,false);offerStore.unshift(data);window.offers=offerStore;close();toast?.('Teklif oluşturuldu.');await window.loadView?.('offers');}); }
  async function ensureJobFromOffer(o){if(!o?.id||typeof sb==='undefined')return{ok:false,reason:'no-offer'};try{const{data:existing,error:e1}=await sb.from('jobs').select('id').eq('offer_id',o.id).limit(1);if(e1)return{ok:false,reason:e1.message};if(existing?.length)return{ok:true,id:existing[0].id,created:false};try{const{data:rid,error:rpcErr}=await sb.rpc('ensure_job_for_offer',{p_offer_id:o.id});if(!rpcErr&&rid)return{ok:true,id:rid,created:true};}catch(_){}const d=o.event_date||null,at=hm=>(d?new Date(`${d}T${hm}:00`).toISOString():null),title=[o.quote_number,o.name,o.type].filter(Boolean).join(' · ')||'İş',payload={offer_id:o.id,title,location:o.location||null,setup_at:at('14:00'),event_at:at('18:00'),teardown_at:at('23:00'),status:'planned',notes:o.message||null};const{data:row,error}=await sb.from('jobs').insert([payload]).select('id').single();if(error)return{ok:false,reason:error.message};return{ok:true,id:row?.id,created:true};}catch(e){return{ok:false,reason:e.message||String(e)}}}
  async function addOfferToCalendar(id){const o=currentOffers().find(x=>x.id===id);if(!o)return typeof toast==='function'&&toast('Teklif yok',false);const snap={...o,id,name:($('#editName')?.value||o.name||'').trim(),location:($('#editLocation')?.value||o.location||'').trim()||null,type:($('#editType')?.value||o.type||'').trim()||null,event_date:$('#editEventDate')?.value||o.event_date||null,message:($('#editMessage')?.value||o.message||'').trim()||null,quote_number:o.quote_number};if(!snap.event_date)return typeof toast==='function'&&toast('Önce etkinlik tarihi girin',false);const update=await sb.from('teklifler').update({event_date:snap.event_date,location:snap.location,type:snap.type,message:snap.message,updated_at:new Date().toISOString()}).eq('id',id);if(update.error)return toast?.(update.error.message,false);Object.assign(o,snap);const r=await ensureJobFromOffer(snap);if(!r.ok)return typeof toast==='function'&&toast('Takvime eklenemedi: '+(r.reason||''),false);if(typeof toast==='function')toast(r.created?'Takvime iş eklendi':'Bu teklif zaten takvimde');}
  async function loadPricingContext(){const out={services:[],rules:{},crewDefault:3,perCrew:1500,setup:2500,teardown:1500,minQuote:0,marginPct:35};try{const[{data:svc},{data:rules}]=await Promise.all([sb.from('services').select('id,name,base_price,base_cost,active').eq('active',true).order('sort_order'),sb.from('price_rules').select('name,value,active')]);out.services=svc||[];for(const r of rules||[])if(r.active)out.rules[r.name]=num(r.value);out.crewDefault=num(out.rules['Varsayılan ekip sayısı'])||3;out.perCrew=num(out.rules['Kişi başı ek ücret'])||1500;out.setup=num(out.rules['Kurulum'])||2500;out.teardown=num(out.rules['Söküm'])||1500;out.minQuote=num(out.rules['Minimum teklif']);out.marginPct=num(out.rules['Varsayılan kâr marjı'])||35;out.crewDefault=Math.max(1,Math.min(12,out.crewDefault));}catch(e){console.error('pricing context',e)}return out;}
  function computePrice(ctx,serviceName,crew){const svc=(ctx.services||[]).find(s=>s.name===serviceName);let base=num(svc?.base_price);if(!base&&serviceName)base=35000;if(!base&&!serviceName)base=40000;const c=Math.min(12,Math.max(1,num(crew)||ctx.crewDefault||3));let price=base+num(ctx.setup)+num(ctx.teardown)+(c*num(ctx.perCrew));if(price>0&&ctx.minQuote>0&&price<ctx.minQuote)price=ctx.minQuote;let cost=ctx.marginPct>0&&price>0?Math.round((price/(1+ctx.marginPct/100))*100)/100:num(svc?.base_cost);return{base,crew:c,setup:num(ctx.setup),teardown:num(ctx.teardown),perCrew:num(ctx.perCrew),total:Math.round(price*100)/100,cost,margin:Math.round((price-cost)*100)/100};}
  function renderBreakdown(calc){const el=$('#spPriceBreakdown');if(!el||!calc)return;el.innerHTML=`<div class="muted small" style="line-height:1.55"><b>Hesap özeti</b> (seyirci fiyata girmez · ortalama paket ~40.000 ₺ bandı)<br>Hizmet tabanı: <b>${money(calc.base)}</b><br>Kurulum: <b>${money(calc.setup)}</b> · Söküm: <b>${money(calc.teardown)}</b><br>Ekip: <b>${calc.crew}</b> × ${money(calc.perCrew)} = <b>${money(calc.crew*calc.perCrew)}</b><br><span style="font-size:15px;color:#ffb000">Önerilen toplam: <b>${money(calc.total)}</b></span> · Kâr ~ ${money(calc.margin)}</div>`;}
  function workScopeHtml(o){const parts=[];if(o.type)parts.push(`<li><b>Hizmet:</b> ${esc(o.type)}</li>`);if(o.event_type)parts.push(`<li><b>Etkinlik türü:</b> ${esc(o.event_type)}</li>`);if(o.location)parts.push(`<li><b>Lokasyon:</b> ${esc(o.location)}</li>`);if(o.event_date)parts.push(`<li><b>Tarih:</b> ${esc(o.event_date)}</li>`);if(o.people)parts.push(`<li><b>Tahmini seyirci:</b> ${esc(o.people)} (bilgi)</li>`);if(o.message)parts.push(`<li><b>Talep / yapılacak iş:</b> ${esc(o.message)}</li>`);if(!parts.length)parts.push('<li>Kapsam admin tarafından netleştirilecek.</li>');return `<ul style="margin:8px 0 0 18px;padding:0;line-height:1.55">${parts.join('')}</ul>`;}
  async function openWhatsAppToCustomer(id){const o=currentOffers().find(x=>x.id===id);if(!o)return typeof toast==='function'&&toast('Teklif bulunamadı',false);const phone=waPhone(o.phone);if(!phone||phone.length<12)return typeof toast==='function'&&toast('Müşteri telefonu yok veya geçersiz. Önce kaydedin.',false);const origin=location.origin.replace(/\/$/,''),link=o.public_token?`${origin}/teklif-view.html?token=${o.public_token}`:'',msg=[`Merhaba ${o.name||''},`,`Stagepulse teklifiniz hazır${o.quote_number?` (${o.quote_number})`:''}.`,o.type?`Hizmet: ${o.type}`:null,o.total!=null&&Number(o.total)>0?`Toplam: ${money(o.total)}`:null,o.event_date?`Etkinlik: ${o.event_date}`:null,o.location?`Lokasyon: ${o.location}`:null,link?`Detaylı teklif / onay: ${link}`:null,'','Teklif PDF olarak da iletilecektir.','Sorularınız için yazabilirsiniz.','Stagepulse'].filter(x=>x!=null).join('\n');if(typeof window.openOfferPdf==='function'){try{window.openOfferPdf(id)}catch(e){console.warn(e)}}window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener');if(o.status&&!['accepted','rejected','cancelled','archived'].includes(o.status)&&o.status!=='sent'){sb.from('teklifler').update({status:'sent',updated_at:new Date().toISOString()}).eq('id',id).then(({error})=>{if(!error&&Array.isArray(offerStore)){const row=offerStore.find(x=>x.id===id);if(row)row.status='sent';}if(typeof toast==='function')toast(error?'WhatsApp açıldı (durum güncellenemedi)':'PDF + WhatsApp müşteriye · durum: Gönderildi');});}else if(typeof toast==='function')toast('PDF + WhatsApp müşteriye açıldı');}
  async function saveOfferFull(id){const o=currentOffers().find(x=>x.id===id);if(!o)return typeof toast==='function'&&toast('Teklif yok',false);const newStatus=$('#editStatus')?.value||o.status||'new',wasAccepted=o.status==='accepted',total=num($('#editTotal')?.value);if(total>1000000&&!confirm('Toplam 1.000.000 ₺ üzerinde. Eski seyirci×ücret hatası olabilir. Yine de kaydedilsin mi?'))return;const payload={name:($('#editName')?.value||o.name||'').trim(),phone:($('#editPhone')?.value||o.phone||'').trim(),company:($('#editCompany')?.value||'').trim()||null,email:($('#editEmail')?.value||'').trim()||null,location:($('#editLocation')?.value||'').trim()||null,type:($('#editType')?.value||'').trim()||null,event_type:($('#editEventType')?.value||'').trim()||null,people:num($('#editPeople')?.value)||null,event_date:$('#editEventDate')?.value||null,total,margin:num($('#editMargin')?.value),estimated_price:total,estimated_cost:num($('#editCost')?.value)||null,valid_until:$('#editValid')?.value||null,status:newStatus,message:($('#editMessage')?.value||'').trim(),updated_at:new Date().toISOString(),accepted_at:newStatus==='accepted'?(o.accepted_at||new Date().toISOString()):null,rejected_at:newStatus==='rejected'?new Date().toISOString():null};const{error}=await sb.from('teklifler').update(payload).eq('id',id);if(error)return typeof toast==='function'&&toast(error.message,false);Object.assign(o,payload);if(typeof log==='function'){try{await log('offer_update','teklifler',id,payload)}catch(_){}}let jobNote='';if(newStatus==='accepted'||payload.event_date){const jr=await ensureJobFromOffer({...o,...payload,id});if(jr.ok&&jr.created)jobNote=' · Takvime eklendi';else if(!jr.ok&&newStatus==='accepted')jobNote=' · Takvim: '+(jr.reason||'eklenemedi');}if(newStatus==='accepted'&&!wasAccepted&&typeof ensureSettlementFromOffer==='function'){const created=await ensureSettlementFromOffer({...o,...payload,id,total:payload.total});if(typeof toast==='function')toast((created?'Kaydedildi · Gelir·Gider’e eklendi':'Kaydedildi')+jobNote)}else if(wasAccepted&&newStatus!=='accepted'){await sb.from('settlements').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('offer_id',id).neq('status','closed');if(typeof toast==='function')toast('Kaydedildi · Mutabakat iptal'+jobNote)}else{if(newStatus==='accepted'&&num(o.total)!==payload.total)await sb.from('settlements').update({agreed_amount:payload.total,updated_at:new Date().toISOString()}).eq('offer_id',id).eq('status','open');if(typeof toast==='function')toast('Kaydedildi'+jobNote)}$('#offerModal')?.remove();await getOffers();try{if(typeof getSettlements==='function')await getSettlements()}catch(_) {}}
  async function openOfferEditable(id){await getOffers();const o=currentOffers().find(x=>x.id===id);if(!o)return typeof toast==='function'&&toast('Teklif bulunamadı.',false);if(typeof getSettings==='function')await getSettings();const ctx=await loadPricingContext(),inflated=num(o.total)>1000000;$('#offerModal')?.remove();const st=statusMap();const statusOpts=Object.entries(st).map(([k,v])=>`<option value="${esc(k)}" ${o.status===k?'selected':''}>${esc(v)}</option>`).join('');const serviceOpts=['<option value="">— Hizmet seç —</option>'].concat((ctx.services||[]).map(s=>`<option value="${esc(s.name)}" ${o.type===s.name?'selected':''}>${esc(s.name)} (${money(s.base_price)})</option>`)).join('');const crewInit=Math.max(1,Math.min(12,num(o.crew_count)||ctx.crewDefault||3));document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="offerModal"><div class="modal-card" style="max-width:820px;max-height:92vh;overflow:auto"><button class="close" type="button" onclick="document.querySelector('#offerModal')?.remove()">×</button><div class="modal-top"><div><div class="muted small">${esc(o.quote_number||'')}</div><h2>${esc(o.name||'Teklif')}</h2></div><span class="status ${esc(o.status||'')}">${esc(st[o.status]||o.status||'')}</span></div>${inflated?`<div class="notice" style="margin:10px 0;padding:10px 12px;border:1px solid #a33;border-radius:10px;background:#2a1111;color:#fcc"><b>Uyarı:</b> Toplam ${money(o.total)} — eski seyirci×ücret hatası olabilir. <b>Fiyatı yeniden hesapla</b> ile ~40.000 ₺ bandına çekin.</div>`:''}<div class="grid2"><div class="panel"><h3>Müşteri</h3><label>Ad<input id="editName" value="${esc(o.name||'')}"></label><label>Telefon (WhatsApp)<input id="editPhone" value="${esc(o.phone||'')}" inputmode="tel" placeholder="05xx..."></label><label>Firma<input id="editCompany" value="${esc(o.company||'')}"></label><label>E-posta<input id="editEmail" type="email" value="${esc(o.email||'')}"></label><label>Lokasyon<input id="editLocation" value="${esc(o.location||'')}"></label><label>Seyirci / katılımcı <span class="muted">(bilgi — fiyata girmez)</span><input id="editPeople" type="number" min="0" value="${num(o.people)}"></label><label>Etkinlik tarihi<input id="editEventDate" type="date" value="${esc(o.event_date||'')}"></label><label>Etkinlik türü<input id="editEventType" value="${esc(o.event_type||'')}" placeholder="Düğün, konser…"></label></div><div class="panel"><h3>Hizmet & fiyat</h3><label>Hizmet<select id="editType">${serviceOpts}</select></label><label>Ekip sayısı (çalışan)<input id="editCrew" type="number" min="1" max="12" step="1" value="${crewInit}"></label><p class="muted small" style="margin:4px 0 8px">Gelen talep = 0 ₺. Öneri: taban + kurulum + söküm + ekip × kişi başı.</p><div id="spPriceBreakdown" style="margin-bottom:10px"></div><button type="button" class="btn" id="spRecalcBtn" style="margin-bottom:12px">Fiyatı yeniden hesapla</button><label>Toplam (₺)<input type="number" id="editTotal" value="${inflated?0:num(o.total)}" min="0" step="100"></label><label>Maliyet (₺)<input type="number" id="editCost" value="${num(o.estimated_cost)}" min="0" step="100"></label><label>Kâr (₺)<input type="number" id="editMargin" value="${inflated?0:num(o.margin)}" step="100"></label><label>Geçerlilik<input type="date" id="editValid" value="${esc(o.valid_until||'')}"></label><label>Durum<select id="editStatus">${statusOpts}</select></label></div></div><div class="panel" style="margin-top:14px"><h3>Yapılacak iş / müşteri notu</h3><textarea id="editMessage" rows="4" placeholder="Kurulum saati, sahne ölçüleri, istekler…">${esc(o.message||'')}</textarea></div><div class="modal-actions" style="flex-wrap:wrap;gap:8px"><button class="btn btn-primary" type="button" onclick="saveOffer('${o.id}')">Kaydet</button><button class="btn" type="button" onclick="addOfferToCalendar('${o.id}')">Takvime ekle</button><button class="btn btn-primary" type="button" id="spWaSendBtn">PDF + WhatsApp gönder</button><button class="btn" type="button" onclick="copyPublicLink('${o.id}')">Bağlantı kopyala</button><button class="btn" type="button" data-offer-action="detailed-pdf" data-offer-id="${esc(o.id)}">Detaylı PDF</button><button class="btn" type="button" onclick="settlementFromOffer('${o.id}')">Gelir/Gider’e aktar</button><button class="btn btn-danger" type="button" onclick="deleteOffer('${o.id}')">Sil</button></div></div>`);const modal=$('#offerModal');if(modal)modal.dataset.offerId=String(o.id);const applyCalc=()=>{const type=$('#editType')?.value||o.type||'',crew=num($('#editCrew')?.value)||ctx.crewDefault,calc=computePrice(ctx,type,crew);renderBreakdown(calc);return calc;};$('#spRecalcBtn')?.addEventListener('click',()=>{const calc=applyCalc();if($('#editTotal'))$('#editTotal').value=String(calc.total);if($('#editCost'))$('#editCost').value=String(calc.cost);if($('#editMargin'))$('#editMargin').value=String(calc.margin);toast?.('Önerilen fiyat dolduruldu')});$('#editType')?.addEventListener('change',applyCalc);$('#editCrew')?.addEventListener('input',applyCalc);applyCalc();if(inflated){const calc=applyCalc();if($('#editTotal'))$('#editTotal').value=String(calc.total);if($('#editCost'))$('#editCost').value=String(calc.cost);if($('#editMargin'))$('#editMargin').value=String(calc.margin)}$('#spWaSendBtn')?.addEventListener('click',async()=>{const phone=($('#editPhone')?.value||'').trim();if(phone){const total=num($('#editTotal')?.value);const{error}=await sb.from('teklifler').update({name:($('#editName')?.value||'').trim(),phone,total,estimated_price:total,message:($('#editMessage')?.value||'').trim(),location:($('#editLocation')?.value||'').trim()||null,event_date:$('#editEventDate')?.value||null,type:($('#editType')?.value||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',id);if(error)return toast?.(error.message,false);Object.assign(o,{name:($('#editName')?.value||'').trim(),phone,total,message:($('#editMessage')?.value||'').trim(),type:($('#editType')?.value||'').trim()||null});}await openWhatsAppToCustomer(id)});modal?.addEventListener('click',(e)=>{const btn=e.target.closest('[data-offer-action="detailed-pdf"]');if(!btn)return;e.preventDefault();e.stopPropagation();const offerId=btn.getAttribute('data-offer-id');if(typeof window.openOfferPdf==='function')window.openOfferPdf(offerId);else toast?.('PDF modülü henüz yüklenmedi.',false)});}
  async function copyPublicLink(id){const o=currentOffers().find(x=>x.id===id);if(!o)return toast?.('Teklif bulunamadı.',false);let token=o.public_token;if(!token){try{const{data,error}=await sb.from('teklifler').select('public_token').eq('id',id).maybeSingle();if(error)throw error;token=data?.public_token||''}catch(e){return toast?.(e.message||'Public bağlantı alınamadı.',false)}}if(!token)return toast?.('Bu teklif için public bağlantı oluşturulmamış.',false);const url=`${location.origin}/teklif-view.html?token=${encodeURIComponent(token)}`;try{await navigator.clipboard.writeText(url)}catch(_){const ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}toast?.('Public teklif bağlantısı kopyalandı.')}
  async function settlementFromOffer(id){const o=currentOffers().find(x=>x.id===id);if(!o)return toast?.('Teklif bulunamadı.',false);try{const{data:existing,error:findError}=await sb.from('settlements').select('id,status').eq('offer_id',id).limit(1);if(findError)throw findError;if(existing?.length){await window.loadView?.('settlements');return toast?.('Bu teklif zaten Gelir/Gider kayıtlarında.')};const{error}=await sb.from('settlements').insert([{title:o.quote_number||o.name||'Teklif',offer_id:id,event_date:o.event_date||null,location:o.location||null,agreed_amount:num(o.total),expense_amount:0,status:'open',notes:o.message||null,updated_at:new Date().toISOString()}]);if(error)throw error;toast?.('Teklif Gelir/Gider’e aktarıldı.');await window.loadView?.('settlements')}catch(e){toast?.(e.message||'Gelir/Gider kaydı oluşturulamadı.',false)}}
  async function deleteOffer(id){if(!id)return;if(!confirm('Bu teklif arşivlensin mi?'))return;try{const{data,error}=await sb.rpc('admin_delete_offer',{p_offer_id:id});if(error)throw error;if(data!==true&&data!==null)throw new Error('Teklif silinemedi veya yetkiniz yok.');offerStore=offerStore.filter(x=>x.id!==id);window.offers=offerStore;document.getElementById('offerModal')?.remove();toast?.('Teklif arşivlendi.');await window.loadView?.('offers')}catch(e){toast?.(e.message||'Teklif arşivlenemedi.',false)}}
  function rebindOfferPatches(){window.offers=offerStore;window.getOffers=getOffers;window.newOffer=newOffer;window.openOffer=openOfferEditable;window.openOfferEditable=openOfferEditable;window.saveOffer=saveOfferFull;window.createPDF=window.openOfferPdf||window.createPDF;window.openWhatsApp=openWhatsAppToCustomer;window.addOfferToCalendar=addOfferToCalendar;window.ensureJobFromOffer=ensureJobFromOffer;window.copyPublicLink=copyPublicLink;window.settlementFromOffer=settlementFromOffer;window.deleteOffer=deleteOffer;}
  rebindOfferPatches(); getOffers().catch(e=>console.warn('[Stagepulse offers] initial load:', e.message)); window.addEventListener('stagepulse-admin-ready',rebindOfferPatches);window.addEventListener('load',rebindOfferPatches);let __spRebindN=0;const __spRebindT=setInterval(()=>{rebindOfferPatches();if(++__spRebindN>80)clearInterval(__spRebindT)},250);
})();
/* ===== END admin/admin-offer-wa-edit.js ===== */

/* ===== BEGIN admin/admin-offer-pdf-v1.js ===== */
/* Stagepulse Admin — canonical offer PDF control. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(n(v));
  const client=()=>window.StagepulseAdminSupabase?.getClient?.()||window.sb||window.__stagepulseAdminClient||window.supabaseClient;
  const hasCan=k=>typeof window.can!=='function'||window.can(k)||window.can('offers.manage');
  const invoke=async(name,body)=>{const c=client();if(!c?.functions?.invoke)throw new Error('Admin Supabase bağlantısı hazır değil.');const r=await c.functions.invoke(name,{body});if(r.error)throw r.error;return r.data||{};};
  async function state(id){return invoke('admin-offer-runtime',{action:'get_offer_state',offer_id:id});}
  async function inv(id){return invoke('admin-offer-runtime',{action:'get_inventory',offer_id:id})||[];}
  async function photos(id){const c=client();const {data,error}=await c.from('offer_attachments').select('id,storage_path,file_name,mime_type,size_bytes,sort_order,customer_visible').eq('offer_id',id).order('sort_order').order('created_at');if(error)throw error;return data||[];}
  async function signedPdf(path,download=false){const {data,error}=await client().storage.from('offer-pdfs').createSignedUrl(path,900,{download});if(error)throw error;return data.signedUrl;}
  async function signedAsset(path){const {data,error}=await client().storage.from('offer-assets').createSignedUrl(path,900);if(error)throw error;return data.signedUrl;}
  async function open(id){if(!hasCan('offers.pdf.preview')&&!hasCan('offers.pdf.download')&&!hasCan('offers.pdf.generate')&&!hasCan('offers.equipment')&&!hasCan('offers.crew'))return toast('Teklif yönetim yetkiniz yok.',false);try{const [s,items,ph]=await Promise.all([state(id),inv(id),photos(id)]);document.getElementById('spOfferPdfModal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="spOfferPdfModal"><div class="modal-card" style="max-width:1120px;max-height:94vh;overflow:auto"><button class="close" id="spOfferPdfClose">×</button><div class="modal-top"><div><span class="muted small">TEKLİF KONTROLÜ</span><h2>${esc(s.quote_number||'Teklif')}</h2></div></div><section class="sp-op-panel"><h3>PDF</h3><p class="muted">PDF sunucuda güncel teklif verileriyle oluşturulur.</p><div class="sp-op-actions"><button class="btn" id="spPdfPreview">Önizleme</button><button class="btn" id="spPdfDownload">İndir</button><button class="btn btn-primary" id="spPdfGenerate">PDF oluştur / yenile</button></div><div class="panel" style="margin-top:10px"><b>Güncel dosya:</b> ${esc(s.pdf_file_name||'Henüz yok')}<br><span class="muted small">${s.pdf_updated_at?new Date(s.pdf_updated_at).toLocaleString('tr-TR'):'PDF oluşturulmadı'}</span></div><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="spPdfVisible" ${s.customer_visible!==false?'checked':''}> Müşteriye göster</label><button class="btn" id="spPdfSaveVisibility" style="margin-top:8px">Bu durumu kaydet</button></section><section class="sp-op-panel" style="margin-top:12px"><h3>Teklif personeli</h3><div style="display:flex;gap:8px;align-items:center"><input id="spOfferCrew" type="number" min="0" max="99" value="${n(s.crew_count||0)}" style="max-width:140px"><button class="btn btn-primary" id="spOfferCrewSave">Kaydet</button></div><h3 style="margin-top:18px">Envanter</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Ekipman</th><th>İstenen</th><th>Mevcut</th><th>Rezerve</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc([x.category,x.brand,x.model].filter(Boolean).join(' · '))}</td><td>${n(x.requested_qty)}</td><td>${n(x.available_qty)}</td><td>${n(x.reserved_qty)}</td><td><button class="btn" data-sp-reserve="${esc(x.equipment_id)}" data-sp-reserved="${n(x.reserved_qty)}">Rezerv</button><button class="btn" data-sp-remove="${esc(x.equipment_id)}" style="margin-left:4px">Sil</button></td></tr>`).join('')||'<tr><td colspan="5">Ekipman eklenmemiş.</td></tr>'}</tbody></table></div><button class="btn" id="spOfferEquipmentAdd">Envanterden ekipman ekle</button></section><section class="sp-op-panel" style="margin-top:12px"><h3>Teklif fotoğrafları</h3><input id="spOfferPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="sp-op-photos">${ph.map(p=>`<div class="sp-op-photo"><img src="" data-photo-path="${esc(p.storage_path)}"><div><label><input type="checkbox" data-photo-visible="${esc(p.id)}" ${p.customer_visible!==false?'checked':''}> Müşteri</label><button class="btn" data-photo-delete="${esc(p.id)}">Sil</button></div></div>`).join('')||'<div>Fotoğraf yok.</div>'}</div></section></div></div>`);document.getElementById('spOfferPdfClose').onclick=()=>document.getElementById('spOfferPdfModal')?.remove();document.getElementById('spPdfGenerate').onclick=()=>generate(id);document.getElementById('spPdfPreview').onclick=()=>previewCurrent(id);document.getElementById('spPdfDownload').onclick=()=>downloadCurrent(id);document.getElementById('spPdfSaveVisibility').onclick=()=>setVisible(id,document.getElementById('spPdfVisible').checked);document.getElementById('spOfferCrewSave').onclick=()=>setCrew(id,n(document.getElementById('spOfferCrew').value));document.querySelectorAll('[data-sp-reserve]').forEach(b=>b.onclick=()=>reserve(id,b.dataset.spReserve,n(prompt('Rezerve edilecek adet?',b.dataset.spReserved||'0')||0)));document.querySelectorAll('[data-sp-remove]').forEach(b=>b.onclick=()=>removeEquipment(id,b.dataset.spRemove));document.getElementById('spOfferEquipmentAdd').onclick=()=>addEquipment(id);document.getElementById('spOfferPhotos').onchange=e=>uploadPhotos(id,[...(e.target.files||[])]);document.querySelectorAll('[data-photo-visible]').forEach(e=>e.onchange=()=>setPhotoVisible(e.dataset.photoVisible,e.checked));document.querySelectorAll('[data-photo-delete]').forEach(e=>e.onclick=()=>deletePhoto(e.dataset.photoDelete,id));await hydratePhotoPreviews();}catch(e){toast(e.message||String(e),false)}}
  async function hydratePhotoPreviews(){for(const img of document.querySelectorAll('[data-photo-path]')){try{img.src=await signedAsset(img.dataset.photoPath)}catch{img.alt='Önizleme yok'}}}
  async function generate(id){if(!hasCan('offers.pdf.generate'))return toast('PDF oluşturma yetkiniz yok.',false);try{const d=await invoke('offer-pdf',{offer_id:id});if(!d.ok)throw new Error(d.error||'PDF oluşturulamadı.');toast('PDF güncellendi.');open(id);}catch(e){toast('PDF güncellenemedi: '+(e.message||String(e)),false)}}
  async function previewCurrent(id){if(!hasCan('offers.pdf.preview'))return;try{const s=await state(id);if(!s.pdf_storage_path)return toast('Önizlenecek PDF yok.',false);window.open(await signedPdf(s.pdf_storage_path,false),'_blank','noopener')}catch(e){toast(e.message||String(e),false)}}
  async function downloadCurrent(id){if(!hasCan('offers.pdf.download'))return;try{const s=await state(id);if(!s.pdf_storage_path)return toast('İndirilecek PDF yok.',false);window.open(await signedPdf(s.pdf_storage_path,true),'_blank','noopener')}catch(e){toast(e.message||String(e),false)}}
  async function setVisible(id,value){if(!hasCan('offers.pdf.visibility'))return toast('PDF görünürlük yetkiniz yok.',false);const r=await client().rpc('admin_set_offer_pdf_visibility',{p_offer_id:id,p_visible:value});if(r.error)return toast(r.error.message,false);toast(value?'Müşteriye gösterilecek.':'Müşteriden gizlendi.');open(id)}
  async function setCrew(id,value){if(!hasCan('offers.crew'))return;try{await invoke('admin-offer-runtime',{action:'set_crew',offer_id:id,crew_count:value});toast('Personel sayısı güncellendi.');open(id)}catch(e){toast(e.message||String(e),false)}}
  async function reserve(id,equipmentId,qty){if(!hasCan('offers.equipment'))return;try{await invoke('admin-offer-runtime',{action:'set_inventory_reserved',offer_id:id,equipment_id:equipmentId,reserved_qty:qty});toast('Envanter rezervi güncellendi.');open(id)}catch(e){toast(e.message||String(e),false)}}
  async function removeEquipment(id,equipmentId){if(!confirm('Bu ekipman tekliften çıkarılsın?'))return;try{await invoke('admin-offer-runtime',{action:'remove_inventory',offer_id:id,equipment_id:equipmentId});toast('Ekipman tekliften çıkarıldı.');open(id)}catch(e){toast(e.message||String(e),false)}}
  async function addEquipment(id){const c=client();const {data:eq,error}=await c.from('equipment').select('id,category,brand,model,available_quantity,active').eq('active',true).order('category').order('brand').order('model');if(error)return toast(error.message,false);const pick=prompt((eq||[]).map(x=>`${x.id} | ${[x.category,x.brand,x.model].filter(Boolean).join(' · ')} | mevcut ${n(x.available_quantity)}`).join('\n')+'\n\nEkipman ID girin:');if(!pick)return;const qty=n(prompt('Adet?','1')||1);try{await invoke('admin-offer-runtime',{action:'add_inventory',offer_id:id,equipment_id:pick.trim(),quantity:qty,notes:null});toast('Ekipman teklife eklendi.');open(id)}catch(e){toast(e.message||String(e),false)}}
  async function uploadPhotos(id,files){try{for(const f of files){const ext=(f.name.split('.').pop()||'jpg').toLowerCase();const path=`offers/${id}/attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const c=client();const up=await c.storage.from('offer-assets').upload(path,f,{contentType:f.type,upsert:false});if(up.error)throw up.error;const ins=await c.from('offer_attachments').insert({offer_id:id,storage_path:path,file_name:f.name,mime_type:f.type,size_bytes:f.size,customer_visible:true}).select('id').single();if(ins.error)throw ins.error;}toast('Fotoğraflar eklendi.');open(id)}catch(e){toast(e.message||String(e),false)}}
  async function setPhotoVisible(id,value){const r=await client().rpc('admin_set_offer_attachment_visibility',{p_attachment_id:id,p_visible:value});if(r.error)toast(r.error.message,false)}
  async function deletePhoto(id,offerId){if(!confirm('Fotoğraf silinsin mi?'))return;const r=await client().rpc('admin_delete_offer_attachment',{p_attachment_id:id});if(r.error)return toast(r.error.message,false);toast('Fotoğraf silindi.');open(offerId)}
  window.StagepulseOfferPdf={open,generate};
})();
/* ===== END admin/admin-offer-pdf-v1.js ===== */

/* ===== BEGIN admin/admin-core-ui-v1.js ===== */
/* Stagepulse Admin — focused UI polish for Personnel, Settings, Notifications and Payments. Visual layer only. */
(() => {
  'use strict';
  const STYLE_ID = 'sp-admin-core-ui-v1';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Admin content rhythm */
      #content > .page-head { margin-bottom: 18px; }
      #content > .page-head h1 { letter-spacing: -.02em; }
      #content > .page-head .muted { max-width: 760px; }
      #content .panel { border-radius: 16px; }
      #content .cards { gap: 12px; }
      #content .card { border-radius: 16px; min-height: 92px; }

      /* Personnel console */
      #spPersonnelAdmin .sp-pa-card { border-radius: 18px; }
      #spPersonnelAdmin .sp-pa-card-top { align-items: flex-start; }
      #spPersonnelAdmin .sp-pa-perms { grid-template-columns: repeat(auto-fit,minmax(290px,1fr)); }
      #spPersonnelAdmin .sp-pa-group { border: 1px solid rgba(127,127,127,.14); border-radius: 14px; padding: 12px 14px; }
      #spPersonnelAdmin .sp-pa-group h4 { margin-bottom: 4px; }
      #spPersonnelAdmin .sp-pa-row { min-height: 42px; }
      #spPersonnelAdmin .sp-pa-save { position: sticky; bottom: 8px; z-index: 3; padding: 10px 0; background: linear-gradient(transparent,var(--bg,#0d0e12) 24%); }

      /* Settings */
      #content .grid2 { align-items: stretch; gap: 14px; }
      #content .grid2 > .panel { min-width: 0; }
      #content .grid2 > .panel h3 { margin-top: 0; margin-bottom: 14px; }
      #content label { gap: 7px; }
      #content input:not([type=checkbox]), #content select, #content textarea { min-height: 42px; border-radius: 10px; }

      /* Notifications */
      #content #spPushConnectionPanel { border: 1px solid rgba(127,127,127,.18); }
      #content .row-item { gap: 14px; padding: 13px 0; }
      #content .row-main { min-width: 0; }
      #content .row-main strong { display: block; margin-bottom: 3px; }
      #content .row-side { flex-wrap: wrap; }

      /* Payments / finance */
      #content .data-table { min-width: 820px; }
      #content .data-table th { white-space: nowrap; }
      #content .data-table td { vertical-align: middle; }

      @media (max-width: 760px) {
        #content > .page-head { gap: 10px; }
        #content .grid2 { grid-template-columns: 1fr; }
        #content .cards { grid-template-columns: repeat(2,minmax(0,1fr)); }
        #spPersonnelAdmin .sp-pa-perms { grid-template-columns: 1fr; }
        #spPersonnelAdmin .sp-pa-save { position: static; background: none; }
      }
      @media (max-width: 430px) {
        #content .cards { grid-template-columns: 1fr; }
        #spPersonnelAdmin .sp-pa-head { align-items: stretch; }
        #spPersonnelAdmin .sp-pa-head .btn { width: 100%; }
        #spPersonnelAdmin .sp-pa-card-top { flex-direction: column; }
        #spPersonnelAdmin .sp-pa-status { width: 100%; justify-content: space-between; }
      }
    `;
    document.head.appendChild(style);
  }

  function decorate(view) {
    injectStyle();
    document.body.classList.add('stagepulse-admin-polished');
    const content = document.getElementById('content');
    if (!content) return;
    content.dataset.adminPolishedView = view || '';

    if (view === 'notifications') {
      const head = content.querySelector('.page-head');
      if (head) head.dataset.section = 'notifications';
    }
    if (view === 'finance') {
      const table = content.querySelector('.data-table');
      if (table) table.closest('.table-wrap')?.setAttribute('role', 'region');
    }
  }

  function bind() {
    if (window.__stagepulseAdminCoreUiBound) return;
    window.__stagepulseAdminCoreUiBound = true;
    injectStyle();
    const original = window.loadView;
    if (typeof original === 'function') {
      window.loadView = async function(view) {
        const result = await original.apply(this, arguments);
        requestAnimationFrame(() => decorate(view));
        return result;
      };
    }
    const observer = new MutationObserver(() => {
      if (document.getElementById('content')?.children.length) decorate((location.hash || '#home').slice(1));
    });
    const content = document.getElementById('content');
    if (content) observer.observe(content, {childList:true, subtree:false});
    setTimeout(() => observer.disconnect(), 15000);
    decorate((location.hash || '#home').slice(1));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();

/* ===== END admin/admin-core-ui-v1.js ===== */

/* ===== BEGIN admin/customer-offer-binding-v1.js ===== */
/* Stagepulse Admin — customer ↔ offer binding + public code + PDF-ready item. */
(() => {
  'use strict';
  const URL='https://mtjcqqrogjqaxkagwkti.supabase.co',KEY='sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  const client=()=>window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v)||0;
  const toast=(m,ok=true)=>window.toast?.(m,ok)||console.log(m);
  async function getCustomers(){const {data,error}=await client().from('customers').select('id,name,company,phone,email').order('name');if(error)throw error;return data||[]}
  async function addSelector(){const modal=document.getElementById('offerModal');if(!modal||document.getElementById('nCustomer'))return;const name=modal.querySelector('#nName');if(!name)return;const list=await getCustomers();const phone=modal.querySelector('#nPhone');const label=document.createElement('label');label.style.display='block';label.style.marginTop='12px';label.innerHTML='<span>Müşteri kaydı</span><select id="nCustomer"><option value="">Yeni müşteri / otomatik eşleştir</option>'+list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.company?' · '+esc(c.company):''}${c.phone?' · '+esc(c.phone):''}</option>`).join('')+'</select>';name.closest('label')?.insertAdjacentElement('afterend',label);const select=label.querySelector('select');const sync=()=>{const q=(phone?.value||'').replace(/\D/g,'');if(!q)return;const hit=list.find(c=>String(c.phone||'').replace(/\D/g,'')===q);if(hit)select.value=hit.id};phone?.addEventListener('blur',sync);name?.addEventListener('blur',()=>{if(select.value)return;const n=name.value.trim().toLowerCase();const hit=list.find(c=>String(c.name||'').trim().toLowerCase()===n);if(hit)select.value=hit.id})}
  async function resolveCustomer(){const c=client(),selected=document.getElementById('nCustomer')?.value||'';if(selected)return selected;const name=document.getElementById('nName')?.value?.trim(),phone=document.getElementById('nPhone')?.value?.trim(),email=document.getElementById('nEmail')?.value?.trim()||null;if(!name||!phone)return null;const norm=phone.replace(/\D/g,'');const {data:found}=await c.from('customers').select('id,phone').limit(100);const hit=(found||[]).find(x=>String(x.phone||'').replace(/\D/g,'')===norm);if(hit)return hit.id;const {data,error}=await c.from('customers').insert([{name,phone,email,notes:'Teklif oluşturulurken otomatik oluşturuldu.'}]).select('id').single();if(error)throw error;return data.id}
  async function ensurePublicCode(id){const c=client();try{const {data,error}=await c.rpc('ensure_quote_public_code',{p_offer_id:id});if(error)throw error;return data}catch(e){console.warn('public code',e);return null}}
  async function ensurePdfItem(id,total,type){const c=client();if(!id)return;try{const {count,error}=await c.from('offer_items').select('id',{count:'exact',head:true}).eq('offer_id',id);if(error||count)return;const value=num(total);await c.from('offer_items').insert([{offer_id:id,description:type||'Teklif hizmeti',quantity:1,unit_price:value,total:value}]);}catch(e){console.warn('offer item',e)}}
  let legacyNew=null,patched=false;
  function patch(){if(patched||typeof window.newOffer!=='function')return false;legacyNew=window.newOffer;window.newOffer=async function(){await legacyNew();setTimeout(()=>addSelector().catch(e=>console.error('customer selector',e)),60)};if(typeof window.createOffer==='function'){window.createOffer=async function(){try{const c=client(),name=document.getElementById('nName')?.value?.trim(),phone=document.getElementById('nPhone')?.value?.trim();if(!name||!phone)return toast('Ad ve telefon zorunlu',false);const customerId=await resolveCustomer();if(!customerId)throw new Error('Müşteri kaydı oluşturulamadı.');const total=num(document.getElementById('nTotal')?.value),days=num(document.getElementById('nValidDays')?.value)||7,eventDate=document.getElementById('nDate')?.value||null,d=new Date(eventDate||Date.now());d.setDate(d.getDate()+days);const type=document.getElementById('nType')?.value||null;const payload={customer_id:customerId,name,phone,email:document.getElementById('nEmail')?.value?.trim()||null,location:document.getElementById('nLoc')?.value?.trim()||null,event_type:document.getElementById('nEventType')?.value||null,type,people:num(document.getElementById('nPeople')?.value)||null,event_date:eventDate,message:document.getElementById('nMessage')?.value?.trim()||null,total,estimated_price:total,margin:0,status:'preparing',valid_until:d.toISOString().slice(0,10),services:[]};const {data,error}=await c.from('teklifler').insert([payload]).select().single();if(error)throw error;await ensurePublicCode(data.id);await ensurePdfItem(data.id,total,type);toast('Teklif oluşturuldu ve müşteriyle bağlandı');document.getElementById('offerModal')?.remove();window.loadView?.('offers');setTimeout(()=>window.openOffer?.(data.id),100)}catch(e){console.error(e);toast(e.message||'Teklif oluşturulamadı',false)}}}patched=true;return true}
  let tries=0;const boot=()=>{if(patch()||tries++>40)return;setTimeout(boot,150)};document.addEventListener('DOMContentLoaded',boot);window.addEventListener('stagepulse-admin-ready',boot);document.addEventListener('click',e=>{if(e.target.closest('button[onclick="newOffer()"]'))setTimeout(()=>addSelector().catch(console.error),120)},true);
})();

/* ===== END admin/customer-offer-binding-v1.js ===== */

/* ===== BEGIN admin/admin-offer-edit-media-fix-v1.js ===== */
/* Stagepulse Admin — offer edit button bridge v3 */
(() => {
  'use strict';

  function addEditButtons() {
    if (location.hash !== '#offers') return;
    document.querySelectorAll('.row-item').forEach(row => {
      if (row.querySelector('[data-sp-edit-offer]')) return;
      const side = row.querySelector('.row-side');
      if (!side) return;

      const attrs = [...row.querySelectorAll('[onclick]')]
        .map(el => el.getAttribute('onclick') || '').join(' ');
      const m = attrs.match(/(?:openOffer|openOfferEditable)\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/i);
      const id = m?.[1] || row.dataset.offerId || row.getAttribute('data-offer-id') || row.dataset.id || row.getAttribute('data-id');
      if (!id) return;

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-primary';
      b.dataset.spEditOffer = id;
      b.textContent = 'Düzenle';
      b.setAttribute('aria-label', 'Teklifi düzenle');
      b.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openOffer === 'function') window.openOffer(id);
        else if (typeof window.openOfferEditable === 'function') window.openOfferEditable(id);
      });
      side.appendChild(b);
    });
  }

  function init() {
    addEditButtons();
    const content = document.getElementById('content') || document.body;
    new MutationObserver(addEditButtons).observe(content, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setTimeout(addEditButtons, 100));
    window.addEventListener('stagepulse-admin-ready', addEditButtons);
    window.addEventListener('load', addEditButtons);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* ===== END admin/admin-offer-edit-media-fix-v1.js ===== */

/* ===== BEGIN admin/admin-offer-media-final-v1.js ===== */
/* Stagepulse Admin — canonical offer photo attachment editor */
(() => {
  'use strict';
  const state = { offerId: null, bound: null };
  const client = () => window.StagepulseAdminSupabase?.getClient?.() || window.sb || window.supabaseClient;
  const toast = (m, ok = true) => typeof window.toast === 'function' ? window.toast(m, ok) : console[ok ? 'log' : 'error'](m);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const modal = () => document.getElementById('offerModal');
  const card = m => m?.querySelector('.modal-card') || m;
  const offerId = m => m?.dataset.offerId || m?.dataset.spOfferId || m?.querySelector('[data-sp-offer-id]')?.dataset.spOfferId || window.__spLastOfferModalId || window.__spLastOfferId || null;
  const api = () => { const c = client(); if (!c?.rpc || !c?.storage) throw new Error('Admin bağlantısı hazır değil.'); return c; };
  const bucket = 'offer-assets';
  function ensurePanel(m) {
    let p = m.querySelector('#spCanonicalOfferMedia');
    if (p) return p;
    p = document.createElement('section');
    p.id = 'spCanonicalOfferMedia';
    p.className = 'panel';
    p.innerHTML = `<h3>Teklif fotoğrafları</h3><p class="muted small">PDF içinde ve müşteriye gösterilecek görselleri buradan ekleyin. JPG ve PNG doğrudan, WebP ise PDF uyumluluğu için otomatik PNG olarak yüklenir.</p><div class="sp-media-upload"><input id="spOfferMediaFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><button type="button" class="btn btn-primary" id="spOfferMediaUpload">Fotoğrafları yükle</button></div><div id="spOfferMediaStatus" class="muted small" style="margin-top:8px"></div><div id="spOfferMediaGrid" class="sp-media-grid" style="margin-top:12px"></div>`;
    const actions = card(m)?.querySelector('.modal-actions');
    actions ? card(m).insertBefore(p, actions) : card(m)?.appendChild(p);
    p.querySelector('#spOfferMediaUpload').onclick = () => uploadSelected(m);
    return p;
  }
  async function list(m, id) {
    const { data, error } = await api().rpc('admin_get_offer_attachments', { p_offer_id: id });
    if (error) throw error;
    return data || [];
  }
  async function signedUrl(path) {
    const { data, error } = await api().storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data?.signedUrl || '';
  }
  async function render(m, id) {
    const p = ensurePanel(m), grid = p.querySelector('#spOfferMediaGrid'), status = p.querySelector('#spOfferMediaStatus');
    if (!grid) return;
    status.textContent = 'Fotoğraflar yükleniyor…';
    try {
      const items = await list(m, id);
      if (!items.length) grid.innerHTML = '<div class="muted small">Bu teklife henüz fotoğraf eklenmemiş.</div>';
      else {
        grid.innerHTML = items.map(a => `<article class="sp-media-item" data-att-id="${esc(a.id)}"><div class="sp-media-image"><div class="muted small" data-loading>Yükleniyor…</div></div><div class="sp-media-meta"><div class="sp-media-name">${esc(a.file_name)}</div><div class="small muted">${Number(a.size_bytes||0) ? Math.round(Number(a.size_bytes)/1024)+' KB' : ''}</div><div class="sp-media-actions"><button type="button" class="btn" data-visible>${a.customer_visible ? 'Müşteri: Açık' : 'Müşteri: Kapalı'}</button><button type="button" class="btn btn-danger" data-delete>Sil</button></div></div></article>`).join('');
        for (const a of items) {
          const url = await signedUrl(a.storage_path).catch(() => '');
          const item = grid.querySelector(`[data-att-id="${a.id}"]`);
          if (!item) continue;
          const box = item.querySelector('.sp-media-image');
          if (url) box.innerHTML = `<img class="sp-media-thumb" src="${esc(url)}" alt="${esc(a.file_name)}" loading="lazy">`;
          else box.innerHTML = '<div class="form-error small">Önizleme alınamadı.</div>';
          item.querySelector('[data-visible]').onclick = async () => {
            const c = api();
            const r = await c.rpc('admin_set_offer_attachment_visibility', { p_attachment_id: a.id, p_visible: !a.customer_visible });
            if (r.error) return toast(r.error.message || String(r.error), false);
            await render(m, id);
            window.stagepulseRegenerateOfferPdf?.(id);
          };
          item.querySelector('[data-delete]').onclick = async () => {
            if (!confirm(`“${a.file_name}” silinsin mi?`)) return;
            const c = api();
            const r = await c.rpc('admin_delete_offer_attachment', { p_attachment_id: a.id });
            if (r.error) return toast(r.error.message || String(r.error), false);
            await c.storage.from(bucket).remove([a.storage_path]);
            toast('Fotoğraf silindi.');
            await render(m, id);
            window.stagepulseRegenerateOfferPdf?.(id);
          };
        }
      }
      status.textContent = `${items.length} fotoğraf`;
    } catch (e) { status.textContent = ''; grid.innerHTML = `<div class="form-error">${esc(e.message || e)}</div>`; }
  }
  async function normalizeForPdf(file) {
    if (file.type !== 'image/webp') return file;
    let source;
    if (typeof createImageBitmap === 'function') source = await createImageBitmap(file);
    else {
      const url = URL.createObjectURL(file);
      try {
        source = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('WebP görseli açılamadı.'));
          image.src = url;
        });
      } finally { URL.revokeObjectURL(url); }
    }
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('WebP dönüştürme başlatılamadı.');
    context.drawImage(source, 0, 0);
    if (typeof source.close === 'function') source.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('WebP, PNG biçimine dönüştürülemedi.');
    return new File([blob], file.name.replace(/\.webp$/i, '') + '.png', { type:'image/png', lastModified:file.lastModified });
  }
  async function uploadSelected(m) {
    const id = offerId(m), p = ensurePanel(m), input = p.querySelector('#spOfferMediaFiles');
    if (!id || !input?.files?.length) return toast('Önce fotoğraf seçin.', false);
    const files = [...input.files].filter(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
    if (!files.length) return toast('JPG, PNG veya WebP dosyası seçin.', false);
    const c = api(), status = p.querySelector('#spOfferMediaStatus');
    let done = 0;
    for (const originalFile of files) {
      try {
        const file = await normalizeForPdf(originalFile);
        const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-90) || 'image';
        const path = `${id}/${crypto.randomUUID()}-${safe}`;
        const up = await c.storage.from(bucket).upload(path, file, { upsert:false, contentType:file.type, cacheControl:'3600' });
        if (up.error) throw up.error;
        const reg = await c.rpc('admin_register_offer_attachment', { p_offer_id:id, p_storage_path:path, p_file_name:file.name, p_mime_type:file.type, p_size_bytes:file.size, p_sort_order:999, p_customer_visible:true });
        if (reg.error) { await c.storage.from(bucket).remove([path]); throw reg.error; }
        done++;
        status.textContent = `${done}/${files.length} fotoğraf yüklendi…`;
      } catch (e) { toast(`${originalFile.name}: ${e.message || e}`, false); }
    }
    input.value = '';
    toast(done ? `${done} fotoğraf eklendi.` : 'Fotoğraf yüklenemedi.', !!done);
    await render(m, id);
    window.stagepulseRegenerateOfferPdf?.(id);
  }
  function bind() {
    const m = modal();
    if (!m || m.classList.contains('is-hidden')) { state.offerId = null; return; }
    const id = offerId(m); if (!id) return;
    if (state.offerId !== id) { state.offerId = id; state.bound = null; }
    const p = ensurePanel(m);
    if (state.bound !== id) { state.bound = id; render(m, id); }
  }
  function watch() {
    bind();
    const root = document.getElementById('content') || document.body;
    new MutationObserver(() => bind()).observe(root, { childList:true, subtree:true });
    window.addEventListener('stagepulse-admin-ready', bind);
    window.addEventListener('hashchange', () => setTimeout(bind, 80));
    setInterval(bind, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once:true }); else watch();
})();

/* ===== END admin/admin-offer-media-final-v1.js ===== */

/* ===== BEGIN admin/admin-offer-edit-button-v2.js ===== */
/* Stagepulse Admin — robust offer edit action */
(() => {
  'use strict';

  const cleanId = (v) => String(v || '').replace(/[^0-9a-fA-F-]/g, '');

  function resolveOfferId(row) {
    const direct = row.dataset.offerId || row.getAttribute('data-offer-id') || row.dataset.id || row.getAttribute('data-id');
    if (direct && direct.length >= 20) return cleanId(direct);

    for (const el of row.querySelectorAll('[data-offer-id],[data-id]')) {
      const v = el.dataset.offerId || el.getAttribute('data-offer-id') || el.dataset.id || el.getAttribute('data-id');
      if (v && v.length >= 20) return cleanId(v);
    }

    for (const el of row.querySelectorAll('[onclick],a[href]')) {
      const text = `${el.getAttribute('onclick') || ''} ${el.getAttribute('href') || ''}`;
      const m = text.match(/(?:openOffer|openOfferEditable)\s*\(\s*['\"]?([0-9a-fA-F-]{20,})/i);
      if (m?.[1]) return cleanId(m[1]);
      const uuid = text.match(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/);
      if (uuid?.[0]) return cleanId(uuid[0]);
    }

    const body = row.textContent || '';
    const uuid = body.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return uuid?.[0] || '';
  }

  function openEdit(id) {
    if (!id) return;
    if (typeof window.openOfferEditable === 'function') return window.openOfferEditable(id);
    if (typeof window.openOffer === 'function') return window.openOffer(id);
    window.__stagepulsePendingOfferEdit = id;
    setTimeout(() => {
      if (typeof window.openOfferEditable === 'function') window.openOfferEditable(id);
      else if (typeof window.openOffer === 'function') window.openOffer(id);
      else if (typeof window.toast === 'function') window.toast('Teklif düzenleme ekranı henüz hazır değil.', false);
    }, 150);
  }

  function addRenderedButtons() {
    if (location.hash !== '#offers') return;
    document.querySelectorAll('#content .row-item').forEach(row => {
      if (row.querySelector('[data-sp-edit-offer]')) return;
      const side = row.querySelector('.row-side') || row;
      const id = resolveOfferId(row);
      if (!id) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-primary';
      b.dataset.spEditOffer = id;
      b.textContent = 'Düzenle';
      b.setAttribute('aria-label', 'Teklifi düzenle');
      b.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openEdit(id);
      });
      side.appendChild(b);
    });
  }

  function install() {
    if (window.__stagepulseOfferEditButtonRobust) return;
    window.__stagepulseOfferEditButtonRobust = true;
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-sp-edit-offer]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      openEdit(b.dataset.spEditOffer);
    }, true);
    const content = document.getElementById('content') || document.body;
    new MutationObserver(addRenderedButtons).observe(content, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setTimeout(addRenderedButtons, 80));
    window.addEventListener('stagepulse-admin-ready', () => setTimeout(addRenderedButtons, 80));
    setTimeout(addRenderedButtons, 150);
    setTimeout(addRenderedButtons, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

/* ===== END admin/admin-offer-edit-button-v2.js ===== */

/* ===== BEGIN admin/admin-offer-crew-count-fix-v1.js ===== */
/* Stagepulse Admin — crew count compatibility shim v3.
 * The stable offer editor owns the crew field. This file must not observe DOM
 * mutations or rewrite values while the user is typing.
 */
(() => {
  'use strict';
  window.__stagepulseCrewCountFixBoundV3 = true;
})();

/* ===== END admin/admin-offer-crew-count-fix-v1.js ===== */

/* ===== BEGIN admin/admin-personnel-count-live-v1.js ===== */
/* Stagepulse Admin — live organization member count */
(() => {
  'use strict';
  const R=window.STAGEPULSE_RUNTIME||{};
  const URL=R.supabaseUrl||''; const KEY=R.supabasePublishableKey||'';
  let client=null;
  function getClient(){if(client)return client;client=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;return client;}
  async function getPersonnelCount(){const c=getClient();if(!c)return null;const {count,error}=await c.from('org_memberships').select('user_id',{count:'exact',head:true}).eq('active',true);if(error){console.warn('Stagepulse personnel count:',error.message);return null;}return Number(count||0)}
  function setCommandCenterCount(count){document.querySelectorAll('.sp-cc-card').forEach(card=>{const label=card.querySelector('span'),value=card.querySelector('strong');if(label&&value&&label.textContent.trim()==='Personel')value.textContent=String(count)})}
  async function refresh(){const count=await getPersonnelCount();if(count!=null)setCommandCenterCount(count)}
  function bind(){refresh();setInterval(refresh,10000);window.addEventListener('hashchange',()=>setTimeout(refresh,150));window.addEventListener('stagepulse-admin-ready',()=>setTimeout(refresh,150));const content=document.getElementById('content');if(content)new MutationObserver(()=>{if(location.hash==='#command-center')refresh()}).observe(content,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();

/* ===== END admin/admin-personnel-count-live-v1.js ===== */

/* ===== BEGIN admin/admin-live-summary-counts-v1.js ===== */
/* Stagepulse Admin — live organization/equipment totals. */
(() => {
  'use strict';
  const R=window.STAGEPULSE_RUNTIME||{};
  const URL=R.supabaseUrl||'';const KEY=R.supabasePublishableKey||'';
  let client=null,refreshRunning=false;
  function getClient(){if(client)return client;client=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;return client;}
  async function totals(){const c=getClient();if(!c)return null;const [p,e]=await Promise.all([c.from('org_memberships').select('user_id,active',{count:'exact'}),c.from('equipment').select('id,quantity,active')]);if(p.error||e.error)return null;const staff=p.data||[],equipment=(e.data||[]).filter(x=>x.active!==false);return {personnel:staff.filter(x=>x.active===true).length,equipmentRows:equipment.length,equipmentQuantity:equipment.reduce((s,x)=>s+Math.max(0,Number(x.quantity)||0),0)};}
  function setValue(label,value){if(value==null)return;const needle=label.toLocaleLowerCase('tr-TR');document.querySelectorAll('.sp-cc-card,.card,.kpi-card,.metric-card').forEach(card=>{const text=card.querySelector('span,.card-label,.metric-label,.label'),valueEl=card.querySelector('strong,.metric,.value,b');if(!text||!valueEl)return;const t=text.textContent.trim().toLocaleLowerCase('tr-TR');if(t===needle||t.includes(needle))valueEl.textContent=String(value);});}
  async function refresh(){if(refreshRunning)return;refreshRunning=true;try{const t=await totals();if(!t)return;setValue('Personel',t.personnel);setValue('Ekipman',t.equipmentQuantity);setValue('Envanter',t.equipmentQuantity);document.querySelectorAll('[data-sp-live-personnel]').forEach(e=>e.textContent=String(t.personnel));document.querySelectorAll('[data-sp-live-equipment]').forEach(e=>e.textContent=String(t.equipmentQuantity));}finally{refreshRunning=false;}}
  function bind(){if(window.__stagepulseLiveSummaryCountsV4)return;window.__stagepulseLiveSummaryCountsV4=true;refresh();setInterval(refresh,10000);window.addEventListener('hashchange',()=>setTimeout(refresh,150));window.addEventListener('stagepulse-admin-ready',()=>setTimeout(refresh,150));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();

/* ===== END admin/admin-live-summary-counts-v1.js ===== */

/* ===== BEGIN admin/admin-apk-input-fix-v1.js ===== */
/* Stagepulse Admin — Android WebView input stability v3.
 * This file intentionally does not move, focus, blur, or refocus form controls.
 * Android/WebView owns keyboard and focus behavior; DOM observers must not react
 * to keyboard/viewport changes.
 */
(() => {
  'use strict';
  const STYLE = 'sp-apk-input-fix-style-v3';
  if (document.getElementById(STYLE)) return;
  const style = document.createElement('style');
  style.id = STYLE;
  style.textContent = `
    .modal.sp-apk-modal { align-items:flex-start !important; padding-top:max(12px,env(safe-area-inset-top)) !important; padding-bottom:max(12px,env(safe-area-inset-bottom)) !important; }
    .modal.sp-apk-modal .modal-card { max-height:calc(100dvh - 24px) !important; min-height:0; overflow-y:auto !important; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
    .modal.sp-apk-modal input, .modal.sp-apk-modal select, .modal.sp-apk-modal textarea { touch-action:manipulation; }
  `;
  document.head.appendChild(style);
  const mark = () => document.getElementById('offerModal')?.classList.add('sp-apk-modal');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark, {once:true});
  else mark();
})();

/* ===== END admin/admin-apk-input-fix-v1.js ===== */

/* ===== BEGIN admin/admin-offer-web-apk-final-fix-v1.js ===== */
/* Stagepulse Admin — web + Android offer detail stability v5. */
(() => {
  'use strict';
  const VERSION = '20260831-05';
  const client = () => window.sb || window.__stagepulseAdminClient || window.supabaseClient;
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function installStyle() {
    if (document.getElementById('spOfferFinalFixStyleV5')) return;
    const s = document.createElement('style');
    s.id = 'spOfferFinalFixStyleV5';
    s.textContent = `
      .modal.sp-offer-final-fix { align-items:flex-start !important; padding:12px !important; }
      .modal.sp-offer-final-fix .modal-card { max-height:calc(100dvh - 24px) !important; overflow-y:auto !important; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
      .modal.sp-offer-final-fix input, .modal.sp-offer-final-fix select, .modal.sp-offer-final-fix textarea { touch-action:manipulation; }
    `;
    document.head.appendChild(s);
  }

  async function loadInventory(select) {
    const c = client();
    if (!c || !select || select.dataset.spFinalLoaded === VERSION) return;
    select.dataset.spFinalLoaded = VERSION;
    try {
      const { data, error } = await c.from('equipment').select('id,category,brand,model,quantity,available_quantity,active').eq('active', true).order('category').order('brand').order('model');
      if (error) throw error;
      const rows = data || [];
      const current = select.value;
      select.innerHTML = '<option value="">Ekipman seçin</option>' + rows.map(e => {
        const label = [e.category,e.brand,e.model].filter(Boolean).join(' · ');
        const available = Number.isFinite(Number(e.available_quantity)) ? Number(e.available_quantity) : Number(e.quantity) || 0;
        return `<option value="${esc(e.id)}">${esc(label || 'Ekipman')} — mevcut: ${available}</option>`;
      }).join('');
      if (current) select.value = current;
      if (!rows.length) select.innerHTML = '<option value="">Aktif envanter bulunamadı</option>';
    } catch (e) {
      select.dataset.spFinalLoaded = '';
      select.innerHTML = `<option value="">Envanter yüklenemedi</option>`;
      select.title = e.message || String(e);
    }
  }

  function scan() {
    installStyle();
    const modal = document.getElementById('offerModal');
    if (!modal) return;
    modal.classList.add('sp-offer-final-fix');
    const select = modal.querySelector('#spOfferEqSelect');
    if (select) loadInventory(select);
  }

  function boot() {
    scan();
    const observer = new MutationObserver(() => {
      const modal = document.getElementById('offerModal');
      if (modal && !modal.dataset.spFinalObserverBound) {
        modal.dataset.spFinalObserverBound = '1';
        scan();
      }
    });
    observer.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();

/* ===== END admin/admin-offer-web-apk-final-fix-v1.js ===== */

/* ===== BEGIN admin/site-media-manager.js ===== */
/* Stagepulse Admin — unified repository media manager v5 */
(()=>{'use strict';
const FN='admin-github-media';const OWNER='ibrahimFOH',REPO='Stagepulse.hatay',BRANCH='main';const rt=()=>window.STAGEPULSE_RUNTIME||{};const api=()=>`${rt().supabaseUrl}/functions/v1/${FN}`;const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(action,p={}){const c=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb;if(!c)throw Error('Yönetici istemcisi hazır değil.');const {data:{session}}=await c.auth.getSession();if(!session?.access_token)throw Error('Yönetici oturumu bulunamadı.');const r=await fetch(api(),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:rt().supabasePublishableKey||''},body:JSON.stringify({action,...p})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||`İşlem başarısız (${r.status}).`);return j}
function type(path){if(path.startsWith('documents/'))return'pdf';if(path.startsWith('images/gallery/video/'))return'video';return'photo'}function human(n){n=Number(n||0);return n<1024?(n+' B'):n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB'}
async function publicList(){const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`,{headers:{Accept:'application/vnd.github+json'}});if(!r.ok)throw Error(`Repo medya listesi alınamadı (${r.status}).`);const j=await r.json();return(j.tree||[]).filter(x=>x.type==='blob'&&(x.path.startsWith('images/gallery/')||x.path.startsWith('documents/'))).filter(x=>/\.(jpe?g|png|webp|gif|avif|mp4|webm|mov|pdf)$/i.test(x.path)).map(x=>({path:x.path,name:x.path.split('/').pop(),size:x.size||0,sha:x.sha,download_url:`https://stagepulse.com.tr/${x.path}`,type:'file',source:'repository'}))}
async function render(){const c=document.getElementById('content');if(!c)return;c.innerHTML='<section class="sp-media"><div class="sp-media-card"><div class="sp-gh-toolbar"><div><h2>Medya Merkezi</h2><p>Depodaki mevcut medya ve yeni yüklenecek dosyalar burada yönetilir.</p></div><label class="btn btn-primary">+ Medya Ekle<input id="spMediaFile" type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,application/pdf"></label></div><div class="sp-gh-tabs"><button class="sp-gh-tab active" data-kind="all">Tümü</button><button class="sp-gh-tab" data-kind="photo">Fotoğraflar</button><button class="sp-gh-tab" data-kind="video">Videolar</button><button class="sp-gh-tab" data-kind="pdf">PDF Belgeler</button></div><div id="spMediaStatus" class="sp-gh-status"></div></div><div class="sp-media-card"><div id="spMediaGrid">Depo taranıyor…</div></div></section>';const grid=document.getElementById('spMediaGrid'),status=document.getElementById('spMediaStatus');let filter='all';
async function load(){try{let items=[],writeEnabled=true;try{const j=await call('list');items=j.items||[];if(!items.length){items=await publicList();writeEnabled=false;status.textContent='Mevcut depo medyası gösteriliyor. GitHub yazma bağlantısı ayrıca etkinleştirilebilir.';status.className='sp-gh-status'}}catch(e){items=await publicList();writeEnabled=false;status.textContent='Mevcut depo medyası gösteriliyor. Yeni ekleme/silme/yeniden adlandırma için GitHub bağlantısı gerekir.';status.className='sp-gh-status'}items=items.filter(x=>x.type==='file').filter(x=>filter==='all'||type(x.path)===filter);grid.innerHTML=items.length?'<div class="sp-gh-grid">'+items.map(x=>{const k=type(x.path);const preview=k==='photo'?`<img src="${esc(x.download_url)}" loading="lazy" alt="">`:k==='video'?`<video src="${esc(x.download_url)}" controls preload="metadata"></video>`:'<b style="color:#fff">PDF</b>';const actions=writeEnabled?`<div class="sp-gh-actions"><a class="btn" href="${esc(x.download_url||x.html_url)}" target="_blank" rel="noopener">Aç</a><button class="btn" data-rename="${esc(x.path)}">Adlandır</button>${k==='photo'?`<button class="btn" data-opt="${esc(x.path)}">Optimize</button>`:''}<button class="btn" data-delete="${esc(x.path)}">Sil</button></div>`:`<div class="sp-gh-actions"><a class="btn" href="${esc(x.download_url||x.html_url)}" target="_blank" rel="noopener">Aç</a></div>`;return `<article class="sp-gh-item"><div class="sp-gh-preview">${preview}</div><div class="sp-gh-body"><div class="sp-gh-name">${esc(x.name)}</div><div class="sp-gh-path">${esc(x.path)}</div><div class="sp-gh-meta">${human(x.size)} · ${k==='pdf'?'PDF':k==='video'?'Video':'Fotoğraf'}</div>${actions}</div></article>`}).join('')+'</div>':'<div class="sp-media-empty">Bu bölümde medya yok.</div>';if(writeEnabled)bind()}catch(e){grid.innerHTML=`<div class="sp-media-empty sp-gh-err">${esc(e.message)}</div>`}}
function bind(){grid.querySelectorAll('[data-rename]').forEach(b=>b.onclick=async()=>{const n=prompt('Yeni dosya adı:',b.dataset.rename.split('/').pop());if(!n)return;try{status.textContent='Yeniden adlandırılıyor…';await call('rename',{old_path:b.dataset.rename,new_name:n});status.textContent='Tamamlandı.';await load()}catch(e){status.textContent=e.message}});grid.querySelectorAll('[data-opt]').forEach(b=>b.onclick=async()=>{try{status.textContent='Optimize ediliyor…';await call('optimize',{path:b.dataset.opt});status.textContent='Optimizasyon sıraya alındı.'}catch(e){status.textContent=e.message}});grid.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Bu medya GitHub reposundan ve siteden kaldırılacak. Devam edilsin mi?'))return;try{status.textContent='Siliniyor…';await call('delete',{path:b.dataset.delete});status.textContent='Silindi.';await load()}catch(e){status.textContent=e.message}})}
document.querySelectorAll('.sp-gh-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.sp-gh-tab').forEach(x=>x.classList.toggle('active',x===b));filter=b.dataset.kind;load()});document.getElementById('spMediaFile').onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;try{for(const f of fs){if(!/\.(jpe?g|png|webp|gif|avif|mp4|webm|mov|pdf)$/i.test(f.name))throw Error(`${f.name}: desteklenmeyen dosya.`);if(f.size>35*1024*1024)throw Error(`${f.name}: 35 MB sınırını aşıyor.`);const b=await new Promise((ok,no)=>{const r=new FileReader;r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=()=>no(Error('Dosya okunamadı.'));r.readAsDataURL(f)});status.textContent=`GitHub'a aktarılıyor: ${f.name}`;await call('upload',{file_name:f.name,mime_type:f.type,base64:b,area:'auto'})}status.textContent=`${fs.length} medya aktarıldı.`;await load()}catch(e){status.textContent=e.message}e.target.value=''};await load()}
function bindRoute(){if(window.__spUnifiedMedia)return;const base=window.loadView;if(typeof base!=='function'){setTimeout(bindRoute,100);return}window.loadView=async v=>v==='media'?render():base(v);window.__spUnifiedMedia=true}bindRoute();})();

/* ===== END admin/site-media-manager.js ===== */

/* ===== BEGIN admin/personel-yetki-v2.js ===== */
/* Stagepulse Admin — Personel / Organizasyon Yetki v5 */
(() => {
  'use strict';
  const R = window.STAGEPULSE_RUNTIME || {};
  const URL = R.supabaseUrl || window.SUPABASE_URL || '';
  const KEY = R.supabasePublishableKey || window.SUPABASE_KEY || '';
  const EDGE = `${URL.replace(/\/$/, '')}/functions/v1/org-admin-control`;
  let katalog=[], personeller=[], roller=[], pozisyonlar=[], departmanlar=[], bolgeler=[], taslak={};
  const qs=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const gucluSifre=p=>typeof p==='string'&&p.length>=10&&p.length<=128&&/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p)&&/\d/.test(p);
  function client(){if(window.StagepulseAdminSupabase?.getClient)return window.StagepulseAdminSupabase.getClient();if(window.__stagepulseAdminClient?.auth)return window.__stagepulseAdminClient;if(window.sb?.auth)return window.sb;throw Error('Supabase bağlantısı başlatılamadı.');}
  async function api(body){const c=client(),{data:{session}}=await c.auth.getSession();if(!session?.access_token)throw Error('Yönetici oturumu yok.');const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body),cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`İşlem başarısız (${r.status}).`);return j;}
  async function yukle(){const [c,m]=await Promise.all([api({action:'catalog'}),api({action:'members'})]);katalog=(c.capabilities||[]).filter(x=>x.active!==false);roller=c.roles||[];pozisyonlar=c.positions||[];departmanlar=c.departments||[];bolgeler=c.regions||[];personeller=m.members||[];}
  function toast2(msg,ok=true){if(typeof window.toast==='function')window.toast(msg,ok);else alert(msg)}
  function close(){qs('#spStaffModal')?.remove()}
  function profile(id){return personeller.find(x=>x.user_id===id)||null}
  function toggleHtml(key,on,label,description){return `<button type="button" class="sp-toggle ${on?'is-on':''}" role="switch" aria-checked="${on}" data-k="${esc(key)}"><span class="sp-toggle-track"><span class="sp-toggle-knob"></span></span><span class="sp-toggle-copy"><b>${esc(label)}</b><small>${esc(description||(on?'Açık':'Kapalı'))}</small></span></button>`}
  function bind(){document.querySelectorAll('#spStaffModal .sp-toggle').forEach(el=>el.addEventListener('click',()=>{const k=el.dataset.k;taslak[k]=!taslak[k];el.classList.toggle('is-on',!!taslak[k]);el.setAttribute('aria-checked',String(!!taslak[k]));const s=el.querySelector('small');if(s)s.textContent=taslak[k]?'Açık':'Kapalı'}));qs('#spClose')?.addEventListener('click',close);qs('#spCancel')?.addEventListener('click',close);qs('#spSaveMembership')?.addEventListener('click',()=>window.__spSaveMembershipV5(qs('#spStaffModal')?.dataset.userId||''));qs('#spSaveCapabilities')?.addEventListener('click',()=>window.__spSaveCapabilitiesV5(qs('#spStaffModal')?.dataset.userId||''));qs('#spToggleActive')?.addEventListener('click',()=>window.__spSetActiveV5(qs('#spStaffModal')?.dataset.userId||''));qs('#spResetPassword')?.addEventListener('click',()=>window.__spResetPasswordV5(qs('#spStaffModal')?.dataset.userId||''));qs('#spDeleteStaff')?.addEventListener('click',()=>window.__spDeleteStaffV5(qs('#spStaffModal')?.dataset.userId||''))}
  function modal(id=''){const p=profile(id);taslak=Object.fromEntries(katalog.map(x=>[x.key,(p?.capabilities||[]).some(c=>c.key===x.key)]));close();const roleCode=p?.role?.code||'employee',posCode=p?.position?.code||'',depId=p?.department_id||'',regId=p?.region_id||'';document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="spStaffModal" data-user-id="${esc(id)}"><div class="modal-card sp-staff-modal"><button class="close" type="button" id="spClose" aria-label="Kapat">×</button><div class="modal-top"><div><span class="muted small">${p?'Kullanıcı düzenle':'Yeni kullanıcı'}</span><h2>${p?esc(p.profile?.display_name||p.profile?.username||'Kullanıcı'):'Yeni Kullanıcı'}</h2></div>${p?`<button type="button" class="btn ${p.active?'':'btn-primary'}" id="spToggleActive">${p.active?'Pasifleştir':'Aktif Et'}</button>`:''}</div><div class="grid2"><label>Ad Soyad *<input id="spName" value="${esc(p?.profile?.display_name||'')}" autocomplete="name"></label><label>Kullanıcı adı *<input id="spUsername" value="${esc(p?.profile?.username||'')}" ${p?'readonly':''} autocomplete="username" autocapitalize="none"></label>${!p?`<label>Şifre *<input id="spPassword" type="password" minlength="10" autocomplete="new-password"></label>`:`<label>Yeni şifre<input id="spPassword" type="password" minlength="10" autocomplete="new-password"></label>`}</div><div class="grid2"><label>Rol<select id="spRole">${roller.filter(r=>r.code!=='owner'&&r.active!==false).map(r=>`<option value="${esc(r.code)}" ${roleCode===r.code?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><label>Pozisyon<select id="spPosition">${pozisyonlar.filter(r=>r.code!=='owner'&&r.active!==false).map(r=>`<option value="${esc(r.code)}" ${posCode===r.code?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><label>Departman<select id="spDepartment"><option value="">Seçin</option>${departmanlar.filter(d=>d.active!==false).map(d=>`<option value="${esc(d.id)}" ${depId===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><label>Bölge<select id="spRegion"><option value="">Seçin</option>${bolgeler.filter(d=>d.active!==false).map(d=>`<option value="${esc(d.id)}" ${regId===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label></div><div class="sp-permissions-head"><div><h3>Yönetim Yetkileri</h3><p class="muted">${katalog.length} aktif canonical yetki.</p></div></div><div class="sp-permissions-shell">${Object.entries(katalog.reduce((a,r)=>{(a[r.category||'Genel']??=[]).push(r);return a},{})).map(([cat,rs])=>`<section class="sp-permission-group"><div class="sp-group-title">${esc(cat)}</div><div class="sp-permission-list">${rs.map(r=>toggleHtml(r.key,taslak[r.key],r.name,r.description)).join('')}</div></section>`).join('')}</div><div class="modal-actions">${p?`<button type="button" class="btn btn-primary" id="spSaveMembership">Bilgileri kaydet</button><button type="button" class="btn btn-primary" id="spSaveCapabilities">Yetkileri kaydet</button><button type="button" class="btn" id="spResetPassword">Şifreyi değiştir</button><button type="button" class="btn btn-danger" id="spDeleteStaff">Kalıcı sil</button>`:`<button type="button" class="btn btn-primary" id="spSaveMembership">Personeli oluştur</button>`}<button type="button" class="btn" id="spCancel">Kapat</button></div></div></div>`);bind()}
  async function liste(){try{await yukle();const c=qs('#content');if(!c)throw Error('Personel içerik alanı bulunamadı.');c.innerHTML=`<div class="page-head"><div><h1>Personel</h1><p class="muted">${personeller.length} kullanıcı · ${katalog.length} yönetim yetkisi</p></div><button type="button" class="btn btn-primary" id="spAddStaff">+ Personel Ekle</button></div><div class="panel"><div class="staff-grid">${personeller.map(p=>`<article class="staff-card"><div class="staff-card-top"><div><span class="status ${p.active?'accepted':'cancelled'}">${p.active?'Aktif':'Pasif'}</span><h3>${esc(p.profile?.display_name||p.profile?.username||'Kullanıcı')}</h3><p>${esc(p.profile?.username||'')} · ${esc(p.role?.name||p.role?.code||'Kullanıcı')}</p><p class="muted">${esc(p.department?.name||'Departman atanmadı')}${p.region?.name?` · ${esc(p.region.name)}`:''}</p></div><button type="button" class="btn btn-primary sp-edit-staff" data-id="${esc(p.user_id)}">Düzenle</button></div><div class="staff-card-meta"><span>${(p.capabilities||[]).length}/${katalog.length} yetki açık</span><span>${esc(p.profile?.last_sign_in_at?new Date(p.profile.last_sign_in_at).toLocaleString('tr-TR'):'Henüz giriş yok')}</span></div></article>`).join('')||'<div class="empty muted">Henüz kullanıcı yok.</div>'}</div></div>`;qs('#spAddStaff')?.addEventListener('click',()=>modal(''));document.querySelectorAll('.sp-edit-staff').forEach(b=>b.addEventListener('click',()=>modal(b.dataset.id)))}catch(e){const c=qs('#content');if(c)c.innerHTML=`<div class="notice"><b>Personel servisi kullanılamıyor</b><p>${esc(e.message||e)}</p></div>`}}
  window.__spSaveMembershipV5=async id=>{const name=qs('#spName')?.value?.trim(),username=qs('#spUsername')?.value?.trim().toLowerCase(),role_code=qs('#spRole')?.value||'employee',position_code=qs('#spPosition')?.value||'',department_id=qs('#spDepartment')?.value||null,region_id=qs('#spRegion')?.value||null,manager_user_id=null,password=qs('#spPassword')?.value||'';if(!name||!username)return toast2('Ad Soyad ve kullanıcı adı zorunlu.',false);if(!position_code)return toast2('Pozisyon seçin.',false);try{if(id){await api({action:'save_membership',user_id:id,role_code,position_code,department_id,region_id,manager_user_id,active:profile(id)?.active!==false});if(password&&!gucluSifre(password))return toast2('Şifre en az 10 karakter, bir harf ve bir rakam içermeli.',false);if(password)await api({action:'reset_password',user_id:id,password}) ;toast2('Personel bilgileri kaydedildi.')}else{if(!gucluSifre(password))return toast2('Şifre en az 10 karakter, bir harf ve bir rakam içermeli.',false);await api({action:'create_member',username,display_name:name,password,role_code,position_code,department_id,region_id,manager_user_id,capabilities:Object.keys(taslak).filter(k=>taslak[k])});toast2('Personel oluşturuldu.')}close();await liste()}catch(e){toast2(e.message||'İşlem başarısız.',false)}};
  window.__spSaveCapabilitiesV5=async id=>{try{for(const key of Object.keys(taslak))await api({action:'set_capability',user_id:id,capability_key:key,enabled:taslak[key]===true});toast2('Yönetim yetkileri kaydedildi.');close();await liste()}catch(e){toast2(e.message||'Yetkiler kaydedilemedi.',false)}};
  window.__spSetActiveV5=async id=>{const p=profile(id);if(!p)return;try{await api({action:'save_membership',user_id:id,role_code:p.role?.code||'employee',position_code:p.position?.code||'employee',department_id:p.department_id||null,region_id:p.region_id||null,manager_user_id:null,active:!p.active});toast2(p.active?'Personel pasifleştirildi.':'Personel aktif edildi.');close();await liste()}catch(e){toast2(e.message||'Aktiflik değiştirilemedi.',false)}};
  window.__spResetPasswordV5=async id=>{const p=profile(id);if(!p)return;const password=prompt(`Yeni şifre (${p.profile?.username||''}):`)||'';if(!gucluSifre(password))return toast2('Şifre en az 10 karakter, bir harf ve bir rakam içermeli.',false);try{await api({action:'reset_password',user_id:id,password});toast2('Şifre değiştirildi.')}catch(e){toast2(e.message||'Şifre değiştirilemedi.',false)}};
  window.__spDeleteStaffV5=async id=>{if(!confirm('Bu kullanıcı kalıcı olarak silinsin mi?'))return;try{await api({action:'delete_member',user_id:id});toast2('Kullanıcı silindi.');close();await liste()}catch(e){toast2(e.message||'Kullanıcı silinemedi.',false)}};
  window.personnelView=liste;window.staffModal=id=>modal(id||'');
  const once=window.loadView;window.loadView=async function(v){if(v==='personnel'){await liste();const t=qs('#viewTitle'),s=qs('#viewSubtitle');if(t)t.textContent='Personel';if(s)s.textContent='Personeller, görevler ve yönetim yetkileri';if(location.hash!=='#personnel')history.replaceState(null,'','#personnel');return}return typeof once==='function'?once.apply(this,arguments):undefined};
  if(location.hash==='#personnel')setTimeout(liste,0);
})();

/* ===== END admin/personel-yetki-v2.js ===== */

/* ===== BEGIN admin/admin-business-flow-v1.js ===== */
/* Stagepulse Admin — canonical business workflow navigation. */
(() => {
  'use strict';
  const FLOW=[
    ['customers','Müşteriler'],['offers','Teklifler'],['calendar','İşler / Takvim'],['personnel','Personel'],['equipment','Ekipman'],['finance','Finans'],['command-center','Komuta Merkezi']
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function go(view){document.querySelector(`#sideNav button[data-view="${view}"]`)?.click();}
  function render(){
    const content=document.getElementById('content'); if(!content)return;
    const hash=(location.hash||'#dashboard').slice(1); const i=FLOW.findIndex(x=>x[0]===hash); if(i<0)return;
    let bar=document.getElementById('spBusinessFlow');
    if(!bar){bar=document.createElement('section');bar.id='spBusinessFlow';bar.className='panel';const head=content.querySelector('.page-head');if(head)head.insertAdjacentElement('afterend',bar);else content.prepend(bar);}
    bar.innerHTML=`<div class="sp-bf-head"><strong>İş akışı</strong><span>${i+1}/${FLOW.length}</span></div><div class="sp-bf-steps">${FLOW.map((x,k)=>`<button type="button" class="${k===i?'active':''}" data-sp-bf="${esc(x[0])}"><small>${k+1}</small>${esc(x[1])}</button>`).join('')}</div>`;
    bar.querySelectorAll('[data-sp-bf]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.spBf)));
    if(!document.getElementById('spBusinessFlowStyle')){const s=document.createElement('style');s.id='spBusinessFlowStyle';s.textContent='#spBusinessFlow{padding:11px 12px;margin:0 0 14px;border-radius:14px}#spBusinessFlow .sp-bf-head{display:flex;justify-content:space-between;margin-bottom:8px;font-size:11px}#spBusinessFlow .sp-bf-head span{opacity:.45}#spBusinessFlow .sp-bf-steps{display:flex;gap:5px;overflow:auto}#spBusinessFlow button{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:inherit;border-radius:9px;padding:7px 9px;white-space:nowrap;font-size:10px;cursor:pointer}#spBusinessFlow button.active{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15)}#spBusinessFlow small{opacity:.45;margin-right:5px}';document.head.appendChild(s)}
  }
  let t;function watch(){clearTimeout(t);t=setTimeout(render,250)}
  window.addEventListener('hashchange',watch);window.addEventListener('stagepulse-admin-ready',watch);document.addEventListener('DOMContentLoaded',watch);
  document.addEventListener('click',e=>{if(e.target.closest('#sideNav button[data-view]'))watch()},true);
})();

/* ===== END admin/admin-business-flow-v1.js ===== */

/* ===== BEGIN admin/command-center-single-route.js ===== */
/* Stagepulse — single canonical Command Center route. */
(() => {
  'use strict';

  const runtime = () => window.STAGEPULSE_RUNTIME || {};
  let client;
  let installed = false;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v) => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }).format(Number(v) || 0);
  const n = (v) => Number(v) || 0;

  function sb() {
    if (client) return client;
    client = window.StagepulseAdminSupabase?.getClient?.() ||
      window.__stagepulseAdminClient || window.supabaseClient || window.sb || null;
    return client;
  }

  async function read(table, select='*', options={}) {
    const c = sb();
    if (!c) throw new Error('Supabase bağlantısı hazır değil.');
    let q = c.from(table).select(select);
    if (options.order) q = q.order(options.order[0], { ascending: options.order[1] !== false });
    if (options.limit) q = q.limit(options.limit);
    if (options.eq) q = q.eq(options.eq[0], options.eq[1]);
    const r = await q;
    if (r.error) throw r.error;
    return r.data || [];
  }

  function navClass(view) {
    document.querySelectorAll('#sideNav button[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }

  function setHeader() {
    const t = document.getElementById('viewTitle');
    const s = document.getElementById('viewSubtitle');
    if (t) t.textContent = 'Komuta Merkezi';
    if (s) s.textContent = 'Şirket · satış · operasyon · finans · AI';
  }

  function styles() {
    if (document.getElementById('spSingleCCStyle')) return;
    const s = document.createElement('style');
    s.id = 'spSingleCCStyle';
    s.textContent = `
      .sp-cc{max-width:1180px;margin:0 auto;padding:0 0 40px;color:inherit}
      .sp-cc-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:8px 0 16px}
      .sp-cc-kicker{font-size:10px;letter-spacing:.12em;opacity:.48;font-weight:800}.sp-cc h2{margin:5px 0;font-size:28px}.sp-cc-head p{margin:0;opacity:.58;font-size:13px}
      .sp-cc-tabs{display:flex;gap:6px;overflow:auto;border-bottom:1px solid rgba(255,255,255,.08);padding:0 0 10px;margin-bottom:14px}.sp-cc-tabs button{border:1px solid transparent;background:transparent;color:inherit;border-radius:9px;padding:9px 12px;white-space:nowrap;cursor:pointer;opacity:.6}.sp-cc-tabs button.active{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.06);opacity:1}
      .sp-cc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.sp-cc-card{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025);border-radius:13px;padding:14px;text-align:left}.sp-cc-card strong{display:block;font-size:24px}.sp-cc-card span{display:block;font-size:11px;opacity:.55;margin-top:3px}.sp-cc-card button{margin-top:9px;border:0;background:rgba(255,255,255,.06);color:inherit;border-radius:7px;padding:6px 8px;font-size:10px;cursor:pointer}.sp-cc-section{border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.018);margin-top:12px;padding:14px}.sp-cc-section h3{margin:0 0 9px;font-size:15px}.sp-cc-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.06)}.sp-cc-row:first-child{border-top:0}.sp-cc-row-main{min-width:0}.sp-cc-row-main b,.sp-cc-row-main small{display:block}.sp-cc-row-main b{font-size:12px}.sp-cc-row-main small{font-size:10px;opacity:.52;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.sp-cc-tags{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.sp-cc-tag{font-size:10px;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.06);white-space:nowrap}.sp-cc-empty{padding:10px 0;opacity:.5;font-size:12px}.sp-cc-health{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.sp-cc-health>div{padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);font-size:10px;display:flex;justify-content:space-between}.sp-cc-health b{font-size:10px}.sp-cc-dot{width:7px;height:7px;display:inline-block;border-radius:50%;background:#25d999;margin-right:5px}.sp-cc-flow{display:flex;gap:6px;overflow:auto;margin:0 0 12px}.sp-cc-flow span{min-width:104px;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);font-size:11px}.sp-cc-list{display:grid;gap:4px}.sp-cc-agent{padding:10px 0;border-top:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;gap:12px}.sp-cc-agent:first-child{border-top:0}.sp-cc-agent b,.sp-cc-agent small{display:block}.sp-cc-agent small{opacity:.5;font-size:10px;margin-top:3px}.sp-cc-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sp-cc-mini{padding:11px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.sp-cc-mini small,.sp-cc-mini strong{display:block}.sp-cc-mini small{opacity:.5}.sp-cc-mini strong{margin-top:4px;font-size:16px}
      @media(max-width:900px){.sp-cc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-cc-health{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:600px){.sp-cc{padding-bottom:26px}.sp-cc-head h2{font-size:24px}.sp-cc-head p{font-size:11px}.sp-cc-grid{gap:7px}.sp-cc-card{padding:12px}.sp-cc-card strong{font-size:21px}.sp-cc-section{padding:11px}.sp-cc-row{display:block}.sp-cc-tags{justify-content:flex-start;margin-top:7px}.sp-cc-mini-grid{grid-template-columns:1fr}.sp-cc-flow span{min-width:94px}}
    `;
    document.head.appendChild(s);
  }

  function tabs(active) {
    return `<nav class="sp-cc-tabs" aria-label="Komuta Merkezi"><button data-sp-tab="overview" class="${active==='overview'?'active':''}">Genel</button><button data-sp-tab="operations" class="${active==='operations'?'active':''}">Operasyon</button><button data-sp-tab="finance" class="${active==='finance'?'active':''}">Finans</button><button data-sp-tab="ai" class="${active==='ai'?'active':''}">AI</button><button data-sp-tab="management" class="${active==='management'?'active':''}">Yönetim</button></nav>`;
  }

  async function overview() {
    const [customers, offers, jobs, events, staff, equipment, tasks, finance, aiRuns] = await Promise.all([
      read('customers','id'),read('teklifler','id'),read('jobs','id'),read('event_projects','id'),read('staff_profiles','user_id'),read('equipment','id'),read('event_tasks','id,status'),read('event_financials','event_id,estimated_revenue,estimated_cost,actual_revenue,actual_cost'),read('ai_runs','id')
    ]);
    const openTasks = tasks.filter(x=>!['done','cancelled'].includes(x.status)).length;
    return `<div class="sp-cc-health"><div><span>Veri</span><b><i class="sp-cc-dot"></i>Canlı</b></div><div><span>Operasyon</span><b>Bağlı</b></div><div><span>Finans</span><b>Bağlı</b></div><div><span>AI</span><b>Hazır</b></div></div>
      <div class="sp-cc-flow"><span>1 · Müşteri</span><span>2 · Teklif</span><span>3 · İş</span><span>4 · Etkinlik</span><span>5 · Kaynaklar</span><span>6 · Finans</span><span>7 · AI + Onay</span></div>
      <div class="sp-cc-grid">${[
        ['Müşteriler',customers.length,'customers'],['Teklifler',offers.length,'offers'],['İşler',jobs.length,'calendar'],['Etkinlikler',events.length,'calendar'],['Personel',staff.length,'personnel'],['Ekipman',equipment.length,'equipment'],['Açık görev',openTasks,'calendar'],['Finans kayıtları',finance.length,'finance'],['AI çalışmaları',aiRuns.length,'ai']
      ].map(x=>`<div class="sp-cc-card"><strong>${x[1]}</strong><span>${esc(x[0])}</span><button data-sp-nav="${x[2]}">Aç</button></div>`).join('')}</div>
      <div id="spCCOverviewLists"></div>`;
  }

  async function overviewLists() {
    const [customers, events] = await Promise.all([
      read('stagepulse_customer_command_view','customer_id,name,company,phone,offer_count,job_count,event_count,task_count',{limit:30}),
      read('stagepulse_event_command_view','event_id,title,status,venue,city,customer_name,customer_company,staff_count,equipment_count,task_count,completed_task_count,event_start_at',{limit:30,order:['event_start_at',true]})
    ]);
    return `<div class="sp-cc-section"><h3>Müşteriler</h3><div class="sp-cc-list">${customers.map(c=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(c.company||c.name||'İsimsiz')}</b><small>${esc(c.name||'')} ${c.phone?'· '+esc(c.phone):''}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">Teklif ${n(c.offer_count)}</span><span class="sp-cc-tag">İş ${n(c.job_count)}</span><span class="sp-cc-tag">Etkinlik ${n(c.event_count)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Müşteri bulunamadı.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Yaklaşan / aktif etkinlikler</h3><div class="sp-cc-list">${events.map(e=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(e.title||'Etkinlik')}</b><small>${esc(e.customer_company||e.customer_name||'Müşteri yok')} · ${esc(e.city||e.venue||'Lokasyon yok')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(e.status||'—')}</span><span class="sp-cc-tag">P ${n(e.staff_count)}</span><span class="sp-cc-tag">E ${n(e.equipment_count)}</span><span class="sp-cc-tag">G ${n(e.completed_task_count)}/${n(e.task_count)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Etkinlik bulunamadı.</div>'}</div></div>`;
  }

  async function operations() {
    const [tasks, resources, maintenance, vehicles, checklists, risks, automations] = await Promise.all([
      read('event_tasks','id,status'),read('stagepulse_resource_command_view','resource_id,event_id,resource_type,quantity,status,event_title,event_start_at,staff_name,equipment_brand,equipment_model,vehicle_name,vehicle_plate',{limit:80}),read('equipment_maintenance_plans','id,status'),read('vehicles','id,active'),read('stagepulse_checklist_command_view','checklist_id,event_id,name,phase,status,item_count,completed_items,required_open_items',{limit:50}),read('stagepulse_risk_command_view','id,title,event_title,severity,likelihood,status',{limit:50}),read('stagepulse_automation_command_view','rule_id,code,name,active,run_count,completed_runs,last_run_at',{limit:50})
    ]);
    const open=tasks.filter(x=>!['done','cancelled'].includes(x.status)).length;
    const overdue=maintenance.filter(x=>x.status==='overdue').length;
    const activeVehicles=vehicles.filter(x=>x.active!==false).length;
    return `<div class="sp-cc-mini-grid"><div class="sp-cc-mini"><small>Açık görev</small><strong>${open}</strong></div><div class="sp-cc-mini"><small>Bakım gecikmiş</small><strong>${overdue}</strong></div><div class="sp-cc-mini"><small>Aktif araç</small><strong>${activeVehicles}</strong></div></div>
      <div class="sp-cc-section"><h3>Kaynak atamaları</h3><div class="sp-cc-list">${resources.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.staff_name||((r.equipment_brand||'')+' '+(r.equipment_model||''))||r.vehicle_name||r.vehicle_plate||'Kaynak')}</b><small>${esc(r.event_title||'Etkinlik')} · ${esc(r.status||'—')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.resource_type||'')}</span><span class="sp-cc-tag">${n(r.quantity)} adet</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz kaynak ataması yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Kontrol listeleri</h3><div class="sp-cc-list">${checklists.map(c=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(c.name)}</b><small>${esc(c.phase)} · ${esc(c.status)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${n(c.completed_items)}/${n(c.item_count)}</span><span class="sp-cc-tag">Zorunlu açık ${n(c.required_open_items)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Kontrol listesi yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Riskler</h3><div class="sp-cc-list">${risks.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.title)}</b><small>${esc(r.event_title||'İşletme')} · ${esc(r.likelihood)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.severity)}</span><span class="sp-cc-tag">${esc(r.status)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Risk yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Otomasyon</h3><div class="sp-cc-list">${automations.map(a=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(a.name||a.code)}</b><small>${a.active?'Aktif':'Pasif'} · ${n(a.completed_runs)}/${n(a.run_count)} tamamlandı</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${a.last_run_at?new Date(a.last_run_at).toLocaleString('tr-TR'):'Çalışmadı'}</span></div></div>`).join('')||'<div class="sp-cc-empty">Otomasyon yok.</div>'}</div></div>`;
  }

  async function finance() {
    const data=await read('stagepulse_finance_command_view','event_id,event_title,customer_company,customer_name,estimated_revenue,estimated_cost,actual_revenue,actual_cost,currency',{limit:100});
    const revenue=data.reduce((a,x)=>a+n(x.actual_revenue??x.estimated_revenue),0);
    const cost=data.reduce((a,x)=>a+n(x.actual_cost??x.estimated_cost),0);
    return `<div class="sp-cc-mini-grid"><div class="sp-cc-mini"><small>Gelir</small><strong>${money(revenue)}</strong></div><div class="sp-cc-mini"><small>Maliyet</small><strong>${money(cost)}</strong></div><div class="sp-cc-mini"><small>Marj</small><strong>${money(revenue-cost)}</strong></div></div><div class="sp-cc-section"><h3>Etkinlik finansları</h3><div class="sp-cc-list">${data.map(x=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(x.event_title||'Etkinlik')}</b><small>${esc(x.customer_company||x.customer_name||'')} · ${esc(x.currency||'TRY')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${money(x.actual_revenue??x.estimated_revenue)}</span><span class="sp-cc-tag">Maliyet ${money(x.actual_cost??x.estimated_cost)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Finans kaydı yok.</div>'}</div></div>`;
  }

  async function ai() {
    const [agents,runs,approvals]=await Promise.all([
      read('ai_agents','id,code,name,purpose,scope,active,can_read,can_propose,can_execute',{limit:50}),read('stagepulse_ai_command_view','ai_run_id,agent_id,action_type,status,created_at,event_title',{limit:50,order:['created_at',false]}),read('ai_action_requests','id,action_type,status,reason,created_at',{limit:50,order:['created_at',false]})
    ]);
    return `<div class="sp-cc-section"><h3>AI ajanları</h3><div class="sp-cc-list">${agents.filter(a=>a.active!==false).map(a=>`<div class="sp-cc-agent"><div><b>${esc(a.name)}</b><small>${esc(a.purpose||a.scope||'')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${a.can_read?'Okuma':'Kapalı'}</span><span class="sp-cc-tag">${a.can_propose?'Öneri':'Kapalı'}</span><span class="sp-cc-tag">${a.can_execute?'Uygulama':'Onay gerekli'}</span></div></div>`).join('')||'<div class="sp-cc-empty">Aktif AI ajanı yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Son AI çalışmaları</h3><div class="sp-cc-list">${runs.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.action_type||'AI çalışması')}</b><small>${esc(r.event_title||'Genel')} · ${r.created_at?new Date(r.created_at).toLocaleString('tr-TR'):''}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.status||'—')}</span><span class="sp-cc-tag">${esc(r.agent_id||'ajan')}</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz AI çalışması yok. Ajanlar yapılandırılmış durumda.</div>'}</div></div>
      <div class="sp-cc-section"><h3>AI onay merkezi</h3><div class="sp-cc-list">${approvals.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.action_type||'Onay')}</b><small>${esc(r.reason||'Onay talebi')} · ${r.created_at?new Date(r.created_at).toLocaleString('tr-TR'):''}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.status||'pending')}</span></div></div>`).join('')||'<div class="sp-cc-empty">Bekleyen AI onayı yok.</div>'}</div></div>`;
  }

  async function management() {
    const [goals, initiatives, risks] = await Promise.all([
      read('executive_goals','id,title,status,priority,current_value,target_value,due_at',{limit:50,order:['created_at',false]}),read('strategic_initiatives','id,title,status,risk_level,description',{limit:50,order:['created_at',false]}),read('business_risks','id,title,category,severity,likelihood,status,mitigation',{limit:50,order:['created_at',false]})
    ]);
    return `<div class="sp-cc-section"><h3>Yönetim hedefleri</h3><div class="sp-cc-list">${goals.map(g=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(g.title)}</b><small>${esc(g.status)} · ${esc(g.priority)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(g.current_value??'—')} / ${esc(g.target_value??'—')}</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz hedef tanımlanmadı.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Stratejik girişimler</h3><div class="sp-cc-list">${initiatives.map(i=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(i.title)}</b><small>${esc(i.description||'')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(i.status)}</span><span class="sp-cc-tag">Risk ${esc(i.risk_level)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz stratejik girişim yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>İşletme riskleri</h3><div class="sp-cc-list">${risks.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.title)}</b><small>${esc(r.category)} · ${esc(r.likelihood)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.severity)}</span><span class="sp-cc-tag">${esc(r.status)}</span></div></div>`).join('')||'<div class="sp-cc-empty">İşletme riski yok.</div>'}</div></div>`;
  }

  async function render(tab='overview') {
    styles();
    navClass('command-center');
    setHeader();
    const content=document.getElementById('content'); if(!content)return;
    content.innerHTML=`<div class="sp-cc"><header class="sp-cc-head"><div><div class="sp-cc-kicker">STAGEPULSE · PATRON / YÖNETİM</div><h2>Komuta Merkezi</h2><p>Tek merkezden şirket, satış, operasyon, finans ve AI yönetimi.</p></div><button class="btn" id="spCCRefresh">Yenile</button></header>${tabs(tab)}<div id="spCCBody"><div class="sp-cc-empty">Veriler yükleniyor…</div></div></div>`;
    const body=document.getElementById('spCCBody');
    try {
      if(tab==='overview') body.innerHTML=await overview()+await overviewLists();
      else if(tab==='operations') body.innerHTML=await operations();
      else if(tab==='finance') body.innerHTML=await finance();
      else if(tab==='ai') body.innerHTML=await ai();
      else body.innerHTML=await management();
    } catch(e) {
      body.innerHTML=`<div class="sp-cc-section"><h3>Veri bağlantısı hatası</h3><div class="sp-cc-empty">${esc(e.message||e)}</div></div>`;
    }
    content.querySelectorAll('[data-sp-tab]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.spTab)));
    content.querySelectorAll('[data-sp-nav]').forEach(b=>b.addEventListener('click',()=>window.loadView?.(b.dataset.spNav)));
    document.getElementById('spCCRefresh')?.addEventListener('click',()=>render(tab));
  }

  function install() {
    if(installed)return;
    installed=true;
    styles();
    window.openStagepulseCommandCenter=(tab='overview')=>render(tab);
    window.commandCenterView=()=>render('overview');
    window.CommandCenter={render};
    const oldLoad=window.loadView;
    window.loadView=async function(view) {
      if(view==='command-center') { history.replaceState(null,'','#command-center'); return render('overview'); }
      return oldLoad(view);
    };
    if((location.hash||'#dashboard')==='#command-center')setTimeout(()=>render('overview'),250);
  }

  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(install,100));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,600));
  if(document.readyState!=='loading')setTimeout(install,50);
})();

/* ===== END admin/command-center-single-route.js ===== */

/* ===== BEGIN admin/command-center-ai-v1.js ===== */
/* Stagepulse Command Center — visible AI layer + admin approval center. */
(() => {
  'use strict';
  const URL='https://mtjcqqrogjqaxkagwkti.supabase.co';
  const KEY='sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  let client;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sb=()=>client||(client=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.supabaseClient||null);
  const toast=(msg,ok=true)=>{let e=document.getElementById('spAiToast');if(!e){e=document.createElement('div');e.id='spAiToast';e.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10000;padding:10px 14px;border-radius:10px;background:#12151b;border:1px solid rgba(255,255,255,.12);font-size:12px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35)';document.body.appendChild(e)}e.textContent=msg;e.style.borderColor=ok?'rgba(40,220,155,.35)':'rgba(255,100,100,.4)';clearTimeout(e._t);e._t=setTimeout(()=>e.remove(),2500)};
  const styles=()=>{if(document.getElementById('spAIStyle'))return;const s=document.createElement('style');s.id='spAIStyle';s.textContent='.sp-ai-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.sp-ai-card{padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.sp-ai-card-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.sp-ai-card strong{font-size:11px}.sp-ai-card-top span{font-size:8px;opacity:.55}.sp-ai-card p{font-size:9px;line-height:1.45;opacity:.55;margin:7px 0}.sp-ai-perms{display:flex;gap:4px;flex-wrap:wrap}.sp-ai-perms i{font-style:normal;font-size:8px;padding:3px 5px;border-radius:999px;background:rgba(255,255,255,.05)}.sp-ai-approval-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.sp-ai-approval-actions button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:8px;padding:7px 10px;font-size:10px;cursor:pointer}.sp-ai-approval-actions .ok{border-color:rgba(40,220,155,.28)}.sp-ai-approval-actions .no{border-color:rgba(255,100,100,.25)}.sp-ai-approval-actions button:disabled{opacity:.45;cursor:not-allowed}.sp-ai-payload{font-size:10px;opacity:.55;margin-top:4px;word-break:break-word;line-height:1.35}@media(max-width:760px){.sp-ai-grid{grid-template-columns:1fr 1fr}}@media(max-width:480px){.sp-ai-grid{grid-template-columns:1fr}}';document.head.appendChild(s)};
  async function load(){
    const c=sb();if(!c)return;
    styles();
    const [agents,runs,requests]=await Promise.all([
      c.from('ai_agents').select('code,name,purpose,active,can_read,can_propose,can_execute').eq('active',true).order('name'),
      c.from('stagepulse_ai_command_view').select('ai_run_id,agent_id,action_type,status,created_at,event_title').order('created_at',{ascending:false}).limit(50),
      c.from('ai_action_requests').select('id,action_type,target_type,target_id,payload,status,approved_by,approved_at,executed_at,created_at').order('created_at',{ascending:false}).limit(50)
    ]);
    if(agents.error||runs.error||requests.error){const err=agents.error||runs.error||requests.error;const host=document.querySelector('.sp-cc');if(host)host.querySelector('#spVisibleAI')?.remove();const old=document.getElementById('spAIDataError');if(old)old.remove();if(host){const box=document.createElement('div');box.id='spAIDataError';box.className='sp-cc-section';box.innerHTML='<h3>AI veri bağlantısı hatası</h3><p style="margin:0;font-size:11px;opacity:.6">'+esc(err.message||err)+'</p>';host.appendChild(box)}return;}
    const host=document.querySelector('.sp-cc');if(!host)return;
    document.getElementById('spAIDataError')?.remove();document.getElementById('spVisibleAI')?.remove();document.getElementById('spAIActions')?.remove();
    const agentsBox=document.createElement('section');agentsBox.id='spVisibleAI';agentsBox.className='sp-cc-section';
    agentsBox.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h3 style="margin:0">Stagepulse AI</h3><small style="opacity:.5">Okuma + öneri · doğrudan yürütme kapalı</small></div><div class="sp-ai-grid">'+(agents.data||[]).map(a=>'<article class="sp-ai-card"><div class="sp-ai-card-top"><strong>'+esc(a.name)+'</strong><span>AKTİF</span></div><p>'+esc(a.purpose)+'</p><div class="sp-ai-perms"><i>Okuma</i><i>Öneri</i><i>İşlem kapalı</i></div></article>').join('')+'</div>';
    host.appendChild(agentsBox);
    const actionBox=document.createElement('section');actionBox.id='spAIActions';actionBox.className='sp-cc-section';
    const pending=(requests.data||[]).filter(r=>r.status==='pending');
    actionBox.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h3 style="margin:0">AI işlem / onay merkezi</h3><small style="opacity:.5">AI önerir; yönetici açıkça onaylar veya reddeder.</small></div><span class="sp-ai-status">Bekleyen '+pending.length+'</span></div><div class="sp-cc-list" style="margin-top:8px">'+(pending.map(r=>{let payload='';try{payload=JSON.stringify(r.payload)}catch{payload=String(r.payload||'')}return '<div class="sp-cc-row"><div class="sp-cc-row-main"><b>'+esc(r.action_type||'AI işlemi')+'</b><small>'+esc([r.target_type,r.target_id].filter(Boolean).join(' · ')||'Genel')+' · '+(r.created_at?new Date(r.created_at).toLocaleString('tr-TR'):'')+'</small><div class="sp-ai-payload">'+esc(payload.slice(0,300))+'</div></div><div class="sp-ai-approval-actions"><button class="ok" data-sp-ai-approve="'+esc(r.id)+'">Onayla</button><button class="no" data-sp-ai-reject="'+esc(r.id)+'">Reddet</button></div></div>'}).join('')||'<div class="sp-cc-empty">Bekleyen AI işlemi yok.</div>')+'</div>';
    host.appendChild(actionBox);
    window.__stagepulseAIRefresh=load;
  }
  async function decide(id,approve){const c=sb();if(!c)throw new Error('Supabase bağlantısı hazır değil.');const r=await c.rpc('approve_ai_action_request',{p_request_id:id,p_approve:approve});if(r.error)throw r.error;toast(approve?'AI işlemi onaylandı.':'AI işlemi reddedildi.');await load()}
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-sp-ai-approve],[data-sp-ai-reject]');if(!b)return;b.disabled=true;try{await decide(b.dataset.spAiApprove||b.dataset.spAiReject,!!b.dataset.spAiApprove)}catch(err){b.disabled=false;toast(err.message||'AI onay işlemi başarısız.',false)}});
  document.addEventListener('click',e=>{if(e.target.closest('[data-sp-tab="ai"]'))setTimeout(load,350)});
  window.addEventListener('hashchange',()=>setTimeout(()=>{if(location.hash==='#command-center')load()},350));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(location.hash==='#command-center')load()},900));
})();
/* ===== END admin/command-center-ai-v1.js ===== */

/* ===== BEGIN admin/whatsapp-message-fix-v1.js ===== */
/* Stagepulse customer WhatsApp message: clean text + short public quote code. */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(num(v));
const phone=raw=>{let d=String(raw||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.startsWith('0')&&d.length===11)d='90'+d.slice(1);if(d.length===10&&d.startsWith('5'))d='90'+d;if(!d.startsWith('90')&&d.length>=10)d='90'+d.replace(/^0+/,'');return d};
const rt=()=>window.STAGEPULSE_RUNTIME||{};
async function getCode(id,o){try{if(o.public_code)return o.public_code;const c=window.sb||window.__stagepulseAdminClient||window.supabaseClient;if(!c)return '';const {data,error}=await c.rpc('ensure_quote_public_code',{p_offer_id:id});if(error)throw error;if(data){o.public_code=data;return data}}catch(e){console.error('public code',e)}return ''}
async function openWhatsAppClean(id){const offers=window.offers||[];const o=offers.find(x=>x.id===id);if(!o)return window.toast?.('Teklif bulunamadı',false);const p=phone(o.phone);if(!p||p.length<12)return window.toast?.('Müşteri telefonu yok veya geçersiz. Önce kaydedin.',false);
 const c=await getCode(id,o); const origin=location.origin.replace(/\/$/,''); const link=c?`${origin}/teklif-view.html?code=${encodeURIComponent(c)}`:'';
 const lines=[`Merhaba ${o.name||''},`,`Stagepulse teklifiniz hazır${o.quote_number?` (${o.quote_number})`:''}.`,o.type?`Hizmet: ${o.type}`:null,o.event_date?`Etkinlik tarihi: ${o.event_date}`:null,o.location?`Lokasyon: ${o.location}`:null,o.total!=null&&num(o.total)>0?`Toplam: ${money(o.total)}`:null,link?`Teklifi görüntülemek ve onaylamak için: ${link}`:null,'','Teknik ekipman ve yapılacak iş detayları teklif sayfasında yer almaktadır.','Herhangi bir sorunuz olursa buradan yazabilirsiniz.','Stagepulse'].filter(Boolean);
 window.open(`https://wa.me/${p}?text=${encodeURIComponent(lines.join('\n'))}`,'_blank','noopener');
 const st=o.status;if(st&&!['accepted','rejected','cancelled','archived'].includes(st)&&st!=='sent'){try{const sb=window.sb;const {error}=await sb.from('teklifler').update({status:'sent',updated_at:new Date().toISOString()}).eq('id',id);if(!error)o.status='sent';window.toast?.(error?'WhatsApp açıldı':'Teklif gönderildi · durum: Gönderildi',!error)}catch(e){window.toast?.('WhatsApp açıldı · durum güncellenemedi',false)}} else window.toast?.('WhatsApp müşteriye açıldı');}
window.addEventListener('stagepulse-admin-ready',()=>{window.openWhatsApp=openWhatsAppClean});window.addEventListener('load',()=>{window.openWhatsApp=openWhatsAppClean});setTimeout(()=>{window.openWhatsApp=openWhatsAppClean},1200);
})();
/* ===== END admin/whatsapp-message-fix-v1.js ===== */

/* ===== BEGIN admin/admin-final-hardening-v1.js ===== */
/* Stagepulse Admin — legacy panel hardening shim.
 * Crew/inventory are owned by admin-offer-final-fields-v1.js.
 * Photo UI is owned by admin-offer-edit-media-fix-v1.js.
 * This file intentionally does not create duplicate offer panels.
 */
(() => {
  'use strict';
  const modal=()=>document.getElementById('offerModal');
  const currentOfferId=()=>{
    const m=modal();
    return m?.dataset.offerId||m?.dataset.spOfferId||m?.querySelector('[data-sp-offer-id]')?.dataset.spOfferId||window.__spLastOfferModalId||window.__spLastOfferId||null;
  };
  function remember(){
    const m=modal();
    const id=currentOfferId();
    if(!m||!id)return;
    m.dataset.spLegacyHardening='disabled-duplicate-panels';
  }
  window.addEventListener('hashchange',()=>setTimeout(remember,100));
  setInterval(remember,1000);
  remember();
})();

/* ===== END admin/admin-final-hardening-v1.js ===== */

/* ===== BEGIN admin/admin-offer-final-fields-v1.js ===== */
/* Stagepulse Admin — single personnel field + self-contained inventory editor v5 */
(() => {
  'use strict';
  const client=()=>window.sb||window.__stagepulseAdminClient||window.supabaseClient;
  const toast=(m,ok=true)=>typeof window.toast==='function'?window.toast(m,ok):console[ok?'log':'error'](m);
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let lastOfferId=null;
  const modal=()=>document.getElementById('offerModal');
  const card=m=>m?.querySelector('.modal-card')||m;
  const offerId=m=>m?.dataset.offerId||m?.dataset.spOfferId||m?.querySelector('[data-sp-offer-id]')?.dataset.spOfferId||window.__spLastOfferModalId||window.__spLastOfferId||null;
  const api=()=>{const c=client();if(!c?.functions?.invoke)throw new Error('Admin bağlantısı hazır değil.');return c;};
  function findCrew(m){const candidates=[...m.querySelectorAll('input[type="number"]')].filter(x=>!x.closest('#spFinalOfferInventory'));return candidates.find(x=>/ekip\s*sayısı|personel\s*sayısı/i.test(x.closest('label')?.textContent||''))||null;}
  function normalizeCrew(m){m.querySelectorAll('#spFinalOfferCrew').forEach(x=>x.remove());const input=findCrew(m);if(!input)return null;input.id='spOfferCrewCount';const label=input.closest('label');if(label){label.dataset.spCanonicalCrew='1';[...label.childNodes].filter(n=>n.nodeType===3).forEach(n=>{if(String(n.nodeValue||'').trim())n.nodeValue='Personel sayısı';});let b=label.parentElement?.querySelector(':scope > [data-sp-crew-save]')||label.querySelector('[data-sp-crew-save]');if(!b){b=document.createElement('button');b.type='button';b.className='btn btn-primary';b.dataset.spCrewSave='1';b.textContent='Personel sayısını kaydet';b.style.marginTop='8px';}label.insertAdjacentElement('afterend',b);if(b.dataset.spBound!=='1'){b.dataset.spBound='1';b.onclick=()=>saveCrew(m,input.value);}}return input;}
  async function hydrateCrew(m,id,input){if(!input||input.dataset.spHydrated==='1')return;input.dataset.spHydrated='1';try{const {data,error}=await client().from('teklifler').select('crew_count').eq('id',id).maybeSingle();if(!error&&document.activeElement!==input)input.value=String(Math.max(0,Number(data?.crew_count)||0));}catch(_){}}
  async function saveCrew(m,value){const id=offerId(m);if(!id)return;const n=Math.max(0,Math.floor(Number(value)||0));try{const r=await api().functions.invoke('admin-offer-runtime',{body:{action:'set_crew',offer_id:id,crew_count:n}});if(r.error)throw r.error;const input=m.querySelector('#spOfferCrewCount');if(input)input.value=String(n);toast('Personel sayısı kaydedildi.');window.stagepulseRegenerateOfferPdf?.(id);}catch(e){toast(e.message||String(e),false);}}
  async function loadInventory(id){const r=await api().functions.invoke('admin-offer-runtime',{body:{action:'list_inventory',offer_id:id}});if(r.error)throw r.error;const d=r.data||{};return {inventory:Array.isArray(d.inventory)?d.inventory.map(x=>({equipment_id:x.equipment_id,category:x.equipment?.category,brand:x.equipment?.brand,model:x.equipment?.model,requested_qty:x.quantity,unit_price:x.unit_price,total:x.total,available_qty:x.inventory_available_qty,reserved_qty:x.inventory_reserved_qty,source_type:x.source_type,notes:x.notes})):[],equipment:Array.isArray(d.equipment)?d.equipment:[]};}
  function ensureInventoryPanel(m){let p=m.querySelector('#spFinalOfferInventory');if(p)return p;const c=card(m);p=document.createElement('section');p.id='spFinalOfferInventory';p.className='panel';p.style.marginTop='14px';p.innerHTML='<h3>Envanter</h3><p class="muted small">Teklifte kullanılacak ekipmanları envanterden ekleyin; adet, birim fiyatı, toplam ve rezervi yönetin.</p><div id="spOfferInventoryRows"></div><div class="actions sp-inline-form"><label style="flex:1;min-width:180px">Ekipman<select id="spOfferEqSelect"><option value="">Ekipman seçin</option></select></label><label style="width:100px">Adet<input id="spOfferEqQty" type="number" min="0.1" step="0.1" value="1"></label><label style="flex:1;min-width:150px">Not<input id="spOfferEqNotes" type="text" placeholder="Opsiyonel not"></label><button type="button" class="btn btn-primary" id="spOfferEqAdd">Envantere ekle</button></div>';const actions=c?.querySelector('.modal-actions');if(actions)c.insertBefore(p,actions);else c.appendChild(p);return p;}
  async function renderInventory(m,id){const p=ensureInventoryPanel(m),rows=p.querySelector('#spOfferInventoryRows');if(!rows)return;try{const {inventory,equipment}=await loadInventory(id);const sel=p.querySelector('#spOfferEqSelect'),old=sel?.value||'';if(sel&&document.activeElement!==sel){sel.innerHTML='<option value="">Ekipman seçin</option>'+equipment.map(e=>`<option value="${esc(e.id)}">${esc([e.category,e.brand,e.model].filter(Boolean).join(' · ')||'Ekipman')} — mevcut: ${Number(e.available_quantity??e.quantity)||0}</option>`).join('');if(old)sel.value=old;}rows.innerHTML=inventory.length?inventory.map(r=>{const q=Number(r.requested_qty)||0,u=Number(r.unit_price)||0;return `<div class="price-row" data-sp-inventory-row="${esc(r.equipment_id)}" style="display:grid;gap:8px;margin:12px 0;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)"><div><b>${esc([r.category,r.brand,r.model].filter(Boolean).join(' · ')||'Ekipman')}</b><br><span class="muted small">Mevcut: ${Number(r.available_qty)||0}</span></div><div class="sp-offer-price-grid"><label class="small">Adet<input type="number" min="0.1" step="0.1" value="${q}" data-sp-qty></label><label class="small">Birim fiyat<input type="number" min="0" step="1" value="${u}" data-sp-unit></label><div class="small"><span class="muted">Toplam</span><div data-sp-total aria-live="polite">${money(q*u)}</div></div><button type="button" class="btn btn-primary" data-sp-price-save="${esc(r.equipment_id)}">Kaydet</button></div><div class="sp-inline-form" style="display:flex;gap:8px;align-items:end"><label class="small">Rezerv<input type="number" min="0" step="0.1" value="${Number(r.reserved_qty)||0}" data-sp-reserve></label><button type="button" class="btn" data-sp-reserve-save="${esc(r.equipment_id)}">Rezervi kaydet</button><button type="button" class="btn btn-danger" data-sp-remove="${esc(r.equipment_id)}">Sil</button></div></div>`}).join(''):'<div class="muted small">Bu teklife henüz envanter ekipmanı eklenmemiş.</div>';rows.querySelectorAll('[data-sp-price-save]').forEach(b=>b.onclick=()=>savePricing(m,id,b.dataset.spPriceSave,b.closest('[data-sp-inventory-row]')));rows.querySelectorAll('[data-sp-reserve-save]').forEach(b=>b.onclick=()=>saveReserve(m,id,b.dataset.spReserveSave,b.closest('[data-sp-inventory-row]')));rows.querySelectorAll('[data-sp-remove]').forEach(b=>b.onclick=()=>removeInventory(m,id,b.dataset.spRemove));rows.querySelectorAll('[data-sp-qty],[data-sp-unit]').forEach(inp=>inp.oninput=()=>{const row=inp.closest('[data-sp-inventory-row]');const q=Number(row?.querySelector('[data-sp-qty]')?.value)||0;const u=Number(row?.querySelector('[data-sp-unit]')?.value)||0;const t=row?.querySelector('[data-sp-total]');if(t)t.textContent=money(q*u);});}catch(e){rows.innerHTML=`<div class="form-error">${esc(e.message||e)}</div>`;}}
  async function addInventory(m){const id=offerId(m),p=m.querySelector('#spFinalOfferInventory');if(!id||!p)return;const equipmentId=p.querySelector('#spOfferEqSelect')?.value,quantity=Number(p.querySelector('#spOfferEqQty')?.value),notes=p.querySelector('#spOfferEqNotes')?.value||null;if(!equipmentId||!Number.isFinite(quantity)||quantity<=0)return toast('Geçerli bir ekipman ve adet girin.',false);try{const r=await api().functions.invoke('admin-offer-runtime',{body:{action:'add_inventory',offer_id:id,equipment_id:equipmentId,quantity,notes}});if(r.error)throw r.error;toast('Envanter teklife eklendi.');await renderInventory(m,id);window.stagepulseRegenerateOfferPdf?.(id);}catch(e){toast(e.message||String(e),false);}}
  async function savePricing(m,id,equipmentId,row){const q=Number(row?.querySelector('[data-sp-qty]')?.value),p=Number(row?.querySelector('[data-sp-unit]')?.value);if(!Number.isFinite(q)||q<=0||!Number.isFinite(p)||p<0)return toast('Adet ve birim fiyatı kontrol edin.',false);try{const r=await api().functions.invoke('admin-offer-runtime',{body:{action:'set_inventory_pricing',offer_id:id,equipment_id:equipmentId,quantity:q,unit_price:p}});if(r.error)throw r.error;toast('Adet ve birim fiyat kaydedildi.');await renderInventory(m,id);window.stagepulseRegenerateOfferPdf?.(id);}catch(e){toast(e.message||String(e),false);}}
  async function saveReserve(m,id,equipmentId,row){const q=Number(row?.querySelector('[data-sp-reserve]')?.value);if(!Number.isFinite(q)||q<0)return toast('Geçerli rezerv miktarı gerekli.',false);try{const r=await api().functions.invoke('admin-offer-runtime',{body:{action:'set_inventory_reserved',offer_id:id,equipment_id:equipmentId,reserved_qty:q}});if(r.error)throw r.error;toast('Rezerv güncellendi.');await renderInventory(m,id);window.stagepulseRegenerateOfferPdf?.(id);}catch(e){toast(e.message||String(e),false);}}
  async function removeInventory(m,id,equipmentId){if(!confirm('Bu ekipman tekliften çıkarılsın mı?'))return;try{const r=await api().functions.invoke('admin-offer-runtime',{body:{action:'remove_inventory',offer_id:id,equipment_id:equipmentId}});if(r.error)throw r.error;toast('Envanter kalemi silindi.');await renderInventory(m,id);window.stagepulseRegenerateOfferPdf?.(id);}catch(e){toast(e.message||String(e),false);}}
  function bind(m){const id=offerId(m);if(!id)return;const crew=normalizeCrew(m);hydrateCrew(m,id,crew);const p=ensureInventoryPanel(m),add=p.querySelector('#spOfferEqAdd');if(add?.dataset.spBound!=='1'){add.dataset.spBound='1';add.onclick=()=>addInventory(m);}if(m.dataset.spOfferBound!==String(id)){m.dataset.spOfferBound=String(id);renderInventory(m,id);}}
  setInterval(()=>{const m=modal();if(!m||m.classList.contains('is-hidden')){lastOfferId=null;return;}const id=offerId(m);if(!id)return;if(id!==lastOfferId){lastOfferId=id;bind(m);return;}const crew=findCrew(m);if(crew&&!m.querySelector('#spOfferCrewCount'))bind(m);if(m.querySelector('#spFinalOfferCrew'))bind(m);const add=m.querySelector('#spOfferEqAdd');if(add&&!add.dataset.spBound)bind(m);},350);
})();
/* ===== END admin/admin-offer-final-fields-v1.js ===== */

/* ===== BEGIN admin/admin-offer-pdf-auto-sync-v2.js ===== */
/* Stagepulse Admin — synchronized PDF route v3. */
(() => {
  'use strict';
  const client=()=>window.sb||window.__stagepulseAdminClient||window.supabaseClient;
  const offerId=()=>{const m=document.getElementById('offerModal');return m?.dataset.offerId||m?.dataset.spOfferId||m?.querySelector('[data-sp-offer-id]')?.dataset.spOfferId||window.__spLastOfferModalId||window.__spLastOfferId||null};
  let timer=null;
  async function regenerate(id){
    const c=client();
    if(!c||!id||!c.functions?.invoke)return;
    try{
       const {error}=await c.functions.invoke('offer-pdf',{body:{offer_id:id}});
      if(error)throw error;
      if(typeof window.toast==='function')window.toast('PDF güncellendi.');
    }catch(e){
      console.error('[Stagepulse PDF sync]',e);
      if(typeof window.toast==='function')window.toast('PDF güncellenemedi: '+(e.message||e),false);
    }
  }
  function schedule(id=offerId()){
    if(!id)return;
    clearTimeout(timer);
    timer=setTimeout(()=>regenerate(id),900);
  }
  window.stagepulseRegenerateOfferPdf=regenerate;
  document.addEventListener('click',e=>{
    const t=e.target?.closest?.('button');if(!t)return;
    if(t.id==='spOfferCrewSave'||t.id==='spOfferEqAdd'||t.matches('[data-sp-reserve-save]')||t.matches('[data-sp-price-save]'))schedule();
  },true);
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t?.id==='spFinalOfferPhotoInput'||t?.matches?.('#spFinalOfferPhotos input[type="checkbox"]'))schedule();
  },true);
})();

/* ===== END admin/admin-offer-pdf-auto-sync-v2.js ===== */

/* ===== BEGIN admin/admin-runtime-repair-v1.js ===== */
/* Stagepulse Admin — runtime repair for action buttons and server-side PDF flow. */
(() => {
  'use strict';

  const runtime = () => window.STAGEPULSE_RUNTIME || {};
  const client = () => window.sb || window.__stagepulseAdminClient || window.supabaseClient;
  const toast = (message, ok = true) => {
    if (typeof window.toast === 'function') window.toast(message, ok);
    else if (!ok) console.error(message);
  };

  async function sessionToken() {
    const c = client();
    if (!c) throw new Error('Yönetim bağlantısı hazır değil.');
    const { data, error } = await c.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error('Yönetici oturumu bulunamadı.');
    return data.session.access_token;
  }

  async function edge(slug, body) {
    const cfg = runtime();
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('Supabase yapılandırması bulunamadı.');
    const token = await sessionToken();
    const response = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabasePublishableKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `Sunucu işlemi başarısız (${response.status}).`);
    return data;
  }

  // Use the repository's canonical offer-pdf function. Versioned v3/v4
  // routes are not part of the deployed Supabase function tree.
  async function generatePdf(offerId) {
    if (!offerId) throw new Error('Teklif kimliği bulunamadı.');
    return edge('offer-pdf', { offer_id: offerId });
  }

  async function openPdf(offerId, download = false) {
    const generated = await generatePdf(offerId);
    const path = generated?.path;
    if (!path) throw new Error('PDF yolu oluşturulamadı.');
    const c = client();
    const { data, error } = await c.storage.from('offer-pdfs').createSignedUrl(path, 900, { download });
    if (error || !data?.signedUrl) throw error || new Error('PDF bağlantısı oluşturulamadı.');
    const target = window.open(data.signedUrl, '_blank', 'noopener');
    if (!target) location.href = data.signedUrl;
    return { url: data.signedUrl, generated };
  }

  window.openOfferPdfAdmin = openPdf;
  window.openOfferPdf = openPdf;
  window.stagepulseGenerateOfferPdf = generatePdf;

  window.addEventListener('stagepulse-admin-ready', () => {
    window.openOfferPdfAdmin = openPdf;
    window.openOfferPdf = openPdf;
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && /PDF|Teklif|Supabase|Yönetici/i.test(String(reason.message || reason))) {
      toast(reason.message || String(reason), false);
    }
  });
})();

/* ===== END admin/admin-runtime-repair-v1.js ===== */

/* ===== BEGIN admin/admin-completion-guard-v1.js ===== */
/* Stagepulse Admin — final module wiring/health indicator. */
(() => {
  'use strict';
  const MODULES = [
    ['customers','Müşteriler'], ['offers','Teklifler'], ['calendar','İşler / Etkinlikler'],
    ['personnel','Personel'], ['equipment','Ekipman'], ['finance','Finans'],
    ['notifications','Bildirimler'], ['approvals','Onaylar'], ['ai','AI'], ['settings','Ayarlar / Yetkiler']
  ];
  const aliases = { approvals:'command-center', ai:'command-center' };
  function buttonFor(v){ return document.querySelector(`#sideNav button[data-view="${v}"]`); }
  function mark(){
    const nav=document.getElementById('sideNav'); if(!nav)return;
    let box=document.getElementById('spAdminHealth');
    if(!box){box=document.createElement('section');box.id='spAdminHealth';box.className='sp-admin-health';nav.appendChild(box)}
    const checks=MODULES.map(([v,t])=>{
      const target=buttonFor(v)||buttonFor(aliases[v]);
      return `<span class="${target?'ok':'missing'}"><i></i>${t}</span>`;
    });
    box.innerHTML='<strong>Admin kapsamı</strong><div>'+checks.join('')+'</div>';
    if(!document.getElementById('spAdminHealthStyle')){const s=document.createElement('style');s.id='spAdminHealthStyle';s.textContent='#spAdminHealth{margin:14px 12px 0;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.02)}#spAdminHealth strong{display:block;font-size:9px;opacity:.55;margin-bottom:7px}#spAdminHealth div{display:grid;grid-template-columns:1fr 1fr;gap:5px}#spAdminHealth span{font-size:8px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#spAdminHealth i{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:5px;background:currentColor}.ok{color:#79d6a5}.missing{color:#d97878}@media(max-width:760px){#spAdminHealth{display:none}}';document.head.appendChild(s)}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(mark,800));
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(mark,250));
})();

/* ===== END admin/admin-completion-guard-v1.js ===== */

/* ===== BEGIN admin/admin-rbac-control-center-v1.js ===== */
/* Stagepulse — live owner RBAC + organization structure editor */
(function(){'use strict';
  function runtime(){return window.STAGEPULSE_RUNTIME||{};}
  function client(){if(window.StagepulseAdminSupabase?.getClient)return window.StagepulseAdminSupabase.getClient();if(window.AdminSupabase?.getClient)return window.AdminSupabase.getClient();if(window.__stagepulseAdminClient)return window.__stagepulseAdminClient;throw Error('Yönetici istemcisi hazır değil.');}
  const esc=v=>String(v==null?'':v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let C=null,currentTab='roles';
  function ensureStyles(){
    if(document.getElementById('stagepulse-rbac-styles'))return;
    const s=document.createElement('style');s.id='stagepulse-rbac-styles';s.textContent=`
      .rbac-center{width:100%;overflow:hidden}
      .rbac-center .rbac-tabs{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 18px;padding:6px;background:#0c0c0c;border:1px solid #252525;border-radius:12px}
      .rbac-center .rbac-tabs button{appearance:none;-webkit-appearance:none;display:inline-flex!important;align-items:center;justify-content:center;min-height:40px;padding:9px 14px!important;margin:0!important;border:1px solid #333!important;border-radius:9px!important;background:#171717!important;color:#cfcfcf!important;box-shadow:none!important;cursor:pointer!important;font:600 13px/1.2 Inter,system-ui,-apple-system,sans-serif!important;white-space:nowrap}
      .rbac-center .rbac-tabs button:hover{background:#222!important;color:#fff!important;border-color:#555!important;transform:none!important}
      .rbac-center .rbac-tabs button.is-active{background:linear-gradient(135deg,#ffb000,#ff7a00)!important;color:#111!important;border-color:#ffb000!important;box-shadow:0 6px 18px rgba(255,153,0,.16)!important}
      .rbac-center .rbac-grid{display:grid;grid-template-columns:1fr;gap:10px}
      .rbac-center .rbac-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px!important}
      .rbac-center .rbac-row>div{min-width:0;display:flex;flex-direction:column;gap:3px}
      .rbac-center .rbac-row b{font-size:14px}
      .rbac-center .rbac-row small{color:#8a8a8a;font-size:12px}
      .rbac-center .rbac-row .btn,.rbac-center .admin-card>.btn{appearance:none;-webkit-appearance:none;display:inline-flex!important;align-items:center;justify-content:center;min-height:40px;padding:9px 14px!important;border:1px solid #333!important;border-radius:10px!important;background:#171717!important;color:#eee!important;box-shadow:none!important;cursor:pointer!important;font-weight:600!important;white-space:nowrap}
      .rbac-center .rbac-row .btn:hover,.rbac-center .admin-card>.btn:hover{background:#222!important;border-color:#555!important;transform:none!important}
      .rbac-center .btn-primary{background:linear-gradient(135deg,#ffb000,#ff7a00)!important;color:#111!important;border-color:#ffb000!important}
      .rbac-center label{display:flex;align-items:center;gap:9px;min-height:36px;margin:0 0 10px;color:#b8b8b8}
      .rbac-center label input[type="checkbox"]{display:inline-block;width:18px!important;height:18px!important;margin:0!important;accent-color:#ffb000;flex:0 0 auto}
      .rbac-center .rbac-perms{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;padding:12px 0}
      .rbac-center .rbac-perms label{background:#0d0d0d;border:1px solid #232323;border-radius:9px;padding:9px 10px}
      .rbac-center .rbac-member-list>.admin-card{margin-bottom:10px}
      @media(max-width:640px){.rbac-center .rbac-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}.rbac-center .rbac-tabs button{flex:0 0 auto}.rbac-center .rbac-row{align-items:stretch;flex-direction:column}.rbac-center .rbac-row .btn{width:100%}}
    `;document.head.appendChild(s);
  }
  async function api(action,payload={}){const db=client();const s=await db.auth.getSession();const token=s.data&&s.data.session&&s.data.session.access_token;if(!token)throw Error('Oturum gerekli.');const r=runtime();const res=await fetch((r.supabaseUrl||'')+'/functions/v1/org-admin-control',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':r.supabasePublishableKey||''},body:JSON.stringify(Object.assign({action},payload)),cache:'no-store'});const j=await res.json().catch(()=>({}));if(!res.ok)throw Error(j.error||'İşlem başarısız.');return j;}
  function input(id,label,value='',type='text'){return '<label>'+esc(label)+'<input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></label>';}
  function select(id,label,items,value){return '<label>'+esc(label)+'<select id="'+id+'">'+items.map(x=>'<option value="'+esc(x.value)+'" '+(x.value===value?'selected':'')+'>'+esc(x.label)+'</option>').join('')+'</select></label>';}
  async function render(){ensureStyles();const c=document.getElementById('content');if(!c)return;c.innerHTML='<section class="admin-card rbac-center"><h2>Rol · Yetki · Yapı Merkezi</h2><p>Canlı yapı yükleniyor…</p></section>';try{C=await api('catalog');const M=await api('members');C.members=M.members||[];draw(c);}catch(e){c.innerHTML='<section class="admin-card rbac-center"><h2>Rol · Yetki · Yapı Merkezi</h2><p class="form-error">'+esc(e.message)+'</p></section>';}}
  function draw(c){
    const tabs=[['roles','Roller'],['positions','Pozisyonlar'],['deps','Departmanlar'],['regions','Bölgeler'],['members','Kullanıcı yetkileri']];
    c.innerHTML='<section class="admin-card rbac-center"><div class="org-head"><div><h2>Rol · Yetki · Yapı Merkezi</h2><p>Değişiklikler doğrudan canlı sisteme kaydedilir. Sayfa yenilemeye gerek yok.</p></div><button id="rbacRefresh" class="btn" type="button">Yenile</button></div><div class="rbac-tabs" role="tablist">'+tabs.map(x=>'<button type="button" role="tab" data-tab="'+x[0]+'" aria-selected="'+(currentTab===x[0])+'">'+x[1]+'</button>').join('')+'</div><div id="rbacPanel"></div></section>';
    c.querySelector('#rbacRefresh').onclick=render;c.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));updateTabs();tab(currentTab);
  }
  function updateTabs(){document.querySelectorAll('.rbac-center [data-tab]').forEach(b=>{const active=b.dataset.tab===currentTab;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});}
  function tab(t){currentTab=t;updateTabs();const p=document.getElementById('rbacPanel');if(!p)return;if(t==='roles')return roles(p);if(t==='positions')return positions(p);if(t==='deps')return deps(p);if(t==='regions')return regions(p);members(p);if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Rol · Yetki · Yapı Merkezi','Roller · Pozisyonlar · Departmanlar · Bölgeler · Kullanıcı yetkileri');}
  function roles(p){if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Rol · Yetki · Yapı Merkezi','Roller');p.innerHTML='<div class="rbac-grid">'+(C.roles||[]).map(r=>'<div class="admin-card rbac-row"><div><b>'+esc(r.name)+'</b><small>'+esc(r.code)+' · seviye '+r.tier+'</small></div><button type="button" class="btn" data-role="'+esc(r.id)+'">Düzenle</button></div>').join('')+'</div><div class="admin-card"><h3>Yeni / düzenle rol</h3>'+input('rr_code','Kod')+input('rr_name','Ad')+input('rr_tier','Seviye','4','number')+'<label><input id="rr_admin" type="checkbox"> Admin rolü</label><label><input id="rr_children" type="checkbox"> Alt kullanıcıları yönetebilir</label><label><input id="rr_active" type="checkbox" checked> Aktif</label><button id="rr_save" type="button" class="btn btn-primary">Kaydet</button></div>';
    p.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{const r=C.roles.find(x=>x.id===b.dataset.role);document.getElementById('rr_code').value=r.code;document.getElementById('rr_name').value=r.name;document.getElementById('rr_tier').value=r.tier;document.getElementById('rr_admin').checked=r.is_admin_role;document.getElementById('rr_children').checked=r.can_manage_children;document.getElementById('rr_active').checked=r.active;document.getElementById('rr_save').dataset.id=r.id;document.getElementById('rr_save').scrollIntoView({behavior:'smooth',block:'center'});});
    document.getElementById('rr_save').onclick=async e=>{try{await api('save_role',{id:e.currentTarget.dataset.id||null,code:document.getElementById('rr_code').value,name:document.getElementById('rr_name').value,tier:Number(document.getElementById('rr_tier').value),is_admin_role:document.getElementById('rr_admin').checked,can_manage_children:document.getElementById('rr_children').checked,active:document.getElementById('rr_active').checked});await render();}catch(x){alert(x.message);}};
  }
  function positions(p){if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Rol · Yetki · Yapı Merkezi','Pozisyonlar');p.innerHTML='<div class="rbac-grid">'+(C.positions||[]).map(r=>'<div class="admin-card rbac-row"><div><b>'+esc(r.name)+'</b><small>'+esc(r.code)+'</small></div><button type="button" class="btn" data-pos="'+esc(r.id)+'">Düzenle</button></div>').join('')+'</div><div class="admin-card"><h3>Yeni / düzenle pozisyon</h3>'+input('rp_code','Kod')+input('rp_name','Ad')+input('rp_desc','Açıklama')+'<label><input id="rp_active" type="checkbox" checked> Aktif</label><button id="rp_save" type="button" class="btn btn-primary">Kaydet</button></div>';p.querySelectorAll('[data-pos]').forEach(b=>b.onclick=()=>{const r=C.positions.find(x=>x.id===b.dataset.pos);rp('id',r.id);rp('code',r.code);rp('name',r.name);rp('desc',r.description||'');});document.getElementById('rp_save').onclick=async e=>{try{await api('save_position',{id:e.currentTarget.dataset.id||null,code:rpv('code'),name:rpv('name'),description:rpv('desc'),active:document.getElementById('rp_active').checked});await render();}catch(x){alert(x.message);}};function rp(k,v){document.getElementById('rp_'+k).value=v;if(k==='id')document.getElementById('rp_save').dataset.id=v;}function rpv(k){return document.getElementById('rp_'+k).value;}}
  function deps(p){if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Rol · Yetki · Yapı Merkezi','Departmanlar');p.innerHTML='<div class="rbac-grid">'+(C.departments||[]).map(r=>'<div class="admin-card rbac-row"><div><b>'+esc(r.name)+'</b><small>'+esc(r.code)+'</small></div><button type="button" class="btn" data-dep="'+esc(r.id)+'">Düzenle</button></div>').join('')+'</div><div class="admin-card"><h3>Yeni / düzenle departman</h3>'+input('rd_code','Kod')+input('rd_name','Ad')+input('rd_desc','Açıklama')+select('rd_mgr','Yönetici',[{value:'',label:'Atanmamış'}].concat(C.members.map(m=>({value:m.user_id,label:(m.profile&&m.profile.display_name)||m.user_id}))),'')+'<label><input id="rd_active" type="checkbox" checked> Aktif</label><button id="rd_save" type="button" class="btn btn-primary">Kaydet</button></div>';p.querySelectorAll('[data-dep]').forEach(b=>b.onclick=()=>{const r=C.departments.find(x=>x.id===b.dataset.dep);document.getElementById('rd_save').dataset.id=r.id;document.getElementById('rd_code').value=r.code;document.getElementById('rd_name').value=r.name;document.getElementById('rd_desc').value=r.description||'';document.getElementById('rd_mgr').value=r.manager_user_id||'';document.getElementById('rd_active').checked=r.active;});document.getElementById('rd_save').onclick=async e=>{try{await api('save_department',{id:e.currentTarget.dataset.id||null,code:rdv('code'),name:rdv('name'),description:rdv('desc'),manager_user_id:rdv('mgr'),active:document.getElementById('rd_active').checked});await render();}catch(x){alert(x.message);}};function rdv(k){return document.getElementById('rd_'+k).value;}}
  function regions(p){if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Rol · Yetki · Yapı Merkezi','Bölgeler');p.innerHTML='<div class="rbac-grid">'+(C.regions||[]).map(r=>'<div class="admin-card rbac-row"><div><b>'+esc(r.name)+'</b><small>'+esc(r.code)+'</small></div><button type="button" class="btn" data-reg="'+esc(r.id)+'">Düzenle</button></div>').join('')+'</div><div class="admin-card"><h3>Yeni / düzenle bölge</h3>'+input('rg_code','Kod')+input('rg_name','Ad')+select('rg_mgr','Sorumlu',[{value:'',label:'Atanmamış'}].concat(C.members.map(m=>({value:m.user_id,label:(m.profile&&m.profile.display_name)||m.user_id}))),'')+'<label><input id="rg_active" type="checkbox" checked> Aktif</label><button id="rg_save" type="button" class="btn btn-primary">Kaydet</button></div>';p.querySelectorAll('[data-reg]').forEach(b=>b.onclick=()=>{const r=C.regions.find(x=>x.id===b.dataset.reg);document.getElementById('rg_save').dataset.id=r.id;document.getElementById('rg_code').value=r.code;document.getElementById('rg_name').value=r.name;document.getElementById('rg_mgr').value=r.manager_user_id||'';document.getElementById('rg_active').checked=r.active;});document.getElementById('rg_save').onclick=async e=>{try{await api('save_region',{id:e.currentTarget.dataset.id||null,code:rgv('code'),name:rgv('name'),manager_user_id:rgv('mgr'),active:document.getElementById('rg_active').checked});await render();}catch(x){alert(x.message);}};function rgv(k){return document.getElementById('rg_'+k).value;}}
  function members(p){if(window.AdminUI&&typeof window.AdminUI.setTitle==='function')window.AdminUI.setTitle('Rol · Yetki · Yapı Merkezi','Kullanıcı yetkileri');p.innerHTML='<div class="rbac-member-list">'+(C.members||[]).map(m=>{const role=Array.isArray(m.role)?m.role[0]:m.role;return '<div class="admin-card"><b>'+esc((m.profile&&m.profile.display_name)||m.user_id)+'</b><small>'+esc((m.profile&&m.profile.email)||'')+'</small>'+select('mr_'+m.user_id,'Rol',C.roles.map(r=>({value:r.code,label:r.name})),role&&role.code)+select('mp_'+m.user_id,'Pozisyon',C.positions.map(r=>({value:r.code,label:r.name})),m.position&&m.position.code)+'<div class="rbac-perms">'+(C.capabilities||[]).map(c=>'<label><input type="checkbox" data-cap="'+esc(c.key)+'" data-user="'+esc(m.user_id)+'"> '+esc(c.name)+'</label>').join('')+'</div><button type="button" class="btn btn-primary" data-member-save="'+esc(m.user_id)+'">Rol / pozisyonu kaydet</button></div>';}).join('')+'</div>';p.querySelectorAll('[data-member-save]').forEach(b=>b.onclick=async()=>{const uid=b.dataset.memberSave;try{await api('save_membership',{user_id:uid,role_code:document.getElementById('mr_'+uid).value,position_code:document.getElementById('mp_'+uid).value});alert('Kaydedildi.');}catch(x){alert(x.message);}});p.querySelectorAll('[data-cap]').forEach(ch=>ch.onchange=async()=>{try{await api('set_capability',{user_id:ch.dataset.user,capability_key:ch.dataset.capability,enabled:ch.checked});}catch(x){ch.checked=!ch.checked;alert(x.message);}});}
  function boot(){ensureStyles();if(document.getElementById('rbacNav'))return;const nav=document.getElementById('sideNav');if(!nav)return;const b=document.createElement('button');b.id='rbacNav';b.type='button';b.textContent='Rol · Yetki Merkezi';b.className='rbac-nav-btn';b.onclick=()=>{location.hash='rbac';render();};nav.insertBefore(b,document.getElementById('logoutBtn'));}
  window.addEventListener('stagepulse-admin-ready',boot);document.addEventListener('DOMContentLoaded',boot);setTimeout(boot,1400);window.StagepulseRBAC={render};
})();

/* ===== END admin/admin-rbac-control-center-v1.js ===== */

/* ===== BEGIN admin/admin-menu-final.js ===== */
/* Stagepulse Admin shell: single authoritative hamburger interaction. */
(() => {
  const close = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    side?.classList.remove('open');
    if (overlay) { overlay.hidden = true; overlay.classList.remove('open'); }
    document.body.classList.remove('admin-menu-open');
    document.body.style.overflow = '';
    if (menu) {
      menu.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-label', 'Menüyü aç');
      menu.textContent = '☰';
    }
  };

  const open = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    if (!side) return;
    side.classList.add('open');
    if (overlay) { overlay.hidden = false; overlay.classList.add('open'); }
    document.body.classList.add('admin-menu-open');
    document.body.style.overflow = 'hidden';
    if (menu) {
      menu.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-label', 'Menüyü kapat');
      menu.textContent = '×';
    }
  };

  // Canonical bundle already contains the admin UI and module registry.
  const loadAdminUi = () => {};
  const loadModuleRegistry = () => {};

  const bind = () => {
    const menu = document.getElementById('menuBtn');
    if (!menu || menu.dataset.spAdminFinalMenuBound === '1') return;
    menu.dataset.spAdminFinalMenuBound = '1';

    menu.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const side = document.getElementById('sidebar');
      side?.classList.contains('open') ? close() : open();
    }, { capture: true });

    document.getElementById('sidebarClose')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }, { capture: true });

    document.getElementById('mobileOverlay')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) close();
    }, { capture: true });

    document.getElementById('sideNav')?.addEventListener('click', (event) => {
      if (event.target.closest('button[data-view], #logoutBtn')) close();
    }, { capture: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    window.addEventListener('hashchange', close);
    close();
    loadAdminUi();
    loadModuleRegistry();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.StagepulseAdminFinalMenu = { open, close, bind };
})();

/* ===== END admin/admin-menu-final.js ===== */


/* ===== Stagepulse canonical admin UX repairs 2026-09-02 v3 ===== */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const fmtDate=v=>v?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient;
  const table=(title,sub,headers,body)=>{const c=document.getElementById('content');if(!c)return;c.innerHTML=`<div class="page-head"><div><h1>${esc(title)}</h1><p class="muted">${esc(sub)}</p></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body||'<tr><td colspan="99" class="muted">Kayıt bulunamadı.</td></tr>'}</tbody></table></div></div>`};
  window.financeView=async()=>{const c=db();if(!c)return;try{const {data:payments,error}=await c.from('payments').select('id,offer_id,description,amount,due_date,paid_at,status,created_at').order('created_at',{ascending:false}).limit(500);if(error)throw error;const ids=[...new Set((payments||[]).map(x=>x.offer_id).filter(Boolean))];let offers=[];if(ids.length){const r=await c.from('teklifler').select('id,quote_number,name,company,location').in('id',ids);if(r.error)throw r.error;offers=r.data||[]}const byId=Object.fromEntries(offers.map(x=>[x.id,x]));const body=(payments||[]).map(p=>{const o=byId[p.offer_id]||{};const name=o.name||o.company||'İş kaydı';return `<tr><td><strong>${esc(name)}</strong>${o.quote_number?`<div class="muted">${esc(o.quote_number)}</div>`:''}</td><td>${esc(p.description||'—')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.status||'pending')}</td><td>${p.due_date?esc(new Date(p.due_date).toLocaleDateString('tr-TR')):'—'}</td><td>${fmtDate(p.paid_at)}</td></tr>`}).join('');table('Ödemeler','Tahsilat kayıtları',['İş','Açıklama','Tutar','Durum','Vade','Ödeme'],body)}catch(e){console.error(e);window.toast?.(e.message||'Ödemeler yüklenemedi.',false)}};
  window.calendarView=async()=>{const c=db();if(!c)return;try{const {data:jobs,error}=await c.from('jobs').select('id,offer_id,title,setup_at,event_at,teardown_at,location,status').order('event_at',{ascending:true}).limit(500);if(error)throw error;const ids=[...new Set((jobs||[]).map(x=>x.offer_id).filter(Boolean))];let offers=[];if(ids.length){const r=await c.from('teklifler').select('id,quote_number,name').in('id',ids);if(r.error)throw r.error;offers=r.data||[]}const byId=Object.fromEntries(offers.map(x=>[x.id,x]));const body=(jobs||[]).map(j=>{const o=byId[j.offer_id]||{};const title=j.title||o.name||o.quote_number||'İş';return `<tr><td><strong>${esc(title)}</strong>${o.quote_number&&j.title?`<div class="muted">${esc(o.quote_number)}</div>`:''}</td><td>${esc(j.location||'—')}</td><td>${fmtDate(j.setup_at)}</td><td>${fmtDate(j.event_at)}</td><td>${fmtDate(j.teardown_at)}</td><td>${esc(j.status||'planned')}</td></tr>`}).join('');table('İşler · Takvim','Kurulum ve etkinlik',['İş','Konum','Kurulum','Etkinlik','Söküm','Durum'],body)}catch(e){console.error(e);window.toast?.(e.message||'Takvim yüklenemedi.',false)}};
})();
