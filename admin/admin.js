/* Stagepulse Admin — tam erişim, operasyon + gelir-gider */
const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
const EDGE_LOGIN = `${SUPABASE_URL}/functions/v1/admin-login`;
const EDGE_ACCOUNT = `${SUPABASE_URL}/functions/v1/admin-password-reset`;
const EDGE_STAFF = `${SUPABASE_URL}/functions/v1/staff-manage`;
const EDGE_DATA = `${SUPABASE_URL}/functions/v1/admin-data`;

if (!window.supabase) {
  document.body.innerHTML = '<div style="padding:40px;font-family:system-ui;color:#fff;background:#090909;min-height:100vh">Supabase yüklenemedi. Sayfayı yenileyin.</div>';
  throw new Error('Supabase missing');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  try { toast((event.reason && event.reason.message) || 'Beklenmeyen bir hata oluştu.', false); } catch (_) {}
  event.preventDefault();
});

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => Number(v) || 0;
const PASSWORD_POLICY_MSG = 'Şifre en az 10 karakter, en az bir harf ve bir rakam içermeli.';
function isStrongPassword(pw) { return typeof pw === 'string' && pw.length >= 10 && /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(pw) && /[0-9]/.test(pw); }

async function apiFetch(url, opts) {
  let r;
  try { r = await fetch(url, opts); } catch (_) { throw new Error('Bağlantı hatası. İnternetinizi kontrol edin.'); }
  let j = {};
  try { j = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error(j.error || 'İşlem başarısız.');
  return j;
}

async function adminData(action, payload = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('Oturum gerekli.');
  const result = await apiFetch(EDGE_DATA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  return result.data;
}

let offers = [];
let customers = [];
let settings = {};
let services = [];
let settlements = [];
let equipment = [];
let jobs = [];
let payments = [];
let notifications = [];
let activity = [];

const statuses = { new:'Yeni', reviewing:'İnceleniyor', preparing:'Hazırlanıyor', sent:'Gönderildi', accepted:'Kabul', rejected:'Red', cancelled:'İptal', archived:'Arşiv', expired:'Süresi doldu' };
const settleStatus = { open:'Açık', partial:'Kısmi', closed:'Kapandı', cancelled:'İptal' };
const viewMeta = {
  dashboard:['Genel Bakış','Satış ve operasyon'], offers:['Teklifler','Lead ve teklif yönetimi'], customers:['Müşteriler','Müşteri geçmişi'],
  settlements:['Gelir · Gider','Anlaşılan → gider → paylaşım'], pricing:['Fiyatlandırma','Hizmet ve kurallar'], equipment:['Ekipman','Envanter'],
  calendar:['Takvim / İşler','Kurulum ve etkinlik'], finance:['Ödemeler','Tahsilat kayıtları'], personnel:['Personel','Portal hesapları'],
  analytics:['Analitik','Dönüşüm'], activity:['Aktivite','İşlem geçmişi'], notifications:['Bildirimler','Sistem uyarıları'], settings:['Ayarlar','İşletme ve hesap']
};

function showLogin(){const login=$('#loginView'),app=$('#appView');if(login){login.classList.remove('is-hidden');login.hidden=false}if(app){app.classList.add('is-hidden');app.hidden=true}}
function showApp(){const login=$('#loginView'),app=$('#appView');if(login){login.classList.add('is-hidden');login.hidden=true}if(app){app.classList.remove('is-hidden');app.hidden=false}}
function closeMobileNav(){document.getElementById('sidebar')?.classList.remove('open');const ov=document.getElementById('mobileOverlay');if(ov){ov.hidden=true;ov.classList.remove('open')}}
function routeView(v){if(!location.hash||location.hash.slice(1)!==v)history.replaceState(null,'','#'+v)}
function bindShell(){document.querySelectorAll('#sideNav button[data-view]').forEach(btn=>btn.addEventListener('click',()=>loadView(btn.dataset.view)));const openMenu=()=>{document.getElementById('sidebar')?.classList.add('open');const ov=document.getElementById('mobileOverlay');if(ov){ov.hidden=false;ov.classList.add('open')}};const closeMenu=()=>{document.getElementById('sidebar')?.classList.remove('open');const ov=document.getElementById('mobileOverlay');if(ov){ov.hidden=true;ov.classList.remove('open')}};window.closeMobileNav=closeMenu;document.getElementById('menuBtn')?.addEventListener('click',openMenu);document.getElementById('sidebarClose')?.addEventListener('click',closeMenu);document.getElementById('mobileOverlay')?.addEventListener('click',closeMenu);document.getElementById('logoutBtn')?.addEventListener('click',async()=>{await sb.auth.signOut();location.reload()});document.getElementById('loginForm')?.addEventListener('submit',login)}

async function init(){bindShell();const {data:{session}}=await sb.auth.getSession();if(session){await guard(session);return}showLogin()}
async function guard(session){const profile=await adminData('list',{table:'admin_profiles',columns:'username,display_name,active',order:{column:'username',ascending:true}}).then(rows=>rows.find(r=>r.user_id===session.user.id));if(!profile?.active){await sb.auth.signOut();showLogin();$('#loginError').textContent='Bu hesap admin yetkisine sahip değil.';return}showApp();$('#adminUser').textContent='@'+profile.username;$('#sideAdminName').textContent=profile.display_name||profile.username;const hash=(location.hash||'#dashboard').slice(1);await loadView(viewMeta[hash]?hash:'dashboard')}
async function login(e){e.preventDefault();const btn=$('#loginBtn'),err=$('#loginError');err.textContent='';btn.disabled=true;btn.textContent='Giriş…';try{const body={username:$('#loginUsername').value.trim(),password:$('#loginPassword').value};const j=await apiFetch(EDGE_LOGIN,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},body:JSON.stringify(body)});if(!j.session?.access_token)throw new Error('Oturum alınamadı');await sb.auth.setSession({access_token:j.session.access_token,refresh_token:j.session.refresh_token});await guard((await sb.auth.getSession()).data.session)}catch(ex){console.error(ex);err.textContent=ex.message||'Giriş başarısız'}finally{btn.disabled=false;btn.textContent='Giriş Yap'}}

async function loadView(v){if(!viewMeta[v])v='dashboard';document.querySelectorAll('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));const [title,subtitle]=viewMeta[v];$('#viewTitle').textContent=title;$('#viewSubtitle').textContent=subtitle;routeView(v);closeMobileNav();const map={dashboard,offers:offersView,customers:customersView,settlements:settlementsView,pricing:pricingView,equipment:equipmentView,calendar:calendarView,finance:financeView,personnel:personnelView,analytics:analyticsView,activity:activityView,notifications:notificationsView,settings:settingsView};try{await map[v]()}catch(e){fatal(e)}}

async function bootstrapData(){const d=await adminData('bootstrap');offers=d.offers||[];settings=d.settings||{};customers=d.customers||[];settlements=d.settlements||[];services=d.services||[];equipment=d.equipment||[];jobs=d.jobs||[];payments=d.payments||[];notifications=d.notifications||[];activity=d.activity||[]}
async function getOffers(){const d=await adminData('list',{table:'teklifler',columns:'*',order:{column:'created_at',ascending:false}});offers=d||[];const badge=$('#navOfferBadge');if(badge){const n=offers.filter(x=>x.status==='new').length;badge.textContent=n||'';badge.style.display=n?'inline-flex':'none'}return offers}
async function getSettings(){const d=await adminData('list',{table:'business_settings',columns:'*',order:{column:'id',ascending:true}});settings=d?.[0]||{};return settings}
async function getSettlements(){settlements=await adminData('list',{table:'settlements',columns:'*',order:{column:'event_date',ascending:false}})||[];return settlements}
async function log(action,type,id,metadata){try{await adminData('activity_insert',{payload:{action,entity_type:type,entity_id:id,metadata}})}catch(_){}}
function fatal(e){console.error(e);$('#content').innerHTML=`<div class="notice"><b>Sistem hatası</b><p>${esc(e.message||e)}</p><p class="muted">Admin API / migration / RLS kontrolü gerekli.</p></div>`}
function toast(msg,ok=true){let t=$('#adminToast');if(!t){t=document.createElement('div');t.id='adminToast';t.className='admin-toast';document.body.appendChild(t)}t.textContent=msg;t.className='admin-toast '+(ok?'ok':'err')+' show';setTimeout(()=>t.classList.remove('show'),2800)}

// Existing view/render functions remain below. Data mutations must use adminData(), never sb.from() on protected tables.
