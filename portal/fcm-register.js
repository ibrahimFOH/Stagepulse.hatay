/* Stagepulse FCM registration for both admin and staff portals. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.vapidKey || !window.supabase) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const load = (src) => new Promise((resolve, reject) => { const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
  let registering = false;
  async function register() {
    if (registering) return;
    registering = true;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user || !('Notification' in window) || !('serviceWorker' in navigator)) return;
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') return;
      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
      if (!token) return;
      const variant = cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
      const platform = cfg.platform === 'android' || /Android/i.test(navigator.userAgent) ? 'android' : 'web';
      const { error } = await client.rpc('register_notification_device', { p_token: token, p_platform: platform, p_app_variant: variant });
      if (error) console.warn('[Stagepulse] notification device registration failed', error.message);
    } catch (e) {
      console.warn('[Stagepulse] FCM registration failed', e?.message || e);
    } finally { registering = false; }
  }
  window.StagepulseFCM = { register };
  document.addEventListener('DOMContentLoaded', () => {
    register().catch(() => {});
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') register().catch(() => {});
    });
  });
})();
