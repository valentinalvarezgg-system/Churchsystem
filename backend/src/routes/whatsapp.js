import { Router } from 'express'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import {
  ensureWhatsAppSchema,
  getWhatsAppDiagnostics,
  parseTemplateComponents,
  processWebhookPayload,
  resolveWhatsAppConnection,
  saveWhatsAppTemplate,
  sendWhatsAppTemplate,
  syncTemplatesFromMeta,
  upsertWhatsAppConnection,
  verifyWebhookToken,
} from '../services/whatsapp.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/webhook', async (req, res) => {
  const token = String(req.query.iglesiaId || '').trim()
    ? (await resolveWhatsAppConnection(Number(req.query.iglesiaId)).catch(() => null))?.verifyToken
    : process.env.META_VERIFY_TOKEN
  const challenge = verifyWebhookToken(req.query, token || process.env.META_VERIFY_TOKEN || '')
  if (challenge) return res.status(200).send(challenge)
  return res.sendStatus(403)
})

router.post('/webhook', async (req, res) => {
  res.sendStatus(200)
  await processWebhookPayload(req.body || {})
})

router.get('/diagnostics', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const diagnostics = await getWhatsAppDiagnostics(req.user.iglesiaId)
  return res.json({ ok: true, ...diagnostics })
}))

router.post('/connection', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  await ensureWhatsAppSchema()
  const connection = await upsertWhatsAppConnection(req.user.iglesiaId, req.body || {})
  return res.status(201).json({ ok: true, connection })
}))

router.post('/templates', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  await ensureWhatsAppSchema()
  const connection = await resolveWhatsAppConnection(req.user.iglesiaId)
  const template = await saveWhatsAppTemplate(req.user.iglesiaId, {
    name: req.body?.name,
    language: req.body?.language || 'es',
    category: req.body?.category || '',
    status: req.body?.status || 'draft',
    components: req.body?.components || [],
    metadata: req.body?.metadata || {},
  }, connection?.id || null)
  return res.status(201).json({ ok: true, template })
}))

router.post('/templates/sync', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const result = await syncTemplatesFromMeta(req.user.iglesiaId)
  return res.json(result)
}))

router.post('/send-template', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const { to, personaId = null, templateName, languageCode = 'es' } = req.body || {}
  if (!to || !templateName) {
    return res.status(400).json({ error: 'to y templateName son requeridos.' })
  }
  const result = await sendWhatsAppTemplate({
    iglesiaId: req.user.iglesiaId,
    personaId: personaId ? Number(personaId) : null,
    userId: req.user.id,
    to,
    templateName,
    languageCode,
    components: parseTemplateComponents(req.body || {}),
  })
  return res.json(result)
}))

export default router
