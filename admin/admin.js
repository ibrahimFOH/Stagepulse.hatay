/* Stagepulse Admin — canonical shell, auth bootstrap, navigation and view dispatch. */
(() => {
  'use strict';
  const R = window.STAGEPULSE_RUNTIME || {};
  const URL = R.supabaseUrl || '';
  const KEY = R.supabasePublishableKey || '';
  if (!window.supabase || !URL || !KEY) {
    document.body.innerHTML = '<div style="padding:40px;font-family:system-ui;color:#fff;background:#090909;min-height:100vh">Supabase yapılandırması yüklenemedi.</div>';
    return;
  }
  const client = window.__stagepulseAdminClient || window.supabase.createClient(URL, KEY, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} });
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
  function closeMobileNav(){const s=$('#sidebar'),o=$('#mobileOverlay');s?.classList.remove('open');if(o){o.hidden=true;o.classList.remove('open')}}
  function routeView(v){if((location.hash||'').slice(1)!==v)history.replaceState(null,'','#'+v)}
  async function guard(session){
    const r=await fetch(`${URL}/functions/v1/org-admin-control`,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:'my_context'}),cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.membership||j.membership.active!==true||j.is_admin!==true){await client.auth.signOut();showLogin();$('#loginError').textContent='Bu hesap için aktif yönetim yetkisi bulunmuyor.';return false}
    window.__stagepulseAdminContext=j;showApp();const p=j.profile||{};$('#adminUser').textContent='@'+(p.username||session.user?.email?.split('@')[0]||'admin');$('#sideAdminName').textContent=p.display_name||p.username||'Yönetici';return true;
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
  async function init(){bindShell();const {data:{session}}=await client.auth.getSession();if(session){if(await guard(session)){const h=(location.hash||'#dashboard').slice(1);await window.loadView(viewMeta[h]?h:'dashboard')} } else showLogin()}
  window.getAdminClient=()=>client;
  window.StagepulseAdminSupabase=window.StagepulseAdminSupabase||{getClient:()=>client};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
