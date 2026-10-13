// Cache policy version, independent of Next's content-addressed deployment assets.
const CACHE_NAME = 'anastasis-static-v2'
const LEGACY_ASSET_CACHE = 'anastasis-shell-v1'
const OFFLINE_PAGE = '/offline.html'
const SHELL_ASSETS = ['/Logo.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_PAGE, ...SHELL_ASSETS])))
  // An update waits for existing screens to close, or for explicit user consent.
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting())
})

// Keep previous assets for open screens. Never delete other caches or activity data.
function isAssetResponse(response, destination) {
  if (!response?.ok) return false
  const type = response.headers.get('content-type') || ''
  if (destination === 'script') return /(?:javascript|ecmascript)/i.test(type)
  if (destination === 'style') return /^text\/css(?:;|$)/i.test(type)
  if (destination === 'image') return /^image\//i.test(type)
  if (destination === 'font') return /^(?:font\/|application\/(?:font|vnd\.ms-fontobject|octet-stream))/i.test(type)
  return false
}

async function cachedAsset(request) {
  for (const name of [CACHE_NAME, LEGACY_ASSET_CACHE]) {
    const response = await caches.match(request, { cacheName: name })
    if (isAssetResponse(response, request.destination)) return response
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // HTML and authenticated dashboard data must come from the current deployment.
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match(OFFLINE_PAGE, { cacheName: CACHE_NAME })) || Response.error()
    ))
    return
  }

  // Leave API, RSC, and other dynamic requests entirely to the application.
  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return
  if (!url.pathname.startsWith('/_next/static/') && !SHELL_ASSETS.includes(url.pathname)) return

  event.respondWith(
    fetch(request).then(async (response) => {
      if (isAssetResponse(response, request.destination)) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {}))
      } else if (!response.ok) {
        // A previous open screen can still request its exact old chunk after a deploy.
        const cached = await cachedAsset(request)
        if (cached) return cached
      } else {
        // Deployment errors or redirects must never deliver HTML as a JS/CSS asset.
        return (await cachedAsset(request)) || Response.error()
      }
      return response
    }).catch(async () => (await cachedAsset(request)) || Response.error())
  )
})
