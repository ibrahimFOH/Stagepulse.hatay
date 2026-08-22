/* Stagepulse FCM registration: single canonical implementation for Admin + Staff. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !window.supabase || !window.firebase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  let busy = false;
  let currentStage = 'başlatma';
  let statusNode = null;

  const variant = () => cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
  const clear = () => { statusNode?.remove(); statusNode = null; };
  const describe = (e) => [e?.name, e?.code, e?.message].filter(Boolean).join(' | ') || String(e);

  const show = (text, action = 'Tekrar bağlan', handler = register) => {
    if (!document.body) return;
    let box = statusNode || document.getElementById('stagepulse-fcm-status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'stagepulse-fcm-status';
      Object.assign(box.style, { position:'fixed', left:'16px', right:'16px', bottom:'16px', zIndex:'2147483647', maxWidth:'620px', margin:'auto', padding:'14px 16px', borderRadius:'14px', background:'#171717', color:'#fff', font:'600 13px system-ui', whiteSpace:'pre-wrap', boxShadow:'0 8px 30px rgba(0,0,0,.35)' });
      document.body.appendChild(box); statusNode = box;
    }
    box.replaceChildren(document.createTextNode(text));
    if (action) {
      const b = document.createElement('button');
      b.textContent = action;
      Object.assign(b.style, { display:'block', marginTop:'10px', padding:'9px 12px', border:0, borderRadius:'9px', background:'#f5b400', color:'#111', fontWeight:700 });
      b.onclick = handler;
      box.appendChild(b);
    }
  };

  function environmentDiagnostic() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return [
      `online=${navigator.onLine}`,
      `protocol=${location.protocol}`,
      `origin=${location.origin}`,
      `path=${location.pathname}`,
      `notification=${'Notification' in window ? Notification.permission : 'unsupported'}`,
      `serviceWorker=${'serviceWorker' in navigator}`,
      `pushManager=${'PushManager' in window}`,
      `connection=${connection?.effectiveType || 'unknown'}`
    ].join('\n');
  }

  async function networkProbe() {
    const endpoints = [
      ['Firebase Installations', `https://firebaseinstallations.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/installations`],
      ['FCM Registration', `https://fcmregistrations.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/registrations`],
      ['FCM API', 'https://fcm.googleapis.com/']
    ];
    const results = [];
    for (const [name, url] of endpoints) {
      const started = performance.now();
      try {
        const response = await fetch(url, { method:'OPTIONS', mode:'cors', cache:'no-store' });
        results.push(`${name}: HTTP ${response.status} (${Math.round(performance.now() - started)}ms)`);
      } catch (e) {
        results.push(`${name}: NETWORK/CORS — ${e?.message || 'Failed to fetch'}`);
      }
    }
    return results.join('\n');
  }

  async function requestPermissionAndRegister() {
    if (!('Notification' in window)) { show('Bu Android/Chrome ortamında bildirim API desteklenmiyor.', null); return false; }
    if (Notification.permission === 'denied') {
      show('Stagepulse bildirim izni Android tarafından engellenmiş. Android/Chrome site ayarlarından bildirime izin verip tekrar deneyin.', 'Tekrar kontrol et', register);
      return false;
    }
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { show(`Bildirim izni verilmedi: ${permission}`, 'Bildirimleri aç', requestPermissionAndRegister); return false; }
    }
    return register();
  }

  async function getTokenResilient(messaging, sw) {
    currentStage = 'FCM cihaz tokenı';
    let firstError;
    try {
      return await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: sw });
    } catch (e) {
      firstError = e;
    }

    try { await sw.update(); } catch (_) {}
    try { await navigator.serviceWorker.ready; } catch (_) {}
    await new Promise(r => setTimeout(r, 1000));

    try {
      return await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: sw });
    } catch (secondError) {
      const probe = await networkProbe();
      throw new Error(`${describe(secondError)}\nİlk deneme: ${describe(firstError)}\n\nFCM ağ tanısı:\n${probe}\n\nOrtam:\n${environmentDiagnostic()}`);
    }
  }

  async function register() {
    if (busy) return false;
    busy = true;
    try {
      currentStage = 'Firebase yapılandırması';
      if (!cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.vapidKey) throw new Error('Firebase web yapılandırması eksik.');

      currentStage = 'Supabase oturumu';
      const { data: { session }, error: se } = await client.auth.getSession();
      if (se) throw se;
      if (!session?.user) return false;

      currentStage = 'tarayıcı desteği';
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Notification API, Service Worker veya Push API desteklenmiyor.');
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') throw new Error(`FCM Web Push için HTTPS gerekiyor. Mevcut protokol: ${location.protocol}`);
      if (Notification.permission !== 'granted') { show('Stagepulse bildirimleri için izin gerekiyor.', '🔔 Bildirimleri aç', requestPermissionAndRegister); return false; }

      currentStage = 'Firebase Messaging desteği';
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      if (typeof firebase.messaging.isSupported === 'function' && !(await firebase.messaging.isSupported())) throw new Error('Firebase Web Push bu Android/Chrome ortamında desteklenmiyor.');

      currentStage = 'Service Worker';
      const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=20260822-14', { scope:'/', updateViaCache:'none' });
      await navigator.serviceWorker.ready;
      try { await sw.update(); } catch (_) {}
      if (!sw.active) throw new Error('Firebase Service Worker aktif hale gelmedi.');

      const messaging = firebase.messaging();
      const token = await getTokenResilient(messaging, sw);
      if (!token) throw new Error('FCM cihaz tokenı alınamadı.');

      currentStage = 'Supabase cihaz kaydı';
      const { error } = await client.rpc('register_notification_device', { p_token:token, p_platform:'android', p_app_variant:variant() });
      if (error) throw error;

      clear();
      window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready', { detail:{ appVariant:variant() } }));
      return true;
    } catch (e) {
      show(`Bildirim bağlantısı kurulamadı (${currentStage}): ${describe(e)}`, 'Tekrar bağlan', register);
      console.error('[Stagepulse FCM]', { stage:currentStage, error:e });
      return false;
    } finally { busy = false; }
  }

  window.StagepulseFCM = { register, enable:requestPermissionAndRegister, diagnose:networkProbe };
  document.addEventListener('DOMContentLoaded', () => register());
  client.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) setTimeout(() => register().catch(() => {}), 0);
  });
})();
