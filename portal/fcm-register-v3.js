/* Stagepulse FCM registration: Firebase SDK is served from the Stagepulse origin. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !window.supabase || !window.firebase) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'stagepulse-fcm-auth-v3', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  let busy = false;
  const variant = () => cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
  const show = (text, action = 'Tekrar bağlan') => {
    let box = document.getElementById('stagepulse-fcm-status');
    if (!box) { box = document.createElement('div'); box.id = 'stagepulse-fcm-status'; Object.assign(box.style,{position:'fixed',left:'16px',right:'16px',bottom:'16px',zIndex:'2147483647',maxWidth:'620px',margin:'auto',padding:'14px 16px',borderRadius:'14px',background:'#171717',color:'#fff',font:'600 13px system-ui',whiteSpace:'pre-wrap'}); document.body.appendChild(box); }
    box.textContent = text;
    if (action) { const b=document.createElement('button'); b.textContent=action; Object.assign(b.style,{display:'block',marginTop:'10px',padding:'9px 12px',border:0,borderRadius:'9px',background:'#f5b400',fontWeight:700}); b.onclick=register; box.appendChild(b); }
  };
  const clear = () => document.getElementById('stagepulse-fcm-status')?.remove();
  async function register() {
    if (busy) return false; busy = true;
    try {
      const { data: { session }, error: se } = await client.auth.getSession(); if (se) throw se; if (!session?.user) return false;
      if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Notification API veya Service Worker desteklenmiyor.');
      if (Notification.permission !== 'granted') { const p=await Notification.requestPermission(); if(p!=='granted') throw new Error(`Bildirim izni verilmedi: ${p}`); }
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      if (typeof firebase.messaging.isSupported === 'function' && !(await firebase.messaging.isSupported())) throw new Error('Firebase Web Push bu APK/Chrome ortamında desteklenmiyor.');
      const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=20260822-06', { scope:'/', updateViaCache:'none' });
      await navigator.serviceWorker.ready;
      const token = await firebase.messaging().getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: sw });
      if (!token) throw new Error('FCM cihaz tokenı alınamadı.');
      const { error } = await client.rpc('register_notification_device', { p_token: token, p_platform:'android', p_app_variant:variant() });
      if (error) throw error;
      clear(); window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready',{detail:{appVariant:variant()}})); return true;
    } catch (e) {
      const detail = [e?.name,e?.code,e?.message].filter(Boolean).join(' | ') || String(e);
      show(`Bildirim bağlantısı kurulamadı: ${detail}`); console.error('[Stagepulse FCM]',e); return false;
    } finally { busy=false; }
  }
  window.StagepulseFCM = { register, enable: register };
  document.addEventListener('DOMContentLoaded',()=>register());
})();