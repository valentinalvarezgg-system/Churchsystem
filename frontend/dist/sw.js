const CACHE_NAME = 'church-system-v1'
const OFFLINE_URL = '/offline.html'

// Assets que se cachean en la instalación
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
]

// Rutas de API que se pueden servir desde cache cuando offline
const API_CACHE_PATTERNS = [
  /\/api\/grupos$/,
  /\/api\/personas\?/,
  /\/api\/stats/,
  /\/api\/eventos/,
  /\/api\/comunicados/,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo interceptar GET
  if (request.method !== 'GET') return

  // Para APIs: network-first con fallback a cache
  if (url.pathname.startsWith('/api/')) {
    const shouldCache = API_CACHE_PATTERNS.some(p => p.test(url.pathname + url.search))
    if (!shouldCache) return

    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Para assets estáticos: cache-first
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Para navegación: network-first con fallback a / o offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then(r => r || caches.match(OFFLINE_URL))
      )
    )
  }
})

// Sincronización en background cuando vuelve la conexión
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-asistencia') {
    event.waitUntil(syncAsistenciaPendiente())
  }
})

async function syncAsistenciaPendiente() {
  try {
    const db = await openDB()
    const pendientes = await getAll(db, 'asistencia_pendiente')
    for (const item of pendientes) {
      try {
        await fetch('/api/asistencia', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${item.token}` },
          body: JSON.stringify(item.data)
        })
        await deleteRecord(db, 'asistencia_pendiente', item.id)
      } catch {}
    }
  } catch {}
}

// IndexedDB helper mínimo para cola offline
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('church-system-offline', 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('asistencia_pendiente', { keyPath:'id', autoIncrement:true })
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = reject
  })
}
function getAll(db, store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => res(req.result)
    req.onerror = rej
  })
}
function deleteRecord(db, store, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(id).onsuccess = res
    tx.onerror = rej
  })
}
