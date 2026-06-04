import { Router } from 'express'
import crypto from 'crypto'
import { routeInboundContactEmail } from '../lib/contact-mail.js'

const router = Router()

function parseInboundSecret(req) {
  return String(
    req.headers['x-churchsystem-inbound-secret']
      || req.query?.secret
      || req.body?.secret
      || ''
  ).trim()
}

function expectedInboundSecret() {
  return String(process.env.RESEND_INBOUND_SECRET || '').trim()
}

function isAuthorizedInbound(req) {
  const expected = expectedInboundSecret()
  if (!expected) return false
  const got = parseInboundSecret(req)
  if (!got) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))
  } catch {
    return false
  }
}

router.post('/resend/inbound', async (req, res) => {
  if (!isAuthorizedInbound(req)) return res.status(401).json({ ok: false, error: 'Unauthorized inbound webhook' })
  const result = await routeInboundContactEmail(req.body || {}, { source: 'resend-webhook' })
  return res.json(result)
})

export default router
