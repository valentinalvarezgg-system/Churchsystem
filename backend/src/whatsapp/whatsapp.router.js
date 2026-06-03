import { Router } from 'express'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import {
  ensureWhatsAppSchema,
  getMetaAppConfig,
  getWhatsAppDiagnostics,
  onboardChurchWhatsAppConnection,
  parseTemplateComponents,
  processWebhookPayload,
  resolveScopedWhatsAppConnection,
  resolveWhatsAppConnection,
  sendScopedWhatsAppTemplate,
  sendScopedWhatsAppText,
  syncTemplatesFromMeta,
  upsertWhatsAppConnection,
} from './whatsapp.service.js'
import { TEMPLATES, reunionRecordatorioComponents } from './whatsapp.templates.js'
import { verifyWebhookSignature, verifyWebhookToken } from './whatsapp.webhook.js'
import { saveWhatsAppTemplate } from '../services/whatsapp.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function requireChurchScopeAccess(req, res, next) {
  if (req.user?.rol === 'GODMODE') return next()
  if (req.user?.rol !== 'PASTOR_GENERAL') {
    return res.status(403).json({ error: 'Permisos insuficientes para WhatsApp.' })
  }
  const targetIglesiaId = Number(req.params.iglesiaId || 0)
  if (!targetIglesiaId || targetIglesiaId !== Number(req.user?.iglesiaId || 0)) {
    return res.status(403).json({ error: 'No podés operar el WhatsApp de otra iglesia.' })
  }
  return next()
}

function resolveWebhookTokenForRequest(req) {
  const iglesiaId = Number(req.query.iglesiaId || 0)
  if (iglesiaId > 0) {
    return resolveWhatsAppConnection(iglesiaId)
      .then(connection => connection?.verifyToken || getMetaAppConfig().verifyToken)
      .catch(() => getMetaAppConfig().verifyToken)
  }
  return Promise.resolve(getMetaAppConfig().verifyToken)
}

router.get('/webhook', wrap(async (req, res) => {
  const expectedToken = await resolveWebhookTokenForRequest(req)
  const challenge = verifyWebhookToken(req.query, expectedToken)
  if (challenge) return res.status(200).send(challenge)
  return res.sendStatus(403)
}))

router.post('/webhook', wrap(async (req, res) => {
  const signature = req.headers['x-hub-signature-256']
  const valid = verifyWebhookSignature(req.rawBody, String(signature || ''))
  if (!valid) return res.status(403).json({ error: 'Firma de webhook inválida.' })
  res.sendStatus(200)
  await processWebhookPayload(req.body || {})
}))

router.get('/meta/config', requireAuth, requireRol('GODMODE', 'PASTOR_GENERAL'), wrap(async (req, res) => {
  const env = getMetaAppConfig()
  return res.json({
    ok: true,
    apiVersion: env.apiVersion,
    appIdConfigured: !!env.appId,
    appSecretConfigured: !!env.appSecret,
    embeddedSignupConfigId: env.embeddedSignupConfigId || '',
    webhookVerifyTokenConfigured: !!env.verifyToken,
    systemNumberConfigured: !!(env.systemToken && env.phoneNumberId),
  })
}))

router.get('/diagnostics', requireAuth, requireRol('PASTOR_GENERAL', 'GODMODE'), wrap(async (req, res) => {
  const targetIglesiaId = req.user?.rol === 'GODMODE'
    ? Number(req.query.iglesiaId || 0)
    : Number(req.user?.iglesiaId || 0)
  const diagnostics = await getWhatsAppDiagnostics(targetIglesiaId || null)
  return res.json({ ok: true, ...diagnostics })
}))

router.post('/connection', requireAuth, requireRol('PASTOR_GENERAL', 'GODMODE'), wrap(async (req, res) => {
  await ensureWhatsAppSchema()
  const targetIglesiaId = req.user?.rol === 'GODMODE'
    ? Number(req.body?.iglesiaId || req.query.iglesiaId || req.user?.iglesiaId || 0)
    : Number(req.user?.iglesiaId || 0)
  const connection = await upsertWhatsAppConnection(targetIglesiaId, req.body || {})
  return res.status(201).json({ ok: true, connection })
}))

router.post('/templates', requireAuth, requireRol('PASTOR_GENERAL', 'GODMODE'), wrap(async (req, res) => {
  await ensureWhatsAppSchema()
  const targetIglesiaId = req.user?.rol === 'GODMODE'
    ? Number(req.body?.iglesiaId || req.query.iglesiaId || req.user?.iglesiaId || 0)
    : Number(req.user?.iglesiaId || 0)
  const connection = await resolveWhatsAppConnection(targetIglesiaId)
  const template = await saveWhatsAppTemplate(targetIglesiaId, {
    name: req.body?.name,
    language: req.body?.language || 'es',
    category: req.body?.category || '',
    status: req.body?.status || 'draft',
    components: req.body?.components || [],
    metadata: req.body?.metadata || {},
  }, connection?.id || null)
  return res.status(201).json({ ok: true, template })
}))

router.post('/templates/sync', requireAuth, requireRol('PASTOR_GENERAL', 'GODMODE'), wrap(async (req, res) => {
  const targetIglesiaId = req.user?.rol === 'GODMODE'
    ? Number(req.body?.iglesiaId || req.query.iglesiaId || req.user?.iglesiaId || 0)
    : Number(req.user?.iglesiaId || 0)
  const result = await syncTemplatesFromMeta(targetIglesiaId)
  return res.json(result)
}))

router.post('/send-template', requireAuth, requireRol('PASTOR_GENERAL', 'GODMODE'), wrap(async (req, res) => {
  const { to, personaId = null, templateName, languageCode = 'es' } = req.body || {}
  const targetIglesiaId = req.user?.rol === 'GODMODE'
    ? Number(req.body?.iglesiaId || req.query.iglesiaId || req.user?.iglesiaId || 0)
    : Number(req.user?.iglesiaId || 0)
  if (!to || !templateName) {
    return res.status(400).json({ error: 'to y templateName son requeridos.' })
  }
  const result = await sendScopedWhatsAppTemplate({
    scope: targetIglesiaId ? 'iglesia' : 'churchsystem',
    iglesiaId: targetIglesiaId || null,
    personaId: personaId ? Number(personaId) : null,
    userId: req.user.id,
    to,
    templateName,
    languageCode,
    components: parseTemplateComponents(req.body || {}),
  })
  return res.json(result)
}))

router.post('/churchsystem/send', requireAuth, requireRol('GODMODE'), wrap(async (req, res) => {
  const { to, text } = req.body || {}
  if (!to || !text) return res.status(400).json({ error: 'to y text son requeridos.' })
  const connection = await resolveScopedWhatsAppConnection({ scope: 'churchsystem' })
  if (!connection?.phoneNumberId || !connection?.accessToken) {
    return res.status(400).json({ error: 'WhatsApp de Church System no configurado.' })
  }
  const result = await sendScopedWhatsAppText({
    scope: 'churchsystem',
    userId: req.user.id,
    to,
    text,
  })
  return res.json({ ok: true, scope: 'churchsystem', result })
}))

router.post('/churchsystem/recordatorio-reunion', requireAuth, requireRol('GODMODE'), wrap(async (req, res) => {
  const { to, ...datos } = req.body || {}
  if (!to) return res.status(400).json({ error: 'to es requerido.' })
  const result = await sendScopedWhatsAppTemplate({
    scope: 'churchsystem',
    userId: req.user.id,
    to,
    templateName: TEMPLATES.REUNION_RECORDATORIO,
    languageCode: req.body?.languageCode || 'es',
    components: reunionRecordatorioComponents(datos),
  })
  return res.json({ ok: true, scope: 'churchsystem', result })
}))

router.post('/iglesia/:iglesiaId/send', requireAuth, requireChurchScopeAccess, wrap(async (req, res) => {
  const { to, text, personaId = null } = req.body || {}
  const iglesiaId = Number(req.params.iglesiaId || 0)
  if (!iglesiaId || !to || !text) return res.status(400).json({ error: 'iglesiaId, to y text son requeridos.' })
  const connection = await resolveScopedWhatsAppConnection({ scope: 'iglesia', iglesiaId })
  if (!connection?.phoneNumberId || !connection?.accessToken) {
    return res.status(400).json({ error: 'WhatsApp de la iglesia no configurado.' })
  }
  const result = await sendScopedWhatsAppText({
    scope: 'iglesia',
    iglesiaId,
    personaId: personaId ? Number(personaId) : null,
    userId: req.user.id,
    to,
    text,
  })
  return res.json({ ok: true, scope: 'iglesia', iglesiaId, result })
}))

router.post('/iglesia/:iglesiaId/recordatorio-reunion', requireAuth, requireChurchScopeAccess, wrap(async (req, res) => {
  const iglesiaId = Number(req.params.iglesiaId || 0)
  const { to, personaId = null, ...datos } = req.body || {}
  if (!iglesiaId || !to) return res.status(400).json({ error: 'iglesiaId y to son requeridos.' })
  const result = await sendScopedWhatsAppTemplate({
    scope: 'iglesia',
    iglesiaId,
    personaId: personaId ? Number(personaId) : null,
    userId: req.user.id,
    to,
    templateName: TEMPLATES.REUNION_RECORDATORIO,
    languageCode: req.body?.languageCode || 'es',
    components: reunionRecordatorioComponents(datos),
  })
  return res.json({ ok: true, scope: 'iglesia', iglesiaId, result })
}))

router.post('/onboard-iglesia', requireAuth, requireRol('PASTOR_GENERAL', 'GODMODE'), wrap(async (req, res) => {
  const iglesiaId = req.user?.rol === 'GODMODE'
    ? Number(req.body?.iglesiaId || req.query.iglesiaId || 0)
    : Number(req.user?.iglesiaId || 0)
  const result = await onboardChurchWhatsAppConnection({
    iglesiaId,
    code: req.body?.code,
    redirectUri: req.body?.redirectUri || '',
    wabaId: req.body?.wabaId || req.body?.businessAccountId || '',
    phoneNumberId: req.body?.phoneNumberId || '',
    displayPhoneNumber: req.body?.displayPhoneNumber || '',
    verifiedName: req.body?.verifiedName || '',
    verifyToken: req.body?.verifyToken || '',
    metadata: req.body?.metadata || {},
  })
  return res.status(201).json(result)
}))

export default router
