// Life OS PWA Service Worker v6 — 强制版本更新
const CACHE_VERSION = 'v6';
const CACHE_NAME = `lifeos-${CACHE_VERSION}`;
const API_CACHE = `lifeos-api-${CACHE_VERSION}`;

const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// 安装时删除所有旧版缓存
self.addEventListener('install', event => {
  self.skipWaiting(); // 立刻激活新SW，不等旧页面关闭
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// 激活时清理旧版缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // 立刻接管所有已打开的页面
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isSupabaseApi = url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/');
  const isStatic = url.pathname.match(/\.(js|css|png|jpg|ico|svg|woff2?)$/) || STATIC_ASSETS.includes(url.pathname);

  if (isStatic) {
    // 静态资源：网络优先，失败用缓存
    event.respondWith(
      fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  if (isSupabaseApi && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request.clone()).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(API_CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(event.request).then(cached =>
          cached || new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
        )
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(c => c || new Response('Offline', { status: 503 }))
    )
  );
});
