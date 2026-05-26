// Detecta automáticamente la URL del backend:
// - En dev (localhost): usa localhost:4000
// - En red local: usa la IP de la red:4000
// - En Cloudflare Tunnel (https://xxx.trycloudflare.com): usa el mismo origen
//   porque el backend sirve también el frontend
const getApiBase = () => {
  const { protocol, hostname, port } = window.location

  // Cloudflare Tunnel o cualquier HTTPS sin puerto → mismo origen
  if (protocol === 'https:') return ''

  // Red local o localhost → backend en :4000
  return `http://${hostname}:4000`
}

const API = getApiBase()

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const url   = `${API}${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    return
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
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
