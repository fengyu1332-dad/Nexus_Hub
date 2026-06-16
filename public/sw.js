// Nexus Hub Service Worker — PWA offline support
const CACHE = 'nexus-v1'

// Critical assets to pre-cache on install
const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Install — pre-cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return Promise.allSettled(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => {
            // Non-critical if a single asset fails
          })
        )
      )
    })
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    })
  )
  self.clients.claim()
})

// Fetch — network-first with cache fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin
  const { method, url } = event.request
  if (method !== 'GET') return

  // Skip API calls and Next.js HMR
  if (url.includes('/api/') || url.includes('_next/webpack')) return

  event.respondWith(
    (async () => {
      try {
        const netRes = await fetch(event.request)
        // Cache successful responses
        if (netRes.ok) {
          const clone = netRes.clone()
          caches.open(CACHE).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return netRes
      } catch {
        // Offline — try cache
        const cached = await caches.match(event.request)
        if (cached) return cached

        // Return offline page for HTML requests
        const accept = event.request.headers.get('accept') || ''
        if (accept.includes('text/html')) {
          return new Response(
            `<!DOCTYPE html>
            <html lang="zh-CN">
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Nexus Hub — 离线</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
                     min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
              .card { text-align: center; padding: 2rem; }
              h1 { font-size: 1.5rem; color: #f97316; } p { color: #94a3b8; }
            </style></head>
            <body><div class="card"><h1>📡 当前离线</h1><p>请连接网络后重试</p></div></body>
            </html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        }
        return new Response(null, { status: 408 })
      }
    })()
  )
})
