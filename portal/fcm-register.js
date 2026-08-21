/* Stagepulse web/Android FCM registration. Configuration is intentionally runtime-only. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.vapidKey) return;
  const load = (src) => new Promise((resolve, reject) => { const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
  async function register() {
    if (!window.sb?.auth) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return;
    await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
    await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const registration = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
    if (!token) return;
    const variant = cfg.appVariant === 'admin' || document.documentElement.dataset.appVariant === 'admin' || location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
    const platform = cfg.platform === 'android' ? 'android' : 'web';
    const { error } = await sb.rpc('register_notification_device', { p_token: token, p_platform: platform, p_app_variant: variant });
    if (error) console.warn('[Stagepulse] notification device registration failed', error.message);
  }
  window.StagepulseFCM = { register };
  document.addEventListener('DOMContentLoaded', () => { if (window.__STAGEPULSE_AUTO_FCM__) register().catch(() => {}); });
})();
