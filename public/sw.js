// MEDFORGE app-shell service worker (degraded mode). Caches only the built app shell and assets.
// API responses, signal windows and research data are never cached.
const CACHE = 'medforge-shell-v1'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/index.html'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/healthz') return
  if (event.request.mode === 'navigate') {
    // Network first for pages; fall back to the cached shell when offline.
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone()
      caches.open(CACHE).then(cache => cache.put('/index.html', copy))
      return response
    }).catch(() => caches.match('/index.html')))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    // Hashed build assets never change, so cache first.
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      const copy = response.clone()
      caches.open(CACHE).then(cache => cache.put(event.request, copy))
      return response
    })))
  }
})
