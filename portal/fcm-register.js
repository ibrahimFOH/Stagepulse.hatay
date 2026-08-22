/* Stagepulse FCM registration for Admin + Staff. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.vapidKey || !window.supabase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(`Firebase SDK yüklenemedi: ${src}`)); document.head.appendChild(s);
  });
  let registering = false;
  let actionButton = null;
  let statusNode = null;

  function appVariant() {
    return cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
  }
  function platform() { return cfg.platform === 'android' || /Android/i.test(navigator.userAgent) ? 'android' : 'web'; }
  function removeUi() { actionButton?.remove(); statusNode?.remove(); actionButton = null; statusNode = null; }
  function showStatus(text, actionText, handler) {
    if (!document.body) return;
    if (!statusNode) {
      statusNode = document.createElement('div');
      Object.assign(statusNode.style, { position:'fixed', right:'16px', bottom:'16px', zIndex:'2147483647', maxWidth:'340px', padding:'12px 14px', borderRadius:'14px', background:'#171717', color:'#fff', boxShadow:'0 8px 30px rgba(0,0,0,.35)', font:'600 13px system-ui,sans-serif' });
      document.body.appendChild(statusNode);
    }
    statusNode.textContent = text;
    if (actionText) {
      if (!actionButton) {
        actionButton = document.createElement('button');
        Object.assign(actionButton.style, { marginTop:'9px', border:'0', borderRadius:'9px', padding:'9px 12px', background:'#f5b400', color:'#111', font:'700 13px system-ui,sans-serif' });
        statusNode.appendChild(document.createElement('br'));
        statusNode.appendChild(actionButton);
      }
      actionButton.textContent = actionText;
      actionButton.onclick = handler;
      actionButton.disabled = false;
    }
  }

  function errorText(error, stage) {
    const code = error?.code ? ` [${error.code}]` : '';
    const message = error?.message || error?.name || String(error || 'Bilinmeyen hata');
    return `Bildirim bağlantısı kurulamadı (${stage})${code}: ${message}`;
  }

  async function askPermission() {
    if (!('Notification' in window)) {
      showStatus('Bu APK ortamında web bildirimleri desteklenmiyor.', null, null);
      return false;
    }
    if (Notification.permission === 'granted') return true;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showStatus('Stagepulse bildirim izni verilmedi. Android Chrome/site ayarlarından Bildirimler → İzin ver seçin.', 'Tekrar dene', enable);
      return false;
    }
    return true;
  }

  async function register() {
    if (registering) return false;
    registering = true;
    let stage = 'oturum';
    try {
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) return false;

      stage = 'tarayıcı desteği';
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        showStatus('Bu uygulama ortamı web push bildirimlerini desteklemiyor.', null, null);
        return false;
      }
      if (Notification.permission !== 'granted') {
        showStatus('Kapalı uygulama bildirimleri için Stagepulse bildirim izni gerekiyor.', '🔔 Bildirimleri aç', enable);
        return false;
      }

      stage = 'Firebase SDK';
      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(cfg);

      stage = 'Firebase Messaging desteği';
      if (firebase.messaging.isSupported && !(await firebase.messaging.isSupported())) {
        throw new Error('Bu APK/Chrome ortamı Firebase Web Push için desteklenmiyor.');
      }

      stage = 'Service Worker';
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=20260822-02', { scope: '/' });
      await navigator.serviceWorker.ready;

      stage = 'FCM token';
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error('FCM cihaz tokenı alınamadı.');

      stage = 'Supabase cihaz kaydı';
      const { error } = await client.rpc('register_notification_device', {
        p_token: token,
        p_platform: platform(),
        p_app_variant: appVariant()
      });
      if (error) throw error;

      removeUi();
      window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready', { detail: { appVariant: appVariant(), platform: platform() } }));
      return true;
    } catch (e) {
      console.warn('[Stagepulse] FCM registration failed', { stage, error: e });
      showStatus(errorText(e, stage), 'Tekrar bağlan', register);
      return false;
    } finally {
      registering = false;
    }
  }

  async function enable() {
    try {
      if (await askPermission()) return await register();
    } catch (e) {
      showStatus(errorText(e, 'bildirim izni'), 'Tekrar bağlan', register);
    }
    return false;
  }

  window.StagepulseFCM = { register, enable };

  document.addEventListener('DOMContentLoaded', () => {
    register().catch(() => {});
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') register().catch(() => {});
    });
  });
})();
