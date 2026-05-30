import { Router } from 'express'
import crypto from 'crypto'
import logger from '../lib/logger.js'
import { sendSystemEmail, escapeHtml } from '../lib/email.js'

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

function getOwnerInbox() {
  return String(process.env.OWNER_REPORTS_EMAIL || '').trim().toLowerCase()
}

function getSupportInbox() {
  return String(process.env.SUPPORT_EMAIL || 'soporte@churchsystem.com.ar').trim().toLowerCase()
}

function resolveDestination(localPart = '') {
  const owner = getOwnerInbox()
  const support = getSupportInbox()
  const map = {
    contacto: owner || support,
    ventas: owner || support,
    soporte: support || owner,
    legal: owner || support,
    noreply: owner || support,
    bugs: owner || support,
    partners: owner || support,
  }
  return map[localPart] || owner || support
}

function extractLocalPart(to = '') {
  const clean = String(to || '').trim().toLowerCase()
  const email = clean.includes('<') ? clean.split('<').pop()?.replace('>', '') : clean
  return String(email || '').split('@')[0] || ''
}

router.post('/resend/inbound', async (req, res) => {
  if (!isAuthorizedInbound(req)) return res.status(401).json({ ok: false, error: 'Unauthorized inbound webhook' })

  const payload = req.body || {}
  const from = String(payload.from || payload.sender || '').trim()
  const to = String(payload.to || payload.recipient || '').trim().toLowerCase()
  const subject = String(payload.subject || '(sin asunto)')
  const text = String(payload.text || payload.text_body || '')
  const html = String(payload.html || payload.html_body || '')
  const localPart = extractLocalPart(to)
  const destination = resolveDestination(localPart)

  if (!destination) {
    logger.warn({ to, localPart }, 'Inbound email dropped: no destination configured')
    return res.json({ ok: true, dropped: true, reason: 'destination_not_configured' })
  }

  const safeText = escapeHtml(text.slice(0, 6000))
  const safeHtml = html ? html.slice(0, 12000) : ''
  const finalHtml = `<!doctype html>
  <html><body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:18px;color:#0f172a">
    <h2 style="margin:0 0 12px">Inbound @churchsystem.com.ar</h2>
    <p><b>To:</b> ${escapeHtml(to)}</p>
    <p><b>From:</b> ${escapeHtml(from || '(sin remitente)')}</p>
    <p><b>Subject:</b> ${escapeHtml(subject)}</p>
    <hr style="margin:14px 0;border:none;border-top:1px solid #e2e8f0"/>
    ${safeHtml || `<pre style="white-space:pre-wrap;line-height:1.5">${safeText || '(sin contenido)'}</pre>`}
  </body></html>`

  await sendSystemEmail({
    to: destination,
    subject: `[Inbound:${localPart || 'general'}] ${subject}`,
    html: finalHtml,
    text: `To: ${to}\nFrom: ${from}\nSubject: ${subject}\n\n${text}`.slice(0, 12000),
  })

  logger.info({ to, from, localPart, destination }, 'Inbound email processed')
  return res.json({ ok: true, routedTo: destination, mailbox: localPart || 'general' })
})

export default router
