const DB_NAME = 'church-system'
const DB_VERSION = 1
const STORE_CACHE = 'http-cache'
const STORE_QUEUE = 'sync-queue'
const STORE_SYNC_STATUS = 'sync-status'

let db = null

export async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (ev) => {
      const d = ev.target.result
      if (!d.objectStoreNames.contains(STORE_CACHE)) {
        const store = d.createObjectStore(STORE_CACHE, { keyPath: 'url' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!d.objectStoreNames.contains(STORE_QUEUE)) {
        const store = d.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
      if (!d.objectStoreNames.contains(STORE_SYNC_STATUS)) {
        d.createObjectStore(STORE_SYNC_STATUS, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => { db = req.result; resolve(db) }
    req.onerror = () => reject(req.error)
  })
}

export async function cacheResponse(url, data, expireHours = 24) {
  const store = await getStore(STORE_CACHE, 'readwrite')
  return store.put({
    url,
    data,
    timestamp: Date.now(),
    expireAt: Date.now() + expireHours * 3600000,
  })
}

export async function getCachedResponse(url) {
  const store = await getStore(STORE_CACHE, 'readonly')
  return new Promise((resolve, reject) => {
    const req = store.get(url)
    req.onsuccess = () => {
      const item = req.result
      if (!item) return resolve(null)
      if (item.expireAt < Date.now()) {
        deleteFromCache(url)
        return resolve(null)
      }
      resolve(item.data)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function queueChange(method, url, body, options = {}) {
  const store = await getStore(STORE_QUEUE, 'readwrite')
  const id = await store.add({
    method,
    url,
    body,
    headers: options.headers || {},
    timestamp: Date.now(),
    retries: 0,
    lastError: null,
  })
  await updateSyncStatus({ pending: await getPendingCount() })
  return id
}

export async function getPendingChanges() {
  const store = await getStore(STORE_QUEUE, 'readonly')
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function markSynced(id) {
  const store = await getStore(STORE_QUEUE, 'readwrite')
  await store.delete(id)
  await updateSyncStatus({ pending: await getPendingCount() })
}

export async function getPendingCount() {
  const store = await getStore(STORE_QUEUE, 'readonly')
  return new Promise((resolve, reject) => {
    const req = store.count()
    req.onsuccess = () => resolve(req.result || 0)
    req.onerror = () => reject(req.error)
  })
}

export async function updateSyncStatus(updates) {
  const store = await getStore(STORE_SYNC_STATUS, 'readwrite')
  const current = (await new Promise((res, rej) => {
    const r = store.get('status')
    r.onsuccess = () => res(r.result || {})
    r.onerror = () => rej(r.error)
  })) || {}
  const next = { key: 'status', ...current, ...updates, updatedAt: Date.now() }
  await store.put(next)
  return next
}

export async function getSyncStatus() {
  const store = await getStore(STORE_SYNC_STATUS, 'readonly')
  return new Promise((resolve, reject) => {
    const req = store.get('status')
    req.onsuccess = () => resolve(req.result || { key: 'status', pending: 0, lastSync: null })
    req.onerror = () => reject(req.error)
  })
}

function getStore(name, mode) {
  return new Promise((resolve, reject) => {
    if (!db) reject(new Error('DB not initialized'))
    const tx = db.transaction([name], mode)
    resolve(tx.objectStore(name))
  })
}

async function deleteFromCache(url) {
  try {
    const store = await getStore(STORE_CACHE, 'readwrite')
    await store.delete(url)
  } catch (e) {
    console.warn('Could not clear expired cache', e)
  }
}

export async function cleanupExpiredCache() {
  const store = await getStore(STORE_CACHE, 'readwrite')
  const all = await new Promise((res, rej) => {
    const r = store.getAll()
    r.onsuccess = () => res(r.result || [])
    r.onerror = () => rej(r.error)
  })
  const now = Date.now()
  for (const item of all) {
    if (item.expireAt < now) await store.delete(item.url)
  }
}
