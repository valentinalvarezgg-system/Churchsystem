// Church System Service Worker v2 — Cache + Push Notifications
const VERSION    = 'church-v4-app-scope'
const CACHE_NAME = `church-system-${VERSION}`
const SCOPE_PATH = new URL(self.registration.scope).pathname
const IS_ROOT_SCOPE = SCOPE_PATH === '/'

const PRECACHE = ['/app/', '/app/login', '/app/manifest.json']

self.addEventListener('install', e => {
  if (IS_ROOT_SCOPE) {
    e.waitUntil(self.skipWaiting())
    return
  }
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  if (IS_ROOT_SCOPE) {
    e.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('church-system-')).map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
    )
    return
  }
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (IS_ROOT_SCOPE) return
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return
  const url = new URL(e.request.url)
  if (!url.pathname.startsWith('/app/')) return
  const href = e.request.url
  if (href.includes('/auth/') || href.includes('/personas') ||
      href.includes('/checkin/') || href.includes(':4000')) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        }
        return response
      })
      .catch(() => caches.match(e.request))
  )
})

// ── Push Notifications ──────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return

  let data
  try { data = e.data.json() }
  catch { data = { title: 'Church System', body: e.data.text() } }

  const options = {
    body: data.body || '',
    icon: '/app/icon-192.png',
    badge: '/app/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/app/' },
    actions: data.actions || [],
    tag: data.tag || 'church-system',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
  }

  // Emojis según el tipo de alerta
  const title = data.title || 'Church System'

  e.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ──────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/app/'

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Si ya hay una ventana abierta, enfocarla y navegar
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(url)
            return
          }
        }
        // Si no, abrir una nueva
        if (clients.openWindow) return clients.openWindow(url)
      })
  )
})
