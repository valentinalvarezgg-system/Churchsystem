const CACHE_NAME = 'church-system-v3'
const OFFLINE_URL = '/offline.html'
const PRECACHE_ASSETS = ['/', '/offline.html']
const API_CACHE_PATTERNS = [
  /\/api\/grupos$/,
  /\/api\/personas\?/,
  /\/api\/stats/,
  /\/api\/eventos/,
  /\/api\/comunicados/,
]

const DB_NAME = 'church-system'
const STORE_CACHE = 'http-cache'
const STORE_QUEUE = 'sync-queue'
const STORE_SYNC_STATUS = 'sync-status'

let db = null

async function initDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = (ev) => {
      const d = ev.target.result
      if (!d.objectStoreNames.contains(STORE_CACHE)) {
        d.createObjectStore(STORE_CACHE, { keyPath: 'url' })
      }
      if (!d.objectStoreNames.contains(STORE_QUEUE)) {
        d.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true })
      }
      if (!d.objectStoreNames.contains(STORE_SYNC_STATUS)) {
        d.createObjectStore(STORE_SYNC_STATUS, { keyPath: 'key' })
      }
    }
    r.onsuccess = () => { db = r.result; res(db) }
    r.onerror = () => rej(r.error)
  })
}

async function queueChange(method, url, body) {
  if (!db) await initDB()
  const store = db.transaction([STORE_QUEUE], 'readwrite').objectStore(STORE_QUEUE)
  return new Promise((res, rej) => {
    const r = store.add({
      method,
      url,
      body,
      timestamp: Date.now(),
      retries: 0,
    })
    r.onsuccess = () => {
      notifyClients({ type: 'queue-added', count: 1 })
      res(r.result)
    }
    r.onerror = () => rej(r.error)
  })
}

function notifyClients(msg) {
  if (typeof self !== 'undefined' && self.clients) {
    self.clients.matchAll().then(cls => {
      cls.forEach(c => c.postMessage(msg))
    })
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      )
      .then(() => initDB())
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return

  if (request.method === 'GET') {
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
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const offlinePage = await caches.match(OFFLINE_URL)
          return offlinePage || new Response('Offline', { status: 503 })
        })
    )
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    if (request.url.includes('/api/')) {
      event.respondWith(
        fetch(request)
          .then(res => {
            if (res.ok) notifyClients({ type: 'synced' })
            return res
          })
          .catch(async (err) => {
            const isApiChange = request.url.includes('/personas') ||
                                request.url.includes('/grupos') ||
                                request.url.includes('/cultos') ||
                                request.url.includes('/discipulado')
            if (isApiChange) {
              const body = await request.clone().text()
              await queueChange(request.method, request.url, body)
              return new Response(JSON.stringify({ queued: true }), {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
              })
            }
            return new Response(JSON.stringify({ error: 'Offline' }), { status: 503 })
          })
      )
    }
  }
})

self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'sync-now') {
    if (!db) await initDB()
    notifyClients({ type: 'sync-start' })
    try {
      const changes = await getPendingChanges()
      for (const change of changes) {
        try {
          const res = await fetch(change.url, {
            method: change.method,
            body: change.body !== 'null' ? change.body : undefined,
            headers: { 'Content-Type': 'application/json' },
          })
          if (res.ok) {
            await markSynced(change.id)
            notifyClients({ type: 'synced', id: change.id })
          } else {
            notifyClients({ type: 'sync-error', id: change.id, status: res.status })
          }
        } catch (err) {
          notifyClients({ type: 'sync-error', id: change.id, error: err.message })
        }
      }
      notifyClients({ type: 'sync-complete', count: changes.length })
    } catch (err) {
      notifyClients({ type: 'sync-error', error: err.message })
    }
  }
})

async function getPendingChanges() {
  if (!db) await initDB()
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_QUEUE], 'readonly')
    const store = tx.objectStore(STORE_QUEUE)
    const r = store.getAll()
    r.onsuccess = () => res(r.result || [])
    r.onerror = () => rej(r.error)
  })
}

async function markSynced(id) {
  if (!db) await initDB()
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_QUEUE], 'readwrite')
    const store = tx.objectStore(STORE_QUEUE)
    const r = store.delete(id)
    r.onsuccess = () => res()
    r.onerror = () => rej(r.error)
  })
}
