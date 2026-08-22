/* Stagepulse FCM registration for Admin + Staff. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !window.supabase) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const LOCAL_FIREBASE_APP = '/portal/vendor/firebase/firebase-app-compat.js';
  const LOCAL_FIREBASE_MESSAGING = '/portal/vendor/firebase/firebase-messaging-compat.js';
  const loadLocal = (src) => new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src.split('?')[0] === src)) return resolve();
    const s = document.createElement('script'); s.src = `${src}?v=10.14.1-20260822-11`; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Firebase SDK yerel dosyadan yüklenemedi: ${src}`));
    document.head.appendChild(s);
  });
  let registering = false, actionButton = null, statusNode = null;
  function appVariant() { return cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff'; }
  function platform() { return 'android'; }
  function removeUi() { actionButton?.remove(); statusNode?.remove(); actionButton = null; statusNode = null; }
  function showStatus(text, actionText, handler) {
    if (!document.body) return;
    if (!statusNode) { statusNode = document.createElement('div'); Object.assign(statusNode.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'2147483647',maxWidth:'380px',padding:'12px 14px',borderRadius:'14px',background:'#171717',color:'#fff',boxShadow:'0 8px 30px rgba(0,0,0,.35)',font:'600 13px system-ui,sans-serif',whiteSpace:'pre-wrap'}); document.body.appendChild(statusNode); }
    statusNode.textContent = text;
    if (actionText) { if (!actionButton) { actionButton=document.createElement('button'); Object.assign(actionButton.style,{marginTop:'9px',border:'0',borderRadius:'9px',padding:'9px 12px',background:'#f5b400',color:'#111',font:'700 13px system-ui,sans-serif'}); statusNode.appendChild(document.createElement('br')); statusNode.appendChild(actionButton); } actionButton.textContent=actionText; actionButton.onclick=handler; actionButton.disabled=false; }
  }
  function errorText(error, stage) { const code=error?.code?` [${error.code}]`:''; const message=error?.message||error?.name||(typeof error==='string'?error:'Bilinmeyen hata'); return `Bildirim bağlantısı kurulamadı (${stage})${code}: ${message}`; }
  async function askPermission() {
    if (!('Notification' in window)) { showStatus('Bu APK ortamında Notification API yok.',null,null); return false; }
    if (Notification.permission==='granted') return true;
    if (Notification.permission==='denied') { showStatus('Stagepulse bildirim izni Android tarafından engellenmiş.','Tekrar kontrol et',()=>location.reload()); return false; }
    const permission=await Notification.requestPermission();
    if (permission!=='granted') { showStatus(`Bildirim izni verilmedi (durum: ${permission}).`,'Tekrar dene',enable); return false; }
    return true;
  }
  async function networkProbe() {
    const tests = [
      ['Firebase Installations', `https://firebaseinstallations.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/installations`],
      ['FCM Registration API', `https://fcmregistrations.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/registrations`]
    ];
    const out=[];
    for (const [name,url] of tests) {
      try {
        const r=await fetch(url,{method:'OPTIONS',mode:'cors',cache:'no-store'});
        out.push(`${name}: HTTP ${r.status}`);
      } catch (e) {
        out.push(`${name}: NETWORK ${e?.message||'Failed to fetch'}`);
      }
    }
    return out.join('\n');
  }
  async function register() {
    if (registering) return false; registering=true; let stage='başlatma';
    try {
      if(!cfg.apiKey||!cfg.projectId||!cfg.appId||!cfg.vapidKey) throw new Error('Firebase web yapılandırması eksik.');
      stage='oturum'; const {data:{session},error:sessionError}=await client.auth.getSession(); if(sessionError) throw sessionError; if(!session?.user) return false;
      stage='tarayıcı desteği'; if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)) throw new Error('Notification, Service Worker veya Push API desteklenmiyor.');
      if(Notification.permission!=='granted'){showStatus('Kapalı uygulama bildirimleri için Stagepulse bildirim izni gerekiyor.','🔔 Bildirimleri aç',enable);return false;}
      stage='Firebase SDK'; await loadLocal(LOCAL_FIREBASE_APP); await loadLocal(LOCAL_FIREBASE_MESSAGING);
      if(!window.firebase) throw new Error('Yerel Firebase SDK global nesnesi oluşmadı.');
      if(!firebase.apps.length) firebase.initializeApp(cfg);
      stage='Firebase Messaging desteği'; if(typeof firebase.messaging.isSupported!=='function') throw new Error('Firebase Messaging isSupported API bulunamadı.');
      if(!(await firebase.messaging.isSupported())) throw new Error('Bu APK/Chrome ortamı Firebase Web Push için desteklenmiyor.');
      stage='Service Worker'; const registration=await navigator.serviceWorker.register(`/firebase-messaging-sw.js?v=20260822-11`,{scope:'/'}); await navigator.serviceWorker.ready;
      stage='Push altyapısı';
      const subscription=await registration.pushManager.getSubscription();
      if(!subscription) { try { await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64ToUint8(cfg.vapidKey)}); } catch(e) { throw new Error(`Android Push aboneliği oluşturulamadı: ${e?.message||e}`); } }
      stage='FCM token';
      const messaging=firebase.messaging();
      let token;
      try { token=await Promise.race([messaging.getToken({vapidKey:cfg.vapidKey,serviceWorkerRegistration:registration}),new Promise((_,rej)=>setTimeout(()=>rej(new Error('FCM token isteği 15 saniyede yanıt vermedi.')),15000))]); }
      catch(e) { const probe=await networkProbe(); throw new Error(`${e?.message||e}\n\nFCM ağ testi:\n${probe}`); }
      if(!token) throw new Error('FCM cihaz tokenı alınamadı.');
      stage='Supabase cihaz kaydı'; const {error}=await client.rpc('register_notification_device',{p_token:token,p_platform:platform(),p_app_variant:appVariant()}); if(error) throw error;
      removeUi(); window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready',{detail:{appVariant:appVariant(),platform:platform()}})); return true;
    } catch(e){ console.warn('[Stagepulse] FCM registration failed',{stage,error:e}); showStatus(errorText(e,stage),'Tekrar bağlan',register); return false; } finally {registering=false;}
  }
  function base64ToUint8(value){const padding='='.repeat((4-value.length%4)%4);const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
  async function enable(){try{if(await askPermission())return await register();}catch(e){showStatus(errorText(e,'bildirim izni'),'Tekrar bağlan',register);}return false;}
  window.StagepulseFCM={register,enable};
  document.addEventListener('DOMContentLoaded',()=>{register().catch(()=>{});client.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')register().catch(()=>{});});});
})();