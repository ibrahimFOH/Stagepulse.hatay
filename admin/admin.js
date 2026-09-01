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
      storageKey:'stagepulse-admin-auth-v2'
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
  function cleanAuthUrl(url){
    authUrlKeys.forEach(key=>url.searchParams.delete(key));
    let hash=url.hash;
    if(/^#[^#]*=/.test(hash)){
      const params=new URLSearchParams(hash.slice(1));
      authUrlKeys.forEach(key=>params.delete(key));
      hash=params.toString()?`#${params}`:'';
    }
    history.replaceState(null,document.title,url.pathname+(url.searchParams.toString()?`?${url.searchParams}`:'')+hash);
  }
  async function recoverAdminSessionFromUrl(){
    const url=new window.URL(location.href),hash=new URLSearchParams(/^#[^#]*=/.test(url.hash)?url.hash.slice(1):'');
    const code=url.searchParams.get('code');
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    const type=url.searchParams.get('type')||hash.get('type');
    const hasAuthUrl=authUrlKeys.some(key=>url.searchParams.has(key)||hash.has(key));
    if(!hasAuthUrl)return false;
    try{
      if(url.searchParams.get('error'))throw new Error(url.searchParams.get('error_description')||'Kimlik doğrulama bağlantısı geçersiz.');
      if(code){const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw error;}
      else if(accessToken&&refreshToken){const {error}=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});if(error)throw error;}
      else throw new Error('Kimlik doğrulama bağlantısı eksik veya geçersiz.');
      window.__stagepulseAdminRecovery=type==='recovery';
      return true;
    }finally{cleanAuthUrl(url);}
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
