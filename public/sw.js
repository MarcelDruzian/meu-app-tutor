// Service Worker do Tutor IA (PWA)
// - Arquivos estáticos: "rede primeiro, cache como reserva". Com internet, o usuário sempre recebe a
//   versão mais nova do app (novos deploys chegam sozinhos); sem internet, usa a cópia guardada.
// - /api/ nunca é interceptado nem guardado em cache.
// - Ao publicar uma mudança nos arquivos estáticos, aumente CACHE_VERSION para limpar caches antigos.
const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'tutor-ia-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/css/variables.css',
  '/css/style.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/data/demoData.js',
  '/js/services/auth.js',
  '/js/services/storage.js',
  '/js/services/speech.js',
  '/js/services/tutor.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Um arquivo que falhe não impede os demais de serem guardados.
      Promise.all(
        ASSETS_TO_CACHE.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('Arquivo não guardado em cache offline:', asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  // Só arquivos do próprio app; nunca a API nem outros domínios.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return Response.error();
        })
      )
  );
});
