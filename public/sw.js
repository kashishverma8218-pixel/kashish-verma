/* VIO Streaming Workbox Service Worker */
const CACHE_NAME = 'vio-static-v1';
const IMAGE_CACHE = 'vio-images-v1';

let workboxLoaded = false;
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');
  if (typeof workbox !== 'undefined') {
    workboxLoaded = true;
  }
} catch {
  workboxLoaded = false;
}

const isBypassedRequest = (request, url) => {
  if (request.method !== 'GET') return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  if (request.headers.has('range')) return true;
  if (url.pathname.startsWith('/api/')) return true;
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com')
  ) {
    return true;
  }
  return false;
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== IMAGE_CACHE && !key.startsWith('workbox-'))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

if (workboxLoaded) {
  workbox.setConfig({ debug: false });
  workbox.core.clientsClaim();

  workbox.routing.registerRoute(
    ({ request, url }) =>
      !isBypassedRequest(request, url) &&
      url.origin === self.location.origin &&
      (request.mode === 'navigate' || request.destination === 'document'),
    new workbox.strategies.NetworkFirst({
      cacheName: CACHE_NAME,
      networkTimeoutSeconds: 5,
    })
  );

  workbox.routing.registerRoute(
    ({ request, url }) =>
      !isBypassedRequest(request, url) &&
      ['script', 'style', 'font'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: CACHE_NAME,
    })
  );

  workbox.routing.registerRoute(
    ({ request, url }) =>
      !isBypassedRequest(request, url) && request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: IMAGE_CACHE,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 80,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        }),
      ],
    })
  );
} else {
  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (isBypassedRequest(request, url)) return;

    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response && response.ok && url.origin === self.location.origin) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
      );
      return;
    }

    if (request.destination === 'image' || ['script', 'style', 'font'].includes(request.destination)) {
      event.respondWith(
        caches.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response && (response.ok || response.type === 'opaque')) {
              const targetCache = request.destination === 'image' ? IMAGE_CACHE : CACHE_NAME;
              const clone = response.clone();
              caches.open(targetCache).then((cache) => cache.put(request, clone));
            }
            return response;
          });
          return cached || networkFetch;
        })
      );
    }
  });
}
