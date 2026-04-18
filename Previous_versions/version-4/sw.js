// ═══════════════════════════════════════════
// BLOOM WELLNESS — Service Worker v2
// ═══════════════════════════════════════════
const CACHE_NAME = 'bloom-sw-v2';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

// Keep-alive ping handler
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'PING') {
    e.source && e.source.postMessage({ type: 'PONG' });
  }
});

// Push notification handler
self.addEventListener('push', e => {
  const data = e.data
    ? e.data.json()
    : { title: 'Bloom 🌸', body: 'Your wellness reminder!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌸</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌸</text></svg>',
      vibrate: [200, 80, 200, 80, 200],
      tag: data.tag || 'bloom-notif',
    })
  );
});

self.addEventListener('notificationclick', e => { e.notification.close(); });
