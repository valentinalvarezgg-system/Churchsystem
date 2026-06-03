const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'
const tokenCache = new Map()

function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || ''
}

function googleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET || ''
}

function googleDriveRedirectUri(baseUrl = '') {
  const normalized = String(process.env.GOOGLE_DRIVE_REDIRECT_URI || '').trim()
  if (normalized) return normalized
  const base = String(baseUrl || process.env.BASE_URL || '').trim().replace(/\/$/, '')
  return base ? `${base}/oauth/google/drive/callback` : ''
}

export function buildGoogleDriveAuthUrl({ state, baseUrl = '' } = {}) {
  const clientId = googleClientId()
  const redirectUri = googleDriveRedirectUri(baseUrl)
  if (!clientId || !redirectUri) return null

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state: state || '',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function extractGoogleDriveFolderId(raw = '') {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (!value.includes('http')) return value
  try {
    const url = new URL(value)
    const folderMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (folderMatch?.[1]) return folderMatch[1]
    const id = url.searchParams.get('id')
    if (id) return id
    const q = url.searchParams.get('q')
    if (q && q !== value) return q
    return value
  } catch {
    const match = value.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    return match?.[1] || value
  }
}

export async function exchangeGoogleDriveCode({ code, redirectUri }) {
  const clientId = googleClientId()
  const clientSecret = googleClientSecret()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Drive no está configurado')
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'No se pudo completar Google Drive')
  }
  return data
}

export async function refreshGoogleDriveAccessToken(refreshToken) {
  const clientId = googleClientId()
  const clientSecret = googleClientSecret()
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive no está conectado')
  }

  const cached = tokenCache.get(refreshToken)
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return { access_token: cached.accessToken, token_type: 'Bearer', expires_in: Math.max(1, Math.floor((cached.expiresAt - Date.now()) / 1000)) }
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'No se pudo renovar Google Drive')
  }
  if (data.expires_in) {
    tokenCache.set(refreshToken, {
      accessToken: data.access_token,
      expiresAt: Date.now() + Number(data.expires_in) * 1000,
    })
  }
  return data
}

export async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'No se pudo leer el perfil de Google')
  }
  return data
}

function humanFileSize(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = Number(bytes)
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function classifyGoogleDriveFile(file = {}) {
  const name = String(file.name || '').toLowerCase()
  const mime = String(file.mimeType || '').toLowerCase()
  const title = String(file.name || '')
  const isFolder = mime === 'application/vnd.google-apps.folder'
  const looksLikeSheet = mime.includes('spreadsheet') || /\.(xlsx?|csv|gsheet)$/.test(name)
  const looksLikeDoc = mime.includes('document') || /\.(docx?|txt|md|rtf|google-docs)$/.test(name)
  const looksLikePdf = mime.includes('pdf') || /\.pdf$/.test(name)

  let category = 'archivo'
  let categoryLabel = 'Archivo'
  if (isFolder) {
    category = 'carpeta'
    categoryLabel = 'Carpeta'
  } else if (/(partitura|score|sheet|cancion|canto|music|lyrics|letra)/.test(name) || looksLikeDoc) {
    category = 'material'
    categoryLabel = 'Material'
  } else if (/(rider|sonido|luces|stage|audio|mix|monitores)/.test(name) || looksLikePdf) {
    category = 'produccion'
    categoryLabel = 'Producción'
  } else if (/(cronograma|agenda|schedule|planning|planificacion|calendario)/.test(name) || looksLikeSheet) {
    category = 'cronograma'
    categoryLabel = 'Cronograma'
  } else if (/(checklist|check-list|lista|control|tarea|tareas)/.test(name)) {
    category = 'checklist'
    categoryLabel = 'Checklist'
  }

  return {
    ...file,
    title,
    category,
    categoryLabel,
    sizeLabel: humanFileSize(file.size),
  }
}

export async function listGoogleDriveFolderFiles({ refreshToken, folderId, pageSize = 100 }) {
  if (!refreshToken) return []
  const token = await refreshGoogleDriveAccessToken(refreshToken)
  if (!folderId) return []

  const query = [
    `'${folderId}' in parents`,
    'trashed = false',
  ].join(' and ')

  const params = new URLSearchParams({
    q: query,
    pageSize: String(pageSize),
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,thumbnailLink,webContentLink,owners(displayName,emailAddress),parents)',
    orderBy: 'folder,name',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    corpora: 'allDrives',
  })

  const res = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'No se pudieron leer los archivos de Drive')
  }
  return (data.files || []).map(classifyGoogleDriveFile)
}
