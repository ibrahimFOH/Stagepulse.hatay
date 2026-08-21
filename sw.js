/* ============================================
   STAGEPULSE – Service Worker v7
   Network-first for HTML/JS
   Cache-first for images, videos, fonts, CSS
   Video ve büyük medya için hazır
   ============================================ */

const CACHE_VERSION = 'stagepulse-v7';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const MEDIA_CACHE = `media-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/favicon.svg',
  '/manifest.webmanifest',
  '/i18n.js'
];

const NETWORK_FIRST_PATHS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/i18n.js',
  '/teklif.html',
  '/hizmetler.html',
  '/muhendislik.html',
  '/galeri.html',
  '/dokumanlar.html',
  '/hakkimizda.html',
  '/referanslar.html',
  '/nasil-calisiyoruz.html',
  '/sss.html',
  '/ekipman.html',
  '/Kvkk.html',
  '/media.json'
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
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== MEDIA_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Sadece same-origin
  if (url.origin !== self.location.origin) return;

  // Admin/Portal JS artık asla eski cache'ten gelmez – 2026-08-21
  // HTML + kritik JS + media.json → Network First
  const isNetworkFirst =
    NETWORK_FIRST_PATHS.some((p) => url.pathname === p || url.pathname.endsWith(p)) ||
    request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('script.js') ||
    url.pathname.endsWith('i18n.js') ||
    url.pathname.endsWith('media.json') ||
    (
      url.pathname.startsWith('/admin/') &&
      url.pathname.endsWith('.js')
    ) ||
    (
      url.pathname.startsWith('/portal/') &&
      url.pathname.endsWith('.js')
    );

  if (isNetworkFirst) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // Görsel, video, font, CSS → Cache First (video için de uygun)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          // Videoları ayrı cache'e koy (büyük dosya yönetimi)
          const targetCache = request.destination === 'video' || url.pathname.match(/\.(mp4|webm|mov|m4v)$/i)
            ? MEDIA_CACHE
            : STATIC_CACHE;
          caches.open(targetCache).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.destination === 'image') {
          return new Response('', { status: 404 });
        }
        return caches.match('/index.html');
      });
    })
  );
});
