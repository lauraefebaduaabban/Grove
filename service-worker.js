/* ==========================================================================
   GROVE — Service worker
   Caches only the static app shell (HTML/CSS/JS/icons) so the interface
   loads reliably and can be installed as a PWA. It does NOT cache or sync
   any financial data — that stays in the browser's localStorage on this
   device, exactly as it does without a service worker.
   ========================================================================== */

const CACHE_NAME = 'grove-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './auth.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* non-fatal: app still works without a full pre-cache */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't intercept CDN/font requests

  // Navigations: try the network first so updates are picked up, fall back
  // to the cached shell if the device is offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: cache-first, then network, then nothing (safe failure).
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  );
});
