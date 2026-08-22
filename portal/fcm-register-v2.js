/* Stagepulse FCM registration v2: explicit diagnostics for TWA/Chrome + Admin/Staff. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !window.supabase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: 'stagepulse-fcm-auth-v2', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  let registering = false;
  let statusNode = null;
  let actionButton = null;

  const appVariant = () => cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
  const platform = () => 'android';

  function serializeError(error) {
    if (!error) return 'Bilinmeyen hata (boş hata nesnesi)';
    const parts = [];
    for (const key of ['code', 'name', 'message', 'status', 'statusCode', 'errorInfo']) {
      try { if (error[key] !== undefined && error[key] !== null) parts.push(`${key}=${typeof error[key] === 'object' ? JSON.stringify(error[key]) : String(error[key])}`); } catch {}
    }
    if (!parts.length) { try { parts.push(`object=${JSON.stringify(error)}`); } catch {} }
    return parts.join(' | ') || String(error);
  }
  function removeUi() { statusNode?.remove(); actionButton?.remove(); statusNode = null; actionButton = null; }
  function showStatus(text, actionText, handler) {
    if (!document.body) return;
    if (!statusNode) {
      statusNode = document.createElement('div');
      Object.assign(statusNode.style, { position:'fixed', left:'16px', right:'16px', bottom:'16px', zIndex:'2147483647', maxWidth:'620px', margin:'auto', padding:'14px 16px', borderRadius:'14px', background:'#171717', color:'#fff', boxShadow:'0 8px 30px rgba(0,0,0,.4)', font:'600 13px system-ui,sans-serif', whiteSpace:'pre-wrap', lineHeight:'1.45' });
      document.body.appendChild(statusNode);
    }
    statusNode.textContent = text;
    if (actionText) {
      if (!actionButton) {
        actionButton = document.createElement('button');
        Object.assign(actionButton.style, { marginTop:'10px', border:'0', borderRadius:'9px', padding:'9px 12px', background:'#f5b400', color:'#111', font:'700 13px system-ui,sans-serif' });
        statusNode.appendChild(document.createElement('br')); statusNode.appendChild(actionButton);
      }
      actionButton.textContent = actionText; actionButton.onclick = handler; actionButton.disabled = false;
    }
  }
  async function askPermission() {
    if (!('Notification' in window)) { showStatus('Bildirim bağlantısı kurulamadı (izin): Bu APK ortamında Notification API yok.'); return false; }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') { showStatus('Bildirim izni Android tarafından engellenmiş. Android uygulama ayarlarından Stagepulse bildirimlerini etkinleştirin.', 'Tekrar kontrol et', enable); return false; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { showStatus(`Bildirim izni verilmedi. Durum: ${permission}`, 'Tekrar dene', enable); return false; }
    return true;
  }
  const load = (sources) => new Promise((resolve, reject) => {
    const list = Array.isArray(sources) ? sources : [sources]; let index = 0;
    const next = () => {
      if (index >= list.length) { reject(new Error(`Firebase SDK yüklenemedi: ${list.join(' | ')}`)); return; }
      const src = list[index++];
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = () => { s.remove(); next(); }; document.head.appendChild(s);
    }; next();
  });

  async function register() {
    if (registering) return false;
    registering = true;
    let stage = 'başlatma';
    try {
      if (!cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.vapidKey) throw new Error('Firebase web yapılandırması eksik.');
      stage = 'oturum';
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError; if (!session?.user) return false;
      stage = 'tarayıcı';
      if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error(`Notification/ServiceWorker desteklenmiyor. Notification=${'Notification' in window}; ServiceWorker=${'serviceWorker' in navigator}`);
      if (Notification.permission !== 'granted') { showStatus('Kapalı uygulama bildirimleri için Stagepulse bildirim izni gerekiyor.', '🔔 Bildirimleri aç', enable); return false; }
      stage = 'Firebase SDK';
      await load([
        'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@10.14.1/compat/firebase-app.js',
        'https://unpkg.com/firebase@10.14.1/compat/firebase-app.js'
      ]);
      await load([
        'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
        'https://cdn.jsdelivr.net/npm/firebase@10.14.1/compat/firebase-messaging.js',
        'https://unpkg.com/firebase@10.14.1/compat/firebase-messaging.js'
      ]);
      if (!window.firebase) throw new Error('Firebase global nesnesi oluşmadı.');
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      stage = 'Messaging desteği';
      if (typeof firebase.messaging.isSupported === 'function') {
        let supported = false; try { supported = await firebase.messaging.isSupported(); } catch (e) { throw new Error(`Firebase Messaging destek kontrolü başarısız: ${serializeError(e)}`); }
        if (!supported) throw new Error(`Bu TWA/Chrome ortamı Firebase Web Push için desteklenmiyor. UA=${navigator.userAgent}`);
      }
      stage = 'Service Worker';
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=20260822-05', { scope: '/', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      if (!registration.active) throw new Error(`Service Worker aktif değil. state=${registration.installing?.state || registration.waiting?.state || 'yok'}`);
      stage = 'FCM token';
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error('FCM cihaz tokenı boş döndü.');
      stage = 'Supabase cihaz kaydı';
      const { error: rpcError } = await client.rpc('register_notification_device', { p_token: token, p_platform: platform(), p_app_variant: appVariant() });
      if (rpcError) throw rpcError;
      removeUi(); window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready', { detail: { appVariant: appVariant(), platform: platform() } })); return true;
    } catch (error) {
      const details = serializeError(error); console.warn('[Stagepulse] FCM registration failed', { stage, error, details });
      showStatus(`Bildirim bağlantısı kurulamadı (${stage}): ${details}`, 'Tekrar bağlan', register); return false;
    } finally { registering = false; }
  }
  async function enable() { try { if (await askPermission()) return await register(); } catch (error) { showStatus(`Bildirim bağlantısı kurulamadı (izin): ${serializeError(error)}`, 'Tekrar bağlan', register); } return false; }
  window.StagepulseFCM = { register, enable };
  document.addEventListener('DOMContentLoaded', () => {
    register().catch(error => console.warn('[Stagepulse] initial FCM registration', error));
    client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') register().catch(error => console.warn('[Stagepulse] auth FCM registration', error)); });
  });
})();