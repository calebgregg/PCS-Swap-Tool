// PCS Swap Tool — Service Worker v2.20260821
// INCREMENT THIS VERSION NUMBER ON EVERY RELEASE — this is what forces updates
const VERSION = 'v2.20260821';
const CACHE_NAME = 'pcs-swap-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// On install: cache assets and skip waiting immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // Don't wait — activate immediately
});

// On activate: delete ALL old caches, claim all clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // Take control of all open tabs NOW
      .then(() => {
        // Tell every open client to reload so they get the new version
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SW_UPDATED', version: VERSION });
          });
        });
      })
  );
});

// Fetch: network-first for HTML so updates always land,
//        cache-first for everything else
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for Firebase/CDN
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Network-first for the app shell (index.html)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html') || url.pathname === '/PCS-Swap-Tool/') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && e.request.method === 'GET') {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
