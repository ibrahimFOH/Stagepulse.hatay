/* Stagepulse notification service worker v10: FCM + native Web Push. */
importScripts('/portal/vendor/firebase/firebase-app-compat.js?v=10.14.1');
importScripts('/portal/vendor/firebase/firebase-messaging-compat.js?v=10.14.1');
importScripts('/shared/runtime-config.js');
importScripts('/portal/fcm-config.js');

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const firebaseOrigins = new Set(['https://firebaseinstallations.googleapis.com','https://fcmregistrations.googleapis.com','https://fcm.googleapis.com']);
  if (!firebaseOrigins.has(url.origin)) return;
  try {
    const request = new Request(event.request, { referrer: self.location.origin + '/', referrerPolicy: 'strict-origin' });
    event.respondWith(fetch(request));
  } catch (_) { event.respondWith(fetch(event.request)); }
});

const config = self.STAGEPULSE_FCM_CONFIG;
if (!config?.apiKey || config.apiKey === '__STAGEPULSE_FIREBASE_API_KEY__') {
  throw new Error('FCM API key was not injected at build time');
}

firebase.initializeApp(config);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  if (payload?.notification) return;
  const data = payload?.data || {};
  self.registration.showNotification(data.title || 'Stagepulse', {
    body: data.body || '',
    icon: data.icon || '/favicon-32.png',
    badge: data.badge || '/favicon-32.png',
    data: { url: safeNotificationUrl(data.url || '/portal/') },
    tag: data.tag || `stagepulse-${data.kind || 'system'}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200,100,200]
  });
});

// Native Web Push fallback. Malformed/non-JSON payloads are ignored here so the two channels can coexist safely.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch (_) { return; }
  if (!data || typeof data !== 'object') return;
  const title = typeof data.title === 'string' ? data.title : 'Stagepulse';
  const body = typeof data.body === 'string' ? data.body : '';
  const options = {
    body,
    icon: typeof data.icon === 'string' ? data.icon : '/favicon-32.png',
    badge: typeof data.badge === 'string' ? data.badge : '/favicon-32.png',
    data: { url: safeNotificationUrl(data.url || '/portal/') },
    tag: typeof data.tag === 'string' ? data.tag : `stagepulse-${data.kind || 'system'}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200,100,200]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

function safeNotificationUrl(value) {
  try {
    const url = new URL(value || '/portal/', self.location.origin);
    if (url.origin !== self.location.origin) return '/portal/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/portal/'; }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeNotificationUrl(event.notification?.data?.url);
  event.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
