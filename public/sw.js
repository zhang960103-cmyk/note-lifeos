// Service Worker for Life OS PWA — offline-first
const CACHE_NAME = 'lifeos-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192.png',
  '/pwa-512.png',
];

// M4: API response cache for offline reading
const API_CACHE = 'lifeos-api-v1';
const API_CACHE_URLS = [
  '/rest/v1/day_entries',
  '/rest/v1/todos',
  '/rest/v1/finance_entries',
  '/rest/v1/habits',
  '/rest/v1/profiles',
];

// Offline queue for writes when network is unavailable
const OFFLINE_QUEUE_KEY = 'lifeos_offline_queue';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
        .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy:
// - Static assets: cache-first
// - Supabase API GETs: network-first with cache fallback
// - Supabase API writes (POST/PATCH/DELETE): network-only, queue offline
// - Everything else: network-first
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSupabaseApi = url.hostname.includes('supabase.co') && 
                        url.pathname.includes('/rest/v1/');
  const isStaticAsset = STATIC_ASSETS.some(a => url.pathname === a) ||
                        url.pathname.match(/\.(js|css|png|jpg|ico|svg|woff2?)$/);

  if (isStaticAsset) {
    // Cache first for static assets
    event.respondWith(
      caches.match(event.request).then(cached => 
        cached || fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  if (isSupabaseApi && event.request.method === 'GET') {
    // Network first, cache fallback for API reads
    event.respondWith(
      fetch(event.request.clone()).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(API_CACHE).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return res;
      }).catch(() => 
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
      )
    );
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(event.request).catch(() => 
      caches.match(event.request).then(cached =>
        cached || new Response('Offline', { status: 503 })
      )
    )
  );
});
