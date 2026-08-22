/* Stagepulse FCM registration for Admin + Staff. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.vapidKey || !window.supabase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
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

  async function askPermission() {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showStatus('Stagepulse bildirimleri cihaz/tarayıcı ayarlarında kapalı. Android Chrome site ayarlarından Bildirimler → İzin ver seçin.', 'Tekrar dene', askPermission);
      return false;
    }
    return true;
  }

  async function register() {
    if (registering) return false;
    registering = true;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) return false;
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        showStatus('Bu uygulama ortamı web push bildirimlerini desteklemiyor.', null, null);
        return false;
      }
      if (Notification.permission !== 'granted') {
        showStatus('Kapalı uygulama bildirimleri için Stagepulse bildirim izni gerekiyor.', '🔔 Bildirimleri aç', askPermission);
        return false;
      }

      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(cfg);

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error('FCM cihaz tokenı alınamadı.');

      const { error } = await client.rpc('register_notification_device', {
        p_token: token,
        p_platform: platform(),
        p_app_variant: appVariant()
      });
      if (error) throw new Error(error.message || 'Bildirim cihazı kaydedilemedi.');

      removeUi();
      window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready', { detail: { appVariant: appVariant(), platform: platform() } }));
      return true;
    } catch (e) {
      console.warn('[Stagepulse] FCM registration failed', e?.message || e);
      showStatus(`Bildirim bağlantısı kurulamadı: ${e?.message || 'bilinmeyen hata'}`, 'Tekrar bağlan', register);
      return false;
    } finally {
      registering = false;
    }
  }

  window.StagepulseFCM = { register, enable: async () => (await askPermission()) ? register() : false };

  document.addEventListener('DOMContentLoaded', () => {
    register().catch(() => {});
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') register().catch(() => {});
    });
  });
})();
