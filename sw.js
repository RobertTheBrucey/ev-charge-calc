const CACHE_NAME = 'evcc-v2';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/404.html',
  '/css/style.css',
  '/js/main.js',
  '/js/calc.js',
  '/js/storage.js',
  '/js/favourites.js',
  '/js/vehicles.js',
  '/js/advanced.js',
  '/js/simulate.js',
  '/js/format.js',
  '/js/badge.js',
  '/js/pwa.js',
  '/data/vehicles.json',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Network-first: always prefer a fresh response so deploys show up immediately
// for online visitors. Only fall back to the cache when the network fails,
// which is the whole point of this being a PWA (poor connectivity at a charger).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
