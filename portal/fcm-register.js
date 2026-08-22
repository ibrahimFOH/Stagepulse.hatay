/* Stagepulse FCM registration for Admin + Staff. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const load = (sources) => new Promise((resolve, reject) => {
    const list = Array.isArray(sources) ? sources : [sources];
    let index = 0;
    const next = () => {
      if (index >= list.length) return reject(new Error(`Firebase SDK yüklenemedi: ${list.join(' | ')}`));
      const src = list[index++];
      if ([...document.scripts].some(s => s.src.split('?')[0] === src.split('?')[0])) return resolve();
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    };
    next();
  });
  let registering = false, actionButton = null, statusNode = null;
  function appVariant() { return cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff'; }
  function platform() { return 'android'; }
  function removeUi() { actionButton?.remove(); statusNode?.remove(); actionButton = null; statusNode = null; }
  function showStatus(text, actionText, handler) {
    if (!document.body) return;
    if (!statusNode) { statusNode = document.createElement('div'); Object.assign(statusNode.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'2147483647',maxWidth:'360px',padding:'12px 14px',borderRadius:'14px',background:'#171717',color:'#fff',boxShadow:'0 8px 30px rgba(0,0,0,.35)',font:'600 13px system-ui,sans-serif',whiteSpace:'pre-wrap'}); document.body.appendChild(statusNode); }
    statusNode.textContent = text;
    if (actionText) { if (!actionButton) { actionButton=document.createElement('button'); Object.assign(actionButton.style,{marginTop:'9px',border:'0',borderRadius:'9px',padding:'9px 12px',background:'#f5b400',color:'#111',font:'700 13px system-ui,sans-serif'}); statusNode.appendChild(document.createElement('br')); statusNode.appendChild(actionButton); } actionButton.textContent=actionText; actionButton.onclick=handler; actionButton.disabled=false; }
  }
  function errorText(error, stage) { const code=error?.code?` [${error.code}]`:''; const message=error?.message||error?.name||(typeof error==='string'?error:'Bilinmeyen hata'); return `Bildirim bağlantısı kurulamadı (${stage})${code}: ${message}`; }
  async function askPermission() {
    if (!('Notification' in window)) { showStatus('Bu APK ortamında Notification API yok. Android uygulamasının native FCM katmanı gerekiyor.',null,null); return false; }
    if (Notification.permission==='granted') return true;
    if (Notification.permission==='denied') { showStatus('Stagepulse bildirim izni Android tarafından engellenmiş. Chrome/site ayarlarından Bildirimler → İzin ver seçin.','Ayarları tekrar kontrol et',()=>location.reload()); return false; }
    const permission=await Notification.requestPermission();
    if (permission!=='granted') { showStatus(`Bildirim izni verilmedi (durum: ${permission}).`,'Tekrar dene',enable); return false; }
    return true;
  }
  async function register() {
    if (registering) return false; registering=true; let stage='başlatma';
    try {
      if(!cfg.apiKey||!cfg.projectId||!cfg.appId||!cfg.vapidKey) throw new Error('Firebase web yapılandırması eksik.');
      stage='oturum'; const {data:{session},error:sessionError}=await client.auth.getSession(); if(sessionError) throw sessionError; if(!session?.user) return false;
      stage='tarayıcı desteği'; if(!('Notification'in window)||!('serviceWorker'in navigator)) throw new Error('Notification API veya Service Worker desteklenmiyor.');
      if(Notification.permission!=='granted'){showStatus('Kapalı uygulama bildirimleri için Stagepulse bildirim izni gerekiyor.','🔔 Bildirimleri aç',enable);return false;}
      stage='Firebase SDK';
      await load([
        'https://cdnjs.cloudflare.com/ajax/libs/firebase/10.14.1/firebase-app-compat.min.js',
        'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@10.14.1/compat/firebase-app.js',
        'https://unpkg.com/firebase@10.14.1/compat/firebase-app.js'
      ]);
      await load([
        'https://cdnjs.cloudflare.com/ajax/libs/firebase/10.14.1/firebase-messaging-compat.min.js',
        'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@10.14.1/compat/firebase-messaging.js',
        'https://unpkg.com/firebase@10.14.1/compat/firebase-messaging.js'
      ]);
      if(!window.firebase) throw new Error('Firebase global nesnesi oluşmadı.');
      if(!firebase.apps.length) firebase.initializeApp(cfg);
      stage='Firebase Messaging desteği'; if(typeof firebase.messaging.isSupported!=='function') throw new Error('Firebase Messaging isSupported API bulunamadı.');
      if(!(await firebase.messaging.isSupported())) throw new Error('Bu APK/Chrome ortamı Firebase Web Push için desteklenmiyor.');
      stage='Service Worker'; const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=20260822-06',{scope:'/'}); await navigator.serviceWorker.ready;
      stage='FCM token'; const messaging=firebase.messaging(); const token=await messaging.getToken({vapidKey:cfg.vapidKey,serviceWorkerRegistration:registration}); if(!token) throw new Error('FCM cihaz tokenı alınamadı.');
      stage='Supabase cihaz kaydı'; const {error}=await client.rpc('register_notification_device',{p_token:token,p_platform:platform(),p_app_variant:appVariant()}); if(error) throw error;
      removeUi(); window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready',{detail:{appVariant:appVariant(),platform:platform()}})); return true;
    } catch(e){ console.warn('[Stagepulse] FCM registration failed',{stage,error:e}); showStatus(errorText(e,stage),'Tekrar bağlan',register); return false; } finally { registering=false; }
  }
  async function enable(){try{if(await askPermission())return await register();}catch(e){showStatus(errorText(e,'bildirim izni'),'Tekrar bağlan',register);}return false;}
  window.StagepulseFCM={register,enable};
  document.addEventListener('DOMContentLoaded',()=>{register().catch(()=>{});client.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')register().catch(()=>{});});});
})();