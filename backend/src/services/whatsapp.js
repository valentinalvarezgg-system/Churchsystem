import logger from '../lib/logger.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'

const GRAPH_VERSION = process.env.META_API_VERSION || process.env.META_GRAPH_VERSION || 'v23.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`
const DEFAULT_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || ''

let schemaReadyPromise = null

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export async function ensureWhatsAppSchema() {
  if (schemaReadyPromise) return schemaReadyPromise
  schemaReadyPromise = (async () => {
    await pgExec(`
      CREATE TABLE IF NOT EXISTS "WhatsAppConnection" (
        "id" SERIAL PRIMARY KEY,
        "iglesiaId" INTEGER NOT NULL REFERENCES "Iglesia"("id") ON DELETE CASCADE,
        "provider" TEXT NOT NULL DEFAULT 'meta_cloud',
        "phoneNumberId" TEXT NOT NULL,
        "businessAccountId" TEXT DEFAULT '',
        "accessToken" TEXT DEFAULT '',
        "verifyToken" TEXT DEFAULT '',
        "displayPhoneNumber" TEXT DEFAULT '',
        "verifiedName" TEXT DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'pending',
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMPTZ,
        UNIQUE ("iglesiaId","phoneNumberId")
      )
    `)
    await pgExec(`
      CREATE TABLE IF NOT EXISTS "WhatsAppTemplate" (
        "id" SERIAL PRIMARY KEY,
        "iglesiaId" INTEGER REFERENCES "Iglesia"("id") ON DELETE CASCADE,
        "connectionId" INTEGER REFERENCES "WhatsAppConnection"("id") ON DELETE SET NULL,
        "name" TEXT NOT NULL,
        "language" TEXT NOT NULL DEFAULT 'es',
        "category" TEXT DEFAULT '',
        "status" TEXT DEFAULT 'pending',
        "components" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "lastSyncedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("iglesiaId","name","language")
      )
    `)
    await pgExec(`
      CREATE TABLE IF NOT EXISTS "WhatsAppConversation" (
        "id" SERIAL PRIMARY KEY,
        "iglesiaId" INTEGER NOT NULL REFERENCES "Iglesia"("id") ON DELETE CASCADE,
        "personaId" INTEGER REFERENCES "Persona"("id") ON DELETE SET NULL,
        "contactWaId" TEXT DEFAULT '',
        "phone" TEXT DEFAULT '',
        "lastDirection" TEXT DEFAULT '',
        "lastMessageAt" TIMESTAMPTZ,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("iglesiaId","phone")
      )
    `)
    await pgExec(`
      CREATE TABLE IF NOT EXISTS "WhatsAppLog" (
        "id" SERIAL PRIMARY KEY,
        "iglesiaId" INTEGER REFERENCES "Iglesia"("id") ON DELETE SET NULL,
        "personaId" INTEGER REFERENCES "Persona"("id") ON DELETE SET NULL,
        "userId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
        "conversationId" INTEGER REFERENCES "WhatsAppConversation"("id") ON DELETE SET NULL,
        "connectionId" INTEGER REFERENCES "WhatsAppConnection"("id") ON DELETE SET NULL,
        "direction" TEXT NOT NULL DEFAULT 'outbound',
        "messageType" TEXT NOT NULL DEFAULT 'text',
        "recipientPhone" TEXT DEFAULT '',
        "templateName" TEXT DEFAULT '',
        "metaMessageId" TEXT DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'queued',
        "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "error" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pgExec('CREATE INDEX IF NOT EXISTS idx_whatsapp_connection_iglesia ON "WhatsAppConnection"("iglesiaId")')
    await pgExec('CREATE INDEX IF NOT EXISTS idx_whatsapp_template_iglesia ON "WhatsAppTemplate"("iglesiaId")')
    await pgExec('CREATE INDEX IF NOT EXISTS idx_whatsapp_log_iglesia_created ON "WhatsAppLog"("iglesiaId","createdAt" DESC)')
    await pgExec('CREATE INDEX IF NOT EXISTS idx_whatsapp_log_meta_message ON "WhatsAppLog"("metaMessageId")')
    await pgExec('CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_phone ON "WhatsAppConversation"("iglesiaId","phone")')
  })()
  return schemaReadyPromise
}

export async function getTenantConfigMap(iglesiaId) {
  const rows = await pgMany(
    'SELECT "clave","valor" FROM "Configuracion" WHERE "iglesiaId"=$1 OR "iglesiaId" IS NULL ORDER BY "iglesiaId" NULLS FIRST',
    [iglesiaId]
  )
  return Object.fromEntries(rows.map(row => [row.clave, row.valor]))
}

export async function upsertWhatsAppConnection(iglesiaId, input = {}) {
  await ensureWhatsAppSchema()
  const phoneNumberId = String(input.phoneNumberId || input.wa_phone_number_id || '').trim()
  if (!iglesiaId || !phoneNumberId) return null
  const provider = String(input.provider || 'meta_cloud').trim() || 'meta_cloud'
  const businessAccountId = String(input.businessAccountId || input.wa_business_account_id || '').trim()
  const accessToken = String(input.accessToken || input.wa_access_token || '').trim()
  const verifyToken = String(input.verifyToken || input.wa_verify_token || '').trim()
  const displayPhoneNumber = String(input.displayPhoneNumber || input.wa_display_phone_number || '').trim()
  const verifiedName = String(input.verifiedName || input.wa_verified_name || '').trim()
  const status = String(input.status || input.wa_status || 'connected').trim() || 'connected'
  const metadata = JSON.stringify(input.metadata || {})

  return pgOne(
    `INSERT INTO "WhatsAppConnection"
      ("iglesiaId","provider","phoneNumberId","businessAccountId","accessToken","verifyToken","displayPhoneNumber","verifiedName","status","metadata","createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("iglesiaId","phoneNumberId")
     DO UPDATE SET
      "provider"=EXCLUDED."provider",
      "businessAccountId"=EXCLUDED."businessAccountId",
      "accessToken"=EXCLUDED."accessToken",
      "verifyToken"=EXCLUDED."verifyToken",
      "displayPhoneNumber"=EXCLUDED."displayPhoneNumber",
      "verifiedName"=EXCLUDED."verifiedName",
      "status"=EXCLUDED."status",
      "metadata"=EXCLUDED."metadata",
      "updatedAt"=CURRENT_TIMESTAMP,
      "deletedAt"=NULL
     RETURNING *`,
    [iglesiaId, provider, phoneNumberId, businessAccountId, accessToken, verifyToken, displayPhoneNumber, verifiedName, status, metadata]
  )
}

export async function syncWhatsAppConnectionFromConfig(iglesiaId) {
  if (!iglesiaId) return null
  const cfg = await getTenantConfigMap(iglesiaId)
  if (!cfg.wa_phone_number_id) return null
  return upsertWhatsAppConnection(iglesiaId, cfg)
}

export async function resolveWhatsAppConnection(iglesiaId) {
  await ensureWhatsAppSchema()
  if (iglesiaId) {
    await syncWhatsAppConnectionFromConfig(iglesiaId).catch(err => logger.warn({ err: err.message, iglesiaId }, 'WhatsApp config sync skipped'))
  }
  const row = iglesiaId
    ? await pgOne(
      `SELECT * FROM "WhatsAppConnection"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        ORDER BY "updatedAt" DESC
        LIMIT 1`,
      [iglesiaId]
    )
    : null

  if (row) {
    return {
      ...row,
      accessToken: row.accessToken || process.env.META_SYSTEM_TOKEN || process.env.META_ACCESS_TOKEN || '',
      verifyToken: row.verifyToken || DEFAULT_VERIFY_TOKEN,
      businessAccountId: row.businessAccountId || process.env.META_WABA_ID || '',
      phoneNumberId: row.phoneNumberId || process.env.META_PHONE_NUMBER_ID || '',
      provider: row.provider || 'meta_cloud',
      metadata: row.metadata || {},
      source: 'tenant',
    }
  }

  const systemToken = process.env.META_SYSTEM_TOKEN || process.env.META_ACCESS_TOKEN || ''
  if (!process.env.META_PHONE_NUMBER_ID || !systemToken) return null
  return {
    id: null,
    iglesiaId: iglesiaId || null,
    provider: 'meta_cloud',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    businessAccountId: process.env.META_WABA_ID || '',
    accessToken: systemToken,
    verifyToken: DEFAULT_VERIFY_TOKEN,
    displayPhoneNumber: process.env.META_DISPLAY_PHONE_NUMBER || '',
    verifiedName: process.env.META_VERIFIED_NAME || '',
    status: 'env_only',
    metadata: {},
    source: 'env',
  }
}

async function graphRequest(path, body, accessToken) {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta Graph error ${response.status}`)
  }
  return data
}

function normalizePhone(phone = '') {
  return String(phone || '').replace(/\D/g, '')
}

function buildTemplateComponents(components = {}) {
  const output = []
  for (const [type, values] of Object.entries(components || {})) {
    if (!Array.isArray(values) || !values.length) continue
    output.push({
      type,
      parameters: values.map(value => (
        typeof value === 'object' && value?.type
          ? value
          : { type: 'text', text: String(value ?? '') }
      )),
    })
  }
  return output
}

export async function sendWhatsAppText({ iglesiaId, personaId = null, userId = null, to, text }) {
  await ensureWhatsAppSchema()
  const connection = await resolveWhatsAppConnection(iglesiaId)
  if (!connection?.phoneNumberId || !connection?.accessToken) {
    throw new Error('WhatsApp Cloud API no configurado para esta iglesia.')
  }
  const recipientPhone = normalizePhone(to)
  const payload = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'text',
    text: { body: String(text || '') },
  }
  const result = await graphRequest(`/${connection.phoneNumberId}/messages`, payload, connection.accessToken)
  const metaMessageId = result?.messages?.[0]?.id || ''
  await saveWhatsAppLog({
    iglesiaId,
    personaId,
    userId,
    connectionId: connection.id,
    direction: 'outbound',
    messageType: 'text',
    recipientPhone,
    templateName: '',
    metaMessageId,
    status: result?.messages?.length ? 'sent' : 'queued',
    payload,
  })
  await upsertConversation({ iglesiaId, personaId, phone: recipientPhone, lastDirection: 'outbound', metadata: { metaMessageId } })
  return { ok: true, metaMessageId, result, provider: 'meta_cloud' }
}

export async function sendWhatsAppTemplate({ iglesiaId, personaId = null, userId = null, to, templateName, languageCode = 'es', components = {} }) {
  await ensureWhatsAppSchema()
  const connection = await resolveWhatsAppConnection(iglesiaId)
  if (!connection?.phoneNumberId || !connection?.accessToken) {
    throw new Error('WhatsApp Cloud API no configurado para esta iglesia.')
  }
  const recipientPhone = normalizePhone(to)
  const payload = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'template',
    template: {
      name: String(templateName || '').trim(),
      language: { code: languageCode || 'es' },
      components: buildTemplateComponents(components),
    },
  }
  const result = await graphRequest(`/${connection.phoneNumberId}/messages`, payload, connection.accessToken)
  const metaMessageId = result?.messages?.[0]?.id || ''
  await saveWhatsAppLog({
    iglesiaId,
    personaId,
    userId,
    connectionId: connection.id,
    direction: 'outbound',
    messageType: 'template',
    recipientPhone,
    templateName: String(templateName || ''),
    metaMessageId,
    status: result?.messages?.length ? 'sent' : 'queued',
    payload,
  })
  await upsertConversation({ iglesiaId, personaId, phone: recipientPhone, lastDirection: 'outbound', metadata: { templateName, metaMessageId } })
  return { ok: true, metaMessageId, result, provider: 'meta_cloud' }
}

export async function saveWhatsAppTemplate(iglesiaId, template = {}, connectionId = null) {
  await ensureWhatsAppSchema()
  const name = String(template.name || '').trim()
  const language = String(template.language || template.code || 'es').trim()
  if (!iglesiaId || !name) return null
  return pgOne(
    `INSERT INTO "WhatsAppTemplate"
      ("iglesiaId","connectionId","name","language","category","status","components","metadata","lastSyncedAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("iglesiaId","name","language")
     DO UPDATE SET
      "connectionId"=EXCLUDED."connectionId",
      "category"=EXCLUDED."category",
      "status"=EXCLUDED."status",
      "components"=EXCLUDED."components",
      "metadata"=EXCLUDED."metadata",
      "lastSyncedAt"=CURRENT_TIMESTAMP,
      "updatedAt"=CURRENT_TIMESTAMP
     RETURNING *`,
    [
      iglesiaId,
      connectionId,
      name,
      language,
      String(template.category || ''),
      String(template.status || 'approved'),
      JSON.stringify(template.components || []),
      JSON.stringify(template.metadata || {}),
    ]
  )
}

export async function upsertConversation({ iglesiaId, personaId = null, phone = '', contactWaId = '', lastDirection = '', metadata = {} }) {
  await ensureWhatsAppSchema()
  const cleanPhone = normalizePhone(phone)
  if (!iglesiaId || !cleanPhone) return null
  return pgOne(
    `INSERT INTO "WhatsAppConversation"
      ("iglesiaId","personaId","contactWaId","phone","lastDirection","lastMessageAt","metadata","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,$6::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("iglesiaId","phone")
     DO UPDATE SET
      "personaId"=COALESCE(EXCLUDED."personaId","WhatsAppConversation"."personaId"),
      "contactWaId"=COALESCE(NULLIF(EXCLUDED."contactWaId",''),"WhatsAppConversation"."contactWaId"),
      "lastDirection"=EXCLUDED."lastDirection",
      "lastMessageAt"=CURRENT_TIMESTAMP,
      "metadata"="WhatsAppConversation"."metadata" || EXCLUDED."metadata",
      "updatedAt"=CURRENT_TIMESTAMP
     RETURNING *`,
    [iglesiaId, personaId, String(contactWaId || ''), cleanPhone, String(lastDirection || ''), JSON.stringify(metadata || {})]
  ).catch(async () => {
    const existing = await pgOne(
      `SELECT * FROM "WhatsAppConversation" WHERE "iglesiaId"=$1 AND "phone"=$2 LIMIT 1`,
      [iglesiaId, cleanPhone]
    )
    if (!existing) return null
    await pgExec(
      `UPDATE "WhatsAppConversation"
          SET "personaId"=COALESCE($1,"personaId"),
              "contactWaId"=COALESCE(NULLIF($2,''),"contactWaId"),
              "lastDirection"=$3,
              "lastMessageAt"=CURRENT_TIMESTAMP,
              "metadata"="metadata" || $4::jsonb,
              "updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=$5`,
      [personaId, String(contactWaId || ''), String(lastDirection || ''), JSON.stringify(metadata || {}), existing.id]
    )
    return pgOne(`SELECT * FROM "WhatsAppConversation" WHERE "id"=$1`, [existing.id])
  })
}

export async function saveWhatsAppLog({
  iglesiaId = null,
  personaId = null,
  userId = null,
  conversationId = null,
  connectionId = null,
  direction = 'outbound',
  messageType = 'text',
  recipientPhone = '',
  templateName = '',
  metaMessageId = '',
  status = 'queued',
  payload = {},
  error = null,
}) {
  await ensureWhatsAppSchema()
  return pgExec(
    `INSERT INTO "WhatsAppLog"
      ("iglesiaId","personaId","userId","conversationId","connectionId","direction","messageType","recipientPhone","templateName","metaMessageId","status","payload","error","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [
      iglesiaId,
      personaId,
      userId,
      conversationId,
      connectionId,
      direction,
      messageType,
      normalizePhone(recipientPhone),
      templateName,
      metaMessageId,
      status,
      JSON.stringify(payload || {}),
      error,
    ]
  )
}

export async function findPersonaByPhone(iglesiaId, phone = '') {
  const cleanPhone = normalizePhone(phone)
  if (!iglesiaId || !cleanPhone) return null
  return pgOne(
    `SELECT * FROM "Persona"
      WHERE "iglesiaId"=$1
        AND regexp_replace(COALESCE("telefono",''), '\\D', '', 'g') = $2
        AND "deletedAt" IS NULL
      LIMIT 1`,
    [iglesiaId, cleanPhone]
  )
}

export function verifyWebhookToken(query = {}, token = DEFAULT_VERIFY_TOKEN) {
  const mode = query['hub.mode']
  const verifyToken = query['hub.verify_token']
  const challenge = query['hub.challenge']
  if (mode === 'subscribe' && token && verifyToken === token) return String(challenge || '')
  return null
}

export async function processWebhookPayload(payload = {}) {
  await ensureWhatsAppSchema()
  const entry = Array.isArray(payload.entry) ? payload.entry : []
  for (const accountEntry of entry) {
    const changes = Array.isArray(accountEntry?.changes) ? accountEntry.changes : []
    for (const change of changes) {
      const value = change?.value || {}
      const metadata = value.metadata || {}
      const phoneNumberId = String(metadata.phone_number_id || '').trim()
      const connection = phoneNumberId
        ? await pgOne(
          `SELECT * FROM "WhatsAppConnection"
            WHERE "phoneNumberId"=$1 AND "deletedAt" IS NULL
            ORDER BY "updatedAt" DESC
            LIMIT 1`,
          [phoneNumberId]
        )
        : null
      const iglesiaId = connection?.iglesiaId || null

      for (const status of value.statuses || []) {
        const recipientPhone = normalizePhone(status.recipient_id || '')
        const conversation = iglesiaId ? await upsertConversation({
          iglesiaId,
          phone: recipientPhone,
          contactWaId: status.recipient_id || '',
          lastDirection: 'outbound',
          metadata: { lastStatus: status.status, metaMessageId: status.id || '' },
        }) : null
        await saveWhatsAppLog({
          iglesiaId,
          conversationId: conversation?.id || null,
          connectionId: connection?.id || null,
          direction: 'status',
          messageType: 'status',
          recipientPhone,
          templateName: '',
          metaMessageId: status.id || '',
          status: status.status || 'delivered',
          payload: status,
        })
      }

      for (const message of value.messages || []) {
        const from = normalizePhone(message.from || '')
        const persona = iglesiaId ? await findPersonaByPhone(iglesiaId, from) : null
        const conversation = iglesiaId ? await upsertConversation({
          iglesiaId,
          personaId: persona?.id || null,
          phone: from,
          contactWaId: message.from || '',
          lastDirection: 'inbound',
          metadata: { lastInboundType: message.type || 'text' },
        }) : null
        await saveWhatsAppLog({
          iglesiaId,
          personaId: persona?.id || null,
          conversationId: conversation?.id || null,
          connectionId: connection?.id || null,
          direction: 'inbound',
          messageType: message.type || 'text',
          recipientPhone: from,
          templateName: '',
          metaMessageId: message.id || '',
          status: 'received',
          payload: message,
        })
      }
    }
  }
}

export async function getWhatsAppDiagnostics(iglesiaId) {
  await ensureWhatsAppSchema()
  const connection = await resolveWhatsAppConnection(iglesiaId)
  const templates = iglesiaId
    ? await pgMany(
      `SELECT "name","language","status","lastSyncedAt"
         FROM "WhatsAppTemplate"
        WHERE "iglesiaId"=$1
        ORDER BY "updatedAt" DESC
        LIMIT 20`,
      [iglesiaId]
    )
    : []
  const recentLogs = iglesiaId
    ? await pgMany(
      `SELECT "direction","messageType","recipientPhone","templateName","status","createdAt","error"
         FROM "WhatsAppLog"
        WHERE "iglesiaId"=$1
        ORDER BY "createdAt" DESC
        LIMIT 20`,
      [iglesiaId]
    )
    : []
  return {
    configured: !!(connection?.phoneNumberId && connection?.accessToken),
    provider: connection?.provider || 'meta_cloud',
    source: connection?.source || 'missing',
    phoneNumberId: connection?.phoneNumberId || '',
    businessAccountId: connection?.businessAccountId || '',
    displayPhoneNumber: connection?.displayPhoneNumber || '',
    verifiedName: connection?.verifiedName || '',
    status: connection?.status || 'missing',
    templates,
    recentLogs,
    env: {
      appId: !!process.env.META_APP_ID,
      appSecret: !!process.env.META_APP_SECRET,
      verifyToken: !!(process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN),
      accessToken: !!(process.env.META_SYSTEM_TOKEN || process.env.META_ACCESS_TOKEN),
      phoneNumberId: !!process.env.META_PHONE_NUMBER_ID,
      wabaId: !!process.env.META_WABA_ID,
    },
  }
}

export async function syncTemplatesFromMeta(iglesiaId) {
  const connection = await resolveWhatsAppConnection(iglesiaId)
  if (!connection?.businessAccountId || !connection?.accessToken) {
    throw new Error('WhatsApp Business Account no configurado para sincronizar templates.')
  }
  const response = await fetch(`${GRAPH_BASE}/${connection.businessAccountId}/message_templates?limit=100`, {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message || `Meta Graph error ${response.status}`)
  const templates = Array.isArray(data.data) ? data.data : []
  for (const template of templates) {
    await saveWhatsAppTemplate(iglesiaId, {
      name: template.name,
      language: template.language,
      category: template.category,
      status: template.status,
      components: template.components || [],
      metadata: template,
    }, connection.id)
  }
  return { ok: true, total: templates.length }
}

export function parseTemplateComponents(body = {}) {
  return safeJsonParse(body.components, body.components || {})
}
