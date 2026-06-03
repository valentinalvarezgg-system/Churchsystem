import {
  ensureWhatsAppSchema,
  getWhatsAppDiagnostics,
  parseTemplateComponents,
  processWebhookPayload,
  resolveWhatsAppConnection,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  syncTemplatesFromMeta,
  upsertWhatsAppConnection,
} from '../services/whatsapp.js'

const API_VERSION = process.env.META_API_VERSION || process.env.META_GRAPH_VERSION || 'v23.0'
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`

export {
  ensureWhatsAppSchema,
  getWhatsAppDiagnostics,
  parseTemplateComponents,
  processWebhookPayload,
  resolveWhatsAppConnection,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  syncTemplatesFromMeta,
  upsertWhatsAppConnection,
}

export function getMetaAppConfig() {
  return {
    apiVersion: API_VERSION,
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    systemToken: process.env.META_SYSTEM_TOKEN || process.env.META_ACCESS_TOKEN || '',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
    wabaId: process.env.META_WABA_ID || '',
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || '',
    embeddedSignupConfigId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
    redirectUri: process.env.META_REDIRECT_URI || '',
  }
}

export async function resolveSystemWhatsAppConnection() {
  const env = getMetaAppConfig()
  const connection = await resolveWhatsAppConnection(null)
  return {
    ...connection,
    iglesiaId: null,
    source: connection?.source || 'env',
    accessToken: connection?.accessToken || env.systemToken,
    phoneNumberId: connection?.phoneNumberId || env.phoneNumberId,
    businessAccountId: connection?.businessAccountId || env.wabaId,
    verifyToken: connection?.verifyToken || env.verifyToken,
  }
}

export async function resolveScopedWhatsAppConnection({ iglesiaId = null, scope = 'churchsystem' } = {}) {
  if (scope === 'churchsystem') return resolveSystemWhatsAppConnection()
  return resolveWhatsAppConnection(Number(iglesiaId || 0))
}

export async function sendScopedWhatsAppText({ scope = 'churchsystem', iglesiaId = null, personaId = null, userId = null, to, text }) {
  const targetIglesiaId = scope === 'churchsystem' ? null : Number(iglesiaId || 0)
  return sendWhatsAppText({ iglesiaId: targetIglesiaId, personaId, userId, to, text })
}

export async function sendScopedWhatsAppTemplate({
  scope = 'churchsystem',
  iglesiaId = null,
  personaId = null,
  userId = null,
  to,
  templateName,
  languageCode = 'es',
  components = {},
}) {
  const targetIglesiaId = scope === 'churchsystem' ? null : Number(iglesiaId || 0)
  return sendWhatsAppTemplate({
    iglesiaId: targetIglesiaId,
    personaId,
    userId,
    to,
    templateName,
    languageCode,
    components,
  })
}

async function exchangeCodeForAccessToken({ code, redirectUri = '' }) {
  const env = getMetaAppConfig()
  if (!env.appId || !env.appSecret) {
    throw new Error('META_APP_ID / META_APP_SECRET no configurados para Embedded Signup.')
  }
  const url = new URL(`${BASE_URL}/oauth/access_token`)
  url.searchParams.set('client_id', env.appId)
  url.searchParams.set('client_secret', env.appSecret)
  url.searchParams.set('code', String(code || '').trim())
  if (redirectUri || env.redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri || env.redirectUri)
  }

  const response = await fetch(url, { method: 'GET' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error?.message || 'No se pudo intercambiar el code de Meta.')
  }
  return data
}

async function fetchMetaPhoneNumber(accessToken, wabaId, fallbackPhoneNumberId = '') {
  if (!wabaId) return null
  const url = new URL(`${BASE_URL}/${wabaId}/phone_numbers`)
  url.searchParams.set('fields', 'id,display_phone_number,verified_name')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error?.message || 'No se pudieron leer los phone numbers de Meta.')
  }
  const rows = Array.isArray(data?.data) ? data.data : []
  if (!rows.length) return null
  if (fallbackPhoneNumberId) {
    return rows.find(item => String(item.id) === String(fallbackPhoneNumberId)) || rows[0]
  }
  return rows[0]
}

export async function onboardChurchWhatsAppConnection({
  iglesiaId,
  code,
  redirectUri = '',
  wabaId = '',
  phoneNumberId = '',
  displayPhoneNumber = '',
  verifiedName = '',
  verifyToken = '',
  metadata = {},
}) {
  await ensureWhatsAppSchema()
  if (!iglesiaId) throw new Error('iglesiaId es requerido.')
  if (!code) throw new Error('code es requerido para Embedded Signup.')

  const tokenData = await exchangeCodeForAccessToken({ code, redirectUri })
  const accessToken = String(tokenData.access_token || '').trim()
  if (!accessToken) {
    throw new Error('Meta no devolvió access_token en el intercambio del code.')
  }

  let nextPhoneNumberId = String(phoneNumberId || '').trim()
  let nextDisplayPhoneNumber = String(displayPhoneNumber || '').trim()
  let nextVerifiedName = String(verifiedName || '').trim()
  const nextWabaId = String(wabaId || tokenData.waba_id || '').trim()

  if (nextWabaId) {
    const phoneInfo = await fetchMetaPhoneNumber(accessToken, nextWabaId, nextPhoneNumberId).catch(() => null)
    if (phoneInfo) {
      nextPhoneNumberId = nextPhoneNumberId || String(phoneInfo.id || '').trim()
      nextDisplayPhoneNumber = nextDisplayPhoneNumber || String(phoneInfo.display_phone_number || '').trim()
      nextVerifiedName = nextVerifiedName || String(phoneInfo.verified_name || '').trim()
    }
  }

  if (!nextPhoneNumberId) {
    throw new Error('No se pudo resolver phoneNumberId desde Embedded Signup.')
  }

  const connection = await upsertWhatsAppConnection(Number(iglesiaId), {
    provider: 'meta_cloud',
    phoneNumberId: nextPhoneNumberId,
    businessAccountId: nextWabaId,
    accessToken,
    verifyToken: String(verifyToken || getMetaAppConfig().verifyToken || '').trim(),
    displayPhoneNumber: nextDisplayPhoneNumber,
    verifiedName: nextVerifiedName,
    status: 'connected',
    metadata: {
      ...metadata,
      onboarding: 'embedded_signup',
      tokenType: tokenData.token_type || '',
      issuedAt: new Date().toISOString(),
    },
  })

  return {
    ok: true,
    connection,
    tokenData: {
      tokenType: tokenData.token_type || '',
      expiresIn: tokenData.expires_in || null,
    },
  }
}
