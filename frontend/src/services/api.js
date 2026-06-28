// Detecta automáticamente la URL del backend:
// - En dev (localhost): usa localhost:4000
// - En red local: usa la IP de la red:4000
// - En Cloudflare Tunnel (https://xxx.trycloudflare.com): usa el mismo origen
//   porque el backend sirve también el frontend
const getApiBase = () => {
  const { protocol, hostname, port } = window.location

  // Cloudflare Tunnel o cualquier HTTPS sin puerto → mismo origen
  if (protocol === 'https:') return ''

  // Si el backend ya está sirviendo la SPA, usar el mismo origen.
  if (port && port !== '5173') return ''

  // Vite dev → backend en :4000
  return `http://${hostname}:4000`
}

const API = getApiBase()
const DATA_EVENT = 'church:data-changed'
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('church-system-sync')
  : null

function normalizeAppContext() {
  const params = new URLSearchParams(window.location.search)
  const mappings = [
    ['lang', 'church_lang'],
    ['country', 'church_country'],
    ['currency', 'church_currency'],
    ['promo', 'church_promo'],
  ]
  for (const [param, key] of mappings) {
    const value = params.get(param)
    if (value) localStorage.setItem(key, value)
  }
  document.documentElement.lang = localStorage.getItem('church_lang') || 'es'
}

normalizeAppContext()

export function syncContextFromUser(user) {
  if (!user) return
  const nextLang = (localStorage.getItem('church_lang') || user.idioma || 'es').slice(0, 2)
  const nextCountry = (localStorage.getItem('church_country') || user.pais || 'AR').toUpperCase()
  const nextCurrency = (localStorage.getItem('church_currency') || user.divisa || 'ARS').toUpperCase()
  localStorage.setItem('church_lang', nextLang)
  localStorage.setItem('church_country', nextCountry)
  localStorage.setItem('church_currency', nextCurrency)
  document.documentElement.lang = nextLang
  emitDataChanged({ source: 'user-context' })
}

export function emitDataChanged(detail = {}) {
  const payload = { ...detail, at: Date.now() }
  window.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: payload }))
  channel?.postMessage(payload)
}

if (channel) {
  channel.onmessage = event => {
    window.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: event.data || {} }))
  }
}

function getOrCreateSessionId() {
  let sid = localStorage.getItem('church_session_id')
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('church_session_id', sid)
  }
  return sid
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const url   = `${API}${path}`
  const method = (options.method || 'GET').toUpperCase()
  const lang = localStorage.getItem('church_lang')
  const skipAuthRedirect = options.skipAuthRedirect === true
  const sessionId = getOrCreateSessionId()
  const body = options.body
  const isNativeBody = body instanceof FormData
    || body instanceof URLSearchParams
    || body instanceof Blob
    || body instanceof ArrayBuffer
  const hasContentType = Object.keys(options.headers || {})
    .some(key => key.toLowerCase() === 'content-type')
  let res
  try {
    res = await fetch(url, {
      ...options,
      credentials: options.credentials || 'include',
      headers: {
        ...(!isNativeBody && !hasContentType ? { 'Content-Type': 'application/json' } : {}),
        ...(lang ? { 'Accept-Language': lang } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-session-id': sessionId,
        ...(options.headers || {})
      }
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisá tu conexión e intentá nuevamente.')
  }

  if (res.status === 401 && token && !skipAuthRedirect) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/app/login'
    return
  }

  const raw = await res.text()
  let data = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw || `Error ${res.status}` } }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    emitDataChanged({ path, method })
  }
  return data
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

export function hasRol(...roles) {
  const u = getUser()
  return u && roles.includes(u.rol)
}

export function getApiUrl() {
  return API || window.location.origin
}

export function getStoredContext() {
  return {
    lang: localStorage.getItem('church_lang') || 'es',
    country: localStorage.getItem('church_country') || 'AR',
    currency: localStorage.getItem('church_currency') || 'ARS',
    promo: localStorage.getItem('church_promo') || '',
  }
}

export function setStoredContext({ lang, country, currency, promo } = {}) {
  if (lang) localStorage.setItem('church_lang', String(lang).slice(0, 2))
  if (country) localStorage.setItem('church_country', String(country).toUpperCase())
  if (currency) localStorage.setItem('church_currency', String(currency).toUpperCase())
  if (promo !== undefined) localStorage.setItem('church_promo', String(promo || ''))
  document.documentElement.lang = localStorage.getItem('church_lang') || 'es'
  emitDataChanged({ source: 'context-selector' })
}
