// Service Worker Medico Subito - v2
const CACHE_NAME = 'medico-subito-v2';

// Installa: svuota cache vecchie
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Attiva: elimina tutte le cache precedenti
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: sempre dalla rete, mai dalla cache
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
