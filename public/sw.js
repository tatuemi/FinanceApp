/**
 * Service Worker seguro para Finanzas & Portafolio PWA (Sección 2.3).
 *
 * REGLA DE SEGURIDAD OBLIGATORIA:
 * - NUNCA almacena respuestas privadas de `/api/*`, tokens de sesión (`/auth/*`),
 *   información financiera ni páginas HTML autenticadas en cachés públicas.
 * - Limita la caché exclusivamente a recursos estáticos inmutables de interfaz
 *   (iconos, manifest y bundles estáticos `/_next/static/`).
 */

const STATIC_CACHE_NAME = 'finanzas-pwa-static-v1';

const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isSafeStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const pathname = url.pathname;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/finances') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/investments') ||
    pathname.startsWith('/settings')
  ) {
    return false;
  }

  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSafeStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
        }
        return networkResponse;
      });
    })
  );
});
