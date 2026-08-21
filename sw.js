/* ============================================
   STAGEPULSE – Service Worker v8
   Network-first for HTML/JS
   Cache-first for images, videos, fonts, CSS
   Push notification display/click handling
   ============================================ */

const CACHE_VERSION = 'stagepulse-v8';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const MEDIA_CACHE = `media-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/favicon.svg',
  '/manifest.webmanifest',
  '/i18n.js'
];

const NETWORK_FIRST_PATHS = [
  '/', '/index.html', '/style.css', '/script.js', '/i18n.js',
  '/teklif.html', '/hizmetler.html', '/muhendislik.html', '/galeri.html',
  '/dokumanlar.html', '/hakkimizda.html', '/referanslar.html',
  '/nasil-calisiyoruz.html', '/sss.html', '/ekipman.html', '/Kvkk.html', '/media.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== STATIC_CACHE && key !== MEDIA_CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || 'Stagepulse';
  const body = notification.body || data.body || '';
  const url = data.url || notification.click_action || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: notification.icon || '/icon-192.png',
      badge: notification.badge || '/favicon-32.png',
      tag: data.tag || `stagepulse-${data.notification_id || title}`,
      renotify: false,
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        if ('navigate' in existing && existing.url !== new URL(target, self.location.origin).href) {
          return existing.navigate(new URL(target, self.location.origin).href).then(() => existing.focus());
        }
        return existing.focus();
      }
      return self.clients.openWindow(new URL(target, self.location.origin).href);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNetworkFirst =
    NETWORK_FIRST_PATHS.some((p) => url.pathname === p || url.pathname.endsWith(p)) ||
    request.destination === 'document' || url.pathname.endsWith('.html') ||
    url.pathname.endsWith('script.js') || url.pathname.endsWith('i18n.js') ||
    url.pathname.endsWith('media.json') ||
    (url.pathname.startsWith('/admin/') && url.pathname.endsWith('.js')) ||
    (url.pathname.startsWith('/portal/') && url.pathname.endsWith('.js'));

  if (isNetworkFirst) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html') || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response && response.status === 200 && request.method === 'GET') {
        const clone = response.clone();
        const targetCache = request.destination === 'video' || url.pathname.match(/\.(mp4|webm|mov|m4v)$/i)
          ? MEDIA_CACHE : STATIC_CACHE;
        caches.open(targetCache).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => request.destination === 'image' ? new Response('', { status: 404 }) : caches.match('/index.html')))
  );
});
