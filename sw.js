// ===== SERVICE WORKER — BATTLE ROYALE OFFLINE CACHE =====
const CACHE = 'br-v1';

// Todo lo que se cachea en la primera visita
const PRECACHE = [
  '/',
  '/index.html',
  // Three.js desde CDN
  'https://unpkg.com/three@0.128.0/build/three.module.js',
  'https://unpkg.com/three@0.128.0/examples/jsm/loaders/GLTFLoader.js',
];

// Modelos GLB — se cachean cuando se cargan por primera vez
// No los precacheamos porque son pesados y opcionales

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Borra caches viejos
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Solo cachea GET
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Estrategia: Cache First para GLB (son estáticos y pesados)
  if (url.pathname.includes('.glb')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(response => {
            if (response.ok) cache.put(e.request, response.clone());
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // Estrategia: Network First para el HTML (siempre trae lo nuevo)
  // si no hay red, usa el cache
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() =>
        caches.match(e.request).then(cached => cached || new Response('Sin conexión', { status: 503 }))
      )
    );
    return;
  }

  // Estrategia: Cache First para todo lo demás (CDN de three.js, etc)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          caches.open(CACHE).then(cache => cache.put(e.request, response.clone()));
        }
        return response;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
