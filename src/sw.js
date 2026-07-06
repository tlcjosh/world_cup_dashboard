const CACHE = 'wc2026-v26.1';
const PRECACHE = [
  '/world_cup_dashboard/',
  '/world_cup_dashboard/styles.css',
  '/world_cup_dashboard/app.js',
  '/world_cup_dashboard/vendor/idiomorph.esm.js',
  '/world_cup_dashboard/data/data.json',
  '/world_cup_dashboard/data/combinations.json',
  '/world_cup_dashboard/data/fifa_rankings.json',
  '/world_cup_dashboard/favicon.svg',
  '/world_cup_dashboard/manifest.json',
  '/world_cup_dashboard/icons/icon-192-any.png',
  '/world_cup_dashboard/icons/icon-512-any.png',
  '/world_cup_dashboard/icons/icon-192.png',
  '/world_cup_dashboard/icons/icon-512.png',
  '/world_cup_dashboard/icons/badge-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/world_cup_dashboard/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('/world_cup_dashboard/');
    })
  );
});

self.addEventListener('fetch', e => {
  // Network-first for API calls and data.json; cache-first for static assets
  const url = new URL(e.request.url);
  const isData = url.pathname.endsWith('data.json') || url.pathname.endsWith('fifa_rankings.json') || url.hostname.includes('espn') || url.hostname.includes('football-data');
  if (isData) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  }
});
