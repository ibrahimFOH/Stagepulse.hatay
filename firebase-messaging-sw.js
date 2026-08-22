/* Stagepulse FCM service worker. Public Firebase web config only. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBZbLD2HpnrCDy4KJh9FUbwgBbI0m-jdeo',
  authDomain: 'stagepulse-905be.firebaseapp.com',
  projectId: 'stagepulse-905be',
  storageBucket: 'stagepulse-905be.firebasestorage.app',
  messagingSenderId: '163274034334',
  appId: '1:163274034334:web:844791f51bef484d33bf8f',
  measurementId: 'G-4BFSFS0SGM'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload?.notification || {};
  const data = payload?.data || {};
  const title = notification.title || data.title || 'Stagepulse';
  const options = {
    body: notification.body || data.body || '',
    icon: notification.icon || '/favicon-32.png',
    badge: notification.badge || '/favicon-32.png',
    data: { url: data.url || notification.click_action || '/portal/' },
    tag: data.tag || 'stagepulse-notification'
  };
  self.registration.showNotification(title, options);
});

function safeNotificationUrl(value) {
  try {
    const url = new URL(value || '/portal/', self.location.origin);
    if (url.origin !== self.location.origin) return '/portal/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/portal/';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeNotificationUrl(event.notification?.data?.url);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
