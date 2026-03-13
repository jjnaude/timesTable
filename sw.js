const CACHE_VERSION = 'times-table-sprint-v5';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './translations.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './assets/stage/environment-day.svg',
  './assets/vehicles/bicycle.svg',
  './assets/vehicles/hatchback.svg',
  './assets/vehicles/lawnmower.svg',
  './assets/vehicles/limousine.svg',
  './assets/vehicles/miningtruck.svg',
  './assets/vehicles/monster-truck.svg',
  './assets/vehicles/motorbike.svg',
  './assets/vehicles/movingtruck.svg',
  './assets/vehicles/pickup.svg',
  './assets/vehicles/racecar.svg',
  './assets/vehicles/suv.svg',
  './assets/vehicles/tractor.svg',
  './assets/vehicles/transforms.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_VERSION)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

function shouldUseNetworkFirst(request) {
  if (request.mode === 'navigate') return true;

  const isSameOrigin = new URL(request.url).origin === self.location.origin;
  if (!isSameOrigin) return false;

  return ['document', 'script', 'style', 'manifest'].includes(request.destination);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  if (shouldUseNetworkFirst(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
