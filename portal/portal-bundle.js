/* Stagepulse Personnel Portal — consolidated canonical bundle. */
/* ===== BEGIN portal/session-isolation.js ===== */
/* Stagepulse: Admin and Staff must keep independent Supabase sessions even
 * when both APKs are TWA/Chrome shells sharing the same origin storage. */
(() => {
  // Never leave a password-like query parameter in browser history/address bars.
  // This also protects the form if the auth JS fails to intercept a submit.
  try {
    const url = new URL(window.location.href);
    const sensitive = ['password', 'passwd', 'pass', 'pwd'];
    let changed = false;
    for (const key of sensitive) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const query = url.searchParams.toString();
      const clean = url.pathname + (query ? `?${query}` : '') + url.hash;
      history.replaceState(null, document.title, clean);
    }
  } catch (_) {}

  if (!window.supabase?.createClient) return;
  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  const role = location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
  const storageKey = `stagepulse-${role}-auth-v2`;

  window.supabase.createClient = (url, key, options = {}) => {
    const auth = options.auth || {};
    return originalCreateClient(url, key, {
      ...options,
      auth: {
        ...auth,
        storageKey,
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  };
})();

/* ===== END portal/session-isolation.js ===== */

/* ===== BEGIN portal/portal.js ===== */
/* Stagepulse Portal — canonical shell bootstrap */
(() => {
  'use strict';
  const ready=()=>{
    const R=window.STAGEPULSE_RUNTIME||{};
    if(!window.StagepulsePortalSupabase){
      const client=window.supabase?.createClient?.(R.supabaseUrl,R.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'stagepulse-staff-auth-v2',storage:window.sessionStorage}});
      if(client){window.StagepulsePortalSupabase={getClient:()=>client};window.sb=window.sb||client;}
    } else if(!window.sb) window.sb=window.StagepulsePortalSupabase.getClient();
    window.dispatchEvent(new CustomEvent('stagepulse-portal-ready'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();

/* ===== END portal/portal.js ===== */

/* ===== BEGIN portal/portal-modules.js ===== */
/* Stagepulse Portal — canonical RBAC utility modules. */
(() => {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(v)||0);
  const date=v=>v?String(v).slice(0,16).replace('T',' '):'—';
  const roleTr={owner:'Patron / Owner',super_admin:'Süper Admin',upper_admin:'Üst Admin',ceo:'CEO',department_manager:'Departman Yöneticisi',regional_manager:'Bölge Sorumlusu',employee:'Çalışan'};
  const has=k=>typeof window.can==='function'&&window.can(k);
  window.notificationsView=async()=>{if(!has('notifications.view'))return toast('Bildirim yetkiniz yok',false);const r=await sb.from('notifications').select('id,kind,title,body,read_at,created_at,offer_id').eq('recipient_user_id',window.staffUser?.id).order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;const rows=r.data||[];$('#content').innerHTML=`<div class="page-head"><div><h1>Bildirimler</h1><p class="muted">Size gönderilen sistem bildirimleri</p></div><button class="btn" ${rows.some(x=>!x.read_at)?'':'disabled'} onclick="window.__spMarkAllNotificationsRead()">Tümünü okundu yap</button></div><div class="panel">${rows.map(n=>`<div class="row-item" style="${n.read_at?'opacity:.6':''}"><div class="row-main"><strong>${esc(n.title)}</strong><span class="muted">${esc(n.body||'')} · ${date(n.created_at)}</span></div><div class="row-side">${!n.read_at?`<button class="btn" onclick="window.__spMarkNotificationRead('${esc(n.id)}')">Okundu</button>`:''}<span class="status">${esc(n.kind||'sistem')}</span></div></div>`).join('')||'<p class="muted">Bildirim yok.</p>'}</div>`};
  window.__spMarkNotificationRead=async id=>{if(!has('notifications.view'))return;const r=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_user_id',window.staffUser?.id);if(r.error)return toast(r.error.message,false);await window.notificationsView()};
  window.__spMarkAllNotificationsRead=async()=>{if(!has('notifications.view'))return;const r=await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_user_id',window.staffUser?.id).is('read_at',null);if(r.error)return toast(r.error.message,false);toast('Bildirimler okundu.');await window.notificationsView()};
  window.activityView=async()=>{if(!has('activity.view'))return toast('Aktivite yetkiniz yok',false);const r=await sb.from('activity_logs').select('id,action,entity_type,metadata,created_at').order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;$('#content').innerHTML=`<div class="page-head"><div><h1>Aktivite</h1><p class="muted">Sistem işlem geçmişi</p></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Tarih</th><th>İşlem</th><th>Tür</th><th>Detay</th></tr></thead><tbody>${(r.data||[]).map(x=>`<tr><td>${date(x.created_at)}</td><td>${esc(x.action)}</td><td>${esc(x.entity_type||'—')}</td><td><code>${esc(JSON.stringify(x.metadata||{}).slice(0,180))}</code></td></tr>`).join('')||'<tr><td colspan="4" class="muted">Kayıt yok.</td></tr>'}</tbody></table></div></div>`};
  window.analyticsView=async()=>{if(!has('analytics.view'))return toast('Analitik yetkiniz yok',false);const offersRes=has('offers.view')?await sb.from('teklifler').select('id,status,created_at,total').limit(1000):{data:[],error:null},jobsRes=(has('jobs.view')||has('schedule.view'))?await sb.from('jobs').select('id,status,event_at').limit(1000):{data:[],error:null};if(offersRes.error||jobsRes.error)throw offersRes.error||jobsRes.error;const offers=offersRes.data||[],jobs=jobsRes.data||[],accepted=offers.filter(x=>x.status==='accepted').length,activeJobs=jobs.filter(x=>!['done','cancelled'].includes(x.status)).length,rate=offers.length?Math.round(accepted/offers.length*100):0;$('#content').innerHTML=`<div class="page-head"><div><h1>Analitik</h1><p class="muted">Yetkili olduğunuz operasyon verileri</p></div></div><div class="cards"><div class="card"><span class="card-label">Teklif</span><div class="metric">${offers.length}</div></div><div class="card"><span class="card-label">Kabul</span><div class="metric">${accepted}</div></div><div class="card"><span class="card-label">Dönüşüm</span><div class="metric">${rate}%</div></div><div class="card"><span class="card-label">Aktif iş</span><div class="metric">${activeJobs}</div></div></div>`};
  window.settingsView=async()=>{if(!has('settings.view'))return toast('Ayarlar yetkiniz yok',false);const r=await sb.from('org_memberships').select('role:role_id(code,name),position:position_id(code,name),department:department_id(name),region:region_id(name)').eq('user_id',window.staffUser?.id).maybeSingle();if(r.error)throw r.error;const p=(await sb.from('staff_notification_preferences').select('enabled,offers,jobs,schedule,system').eq('user_id',window.staffUser?.id).maybeSingle()).data||{enabled:true,offers:true,jobs:true,schedule:true,system:true},m=r.data;$('#content').innerHTML=`<div class="page-head"><div><h1>Ayarlar</h1><p class="muted">Organizasyon ve bildirim tercihleri</p></div></div><div class="grid2"><div class="panel"><h3>Organizasyon</h3><label>Rol<input value="${esc(roleTr[m?.role?.code]||m?.role?.name||window.staffUser?.role||'')}" disabled></label><label>Pozisyon<input value="${esc(m?.position?.name||'')}" disabled></label><label>Departman<input value="${esc(m?.department?.name||'')}" disabled></label><label>Bölge<input value="${esc(m?.region?.name||'')}" disabled></label></div><div class="panel"><h3>Bildirim tercihleri</h3><label><input id="spPrefMaster" type="checkbox" ${p.enabled?'checked':''}> Bildirimleri açık tut</label><label><input id="spPrefOffers" type="checkbox" ${p.offers?'checked':''}> Teklif bildirimleri</label><label><input id="spPrefJobs" type="checkbox" ${p.jobs?'checked':''}> İş bildirimleri</label><label><input id="spPrefSchedule" type="checkbox" ${p.schedule?'checked':''}> Takvim bildirimleri</label><label><input id="spPrefSystem" type="checkbox" ${p.system?'checked':''}> Sistem bildirimleri</label><button class="btn btn-primary" onclick="window.__spSaveNotificationPrefs()">Tercihleri kaydet</button></div></div>`};
  window.__spSaveNotificationPrefs=async()=>{if(!has('settings.view'))return toast('Ayarlar yetkiniz yok',false);const r=await sb.rpc('staff_update_notification_preferences',{p_master:$('#spPrefMaster').checked,p_offers:$('#spPrefOffers').checked,p_jobs:$('#spPrefJobs').checked,p_schedule:$('#spPrefSchedule').checked,p_system:$('#spPrefSystem').checked});if(r.error)return toast(r.error.message,false);toast('Bildirim tercihleri kaydedildi.')};
  window.financeView=async()=>{if(!has('payments.view'))return toast('Ödemeler yetkiniz yok',false);const r=await sb.from('payments').select('id,offer_id,description,amount,due_date,paid_at,status,created_at').order('due_date',{ascending:true,nullsFirst:false});if(r.error)throw r.error;const rows=r.data||[],sum=a=>a.reduce((s,x)=>s+Number(x.amount||0),0),pending=sum(rows.filter(x=>['pending','deposit','partial','overdue'].includes(x.status))),paid=sum(rows.filter(x=>x.status==='paid')),overdue=sum(rows.filter(x=>x.status==='overdue')),st={pending:'Bekliyor',deposit:'Kapora',partial:'Kısmi',paid:'Ödendi',overdue:'Gecikmiş'};$('#content').innerHTML=`<div class="page-head"><div><h1>Ödemeler / Finans</h1><p class="muted">Yetkili olduğunuz tahsilat kayıtları</p></div></div><div class="cards"><div class="card"><span class="card-label">Bekleyen</span><div class="metric">${money(pending)}</div></div><div class="card"><span class="card-label">Tahsil edilen</span><div class="metric">${money(paid)}</div></div><div class="card"><span class="card-label">Gecikmiş</span><div class="metric">${money(overdue)}</div></div><div class="card"><span class="card-label">Kayıt</span><div class="metric">${rows.length}</div></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Açıklama</th><th>Tutar</th><th>Vade</th><th>Ödeme</th><th>Durum</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.description||'—')}</td><td><b>${money(x.amount)}</b></td><td>${esc(x.due_date||'—')}</td><td>${esc((x.paid_at||'').slice(0,10)||'—')}</td><td><span class="status">${esc(st[x.status]||x.status||'—')}</span></td></tr>`).join('')||'<tr><td colspan="5" class="muted">Ödeme kaydı yok</td></tr>'}</tbody></table></div></div>`};
})();
/* ===== END portal/portal-modules.js ===== */

/* ===== BEGIN portal/portal-permissions.js ===== */
/* Stagepulse Portal — canonical organization RBAC gateway */
(() => {
  'use strict';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const R = window.STAGEPULSE_RUNTIME || {};
  const SUPA = window.StagepulsePortalSupabase || window.StagepulseAdminSupabase || window.AdminSupabase;
  const sb = SUPA?.getClient ? SUPA.getClient() : window.sb || window.supabase?.createClient?.(R.supabaseUrl, R.supabasePublishableKey, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'stagepulse-staff-auth-v2',storage:window.sessionStorage} });
  const LOGIN_EDGE = `${(R.supabaseUrl || '').replace(/\/$/,'')}/functions/v1/portal-login`;
  const EDGE = `${(R.supabaseUrl || '').replace(/\/$/,'')}/functions/v1/org-admin-control`;
  if (!sb || !R.supabaseUrl || !R.supabasePublishableKey) return;
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const setView=(loginVisible)=>{
    const login=$('#loginView'),app=$('#appView');
    if(login){login.hidden=!loginVisible;login.classList.toggle('is-hidden',!loginVisible)}
    if(app){app.hidden=loginVisible;app.classList.toggle('is-hidden',loginVisible)}
  };
  const showLogin=()=>setView(true);
  const showApp=()=>setView(false);
  const localToast=(message,ok=true)=>{
    const current=$('#spPortalToast');if(current)current.remove();
    const el=document.createElement('div');el.id='spPortalToast';el.className=`portal-toast ${ok?'ok':'error'}`;
    el.setAttribute('role','status');el.textContent=String(message||'');document.body.appendChild(el);
    setTimeout(()=>el.remove(),4500);
  };
  const toast=(message,ok=true)=>{const fn=window.toast;return typeof fn==='function'&&fn!==toast?fn(message,ok):localToast(message,ok)};
  if(typeof window.toast!=='function')window.toast=localToast;

  const views={home:'dashboard.view',jobs:'schedule.view',equipment:'equipment.view',offers:'offers.view',customers:'customers.view',settlements:'settlements.view',finance:'payments.view',personnel:'staff.view',pricing:'pricing.view',analytics:'analytics.view',activity:'activity.view',notifications:'notifications.view',settings:'settings.view'};
  const viewAccess={home:['dashboard.view'],jobs:['schedule.view','schedule.manage','jobs.view','jobs.manage','jobs.create','jobs.update','jobs.accept','jobs.reject','jobs.status.update','jobs.notes.update','jobs.equipment.manage','jobs.documents.view'],equipment:['equipment.view','equipment.manage','equipment.create','equipment.update','equipment.delete','equipment.checkout','equipment.return'],offers:['offers.view','offers.manage','offers.create','offers.update','offers.delete','offers.approve','offers.accept','offers.reject','offers.evaluate','offers.send'],customers:['customers.view','customers.manage','customers.create','customers.update','customers.delete'],settlements:['settlements.view','financials.view'],finance:['payments.view','payments.manage','payments.create','payments.update','financials.view','settlements.view'],personnel:['staff.view','staff.manage'],pricing:['pricing.view','pricing.manage','pricing.update'],analytics:['analytics.view'],activity:['activity.view'],notifications:['notifications.view','notifications.send'],settings:['settings.view','settings.update']};
  const navItems=[['home','Özet'],['jobs','İşler'],['equipment','Ekipman'],['offers','Teklifler'],['customers','Müşteriler'],['settlements','Gelir · Gider'],['finance','Ödemeler / Finans'],['personnel','Personel'],['pricing','Fiyatlandırma'],['analytics','Analitik'],['activity','Aktivite'],['notifications','Bildirimler'],['settings','Ayarlar']];
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let live=Object.create(null),recoveryShown=false,lastActivity=Date.now(),sessionTimer=null;
  const hasPermission=key=>live[key]===true;
  const canLive=key=>{const view=Object.entries(views).find(([,need])=>need===key)?.[0];return (view?(viewAccess[view]||[key]):[key]).some(x=>hasPermission(x))};
  const firstAllowed=()=>navItems.map(([v])=>v).find(v=>canLive(views[v]))||null;
  const permissionCount=()=>Object.keys(live).filter(k=>live[k]===true).length;
  const markActivity=()=>{lastActivity=Date.now()};

  async function context(){const {data:{session:s}}=await sb.auth.getSession();if(!s?.access_token)return null;const response=await fetch(EDGE,{method:'POST',headers:{apikey:R.supabasePublishableKey,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'my_context'}),cache:'no-store'});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'Yönetim yetkileri doğrulanamadı.');if(!body.membership||body.membership.active!==true)return null;live=Object.create(null);(body.capabilities||[]).forEach(c=>{if(c?.key)live[c.key]=true});const owner=body.owner===true||body.membership?.role?.code==='owner';if(owner)Object.keys(viewAccess).forEach(v=>viewAccess[v].forEach(k=>{live[k]=true}));const m=body.membership;const p=body.profile||{};const profile={id:m.user_id,username:p.username||m.user_id,display_name:p.display_name||'',role:m.role?.code||'',active:true,permissions:{...live}};window.staffUser=profile;document.documentElement.dataset.portalPermissionCount=String(permissionCount());return profile;}
  async function login(e){e.preventDefault();e.stopImmediatePropagation();const u=$('#loginUser')?.value?.trim().toLowerCase(),p=$('#loginPass')?.value||'',err=$('#loginErr');if(err){err.hidden=true;err.textContent=''}if(!u||!p){if(err){err.hidden=false;err.textContent='Kullanıcı adı ve şifre gerekli.'}return}const submit=$('#loginForm button[type="submit"]');if(submit){submit.disabled=true;submit.dataset.oldText=submit.textContent;submit.textContent='Giriş yapılıyor…'}try{const res=await fetch(LOGIN_EDGE,{method:'POST',headers:{'Content-Type':'application/json',apikey:R.supabasePublishableKey},body:JSON.stringify({username:u,password:p}),cache:'no-store'});const j=await res.json().catch(()=>({}));if(!res.ok||!j.session)throw new Error(j.error||'Giriş başarısız.');const {error}=await sb.auth.setSession({access_token:j.session.access_token,refresh_token:j.session.refresh_token});if(error)throw error;const me=await context();if(!me)throw new Error('Aktif organizasyon üyeliğiniz bulunmuyor.');afterLoginV2()}catch(x){if(err){err.hidden=false;err.textContent=x.message||'Giriş başarısız'}await sb.auth.signOut().catch(()=>{})}finally{if(submit){submit.disabled=false;submit.textContent=submit.dataset.oldText||'Giriş'}}}
  async function recoverSessionFromUrl(){const url=new URL(location.href),hash=new URLSearchParams(/^#[^#]*=/.test(url.hash)?url.hash.slice(1):''),keys=['code','type','token','token_hash','access_token','refresh_token','expires_at','expires_in','provider_token','provider_refresh_token','error','error_code','error_description'],code=url.searchParams.get('code'),accessToken=hash.get('access_token'),refreshToken=hash.get('refresh_token'),type=url.searchParams.get('type')||hash.get('type'),hasAuthUrl=keys.some(key=>url.searchParams.has(key)||hash.has(key));if(!hasAuthUrl)return false;try{if(url.searchParams.get('error'))throw new Error(url.searchParams.get('error_description')||'Kimlik doğrulama bağlantısı geçersiz.');if(code){const {error}=await sb.auth.exchangeCodeForSession(code);if(error)throw error}else if(accessToken&&refreshToken){const {error}=await sb.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(error)throw error}else throw new Error('Kimlik doğrulama bağlantısı eksik veya geçersiz.');if(type==='recovery')resetModal();return true}finally{keys.forEach(key=>url.searchParams.delete(key));keys.forEach(key=>hash.delete(key));history.replaceState(null,document.title,url.pathname+(url.searchParams.toString()?`?${url.searchParams}`:'')+(hash.toString()?`#${hash}`:''))}}
  async function forceLogout(message='Oturumunuz sona erdi. Lütfen tekrar giriş yapın.'){clearTimeout(sessionTimer);sessionTimer=null;await sb.auth.signOut().catch(()=>{});window.staffUser=null;showLogin();if(typeof toast==='function')toast(message,false)}
  function scheduleSessionCheck(){clearTimeout(sessionTimer);sessionTimer=setTimeout(async()=>{if(!window.staffUser)return;if(Date.now()-lastActivity>SESSION_TIMEOUT_MS){await forceLogout('Güvenlik nedeniyle oturumunuz kapatıldı.');return}try{await context();nav()}catch(_){await forceLogout()}scheduleSessionCheck()},5*60*1000)}
  sb.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'&&typeof resetModal==='function')resetModal();if(event==='SIGNED_OUT'){window.staffUser=null;live=Object.create(null);clearTimeout(sessionTimer)}});
  function nav(){const n=$('#sideNav');if(!n)return;n.querySelectorAll('button[data-view]').forEach(b=>b.remove());navItems.forEach(([v,label])=>{const b=document.createElement('button');b.type='button';b.dataset.view=v;b.textContent=label;b.setAttribute('aria-label',label);b.hidden=!canLive(views[v]);b.onclick=()=>loadLiveView(v);n.appendChild(b)});let badge=$('#portalPermissionBadge');if(!badge){badge=document.createElement('small');badge.id='portalPermissionBadge';badge.className='portal-permission-badge';n.appendChild(badge)}badge.textContent=`${permissionCount()} aktif yetki`}
  function patch(){window.can=canLive;window.perms=()=>({...live});window.loadView=loadLiveView;nav();window.dispatchEvent(new CustomEvent('stagepulse:permissions-ready'))}
  async function refreshPermissions(){if(!window.staffUser)return;try{await context();nav();const current=(location.hash||'').slice(1);if(current&&views[current]&&!canLive(views[current]))loadLiveView(firstAllowed()||null)}catch(error){console.warn('Portal permission refresh failed:',error)}}
  function afterLoginV2(){showApp();if(window.staffUser){$('#staffName').textContent=window.staffUser.display_name||window.staffUser.username||'Personel';$('#staffRole').textContent=window.staffUser.role||''}patch();markActivity();scheduleSessionCheck();window.dispatchEvent(new CustomEvent('stagepulse:logged-in',{detail:{portal:'staff'}}));const h=(location.hash||'').slice(1),f=firstAllowed();loadLiveView(views[h]&&canLive(views[h])?h:(f||null))}
  function external(v){const labels={analytics:'Analitik',activity:'Aktivite',notifications:'Bildirimler',settings:'Ayarlar',settlements:'Gelir · Gider',personnel:'Personel'};$('#content').innerHTML=`<div class="panel portal-placeholder"><h2>${esc(labels[v]||'Bölüm')}</h2><p class="muted">Bu bölüm için yetkiniz aktif. Modül verisi hazır olduğunda burada görüntülenecek.</p></div>`}
  async function loadLiveView(v){markActivity();const need=views[v];if(!need||!canLive(need)){const f=firstAllowed();if(f&&f!==v)return loadLiveView(f);$('#content').innerHTML='<div class="panel"><b>Erişim yetkiniz yok.</b><p class="muted">Bu sayfa için yöneticinizden yetki istemelisiniz.</p></div>';return}history.replaceState(null,'','#'+v);$$('#sideNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));const map={home:window.homeView,jobs:window.jobsView,equipment:window.equipmentView,offers:window.offersView,customers:window.customersView,settlements:window.settlementsView,finance:window.financeView,personnel:window.personnelView,pricing:window.pricingView,analytics:window.analyticsView,activity:window.activityView,notifications:window.notificationsView,settings:window.settingsView};const fn=map[v];try{if(typeof fn==='function')return await fn();return external(v)}catch(error){console.error('Portal view error:',error);$('#content').innerHTML=`<div class="panel portal-error"><b>Bu bölüm yüklenemedi.</b><p class="muted">${esc(error?.message||'Beklenmeyen bir hata oluştu.')}</p><button class="btn" type="button" onclick="loadView('home')">Özete dön</button></div>`}}
  function resetModal(){if(recoveryShown)return;recoveryShown=true;document.getElementById('spPortalReset')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="portal-reset" id="spPortalReset" role="dialog" aria-modal="true" aria-labelledby="spPortalResetTitle" aria-describedby="spPortalResetDescription"><div class="login-card"><div class="brand">STAGEPULSE</div><h1 id="spPortalResetTitle">Yeni şifre</h1><p class="muted" id="spPortalResetDescription">Bu ekran yalnızca geçerli bir recovery oturumu için kullanılabilir.</p><label for="spPortalPass1">Yeni şifre</label><input id="spPortalPass1" type="password" minlength="10" autocomplete="new-password"><label for="spPortalPass2">Yeni şifre tekrar</label><input id="spPortalPass2" type="password" minlength="10" autocomplete="new-password"><button class="btn btn-primary" id="spPortalSave" type="button">Şifreyi güncelle</button><p id="spPortalResetErr" class="err" role="alert" aria-live="assertive"></p></div></div>`);$('#spPortalPass1')?.focus();$('#spPortalSave').onclick=async()=>{const a=$('#spPortalPass1').value,b=$('#spPortalPass2').value,e=$('#spPortalResetErr');if(a.length<10||!/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(a)||!/\d/.test(a)){e.textContent='Şifre en az 10 karakter, bir harf ve bir rakam içermeli.';return}if(a!==b){e.textContent='Şifreler eşleşmiyor.';return}const {error}=await sb.auth.updateUser({password:a});if(error){e.textContent='Şifre güncellenemedi. Lütfen yeniden deneyin.';return}await forceLogout('Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.');$('#spPortalReset')?.remove();recoveryShown=false}}
  async function initPortal(){['pointerdown','keydown','touchstart'].forEach(event=>window.addEventListener(event,markActivity,{passive:true}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPermissions()});window.addEventListener('focus',refreshPermissions);const f=$('#loginForm');f?.addEventListener('submit',login,true);$('#logoutBtn')?.addEventListener('click',()=>void forceLogout('Oturum kapatıldı.'));try{if(await recoverSessionFromUrl()){showLogin();return}const u=await context();if(u){afterLoginV2();return}}catch(e){console.warn('Portal session restore failed:',e);await sb.auth.signOut().catch(()=>{})}showLogin()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPortal,{once:true});else void initPortal();
})();

/* ===== END portal/portal-permissions.js ===== */

/* ===== BEGIN portal/admin-parity-v3.js ===== */
/* Stagepulse Personel Portal — Admin menu visual parity. Visual only; permission filtering is authoritative. */
(() => {
  const GROUPS = [
    ['SATIŞ', ['home', 'offers', 'customers', 'finance', 'pricing']],
    ['OPERASYON', ['jobs', 'equipment', 'analytics', 'activity', 'notifications']],
    ['SİSTEM', ['settings']]
  ];

  function closeMenu() {
    document.querySelector('#sidebar')?.classList.remove('open');
    const overlay = document.querySelector('#mobileOverlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('open');
    }
  }

  function ensureHeader(sidebar) {
    const brand = sidebar.querySelector(':scope > .side-brand');
    if (!brand) return;
    brand.classList.add('portal-brand-header');
    let close = brand.querySelector('.portal-sidebar-close');
    if (!close) {
      close = document.createElement('button');
      close.type = 'button';
      close.className = 'portal-sidebar-close';
      close.setAttribute('aria-label', 'Menüyü kapat');
      close.textContent = '×';
      brand.appendChild(close);
      close.addEventListener('click', closeMenu);
    }
  }

  function decorateNav() {
    const nav = document.querySelector('#sideNav');
    const sidebar = document.querySelector('#sidebar');
    if (!nav || !sidebar) return false;

    const buttons = [...nav.querySelectorAll('button[data-view]')];
    if (!buttons.length) return false;
    ensureHeader(sidebar);

    const visible = buttons.filter(b => !b.hidden && b.getAttribute('aria-hidden') !== 'true' && b.style.display !== 'none');
    const signature = visible.map(b => b.dataset.view).join('|');
    if (nav.dataset.adminParitySignature === signature) return true;

    const badge = nav.querySelector('#portalPermissionBadge');
    const fragment = document.createDocumentFragment();

    for (const [label, views] of GROUPS) {
      const matches = views.map(view => visible.find(b => b.dataset.view === view)).filter(Boolean);
      if (!matches.length) continue;
      const title = document.createElement('div');
      title.className = 'portal-nav-label';
      title.textContent = label;
      fragment.appendChild(title);
      matches.forEach(b => fragment.appendChild(b));
    }

    if (badge) fragment.appendChild(badge);
    nav.replaceChildren(fragment);
    nav.dataset.adminParitySignature = signature;
    return true;
  }

  function boot() {
    const sidebar = document.querySelector('#sidebar');
    const nav = document.querySelector('#sideNav');
    if (!sidebar || !nav) return;
    sidebar.classList.add('admin-visual-menu');
    if (decorateNav()) return;

    const observer = new MutationObserver(() => {
      if (decorateNav()) observer.disconnect();
    });
    observer.observe(nav, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* ===== END portal/admin-parity-v3.js ===== */

/* ===== BEGIN portal/portal-view-integrity.js ===== */
/* Stagepulse Portal — permission-driven navigation integrity. */
(() => {
  const CORE = new Set(['home','jobs','equipment','offers','customers','finance','pricing']);
  const VIEW_RULES = {
    home:{perm:'dashboard.view',fn:'homeView'}, jobs:{perm:'schedule.view',fn:'jobsView'},
    equipment:{perm:'equipment.view',fn:'equipmentView'}, offers:{perm:'offers.view',fn:'offersView'},
    customers:{perm:'customers.view',fn:'customersView'}, finance:{perm:'payments.view',fn:'financeView'},
    settlements:{perm:'settlements.view',fn:'settlementsView'}, pricing:{perm:'pricing.view',fn:'pricingView'},
    analytics:{perm:'analytics.view',fn:'analyticsView'}, activity:{perm:'activity.view',fn:'activityView'},
    notifications:{perm:'notifications.view',fn:'notificationsView'}, settings:{perm:'settings.view',fn:'settingsView'}
  };
  const hasPermission=(permission)=>{try{return typeof can==='function'&&can(permission)===true;}catch(_){return false;}};
  const hasHandler=(view,rule)=>CORE.has(view)||typeof window[rule.fn]==='function';
  const allowed=(view)=>{const rule=VIEW_RULES[view];return !!rule&&hasPermission(rule.perm)&&hasHandler(view,rule);};
  function route(view){
    if(!allowed(view)){const fallback=Object.keys(VIEW_RULES).find(allowed);if(fallback)return route(fallback);const content=document.querySelector('#content');if(content)content.innerHTML='<div class="panel"><b>Aktif bölüm bulunamadı.</b><p class="muted">Bu hesap için henüz bir portal yetkisi açılmamış.</p></div>';return;}
    if(CORE.has(view)){if(typeof loadView==='function')return loadView(view);return;}
    const fn=window[VIEW_RULES[view].fn];history.replaceState(null,'','#'+view);document.querySelectorAll('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelector('#sidebar')?.classList.remove('open');const overlay=document.querySelector('#mobileOverlay');if(overlay){overlay.hidden=true;overlay.classList.remove('open');}return fn();
  }
  function reconcile(){
    const nav=document.querySelector('#sideNav');if(!nav)return;
    nav.querySelectorAll('button[data-view]').forEach(btn=>{const view=btn.dataset.view,ok=allowed(view);btn.hidden=!ok;btn.style.display=ok?'':'none';btn.setAttribute('aria-hidden',ok?'false':'true');if(ok)btn.onclick=(event)=>{event.preventDefault();route(view);};else btn.onclick=null;});
    nav.querySelectorAll('.portal-nav-label').forEach(label=>{let next=label.nextElementSibling,hasItem=false;while(next&&!next.classList.contains('portal-nav-label')){if(next.matches?.('button[data-view]')&&!next.hidden){hasItem=true;break;}next=next.nextElementSibling;}label.hidden=!hasItem;});
    const current=(location.hash||'').slice(1);if(current&&!allowed(current)){const fallback=Object.keys(VIEW_RULES).find(allowed);if(fallback)route(fallback);}
  }
  function install(){reconcile();setTimeout(reconcile,150);setTimeout(reconcile,700);setTimeout(reconcile,1500);}
  document.addEventListener('DOMContentLoaded',install,{once:true});
  const observer=new MutationObserver(()=>{if(document.querySelector('#sideNav button[data-view]'))reconcile();});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),30000);
})();

/* ===== END portal/portal-view-integrity.js ===== */

/* ===== BEGIN portal/incoming-offers-ui.js ===== */
/* Stagepulse incoming offers UI — evaluation workflow layered on top of the canonical offers view. */
(() => {
  const oldOffersView = window.offersView;
  if (typeof oldOffersView !== 'function') return;

  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt = d => {
    if (!d) return '—';
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleString('tr-TR', {dateStyle:'short', timeStyle:'short'});
  };
  const toast = (m, ok = true) => window.toast ? window.toast(m, ok) : alert(m);
  const permission = async key => {
    const {data, error} = await sb.rpc('staff_capability', {p_capability:key});
    if (error) throw error;
    return data === true;
  };

  async function renderEvaluationPanel() {
    let canEvaluate = false;
    try { canEvaluate = await permission('offers.evaluate'); } catch (e) { console.error(e); }
    if (!canEvaluate) return;

    const [{data:userData,error:userError},{data,error}] = await Promise.all([
      sb.auth.getUser(),
      sb.from('teklifler').select('id,quote_number,name,company,location,event_start_at,event_date,validity_until,valid_until,status,evaluation_status,evaluated_by').order('created_at',{ascending:false}).limit(100)
    ]);
    if (userError || error) return;

    const currentUserId = userData?.user?.id || null;
    const rows = (data || []).map(o => {
      const evaluating = o.evaluation_status === 'evaluating';
      const mine = o.evaluated_by === currentUserId;
      const closed = ['accepted','rejected','cancelled','expired'].includes(o.status);
      return `<article class="incoming-offer-card" data-offer-id="${esc(o.id)}">
        <div class="incoming-offer-top"><div><strong>${esc(o.quote_number || 'Teklif')}</strong><div class="muted">${esc(o.name || '')}${o.company ? ` · ${esc(o.company)}` : ''}</div></div><span class="status">${esc(o.status || 'Yeni')}</span></div>
        <div class="incoming-offer-grid"><span>📍 ${esc(o.location || '—')}</span><span>📅 ${esc(fmt(o.event_start_at || o.event_date))}</span><span>⏳ Geçerlilik: ${esc(fmt(o.validity_until || o.valid_until))}</span></div>
        <div class="incoming-offer-actions">
          ${evaluating ? `<span class="evaluation-badge">${mine ? 'Siz değerlendiriyorsunuz' : 'Başka bir personel değerlendiriyor'}</span>` : ''}
          ${!closed && !evaluating ? `<button class="btn btn-primary" data-evaluate="${esc(o.id)}">Değerlendir</button>` : ''}
          ${evaluating && mine ? `<button class="btn btn-primary" data-accept="${esc(o.id)}">Kabul</button><button class="btn btn-danger" data-reject="${esc(o.id)}">Red</button>` : ''}
        </div>
      </article>`;
    }).join('');

    const existing = document.querySelector('#staffOfferEvaluationPanel');
    existing?.remove();
    const host = document.querySelector('#content');
    if (!host) return;
    const panel = document.createElement('div');
    panel.id = 'staffOfferEvaluationPanel';
    panel.innerHTML = `<div class="page-head" style="margin-top:24px"><div><h2>Teklif değerlendirme</h2><p class="muted">Gelen teklifleri değerlendirmeye alma ve sonuçlandırma</p></div></div><div class="incoming-offers-list">${rows || '<div class="panel"><p class="muted">Değerlendirilecek teklif yok.</p></div>'}</div>`;
    host.appendChild(panel);

    panel.querySelectorAll('[data-evaluate]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = 'Alınıyor…';
      try {
        const {error:e} = await sb.rpc('offer_claim_for_review', {p_offer_id:btn.dataset.evaluate});
        if (e) throw e;
        toast('Teklif değerlendirmeye alındı.');
        await window.loadView('offers');
      } catch (e) {
        toast(e.message, false);
        btn.disabled = false;
        btn.textContent = 'Değerlendir';
      }
    });

    panel.querySelectorAll('[data-accept],[data-reject]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      const accepted = btn.hasAttribute('data-accept');
      const note = prompt(accepted ? 'Kabul notu (opsiyonel):' : 'Red notu (opsiyonel):', '') || null;
      try {
        const {error:e} = await sb.rpc('offer_evaluate', {
          p_offer_id: accepted ? btn.dataset.accept : btn.dataset.reject,
          p_status: accepted ? 'accepted' : 'rejected',
          p_note: note
        });
        if (e) throw e;
        toast(accepted ? 'Teklif kabul edildi.' : 'Teklif reddedildi.');
        await window.loadView('offers');
      } catch (e) {
        toast(e.message, false);
        btn.disabled = false;
      }
    });
  }

  // IMPORTANT: do not intercept the Offers navigation click. The canonical
  // offers view must remain intact so portal-crud.js can add create/edit/send
  // controls. Evaluation is layered onto that view after it renders.
  window.offersView = async function() {
    await oldOffersView.apply(this, arguments);
    await renderEvaluationPanel();
  };

  const style = document.createElement('style');
  style.textContent = '.incoming-offers-list{display:grid;gap:12px}.incoming-offer-card{background:var(--panel,#111);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:16px}.incoming-offer-top{display:flex;justify-content:space-between;gap:12px}.incoming-offer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0;color:#c8c8c8;font-size:13px}.incoming-offer-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.evaluation-badge{padding:7px 10px;border-radius:999px;background:rgba(255,180,0,.12);color:#ffd166}@media(max-width:700px){.incoming-offer-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);
})();

/* ===== END portal/incoming-offers-ui.js ===== */

/* ===== BEGIN portal/portal-auto-sync.js ===== */
/* Stagepulse portal live data sync + password recovery bootstrap. */
(()=>{
  let channel=null,refreshTimer=null;
  const refresh=()=>{const v=(location.hash||'').slice(1);if(!v||typeof window.loadView!=='function')return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>window.loadView(v),250)};
  const ensureRecoveryUi=()=>{
    const form=document.querySelector('#loginForm'); if(!form||document.querySelector('#forgotPasswordBtn'))return;
    const b=document.createElement('button'); b.type='button'; b.className='btn'; b.id='forgotPasswordBtn'; b.textContent='Şifremi unuttum';
    const err=document.querySelector('#loginErr'); form.insertBefore(b,err||null);
  };
  const loadRecovery=()=>ensureRecoveryUi();
  const start=()=>{loadRecovery();if(!window.sb||channel)return;channel=window.sb.channel('stagepulse-staff-live').on('postgres_changes',{event:'*',schema:'public',table:'customers'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'teklifler'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'jobs'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'equipment'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'notifications'},refresh).subscribe()};
  window.addEventListener('stagepulse:logged-in',start);
  document.addEventListener('DOMContentLoaded',()=>{ensureRecoveryUi();loadRecovery()},{once:true});
  if(window.sb?.auth)window.sb.auth.getSession().then(({data})=>{loadRecovery();if(data?.session)start()});
})();

/* ===== END portal/portal-auto-sync.js ===== */

/* ===== BEGIN portal/portal-pricing-live.js ===== */
/* Fiyat listesi: kuralları doğru formatla + hizmet malzeme satırları */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const fmtRule = (r) => {
    const t = r.rule_type || '';
    const v = Number(r.rule_value != null ? r.rule_value : r.base_price) || 0;
    if (t === 'percent' || /marj|mesai|yüzde/i.test(r.name || '')) return `%${v}`;
    if (t === 'per_km' || /km/i.test(r.name || '')) return `${money(v)} / km`;
    if (t === 'per_person' || /kişi başı/i.test(r.name || '')) return `${money(v)} / kişi (ekip)`;
    if (/ekip sayısı/i.test(r.name || '')) return `${v} kişi`;
    return money(v);
  };

  const orig = window.pricingView;
  window.pricingView = async function pricingViewLive() {
    if (typeof can === 'function' && !can('pricing') && !can('pricing.view')) {
      const el = document.querySelector('#content');
      if (el) el.innerHTML = '<div class="panel"><b>Erişim yok</b><p class="muted">Fiyat listesi için yetki gerekli.</p></div>';
      return;
    }
    let rows = [], bom = [];
    try {
      const { data, error } = await sb.from('pricing_staff').select('*').order('sort_order');
      if (error) throw error;
      rows = data || [];
    } catch (e) {
      if (typeof orig === 'function') return orig();
      const el = document.querySelector('#content');
      if (el) el.innerHTML = `<div class="panel"><b>Hata</b><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    try {
      const { data } = await sb.from('service_bom_staff').select('*');
      bom = data || [];
    } catch (_) {}

    const services = rows.filter((r) => r.kind === 'service');
    const rules = rows.filter((r) => r.kind === 'rule');
    const allServices = services.length ? services : rows;
    const allRules = rules.length ? rules : [];

    const bomBySvc = {};
    for (const b of bom) (bomBySvc[b.service_id] = bomBySvc[b.service_id] || []).push(b);

    const svcRows = allServices.map((r) => {
      const mats = bomBySvc[r.id] || [];
      const matHtml = mats.length
        ? `<div class="muted small" style="margin-top:4px">${mats.map((m) => `${esc([m.category, m.brand, m.model].filter(Boolean).join(' · '))}: <b>${Number(m.quantity)}</b>`).join(' · ')}</div>`
        : '';
      return `<tr><td><strong>${esc(r.name)}</strong>${matHtml}</td><td class="muted">${esc(r.description || '—')}</td><td><b>${money(r.base_price)}</b></td></tr>`;
    }).join('');

    const ruleRows = allRules.map((r) =>
      `<tr><td><strong>${esc(r.name)}</strong></td><td class="muted">${esc(r.description || '—')}</td><td>${fmtRule(r)}</td></tr>`
    ).join('');

    const el = document.querySelector('#content');
    if (!el) return;
    el.innerHTML = `
      <div class="page-head"><div><h1>Fiyat listesi</h1>
        <p class="muted">Admin değişince otomatik yenilenir · malzeme hizmet altında</p></div>
        <button type="button" class="btn" id="spPricingRefresh">Yenile</button>
      </div>
      <div class="panel" style="margin-bottom:14px"><h3 style="margin:0 0 10px">Hizmetler</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Hizmet</th><th>Açıklama / malzeme</th><th>Satış</th></tr></thead>
        <tbody>${svcRows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">Hizmet yok</td></tr>'}</tbody></table></div>
      </div>
      <div class="panel"><h3 style="margin:0 0 10px">Kurallar</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Kural</th><th>Not</th><th>Değer</th></tr></thead>
        <tbody>${ruleRows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">Kural yok veya migration bekleniyor</td></tr>'}</tbody></table></div>
        <p class="muted small" style="margin-top:10px">Kâr marjı yüzde. Kişi başı = ekip ücreti (seyirci değil).</p>
      </div>`;
    document.querySelector('#spPricingRefresh')?.addEventListener('click', () => window.pricingView());
  };
})();

/* ===== END portal/portal-pricing-live.js ===== */

/* ===== BEGIN portal/password-recovery.js ===== */
/* Stagepulse Personel — secure self-service password recovery */
(() => {
  if (window.STAGEPULSE_PASSWORD_RECOVERY_BOUND) return;
  window.STAGEPULSE_PASSWORD_RECOVERY_BOUND = true;
  const resetUrl = `${location.origin}/portal/`;
  const $ = (s) => document.querySelector(s);
  const strong = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 128 && /[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p) && /\d/.test(p);

  async function forgotPassword() {
    const btn = $('#forgotPasswordBtn');
    const err = $('#loginErr');
    const email = String($('#loginUser')?.value || '').trim().toLowerCase();
    if (!email || !email.includes('@')) { if (err) { err.hidden = false; err.textContent = 'Önce hesabınızda kayıtlı e-posta adresini girin.'; } return; }
    if (btn) btn.disabled = true;
    if (err) { err.hidden = false; err.textContent = 'Sıfırlama bağlantısı gönderiliyor…'; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
    if (btn) btn.disabled = false;
    if (error) { if (err) err.textContent = error.message || 'Sıfırlama e-postası gönderilemedi.'; return; }
    if (err) err.textContent = 'Eğer bu e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi. E-postanızı kontrol edin.';
  }

  function recoveryModal() {
    document.getElementById('spPortalResetModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="spPortalResetModal"><div class="modal-card"><button class="close" type="button" id="spPortalResetClose">×</button><div class="brand">STAGEPULSE</div><h2>Yeni şifre</h2><p class="muted">Yeni parolanızı belirleyin. En az 10 karakter, bir harf ve bir rakam kullanın.</p><label>Yeni şifre<input id="spPortalNewPassword" type="password" minlength="10" autocomplete="new-password"></label><label>Yeni şifre tekrar<input id="spPortalNewPassword2" type="password" minlength="10" autocomplete="new-password"></label><div class="modal-actions"><button class="btn btn-primary" id="spPortalResetSave">Şifreyi güncelle</button></div><p id="spPortalResetError" class="err" role="alert"></p></div></div>`);
    $('#spPortalResetClose')?.addEventListener('click', () => document.getElementById('spPortalResetModal')?.remove());
    $('#spPortalResetSave')?.addEventListener('click', async () => {
      const p1 = $('#spPortalNewPassword')?.value || '';
      const p2 = $('#spPortalNewPassword2')?.value || '';
      const e = $('#spPortalResetError');
      if (!strong(p1)) { e.textContent='Şifre en az 10 karakter, bir harf ve bir rakam içermeli.'; return; }
      if (p1 !== p2) { e.textContent='Şifreler eşleşmiyor.'; return; }
      const btn = $('#spPortalResetSave'); btn.disabled = true; e.textContent='';
      const { error } = await sb.auth.updateUser({ password:p1 });
      btn.disabled = false;
      if (error) { e.textContent=error.message; return; }
      await sb.auth.signOut();
      document.getElementById('spPortalResetModal')?.remove();
      if (errBox()) { errBox().hidden = false; errBox().textContent='Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.'; }
      document.getElementById('loginView')?.classList.remove('is-hidden');
      if (document.getElementById('loginView')) document.getElementById('loginView').hidden=false;
      document.getElementById('appView')?.classList.add('is-hidden');
      if (document.getElementById('appView')) document.getElementById('appView').hidden=true;
    });
  }

  function errBox() { return $('#loginErr'); }
  function initPasswordRecovery() {
    $('#forgotPasswordBtn')?.addEventListener('click', forgotPassword);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordRecovery, { once:true });
  } else {
    initPasswordRecovery();
  }
})();

/* ===== END portal/password-recovery.js ===== */

/* ===== BEGIN portal/fcm-config.js ===== */
/* Stagepulse FCM config — delegates to shared/runtime-config.js when present. */
(function (global) {
  'use strict';
  if (global.STAGEPULSE_FCM_CONFIG && global.STAGEPULSE_FCM_CONFIG.apiKey) return;
  // Fallback if runtime-config was not loaded (e.g. SW importScripts order).
  global.STAGEPULSE_FCM_CONFIG = Object.freeze({
    apiKey: 'AIzaSyBZbLD2HpnrCDy4KJh9FUbwgBbI0m-jdeo',
    authDomain: 'stagepulse-905be.firebaseapp.com',
    projectId: 'stagepulse-905be',
    storageBucket: 'stagepulse-905be.firebasestorage.app',
    messagingSenderId: '163274034334',
    appId: '1:163274034334:web:844791f51bef484d33bf8f',
    measurementId: 'G-4BFSFS0SGM',
    vapidKey: 'BOPkjOlp10RVFRaJQtDx2l8v2uzLVrBTcv2EgTthRiSNGA3IbOAc6f24mGJJrQuice0FQtG3dxbB6Ae54gQS7tE'
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);

/* ===== END portal/fcm-config.js ===== */

/* ===== BEGIN portal/fcm-register-v3.js ===== */
/* Stagepulse FCM registration v18: native Android bridge + optional Web FCM. */
(() => {
  const cfg=window.STAGEPULSE_FCM_CONFIG;
  const __rt=(typeof globalThis!=='undefined'?globalThis:window).STAGEPULSE_RUNTIME||{};
  const SUPABASE_URL=__rt.supabaseUrl||'';
  const SUPABASE_KEY=__rt.supabasePublishableKey||'';
  if(!SUPABASE_URL||!SUPABASE_KEY){console.error('[Stagepulse FCM] STAGEPULSE_RUNTIME missing');return;}
  const state={status:'idle',channel:'fcm',error:null,notification:'unknown',secureContext:false,serviceWorker:false,pushManager:false,subscription:false,token:false};
  const emit=()=>window.dispatchEvent(new CustomEvent('stagepulse:push-status',{detail:{...state}}));
  const setState=p=>{Object.assign(state,p);emit();};
  const isNativeAndroid=()=>!!window.StagepulseAndroid;
  const diagnostics=async()=>{
    if(isNativeAndroid()){
      const notification=window.StagepulseAndroid?.notificationPermissionGranted?.()===true?'granted':'unknown';
      setState({status:'ready',channel:'fcm',error:null,notification,secureContext:true,serviceWorker:true,pushManager:true,subscription:true,token:true});
      return {...state};
    }
    state.notification='Notification'in window?Notification.permission:'missing';
    state.secureContext=!!window.isSecureContext;
    state.serviceWorker='serviceWorker'in navigator;
    state.pushManager='PushManager'in window;
    emit();
    return {...state};
  };
  if(!cfg||!window.supabase){setState({status:'error',error:!cfg?'Firebase yapılandırması yüklenmedi.':'Supabase istemcisi yüklenmedi.'});return;}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let busy=false;
  let attemptedUser='';
  const variant=()=>cfg.appVariant==='admin'||document.documentElement.dataset.appVariant==='admin'||location.pathname.startsWith('/admin/')?'admin':'staff';

  async function syncNativeSession(sessionOverride=null){
    if(!isNativeAndroid()||!window.StagepulseAndroid?.setAccessToken)return null;
    try{
      let session=sessionOverride;
      if(!session){
        const {data,error}=await client.auth.getSession();
        if(error)throw error;
        session=data?.session||null;
      }
      const token=session?.access_token||'';
      window.StagepulseAndroid.setAccessToken(token);
      attemptedUser=session?.user?.id||'';
      return session;
    }catch(e){
      console.error('[Stagepulse FCM] Native session sync failed',e);
      return null;
    }
  }

  async function register(force=false){
    if(busy)return false;
    if(!force && (state.status==='error'||state.status==='unsupported'))return false;
    if(isNativeAndroid()){
      await syncNativeSession();
      if(window.StagepulseAndroid?.requestNotificationPermission) window.StagepulseAndroid.requestNotificationPermission();
      setState({status:'ready',channel:'fcm',error:null,secureContext:true,serviceWorker:true,pushManager:true,subscription:true,token:true,notification:'granted'});
      return true;
    }
    busy=true;setState({status:'checking',error:null});await diagnostics();
    try{
      if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){
        setState({status:'unsupported',channel:'web',error:null,subscription:false,token:false});
        return false;
      }
      if(location.protocol!=='https:'&&location.hostname!=='localhost')throw new Error('FCM Web için HTTPS gerekiyor.');
      const {data:{session},error:se}=await client.auth.getSession();if(se)throw se;
      if(!session?.user){setState({status:'idle',error:null});return false;}
      if(Notification.permission==='denied'){
        setState({status:'permission',error:'Bildirim izni cihaz ayarlarından engellenmiş.'});
        return false;
      }
      if(Notification.permission!=='granted'){
        setState({status:'permission',error:null});
        return false;
      }
      if(!cfg.apiKey||!cfg.projectId||!cfg.appId||!cfg.messagingSenderId||!cfg.vapidKey)throw new Error('Firebase FCM yapılandırması eksik.');
      if(!window.firebase||!firebase.messaging)throw new Error('Firebase Messaging SDK yüklenmedi.');
      if(!firebase.apps.length)firebase.initializeApp(cfg);
      const supported=typeof firebase.messaging.isSupported==='function'?await firebase.messaging.isSupported():true;
      if(!supported){setState({status:'unsupported',channel:'web',error:null,subscription:false,token:false});return false;}
      // Reuse the site's root service worker. Registering a second worker with
      // the same scope replaces the PWA worker and makes background delivery
      // depend on which page was visited last.
      const sw=await navigator.serviceWorker.register('/sw.js?v=20260901-fcm-unified',{scope:'/',updateViaCache:'none'});
      await navigator.serviceWorker.ready;try{await sw.update();}catch(_){ }
      const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:cfg.vapidKey,serviceWorkerRegistration:sw});
      if(!token)throw new Error('FCM registration token alınamadı.');
      const {error}=await client.rpc('register_notification_device',{p_token:token,p_platform:'web',p_app_variant:variant()});if(error)throw error;
      attemptedUser=session.user.id;
      setState({status:'ready',channel:'fcm',subscription:true,token:true,error:null});
      window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready',{detail:{appVariant:variant(),channel:'fcm'}}));
      messaging.onMessage(payload=>window.dispatchEvent(new CustomEvent('stagepulse:fcm-message',{detail:payload})));
      return true;
    }catch(e){
      const detail=[e?.name,e?.code,e?.message].filter(Boolean).join(' | ')||String(e);
      setState({status:'error',error:detail,subscription:false,token:false});
      console.error('[Stagepulse FCM]',e);
      return false;
    }finally{busy=false;}
  }

  async function enable(){
    if(isNativeAndroid()){
      if(window.StagepulseAndroid?.requestNotificationPermission) window.StagepulseAndroid.requestNotificationPermission();
      await syncNativeSession();
      return register(true);
    }
    try{
      if(!('Notification'in window))throw new Error('Notification API desteklenmiyor.');
      const p=await Notification.requestPermission();
      if(p!=='granted'){setState({status:'permission',error:`Bildirim izni verilmedi: ${p}`});return false;}
      return register(true);
    }catch(e){
      const detail=e?.message||String(e);setState({status:'error',error:detail});return false;
    }
  }

  window.StagepulseFCM={register,enable,diagnostics,getStatus:()=>({...state})};
  const initFcm=()=>register(false).catch(()=>{});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFcm,{once:true});else void initFcm();
  client.auth.onAuthStateChange((event,session)=>{
    if(isNativeAndroid()){
      syncNativeSession(session);
      if(window.StagepulseAndroid?.refreshSession) window.StagepulseAndroid.refreshSession();
    }
    if(!session?.user){attemptedUser='';return;}
    if(event==='SIGNED_IN' || (event==='INITIAL_SESSION' && attemptedUser!==session.user.id))setTimeout(()=>register(false).catch(()=>{}),0);
  });
})();

/* ===== END portal/fcm-register-v3.js ===== */

/* ===== BEGIN portal/live-sync.js ===== */
/* Stagepulse portal — realtime data + notification sync. */
(() => {
  if (!window.supabase) return;
  const client=window.supabase.createClient('https://mtjcqqrogjqaxkagwkti.supabase.co','sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6');let channel=null,refreshTimer=null,refreshPending=false;
  const currentView=()=> (location.hash||'#home').slice(1)||'home';const activeEditor=()=>{const el=document.activeElement;return !!el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);};
  const refresh=()=>{refreshTimer=null;const v=currentView();const btn=document.querySelector(`#sideNav button[data-view="${CSS.escape(v)}"]`);if(activeEditor()){refreshPending=true;if(typeof window.toast==='function')window.toast('Yeni değişiklik geldi. Açık formu kaydettikten sonra ekran yenilenecek.',true);return;}refreshPending=false;if(btn)btn.click();};
  const scheduleRefresh=()=>{if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,450);};const notifyLocal=p=>{const n=p?.new||{};if(n.title&&typeof window.toast==='function')window.toast(`${n.title}: ${n.body||''}`.trim(),true);if(currentView()==='notifications')scheduleRefresh();};
  async function start(){try{const {data}=await client.auth.getUser();const uid=data?.user?.id;if(!uid)return;if(channel)await client.removeChannel(channel);channel=client.channel(`stagepulse-portal-live-${uid}`).on('postgres_changes',{event:'*',schema:'public',table:'teklifler'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'jobs'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'equipment'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'customers'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'settlements'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'payments'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'services'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'price_rules'},scheduleRefresh).on('postgres_changes',{event:'*',schema:'public',table:'service_equipment_defaults'},scheduleRefresh).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`recipient_user_id=eq.${uid}`},notifyLocal).subscribe();}catch(e){console.warn('Stagepulse realtime portal sync failed:',e);}}
  window.addEventListener('load',()=>setTimeout(start,1200));document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();});document.addEventListener('blur',()=>{if(refreshPending&&!activeEditor())scheduleRefresh();},true);
})();

/* ===== END portal/live-sync.js ===== */

/* ===== BEGIN portal/inventory-ui-v3.js ===== */
/* Stagepulse Inventory UI v6 — canonical personnel/admin equipment UI. */
(() => {
  const PAGE_SIZE=50;
  let page=0,total=0,rows=[],q='';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Math.max(0,Number(v)||0);
  const healthy=e=>Math.max(0,n(e.quantity)-n(e.faulty_quantity)-n(e.maintenance_quantity));
  const available=e=>Math.max(0,n(e.quantity)-n(e.faulty_quantity)-n(e.maintenance_quantity)-n(e.reserved_quantity)-n(e.in_use_quantity));
  const isAdmin=location.pathname.startsWith('/admin');
  const source=()=>isAdmin?'equipment':'equipment_staff';
  const hasCan=()=>typeof window.can==='function';
  const canEdit=()=>isAdmin||(hasCan()&&(window.can('equipment.manage')||window.can('equipment.update')||window.can('equipment_status_update')));
  const canView=()=>isAdmin||(hasCan()&&(window.can('equipment')||window.can('jobs')));
  const notify=(msg,ok=true)=>typeof toast==='function'?toast(msg,ok):console.log(msg);
  let modalReturnFocus=null;
  const modalKeydown=event=>{if(event.key==='Escape')window.spPersonnelInventoryClose();};
  const style=document.createElement('style');
  style.textContent=`
    .sp-pinv-toolbar{display:flex;gap:10px;margin-bottom:14px}.sp-pinv-toolbar input{flex:1}.sp-pinv-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.sp-pinv-stat{padding:14px;border:1px solid #282828;border-radius:14px;background:#111}.sp-pinv-stat span{display:block;color:#999;font-size:12px}.sp-pinv-stat b{display:block;margin-top:4px;font-size:21px}.sp-pinv-status{display:flex;gap:5px;flex-wrap:wrap}.sp-pinv-chip{border:1px solid #292929;border-radius:999px;padding:4px 8px;font-size:11px;background:#151515;color:#ccc;font-weight:600;white-space:nowrap}.sp-pinv-chip b{color:inherit}.sp-pinv-chip:nth-child(1){border-color:#1f6b45;background:#0c2418;color:#73dda1;box-shadow:0 0 8px rgba(105,223,145,.12)}.sp-pinv-chip:nth-child(2){border-color:#713838;background:#261010;color:#ff8b8b;box-shadow:0 0 8px rgba(255,115,115,.12)}.sp-pinv-chip:nth-child(3){border-color:#6e5b0a;background:#241f08;color:#f4d35e;box-shadow:0 0 8px rgba(244,211,94,.12)}.sp-pinv-chip:nth-child(4){border-color:#51418a;background:#17132a;color:#b6a5ff;box-shadow:0 0 8px rgba(169,146,255,.12)}.sp-pinv-chip:nth-child(5){border-color:#315c8f;background:#0d1929;color:#83b5ff;box-shadow:0 0 8px rgba(117,169,255,.12)}.sp-pinv-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.78);backdrop-filter:blur(7px)}.sp-pinv-card{width:min(680px,100%);max-height:92vh;overflow:auto;background:#101010;border:1px solid #343434;border-radius:22px;padding:20px;box-shadow:0 30px 90px #000}.sp-pinv-head{display:flex;justify-content:space-between;gap:10px}.sp-pinv-head h2{margin:0}.sp-pinv-close{width:40px;height:40px;border-radius:10px;background:#181818;color:#fff;border:1px solid #333;font-size:22px}.sp-pinv-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.sp-pinv-grid label{font-size:13px;font-weight:600}.sp-pinv-grid input{margin-top:6px;width:100%;box-sizing:border-box}.sp-pinv-section{margin-top:16px;padding:14px;border:1px solid #292929;border-radius:16px;background:#0d0d0d}.sp-pinv-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sp-pinv-status-grid input{margin-top:5px;width:100%;box-sizing:border-box}.sp-pinv-live{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.sp-pinv-live div{background:#151515;padding:9px;border-radius:9px}.sp-pinv-live span{display:block;color:#888;font-size:11px}.sp-pinv-live b{font-size:17px}.sp-pinv-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px}@media(max-width:650px){.sp-pinv-summary{grid-template-columns:1fr 1fr}.sp-pinv-grid,.sp-pinv-status-grid{grid-template-columns:1fr}.sp-pinv-live{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  async function load(){
    if(!canView())return;
    let query=sb.from(source()).select('id,category,brand,model,quantity,active,notes,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,updated_at',{count:'exact'}).order('category').order('brand',{nullsFirst:true}).range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);
    if(q)query=query.or(`category.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`);
    const {data,error,count}=await query;if(error)throw error;rows=data||[];total=count||0;render();
  }

  async function loadOne(id){
    const {data,error}=await sb.from(source()).select('id,category,brand,model,quantity,active,notes,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,updated_at').eq('id',id).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Ekipman kaydı bulunamadı. Listeyi yenileyin.');
    return data;
  }

  function render(){
    const qty=rows.reduce((a,e)=>a+n(e.quantity),0),fault=rows.reduce((a,e)=>a+n(e.faulty_quantity),0),maint=rows.reduce((a,e)=>a+n(e.maintenance_quantity),0),free=rows.reduce((a,e)=>a+available(e),0);
    $('#content').innerHTML=`<div class="page-head"><div><h1>Ekipman</h1><p class="muted">Envanter · durum adetleri · sadece yetkili personel düzenleyebilir</p></div></div><div class="sp-pinv-toolbar"><input id="spPInvSearch" placeholder="Kategori, marka veya model ara…" value="${esc(q)}"><button class="btn" id="spPInvRefresh">Yenile</button></div><div class="sp-pinv-summary"><div class="sp-pinv-stat"><span>Bu sayfa toplam</span><b>${qty}</b></div><div class="sp-pinv-stat"><span>Arızalı</span><b>${fault}</b></div><div class="sp-pinv-stat"><span>Bakımda</span><b>${maint}</b></div><div class="sp-pinv-stat"><span>Sağlam / boşta</span><b>${free}</b></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Ekipman</th><th>Toplam</th><th>Durum adetleri</th><th>Aktif</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td><strong>${esc([e.category,e.brand].filter(Boolean).join(' · '))}</strong><div class="muted small">${esc(e.model||'—')}</div></td><td><b>${n(e.quantity)}</b></td><td><div class="sp-pinv-status"><span class="sp-pinv-chip">Sağlam <b>${healthy(e)}</b></span><span class="sp-pinv-chip">Arıza <b>${n(e.faulty_quantity)}</b></span><span class="sp-pinv-chip">Bakım <b>${n(e.maintenance_quantity)}</b></span><span class="sp-pinv-chip">Rezerve <b>${n(e.reserved_quantity)}</b></span><span class="sp-pinv-chip">Kullanımda <b>${n(e.in_use_quantity)}</b></span></div></td><td>${e.active===false?'<span class="status cancelled">Pasif</span>':'<span class="status accepted">Aktif</span>'}</td><td>${canEdit()?`<button class="btn" onclick="window.spPersonnelInventory('${e.id}')">Durum</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="muted" style="text-align:center;padding:28px">Ekipman bulunamadı.</td></tr>'}</tbody></table></div></div><div class="sp-pinv-pager"><button class="btn" id="spPPrev" ${page===0?'disabled':''}>‹ Önceki</button><span>${total?page*PAGE_SIZE+1:0}–${Math.min((page+1)*PAGE_SIZE,total)} / ${total}</span><button class="btn" id="spPNext" ${((page+1)*PAGE_SIZE>=total)?'disabled':''}>Sonraki ›</button></div>`;
    $('#spPInvSearch')?.addEventListener('input',()=>{q=$('#spPInvSearch').value.trim();page=0;clearTimeout(window.__spPinvT);window.__spPinvT=setTimeout(load,280)});$('#spPInvRefresh')?.addEventListener('click',load);$('#spPPrev')?.addEventListener('click',()=>{if(page>0){page--;load()}});$('#spPNext')?.addEventListener('click',()=>{if((page+1)*PAGE_SIZE<total){page++;load()}});
  }

  async function modal(id){
    if(!canEdit())return notify('Ekipman durumunu değiştirme yetkiniz yok.',false);
    let e;
    try{e=await loadOne(id)}catch(err){return notify(err.message||'Ekipman yeniden okunamadı.',false)}
    const total=n(e.quantity);window.spPersonnelInventoryClose();modalReturnFocus=document.activeElement;
    document.body.insertAdjacentHTML('beforeend',`<div class="sp-pinv-modal" id="spPInvModal" role="dialog" aria-modal="true" aria-labelledby="spPInvTitle" aria-describedby="spPInvDescription"><div class="sp-pinv-card"><div class="sp-pinv-head"><div><p class="muted small">ENVANTER DURUMU</p><h2 id="spPInvTitle">${esc([e.brand,e.model].filter(Boolean).join(' ')||e.category)}</h2><p class="muted" id="spPInvDescription">Toplam stok <strong>${total}</strong> adet · Aktif/Pasif admin tarafından yönetilir</p></div><button type="button" class="sp-pinv-close" aria-label="Envanter penceresini kapat" onclick="window.spPersonnelInventoryClose()">×</button></div><div class="sp-pinv-section"><h3>Durum adetlerini değiştir</h3><div class="sp-pinv-status-grid"><label for="spPFault">Arızalı<input id="spPFault" type="number" min="0" max="${total}" value="${n(e.faulty_quantity)}"></label><label for="spPMaint">Bakımda<input id="spPMaint" type="number" min="0" max="${total}" value="${n(e.maintenance_quantity)}"></label><label for="spPReserved">Rezerve<input id="spPReserved" type="number" min="0" max="${total}" value="${n(e.reserved_quantity)}"></label><label for="spPUse">Kullanımda<input id="spPUse" type="number" min="0" max="${total}" value="${n(e.in_use_quantity)}"></label></div><div class="sp-pinv-live" aria-live="polite"><div><span>Toplam stok</span><b id="spPTotal">${total}</b></div><div><span>Arızalı</span><b id="spPFaultLive">${n(e.faulty_quantity)}</b></div><div><span>Sağlam</span><b id="spPHealthy">${healthy(e)}</b></div><div><span>Boşta</span><b id="spPAvailable">${available(e)}</b></div></div></div><div class="sp-pinv-actions"><button type="button" class="btn btn-primary" onclick="window.spPersonnelInventorySave('${e.id}')">Kaydet</button><button type="button" class="btn" onclick="window.spPersonnelInventoryClose()">İptal</button></div></div></div>`);
    document.addEventListener('keydown',modalKeydown);
    $('#spPFault')?.focus();
    ['spPFault','spPMaint','spPReserved','spPUse'].forEach(k=>$('#'+k)?.addEventListener('input',()=>{const t=total,f=n($('#spPFault').value),m=n($('#spPMaint').value),r=n($('#spPReserved').value),u=n($('#spPUse').value);$('#spPTotal').textContent=t;$('#spPFaultLive').textContent=f;$('#spPHealthy').textContent=Math.max(0,t-f-m);$('#spPAvailable').textContent=Math.max(0,t-f-m-r-u)}));
  }

  window.spPersonnelInventory=modal;
  window.spPersonnelInventoryClose=()=>{document.removeEventListener('keydown',modalKeydown);document.getElementById('spPInvModal')?.remove();if(modalReturnFocus?.isConnected)modalReturnFocus.focus();modalReturnFocus=null;};
  window.spPersonnelInventorySave=async(id)=>{
    if(!canEdit())return notify('Ekipman durumunu değiştirme yetkiniz yok.',false);
    const f=n($('#spPFault').value),m=n($('#spPMaint').value),r=n($('#spPReserved').value),u=n($('#spPUse').value);
    let latest;try{latest=await loadOne(id)}catch(err){return notify(err.message||'Ekipman yeniden okunamadı.',false)}
    const totalNow=n(latest.quantity);
    if(f+m+r+u>totalNow)return notify(`Durum adetleri toplam stoktan (${totalNow}) fazla olamaz.`,false);
    const res=await sb.from('equipment').update({faulty_quantity:f,maintenance_quantity:m,reserved_quantity:r,in_use_quantity:u,updated_at:new Date().toISOString()}).eq('id',id);
    if(res.error)return notify(res.error.message,false);
    notify('Ekipman durumu güncellendi.');window.spPersonnelInventoryClose();window.dispatchEvent(new CustomEvent('stagepulse:inventory-changed'));await load();
  };
  window.equipmentView=async()=>{page=0;await load()};
  const boot=()=>{if(location.hash==='#equipment')setTimeout(()=>window.loadView?.('equipment'),0)};
  window.addEventListener('hashchange',boot);window.addEventListener('stagepulse:inventory-changed',()=>{if(location.hash==='#equipment')load()});boot();
})();

/* ===== END portal/inventory-ui-v3.js ===== */

/* ===== BEGIN portal/portal-shell-parity.js ===== */
/* Shared visual shell only: keep the staff data/permission model intact while matching Admin navigation chrome. */
(() => {
  const labels = {
    home: ['Genel Bakış', 'Özet'],
    jobs: ['İşler', 'Takvim ve operasyon'],
    equipment: ['Ekipman', 'Envanter'],
    offers: ['Teklifler', 'Satış talepleri'],
    customers: ['Müşteriler', 'Müşteri kayıtları'],
    finance: ['Ödemeler / Finans', 'Finans'],
    pricing: ['Fiyatlandırma', 'Hizmet taban fiyatları'],
    analytics: ['Analitik', 'Raporlar'],
    activity: ['Aktivite', 'Sistem hareketleri'],
    notifications: ['Bildirimler', 'Bildirim merkezi'],
    settings: ['Ayarlar', 'Hesap ve sistem']
  };
  const setTitle = view => {
    const pair = labels[view] || ['Stagepulse', 'Personel Portalı'];
    const title = document.querySelector('#portalViewTitle');
    const subtitle = document.querySelector('#portalViewSubtitle');
    if (title) title.textContent = pair[0];
    if (subtitle) subtitle.textContent = pair[1];
  };
  const boot = () => {
    if (window.__spShellParityWrapped || typeof window.loadView !== 'function') return;
    const original = window.loadView;
    window.loadView = async view => {
      setTitle(view);
      return original(view);
    };
    window.__spShellParityWrapped = true;
    setTitle((location.hash || '#home').slice(1) || 'home');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('stagepulse:permissions-ready', boot);
  window.addEventListener('hashchange', () => setTitle((location.hash || '#home').slice(1) || 'home'));
})();

/* ===== END portal/portal-shell-parity.js ===== */

/* ===== BEGIN portal/app-update.js ===== */
/* Stagepulse OTA web update layer. Public version and internal build are separate. */
(() => {
  'use strict';
  const VERSION_URL = '/app-update.json';
  const STORAGE_KEY = 'stagepulse-web-build';
  const LAST_DAILY_CHECK_KEY = 'stagepulse-last-daily-update-check';
  let reloadScheduled = false;
  let midnightTimer = null;

  function currentBuild() { return localStorage.getItem(STORAGE_KEY) || ''; }
  function setBuild(build) { if (build) localStorage.setItem(STORAGE_KEY, String(build)); }
  function todayKey() { const now=new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }

  function showUpdateNotice() {
    if (document.getElementById('stagepulse-update-notice')) return;
    const notice=document.createElement('div'); notice.id='stagepulse-update-notice'; notice.setAttribute('role','status');
    notice.innerHTML='<strong>Yeni Stagepulse sürümü hazır</strong><span>Uygulama güncelleniyor…</span>';
    Object.assign(notice.style,{position:'fixed',left:'16px',right:'16px',bottom:'16px',zIndex:'2147483647',padding:'14px 16px',borderRadius:'12px',background:'#111',color:'#fff',border:'1px solid #333',boxShadow:'0 12px 40px rgba(0,0,0,.35)',fontFamily:'Inter,system-ui,sans-serif',fontSize:'14px'});
    notice.querySelector('span').style.display='block'; notice.querySelector('span').style.marginTop='4px'; notice.querySelector('span').style.color='#aaa'; document.body.appendChild(notice);
  }

  async function checkForUpdate() {
    if (reloadScheduled || !navigator.onLine) return false;
    try {
      const response=await fetch(`${VERSION_URL}?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin',headers:{'Cache-Control':'no-cache'}});
      if(!response.ok)return false;
      const info=await response.json();
      if(!info||!['verified','no_verified_release'].includes(info.status)||!info.staff)return false;
      const version=String(info.staff.web_version||'').trim();
      if(!version)return false;
      const build=String(info.release||`${version}:${info.updated_at||''}`);
      const local=currentBuild();
      if(!local){setBuild(build);return true;}
      if(local===build)return true;
      showUpdateNotice(); reloadScheduled=true; setBuild(build); setTimeout(()=>window.location.reload(),500); return true;
    } catch (_) { return false; }
  }

  async function dailyCheck(){const today=todayKey();if(localStorage.getItem(LAST_DAILY_CHECK_KEY)===today)return true;const successful=await checkForUpdate();if(successful)localStorage.setItem(LAST_DAILY_CHECK_KEY,today);scheduleNextMidnight();return successful;}
  function scheduleNextMidnight(){if(midnightTimer)clearTimeout(midnightTimer);const now=new Date();const next=new Date(now);next.setHours(24,0,0,0);midnightTimer=setTimeout(()=>dailyCheck(),Math.max(1000,next.getTime()-now.getTime()));}
  window.StagepulseWebUpdate={check:checkForUpdate,dailyCheck,version:()=> '2.3.0'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{checkForUpdate();dailyCheck();},{once:true});else{checkForUpdate();dailyCheck();}
  scheduleNextMidnight(); window.addEventListener('online',dailyCheck);
})();

/* ===== END portal/app-update.js ===== */

/* ===== BEGIN portal/personnel-v2.js ===== */
/* Stagepulse Personel Portal v2 — customer CRUD + pricing + mobile shell hardening. */
(() => {
  'use strict';
  const escV = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const moneyV = (v) => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const dateV = (v) => v ? new Date(v).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
  const norm = (v) => String(v ?? '').toLocaleLowerCase('tr-TR').trim();
  const has = (p) => typeof can === 'function' && can(p);
  const customerWrite = () => has('customers.create') || has('customers.update') || has('customers.manage') || has('customers');
  const customerDelete = () => has('customers.delete');
  const shell = {home:['Genel Bakış','Özet'],jobs:['İşler','Takvim ve operasyon'],equipment:['Ekipman','Envanter'],offers:['Teklifler','Satış talepleri'],customers:['Müşteriler','Müşteri kayıtları'],finance:['Ödemeler / Finans','Finans'],settlements:['Gelir · Gider','Gelir ve gider kayıtları'],pricing:['Fiyatlandırma','Hizmet taban fiyatları'],analytics:['Analitik','Raporlar'],activity:['Aktivite','Sistem hareketleri'],notifications:['Bildirimler','Bildirim merkezi'],settings:['Ayarlar','Hesap ve sistem']};
  function setTitle(view){const p=shell[view]||['Stagepulse','Personel Portalı'];const h=document.querySelector('#portalViewTitle'),s=document.querySelector('#portalViewSubtitle');if(h)h.textContent=p[0];if(s)s.textContent=p[1];}
  function syncMenuButton(){const menu=document.querySelector('#menuBtn'),side=document.querySelector('#sidebar');if(!menu)return;const open=!!side?.classList.contains('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');menu.textContent=open?'×':'☰';}
  function closeMenu(){const side=document.querySelector('#sidebar'),overlay=document.querySelector('#mobileOverlay');side?.classList.remove('open');if(overlay){overlay.hidden=true;overlay.classList.remove('open');}document.body.style.overflow='';syncMenuButton();}
  function openMenu(){const side=document.querySelector('#sidebar'),overlay=document.querySelector('#mobileOverlay');if(!side)return;side.classList.add('open');if(overlay){overlay.hidden=false;overlay.classList.add('open');}document.body.style.overflow='hidden';syncMenuButton();}
  function bindMobileShell(){const menu=document.querySelector('#menuBtn'),overlay=document.querySelector('#mobileOverlay');if(menu&&!menu.dataset.spMenuBound){menu.dataset.spMenuBound='1';menu.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();document.querySelector('#sidebar')?.classList.contains('open')?closeMenu():openMenu();},{passive:false});}if(overlay&&!overlay.dataset.spOverlayBound){overlay.dataset.spOverlayBound='1';overlay.addEventListener('click',(e)=>{if(e.target===overlay)closeMenu();},{passive:true});}document.querySelector('#sidebar')?.querySelectorAll('button[data-view]').forEach(b=>{if(b.dataset.spCloseBound)return;b.dataset.spCloseBound='1';b.addEventListener('click',closeMenu,{passive:true});});const closeBtn=document.querySelector('#sidebar')?.querySelector('.portal-sidebar-close');if(closeBtn&&!closeBtn.dataset.spCloseBound){closeBtn.dataset.spCloseBound='1';closeBtn.addEventListener('click',closeMenu,{passive:true});}syncMenuButton();}
  async function loadCustomers(){if(!has('customers.view'))return [];const {data,error}=await sb.from('customers_staff').select('id,name,company,phone,email,last_contact_at,created_at,updated_at').order('name');if(error)throw error;return data||[];}
  async function loadPricing(){if(!has('pricing.view'))return [];const {data,error}=await sb.from('pricing_staff').select('id,name,description,base_price,sort_order').order('sort_order').order('name');if(error)throw error;return data||[];}
  function customerFormHtml(row={}){return `<div class="panel" id="spCustomerFormPanel" style="margin:16px 0"><div class="page-head"><div><h3 style="margin:0">${row.id?'Müşteriyi düzenle':'Yeni müşteri'}</h3><p class="muted">Yetkiniz olan alanları kaydedebilirsiniz.</p></div></div><div class="grid2"><label>Ad / Ünvan<input id="spCName" value="${escV(row.name)}" maxlength="160"></label><label>Firma<input id="spCCompany" value="${escV(row.company)}" maxlength="160"></label><label>Telefon<input id="spCPhone" value="${escV(row.phone)}" maxlength="60"></label><label>E-posta<input id="spCEmail" type="email" value="${escV(row.email)}" maxlength="180"></label></div><label>Notlar<textarea id="spCNotes" rows="3" maxlength="2000">${escV(row.notes)}</textarea></label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-primary" id="spCustomerSaveBtn">${row.id?'Kaydet':'Müşteri ekle'}</button><button type="button" class="btn" id="spCustomerCancelBtn">İptal</button></div></div>`;}
  async function saveCustomer(id=null){const payload={p_name:document.querySelector('#spCName')?.value?.trim()||'',p_company:document.querySelector('#spCCompany')?.value?.trim()||null,p_phone:document.querySelector('#spCPhone')?.value?.trim()||null,p_email:document.querySelector('#spCEmail')?.value?.trim()||null,p_notes:document.querySelector('#spCNotes')?.value?.trim()||null};if(!payload.p_name)return toast('Müşteri adı zorunludur',false);const rpc=id?'staff_update_customer':'staff_create_customer';const args=id?{p_id:id,...payload}:payload;const {error}=await sb.rpc(rpc,args);if(error)return toast(error.message,false);toast(id?'Müşteri güncellendi.':'Müşteri eklendi.');await window.customersView();}
  async function deleteCustomer(id,name){if(!customerDelete())return toast('Müşteri silme yetkiniz yok',false);if(!window.confirm(`“${name||'Bu müşteri'}” kaydı silinsin mi? Bu işlem geri alınamaz.`))return;const {error}=await sb.rpc('staff_delete_customer',{p_id:id});if(error)return toast(error.message,false);toast('Müşteri silindi.');await window.customersView();}
  window.customersView=async function(){if(!has('customers.view')){const c=document.querySelector('#content');if(c)c.innerHTML='<div class="panel"><b>Erişim yetkiniz yok.</b><p class="muted">Müşteriler modülü için yöneticinizden yetki istemelisiniz.</p></div>';return;}try{const rows=await loadCustomers();const content=document.querySelector('#content');if(!content)return;content.innerHTML=`<div class="personnel-v2"><div class="page-head"><div><h1>Müşteriler</h1><p class="muted">Müşteri kayıtları ve yetkinize bağlı işlemler</p></div>${customerWrite()?'<button type="button" class="btn btn-primary" id="spNewCustomerBtn">+ Yeni Müşteri</button>':''}</div><div id="spCustomerFormSlot"></div><div class="portal-toolbar"><input class="portal-search" id="spCustomerSearch" type="search" placeholder="Müşteri, firma, telefon veya e-posta ara…" autocomplete="off"><span class="portal-pill">${rows.length} kayıt</span></div><div id="spCustomerList" class="portal-customer-grid"></div></div>`;const render=()=>{const list=document.querySelector('#spCustomerList');if(!list)return;const q=norm(document.querySelector('#spCustomerSearch')?.value);const filtered=rows.filter(r=>[r.name,r.company,r.phone,r.email].some(v=>norm(v).includes(q)));list.innerHTML=filtered.map(r=>`<article class="portal-customer-card"><h3>${escV(r.name||'İsimsiz müşteri')}</h3><p>${escV(r.company||'Firma bilgisi yok')}</p><div class="meta"><span>Telefon: ${escV(r.phone||'—')}</span><span>E-posta: ${escV(r.email||'—')}</span><span>Son iletişim: ${dateV(r.last_contact_at)}</span></div>${customerWrite()||customerDelete()?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${customerWrite()?'<button type="button" class="btn" data-edit="'+r.id+'">Düzenle</button>':''}${customerDelete()?'<button type="button" class="btn" data-delete="'+r.id+'">Sil</button>':''}</div>`:''}</article>`).join('')||'<div class="panel portal-empty" style="grid-column:1/-1">Aramanıza uygun müşteri bulunamadı.</div>';};document.querySelector('#spCustomerSearch')?.addEventListener('input',render);document.querySelector('#spNewCustomerBtn')?.addEventListener('click',()=>{const slot=document.querySelector('#spCustomerFormSlot');if(!slot)return;slot.innerHTML=customerFormHtml();bindCustomerForm(null);document.querySelector('#spCustomerFormPanel')?.scrollIntoView({behavior:'smooth',block:'start'});});document.querySelector('#spCustomerList')?.addEventListener('click',(e)=>{const target=e.target;if(!(target instanceof Element))return;const edit=target.closest('[data-edit]'),del=target.closest('[data-delete]');if(edit){const row=rows.find(x=>x.id===edit.dataset.edit);if(row){document.querySelector('#spCustomerFormSlot').innerHTML=customerFormHtml(row);bindCustomerForm(row.id);document.querySelector('#spCustomerFormPanel')?.scrollIntoView({behavior:'smooth',block:'start'});}}if(del){const row=rows.find(x=>x.id===del.dataset.delete);deleteCustomer(del.dataset.delete,row?.name);}});render();}catch(e){const content=document.querySelector('#content');if(content)content.innerHTML=`<div class="panel"><b>Müşteriler yüklenemedi.</b><p class="muted">${escV(e?.message||e)}</p></div>`;}}
  function bindCustomerForm(id){document.querySelector('#spCustomerSaveBtn')?.addEventListener('click',()=>saveCustomer(id));document.querySelector('#spCustomerCancelBtn')?.addEventListener('click',()=>{const slot=document.querySelector('#spCustomerFormSlot');if(slot)slot.innerHTML='';});}
  window.pricingView=async function(){if(!has('pricing.view')){const c=document.querySelector('#content');if(c)c.innerHTML='<div class="panel"><b>Erişim yetkiniz yok.</b><p class="muted">Fiyatlandırma modülü için yöneticinizden yetki istemelisiniz.</p></div>';return;}const rows=await loadPricing();const content=document.querySelector('#content');if(!content)return;content.innerHTML=`<div class="personnel-v2"><div class="page-head"><div><h1>Fiyatlandırma</h1><p class="muted">Personel için yayınlanan hizmet ve fiyat listesi</p></div></div><div class="portal-toolbar"><input class="portal-search" id="spPricingSearch" type="search" placeholder="Hizmet veya açıklama ara…" autocomplete="off"><span class="portal-pill">${rows.length} kalem</span></div><div id="spPricingList" class="portal-price-grid"></div><div class="portal-note">Gösterilen tutarlar Stagepulse fiyat listesindeki aktif kayıtların personel görünümüdür. Maliyet, marj ve diğer hassas finansal alanlar bu ekrana dahil edilmez.</div></div>`;const render=()=>{const list=document.querySelector('#spPricingList');if(!list)return;const q=norm(document.querySelector('#spPricingSearch')?.value);const filtered=rows.filter(r=>[r.name,r.description].some(v=>norm(v).includes(q)));list.innerHTML=filtered.map(r=>`<article class="portal-price-card"><h3>${escV(r.name||'Hizmet')}</h3><p>${escV(r.description||'Açıklama yok')}</p><div class="price">${moneyV(r.base_price)}</div></article>`).join('')||'<div class="panel portal-empty" style="grid-column:1/-1">Aramanıza uygun fiyat kalemi bulunamadı.</div>';};document.querySelector('#spPricingSearch')?.addEventListener('input',render);render();}
  window.settlementsView=async function(){if(!has('settlements.view')){const c=document.querySelector('#content');if(c)c.innerHTML='<div class="panel"><b>Gelir · Gider yetkiniz yok.</b><p class="muted">Bu bölüm için yöneticinizden yetki istemelisiniz.</p></div>';return;}try{const [{data,error},{data:summaryData,error:summaryError}]=await Promise.all([sb.rpc('staff_list_settlements'),sb.rpc('staff_financial_summary')]);if(error)throw error;if(summaryError)throw summaryError;const rows=data||[],s=(summaryData||[])[0]||{};const content=document.querySelector('#content');if(!content)return;content.innerHTML=`<div class="personnel-v2"><div class="page-head"><div><h1>Gelir · Gider</h1><p class="muted">Yetkiniz dahilindeki iş gelir/gider kayıtları</p></div></div><div class="cards"><div class="card"><span class="card-label">Toplam gelir</span><div class="metric">${moneyV(s.total_revenue)}</div></div><div class="card"><span class="card-label">Toplam gider</span><div class="metric">${moneyV(s.total_expense)}</div></div><div class="card"><span class="card-label">Net</span><div class="metric">${moneyV(s.total_net)}</div></div><div class="card"><span class="card-label">İş</span><div class="metric">${Number(s.job_count)||0}</div></div></div><div class="panel" style="margin-top:16px"><div class="table-wrap"><table class="data-table"><thead><tr><th>İş</th><th>Tarih</th><th>Konum</th><th>Gelir</th><th>Gider</th><th>Net</th><th>Durum</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escV(r.title)}</td><td>${escV(r.event_date||'—')}</td><td>${escV(r.location||'—')}</td><td><b>${moneyV(r.agreed_amount)}</b></td><td>${moneyV(r.expense_amount)}</td><td><b>${moneyV(r.net_amount)}</b></td><td><span class="status">${escV(r.status||'—')}</span></td></tr>`).join('')||'<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Gelir · Gider kaydı yok.</td></tr>'}</tbody></table></div></div></div>`;}catch(e){const content=document.querySelector('#content');if(content)content.innerHTML=`<div class="panel"><b>Gelir · Gider verisi yüklenemedi.</b><p class="muted">${escV(e?.message||e)}</p></div>`;}}
  function boot(){bindMobileShell();setTitle((location.hash||'#home').slice(1)||'home');window.addEventListener('hashchange',()=>{setTitle((location.hash||'#home').slice(1)||'home');closeMenu();});const side=document.querySelector('#sideNav');if(side){const observer=new MutationObserver(()=>bindMobileShell());observer.observe(side,{childList:true,subtree:true});}window.addEventListener('stagepulse:permissions-ready',bindMobileShell);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
/* ===== END portal/personnel-v2.js ===== */

/* ===== BEGIN portal/portal-crud.js ===== */
/* Stagepulse Personel — canonical RBAC + CRUD/write actions. */
(() => {
  'use strict';
  const q=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const can=k=>typeof window.can==='function'?window.can(k):window.staffUser?.permissions?.[k]===true;
  const notify=(m,ok=false)=>typeof window.toast==='function'?window.toast(m,ok):(!ok&&console.error(m));
  const ok=m=>notify(m,true);
  const aliases={accept_job:'jobs.accept',reject_job:'jobs.reject',update_job_status:'jobs.status.update',update_job_notes:'jobs.notes.update',manage_job_equipment:'jobs.equipment.manage',pricing_manage:'pricing.manage',equipment_manage:'equipment.manage',customers_manage:'customers.manage',offers_manage:'offers.manage',offer_create:'offers.create',offer_update:'offers.update',offer_send:'offers.send'};
  function hydrate(){const p=window.staffUser;if(!p||typeof p!=='object')return;p.permissions=p.permissions&&typeof p.permissions==='object'?p.permissions:{};Object.entries(aliases).forEach(([legacy,canonical])=>{if(p.permissions[canonical]===true)p.permissions[legacy]=true;});}
  const oldAfterLogin=window.afterLogin;window.afterLogin=function(){const r=oldAfterLogin?.apply(this,arguments);hydrate();return r};hydrate();
  const input=(id,label,type='text',value='')=>`<label>${label}<input id="${id}" type="${type}" value="${esc(value)}"></label>`;
  const panel=(title,fields,button)=>`<div class="panel staff-crud-panel"><div class="panel-head"><h3>${title}</h3></div><form class="staff-crud-form">${fields.join('')}<button class="btn btn-primary" type="submit">${button}</button></form></div>`;
  const mount=html=>{const c=q('#content');if(!c)return null;const x=document.createElement('div');x.innerHTML=html;x.dataset.staffCrud='1';c.prepend(x);return x};
  async function loadOfferRows(){if(!can('offers.view')&&!can('offers.manage')&&!can('offers.update')&&!can('offers.send')&&!can('offers.delete'))return[];const {data,error}=await sb.from('offers_staff').select('id,quote_number,name,company,location,people,event_date,event_type,type,agreed_amount,currency,status,created_at').order('event_date',{ascending:true,nullsFirst:false});if(error){notify(error.message);return[]}return data||[]}
  async function offerActions(){const list=await loadOfferRows();if(can('offers.create')||can('offers.manage')){const box=mount(panel('Yeni teklif oluştur',[input('spOfferName','Müşteri adı'),input('spOfferCompany','Firma'),input('spOfferPhone','Telefon'),input('spOfferEmail','E-posta','email'),input('spOfferLocation','Lokasyon'),input('spOfferPeople','Kişi sayısı','number'),input('spOfferDate','Etkinlik tarihi','date'),input('spOfferTotal','Toplam fiyat','number'),input('spOfferMessage','Not')],'Teklifi oluştur'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();if(!can('offers.create')&&!can('offers.manage'))return notify('Teklif oluşturma yetkiniz yok.');const {error}=await sb.rpc('staff_create_offer',{p_name:q('#spOfferName')?.value.trim(),p_company:q('#spOfferCompany')?.value.trim()||null,p_phone:q('#spOfferPhone')?.value.trim()||null,p_email:q('#spOfferEmail')?.value.trim()||null,p_location:q('#spOfferLocation')?.value.trim()||null,p_people:Number(q('#spOfferPeople')?.value)||null,p_message:q('#spOfferMessage')?.value.trim()||null,p_total:Number(q('#spOfferTotal')?.value)||0,p_services:[]});if(error)return notify(error.message);ok('Teklif oluşturuldu.');await window.loadView('offers')})}
    if(can('offers.update')||can('offers.manage')){const box=mount(panel('Teklif düzenle',[`<label>Teklif<select id="spEditOffer">${list.map(o=>`<option value="${o.id}">${esc(o.quote_number||o.id)} · ${esc(o.name||'')} · ${esc(o.status||'')}</option>`).join('')}</select></label>`,input('spEditName','Müşteri adı'),input('spEditCompany','Firma'),input('spEditLocation','Lokasyon'),input('spEditPeople','Kişi sayısı','number'),input('spEditDate','Etkinlik tarihi','date'),input('spEditTotal','Toplam','number'),input('spEditMessage','Not')],'Teklifi kaydet'));const sel=box?.querySelector('#spEditOffer');const fill=()=>{const o=list.find(x=>x.id===sel?.value);if(!o)return;q('#spEditName').value=o.name||'';q('#spEditCompany').value=o.company||'';q('#spEditLocation').value=o.location||'';q('#spEditPeople').value=o.people??'';q('#spEditDate').value=o.event_date||'';q('#spEditTotal').value=o.agreed_amount??0;q('#spEditMessage').value=''};sel?.addEventListener('change',fill);fill();box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const id=sel?.value;if(!id)return notify('Düzenlenecek teklif seçilmedi.');const {error}=await sb.rpc('staff_update_offer',{p_id:id,p_name:q('#spEditName')?.value.trim(),p_company:q('#spEditCompany')?.value.trim()||null,p_location:q('#spEditLocation')?.value.trim()||null,p_people:Number(q('#spEditPeople')?.value)||null,p_event_date:q('#spEditDate')?.value||null,p_message:q('#spEditMessage')?.value.trim()||null,p_total:Number(q('#spEditTotal')?.value)||0,p_services:[]});if(error)return notify(error.message);ok('Teklif güncellendi.');await window.loadView('offers')})}
    if(can('offers.send')||can('offers.manage')){const box=mount(panel('Teklif gönder',[`<label>Teklif<select id="spSendOffer">${list.map(o=>`<option value="${o.id}">${esc(o.quote_number||o.id)} · ${esc(o.name||'')} · ${esc(o.status||'')}</option>`).join('')}</select></label>`],'Gönder'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const id=q('#spSendOffer')?.value;if(!id)return notify('Gönderilecek teklif seçilmedi.');const {error}=await sb.rpc('staff_send_offer',{p_id:id});if(error)return notify(error.message);ok('Teklif gönderildi.');await window.loadView('offers')})}
    if(can('offers.delete')){const box=mount(panel('Teklif arşivle',[`<label>Teklif<select id="spODel">${list.map(o=>`<option value="${o.id}">${esc(o.quote_number||o.id)} · ${esc(o.name||'')} · ${esc(o.status||'')}</option>`).join('')}</select></label>`],'Arşivle'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Seçilen teklif arşivlensin mi?'))return;const {error}=await sb.rpc('staff_delete_offer',{p_id:q('#spODel')?.value});if(error)return notify(error.message);ok('Teklif arşivlendi.');await window.loadView('offers')})}
  }
  async function customerActions(){if(!can('customers.create')&&!can('customers.manage'))return;const box=mount(panel('Yeni müşteri',[input('spCustomerName','Ad / müşteri'),input('spCustomerCompany','Firma'),input('spCustomerPhone','Telefon'),input('spCustomerEmail','E-posta','email'),input('spCustomerNotes','Not')],'Müşteri ekle'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const {error}=await sb.rpc('staff_create_customer',{p_name:q('#spCustomerName')?.value.trim(),p_company:q('#spCustomerCompany')?.value.trim()||null,p_phone:q('#spCustomerPhone')?.value.trim()||null,p_email:q('#spCustomerEmail')?.value.trim()||null,p_notes:q('#spCustomerNotes')?.value.trim()||null});if(error)return notify(error.message);ok('Müşteri eklendi.');await window.loadView('customers')})}
  async function customerDelete(){if(!can('customers.delete'))return;const {data,error}=await sb.from('customers_staff').select('id,name,company').order('created_at',{ascending:false});if(error)return notify(error.message);const box=mount(panel('Müşteri arşivle',[`<label>Müşteri<select id="spCDel">${(data||[]).map(x=>`<option value="${x.id}">${esc(x.name||'')}${x.company?' · '+esc(x.company):''}</option>`).join('')}</select></label>`],'Arşivle'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Seçilen müşteri arşivlensin mi?'))return;const {error}=await sb.rpc('staff_delete_customer',{p_id:q('#spCDel')?.value});if(error)return notify(error.message);ok('Müşteri arşivlendi.');await window.loadView('customers')})}
  async function equipmentActions(){if(!can('equipment.manage')&&!can('equipment.create')&&!can('equipment.update'))return;const box=mount(panel('Ekipman ekle',[input('spEqCategory','Kategori'),input('spEqBrand','Marka'),input('spEqModel','Model'),input('spEqQty','Adet','number','1'),input('spEqNotes','Not')],'Ekipmanı kaydet'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const {error}=await sb.rpc('staff_upsert_equipment',{p_id:null,p_category:q('#spEqCategory')?.value.trim(),p_brand:q('#spEqBrand')?.value.trim()||null,p_model:q('#spEqModel')?.value.trim()||null,p_quantity:Number(q('#spEqQty')?.value)||0,p_notes:q('#spEqNotes')?.value.trim()||null});if(error)return notify(error.message);ok('Ekipman kaydedildi.');await window.loadView('equipment')})}
  async function equipmentDelete(){if(!can('equipment.delete'))return;const {data,error}=await sb.from('equipment_staff').select('id,category,brand,model').order('category');if(error)return notify(error.message);const box=mount(panel('Ekipman arşivle',[`<label>Ekipman<select id="spEDel">${(data||[]).map(x=>`<option value="${x.id}">${esc(x.category||'')} · ${esc(x.brand||'')} ${esc(x.model||'')}</option>`).join('')}</select></label>`],'Arşivle'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Seçilen ekipman pasifleştirilsin mi?'))return;const {error}=await sb.rpc('staff_delete_equipment',{p_id:q('#spEDel')?.value});if(error)return notify(error.message);ok('Ekipman arşivlendi.');await window.loadView('equipment')})}
  const oldOffers=window.offersView,oldPricing=window.pricingView,oldCustomers=window.customersView,oldEquipment=window.equipmentView;
  if(oldOffers)window.offersView=async function(){const r=await oldOffers.apply(this,arguments);await offerActions();return r};
  if(oldPricing)window.pricingView=async function(){const r=await oldPricing.apply(this,arguments);if(can('pricing.manage')||can('pricing.update')){const box=mount(panel('Yeni hizmet / fiyat',[input('spPriceName','Hizmet adı'),input('spPriceDesc','Açıklama'),input('spPriceValue','Fiyat','number'),input('spPriceSort','Sıra','number','0')],'Kaydet'));box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const {error}=await sb.rpc('staff_upsert_service',{p_id:null,p_name:q('#spPriceName')?.value.trim(),p_description:q('#spPriceDesc')?.value.trim()||null,p_base_price:Number(q('#spPriceValue')?.value)||0,p_sort_order:Number(q('#spPriceSort')?.value)||0});if(error)return notify(error.message);ok('Fiyatlandırma kaydedildi.');await window.loadView('pricing')})}return r};
  if(oldCustomers)window.customersView=async function(){const r=await oldCustomers.apply(this,arguments);await customerActions();await customerDelete();return r};
  if(oldEquipment)window.equipmentView=async function(){const r=await oldEquipment.apply(this,arguments);await equipmentActions();await equipmentDelete();return r};
  window.respondJob=async(id,response)=>{const permission=response==='accepted'?'jobs.accept':'jobs.reject';if(!can(permission)&&!can('jobs.manage'))return notify(response==='accepted'?'İş kabul yetkiniz yok.':'İş reddetme yetkiniz yok.');const {error}=await sb.rpc('staff_respond_job',{p_job_id:id,p_response:response,p_note:null});if(error)return notify(error.message);ok(response==='accepted'?'İş kabul edildi.':'İş reddedildi.');await window.loadView('jobs')};
  window.setJobStatus=async(id,status)=>{if(!can('jobs.status.update')&&!can('jobs.manage'))return notify('İş durumu değiştirme yetkiniz yok.');const {error}=await sb.rpc('staff_update_job_status',{p_job_id:id,p_status:status});if(error)return notify(error.message);ok('İş durumu güncellendi.');await window.loadView('jobs')};
  window.updateJobNotes=async id=>{if(!can('jobs.notes.update')&&!can('jobs.manage'))return notify('İş notu düzenleme yetkiniz yok.');const note=prompt('İş notu','');if(note===null)return;const {error}=await sb.rpc('staff_update_job_notes',{p_job_id:id,p_notes:note});if(error)return notify(error.message);ok('İş notu kaydedildi.');await window.loadView('jobs')};
})();

/* ===== END portal/portal-crud.js ===== */

/* ===== BEGIN portal/personnel-v121.js ===== */
/* Stagepulse Personel Portal v121 — mobile shell + permission/view integrity hotfix. */
(() => {
 'use strict';
 const NAV=[
  ['SATIŞ',[['home','Genel Bakış','dashboard.view'],['offers','Teklifler','offers.view'],['customers','Müşteriler','customers.view'],['finance','Ödemeler / Finans','payments.view'],['pricing','Fiyatlandırma','pricing.view']]],
  ['OPERASYON',[['jobs','İşler','schedule.view'],['equipment','Ekipman','equipment.view'],['analytics','Analitik','analytics.view'],['activity','Aktivite','activity.view'],['notifications','Bildirimler','notifications.view']]],
  ['SİSTEM',[['settings','Ayarlar','settings.view']]]
 ];
 const has=perm=>{try{return typeof window.can==='function'&&window.can(perm)===true}catch(_){return false}};
 function closeMenu(){const side=document.getElementById('sidebar'),overlay=document.getElementById('mobileOverlay');side?.classList.remove('open');if(overlay){overlay.hidden=true;overlay.classList.remove('open')}document.body.classList.remove('portal-menu-open');document.getElementById('menuBtn')?.setAttribute('aria-expanded','false')}
 function openMenu(){const side=document.getElementById('sidebar'),overlay=document.getElementById('mobileOverlay');if(!side)return;side.classList.add('open');if(overlay){overlay.hidden=false;overlay.classList.add('open')}document.body.classList.add('portal-menu-open');document.getElementById('menuBtn')?.setAttribute('aria-expanded','true')}
 function rebuildNav(){const nav=document.getElementById('sideNav');if(!nav||typeof window.loadView!=='function')return;const badge=document.getElementById('portalPermissionBadge');nav.querySelectorAll('button[data-view],.portal-nav-label').forEach(el=>el.remove());const fragment=document.createDocumentFragment();let visibleCount=0;for(const[group,items]of NAV){const allowed=items.filter(([, ,perm])=>has(perm));if(!allowed.length)continue;const label=document.createElement('div');label.className='portal-nav-label';label.textContent=group;fragment.appendChild(label);for(const[view,text]of allowed){const button=document.createElement('button');button.type='button';button.dataset.view=view;button.textContent=text;button.setAttribute('aria-label',text);button.onclick=e=>{e.preventDefault();e.stopPropagation();closeMenu();window.loadView(view)};fragment.appendChild(button);visibleCount++}}if(badge)fragment.appendChild(badge);nav.replaceChildren(fragment);nav.dataset.v121='1';document.documentElement.dataset.portalPermissionCount=String(visibleCount)}
 function bindMenu(){let menu=document.getElementById('menuBtn'),overlay=document.getElementById('mobileOverlay');if(!menu)return;if(!menu.dataset.v121){const fresh=menu.cloneNode(true);fresh.dataset.v121='1';menu.replaceWith(fresh)}const current=document.getElementById('menuBtn');if(current&&!current.dataset.v121Bound){current.dataset.v121Bound='1';current.type='button';current.setAttribute('aria-controls','sidebar');current.setAttribute('aria-expanded','false');current.onclick=e=>{e.preventDefault();e.stopPropagation();document.getElementById('sidebar')?.classList.contains('open')?closeMenu():openMenu()}}if(overlay&&!overlay.dataset.v121Bound){overlay.dataset.v121Bound='1';overlay.onclick=e=>{if(e.target===overlay)closeMenu()}}document.querySelectorAll('#sideNav button[data-view]').forEach(button=>button.addEventListener('click',closeMenu,{passive:true}))}
 function repairTitles(){const titles={home:['Genel Bakış','Özet'],jobs:['İşler','Takvim ve operasyon'],equipment:['Ekipman','Envanter'],offers:['Teklifler','Satış talepleri'],customers:['Müşteriler','Müşteri kayıtları'],finance:['Ödemeler / Finans','Finans'],pricing:['Fiyatlandırma','Hizmet taban fiyatları'],analytics:['Analitik','Raporlar'],activity:['Aktivite','Sistem hareketleri'],notifications:['Bildirimler','Bildirim merkezi'],settings:['Ayarlar','Hesap ve sistem']};const view=(location.hash||'#home').slice(1)||'home',pair=titles[view]||titles.home;const h=document.getElementById('portalViewTitle'),s=document.getElementById('portalViewSubtitle');if(h)h.textContent=pair[0];if(s)s.textContent=pair[1]}
 function install(){document.getElementById('sidebar')?.classList.add('admin-visual-menu');bindMenu();rebuildNav();repairTitles();window.dispatchEvent(new CustomEvent('stagepulse:v121-ready'))}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 window.addEventListener('stagepulse:permissions-ready',install);window.addEventListener('hashchange',repairTitles);window.StagepulsePersonnelV121={install,openMenu,closeMenu,rebuildNav};
})();

/* ===== END portal/personnel-v121.js ===== */

/* ===== BEGIN portal/portal-menu-final.js ===== */
/* Stagepulse personnel shell: single authoritative hamburger interaction. */
(() => {
  const close = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    side?.classList.remove('open');
    if (overlay) { overlay.hidden = true; overlay.classList.remove('open'); }
    document.body.classList.remove('portal-menu-open');
    document.body.style.overflow = '';
    if (menu) { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menüyü aç'); menu.textContent = '☰'; }
  };
  const open = () => {
    const side = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menu = document.getElementById('menuBtn');
    if (!side) return;
    side.classList.add('open');
    if (overlay) { overlay.hidden = false; overlay.classList.add('open'); }
    document.body.classList.add('portal-menu-open');
    document.body.style.overflow = 'hidden';
    if (menu) { menu.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-label', 'Menüyü kapat'); menu.textContent = '×'; }
  };
  const bind = () => {
    const menu = document.getElementById('menuBtn');
    if (!menu || menu.dataset.spFinalMenuBound === '1') return;
    menu.dataset.spFinalMenuBound = '1';
    menu.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const side = document.getElementById('sidebar');
      side?.classList.contains('open') ? close() : open();
    }, { capture: true });
    document.getElementById('mobileOverlay')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) close();
    }, { capture: true });
    document.getElementById('sideNav')?.addEventListener('click', (event) => {
      if (event.target.closest('button[data-view]')) close();
    }, { capture: true });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    window.addEventListener('hashchange', close);
    close();

    if (!document.querySelector('script[data-sp-personnel-menu-parity]')) {
      const script = document.createElement('script');
      // Cache-bust the permission menu after the login freeze fix.
      script.src = '/portal/personnel-admin-menu-parity.js?v=20260825-03';
      script.defer = true;
      script.dataset.spPersonnelMenuParity = '1';
      document.head.appendChild(script);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
  window.StagepulseFinalMenu = { open, close, bind };
})();

/* ===== END portal/portal-menu-final.js ===== */

/* ===== BEGIN portal/portal-jobs-fix.js ===== */
/* Stagepulse Portal — jobs loader. Uses the authenticated jobs RPC when available. */
(() => {
  'use strict';
  const getClient=()=>window.StagepulsePortalSupabase?.getClient?.()||window.StagepulseAdminSupabase?.getClient?.()||window.sb;
  async function fetchJobsSolid(){
    const sb=getClient();if(!sb)throw new Error('Supabase bağlantısı hazırlanamadı.');
    const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error('Oturum gerekli.');
    const r=await sb.rpc('staff_list_jobs');
    if(!r.error){window.jobs=Array.isArray(r.data)?r.data:[];return window.jobs;}
    try{const q=await sb.from('jobs').select('*').order('event_at',{ascending:true,nullsFirst:false});if(!q.error){window.jobs=q.data||[];return window.jobs;}}catch(_){ }
    throw r.error;
  }
  function install(){window.fetchJobs=fetchJobsSolid;window.fetchJobs.__spSolid=true;}
  install();document.addEventListener('DOMContentLoaded',install);window.addEventListener('stagepulse:permissions-ready',install);
})();

/* ===== END portal/portal-jobs-fix.js ===== */
