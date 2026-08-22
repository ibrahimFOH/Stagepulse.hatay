/* Stagepulse FCM registration for both admin and staff portals. */
(() => {
  const cfg = window.STAGEPULSE_FCM_CONFIG;
  const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  if (!cfg || !cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.vapidKey || !window.supabase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  let registering = false;
  let permissionButton = null;

  function appVariant() {
    return cfg.appVariant === 'admin' ||
      document.documentElement.dataset.appVariant === 'admin' ||
      location.pathname.startsWith('/admin/')
      ? 'admin'
      : 'staff';
  }

  function platform() {
    return cfg.platform === 'android' || /Android/i.test(navigator.userAgent) ? 'android' : 'web';
  }

  function removePermissionButton() {
    permissionButton?.remove();
    permissionButton = null;
  }

  function showPermissionButton() {
    if (permissionButton || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    permissionButton = document.createElement('button');
    permissionButton.type = 'button';
    permissionButton.textContent = '🔔 Bildirimleri aç';
    permissionButton.setAttribute('aria-label', 'Stagepulse bildirimlerini aç');
    Object.assign(permissionButton.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '2147483647',
      border: '0',
      borderRadius: '999px',
      padding: '12px 18px',
      background: '#f5b400',
      color: '#111',
      font: '700 14px system-ui,sans-serif',
      boxShadow: '0 6px 24px rgba(0,0,0,.28)',
      cursor: 'pointer'
    });

    permissionButton.addEventListener('click', async () => {
      permissionButton.disabled = true;
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          removePermissionButton();
          await register();
        } else {
          permissionButton.textContent = 'Bildirim izni verilmedi';
          setTimeout(() => removePermissionButton(), 2500);
        }
      } catch (e) {
        console.warn('[Stagepulse] notification permission failed', e?.message || e);
        permissionButton.disabled = false;
      }
    });

    document.body.appendChild(permissionButton);
  }

  async function register() {
    if (registering) return false;
    registering = true;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user || !('Notification' in window) || !('serviceWorker' in navigator)) return false;

      // Permission prompts must be initiated by a user gesture. If permission is
      // still undecided, the explicit "Bildirimleri aç" button handles that step.
      if (Notification.permission !== 'granted') {
        showPermissionButton();
        return false;
      }

      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
      await load('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(cfg);

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const messaging = firebase.messaging();
      const token = await messaging.getToken({
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: registration
      });
      if (!token) return false;

      const { error } = await client.rpc('register_notification_device', {
        p_token: token,
        p_platform: platform(),
        p_app_variant: appVariant()
      });

      if (error) {
        console.warn('[Stagepulse] notification device registration failed', error.message);
        return false;
      }

      removePermissionButton();
      return true;
    } catch (e) {
      console.warn('[Stagepulse] FCM registration failed', e?.message || e);
      return false;
    } finally {
      registering = false;
    }
  }

  window.StagepulseFCM = {
    register,
    enable: async () => {
      if (!('Notification' in window)) return false;
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') return false;
      return register();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    register().catch(() => {});
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        register().catch(() => {});
      }
    });
  });
})();
