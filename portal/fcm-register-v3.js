/* Stagepulse FCM registration v5: reuse the authenticated Stagepulse Supabase session. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !window.supabase || !window.firebase) return;

  // IMPORTANT: use Supabase's default auth storage key so this client sees the
  // same session created by portal.js/admin.js. A separate storageKey caused
  // FCM registration to see no logged-in user and silently stop.
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  let busy = false;
  const variant = () => cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff';

  const clear = () => document.getElementById('stagepulse-fcm-status')?.remove();
  const show = (text, action = 'Tekrar bağlan', handler = register) => {
    let box = document.getElementById('stagepulse-fcm-status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'stagepulse-fcm-status';
      Object.assign(box.style, {
        position: 'fixed', left: '16px', right: '16px', bottom: '16px', zIndex: '2147483647',
        maxWidth: '620px', margin: 'auto', padding: '14px 16px', borderRadius: '14px',
        background: '#171717', color: '#fff', font: '600 13px system-ui', whiteSpace: 'pre-wrap'
      });
      document.body.appendChild(box);
    }
    box.textContent = text;
    if (action) {
      const b = document.createElement('button');
      b.textContent = action;
      Object.assign(b.style, {
        display: 'block', marginTop: '10px', padding: '9px 12px', border: 0,
        borderRadius: '9px', background: '#f5b400', fontWeight: 700
      });
      b.onclick = handler;
      box.appendChild(b);
    }
  };

  async function requestPermissionAndRegister() {
    if (!('Notification' in window)) {
      show('Bu Android/Chrome ortamında Notification API desteklenmiyor.', null);
      return false;
    }
    if (Notification.permission === 'denied') {
      show('Stagepulse bildirim izni Android tarafından engellenmiş. Android ayarlarından bildirime izin verip tekrar deneyin.', 'Tekrar kontrol et', register);
      return false;
    }
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        show(`Bildirim izni verilmedi: ${permission}`, 'Bildirimleri aç', requestPermissionAndRegister);
        return false;
      }
    }
    return register();
  }

  async function register() {
    if (busy) return false;
    busy = true;
    try {
      const { data: { session }, error: se } = await client.auth.getSession();
      if (se) throw se;
      // Not logged in yet: auth state listener will retry immediately after login.
      if (!session?.user) return false;

      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Notification API, Service Worker veya Push API desteklenmiyor.');
      }

      if (Notification.permission !== 'granted') {
        show('Stagepulse bildirimleri için izin gerekiyor.', '🔔 Bildirimleri aç', requestPermissionAndRegister);
        return false;
      }

      if (!firebase.apps.length) firebase.initializeApp(cfg);
      if (typeof firebase.messaging.isSupported === 'function' && !(await firebase.messaging.isSupported())) {
        throw new Error('Firebase Web Push bu APK/Chrome ortamında desteklenmiyor.');
      }

      const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=20260822-11', {
        scope: '/',
        updateViaCache: 'none'
      });
      await navigator.serviceWorker.ready;

      const token = await firebase.messaging().getToken({
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: sw
      });
      if (!token) throw new Error('FCM cihaz tokenı alınamadı.');

      const { error } = await client.rpc('register_notification_device', {
        p_token: token,
        p_platform: 'android',
        p_app_variant: variant()
      });
      if (error) throw error;

      clear();
      window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready', { detail: { appVariant: variant() } }));
      return true;
    } catch (e) {
      const detail = [e?.name, e?.code, e?.message].filter(Boolean).join(' | ') || String(e);
      show(`Bildirim bağlantısı kurulamadı: ${detail}`);
      console.error('[Stagepulse FCM]', e);
      return false;
    } finally {
      busy = false;
    }
  }

  window.StagepulseFCM = { register, enable: requestPermissionAndRegister };

  // Initial load: works when an existing session is already present.
  document.addEventListener('DOMContentLoaded', () => register());

  // Critical: login happens after DOMContentLoaded. Retry as soon as portal/admin
  // establishes the authenticated Supabase session.
  client.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
      setTimeout(() => register().catch(() => {}), 0);
    }
  });
})();
