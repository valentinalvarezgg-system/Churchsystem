import logger from './logger.js'
import { escapeHtml, sendNotificationEmail, sendSystemEmail } from './email.js'

export const CONTACT_MAIL_DOMAIN = 'churchsystem.com.ar'
export const CONTACT_ADMIN_EMAIL = 'admin@churchsystem.com.ar'

const CONTACT_ALIAS_DEFS = [
  { key: 'contacto', label: 'Contacto', publicEmail: `contacto@${CONTACT_MAIL_DOMAIN}`, envKeys: ['CONTACT_EMAIL', 'OWNER_REPORTS_EMAIL', 'SUPPORT_EMAIL'] },
  { key: 'ventas', label: 'Ventas', publicEmail: `ventas@${CONTACT_MAIL_DOMAIN}`, envKeys: ['SALES_EMAIL', 'OWNER_REPORTS_EMAIL'] },
  { key: 'soporte', label: 'Soporte', publicEmail: `soporte@${CONTACT_MAIL_DOMAIN}`, envKeys: ['SUPPORT_EMAIL', 'OWNER_REPORTS_EMAIL'] },
  { key: 'legal', label: 'Legal', publicEmail: `legal@${CONTACT_MAIL_DOMAIN}`, envKeys: ['LEGAL_EMAIL', 'OWNER_REPORTS_EMAIL'] },
  { key: 'seguridad', label: 'Seguridad', publicEmail: `seguridad@${CONTACT_MAIL_DOMAIN}`, envKeys: ['SECURITY_EMAIL', 'OWNER_REPORTS_EMAIL', 'SUPPORT_EMAIL'] },
]

const CONTACT_ALIAS_MAP = new Map(CONTACT_ALIAS_DEFS.map(alias => [alias.key, alias]))
const EXTRA_LOCAL_PARTS = {
  bugs: 'soporte',
  noreply: 'contacto',
  partners: 'ventas',
  privacidad: 'legal',
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase()
}

function extractEmailAddress(value = '') {
  const clean = normalizeEmail(value)
  if (!clean) return ''
  const withBrackets = clean.includes('<') ? clean.split('<').pop()?.replace('>', '') : clean
  return String(withBrackets || '').split(',')[0].trim()
}

function firstConfiguredEnv(keys = []) {
  for (const key of keys) {
    const value = normalizeEmail(process.env[key])
    if (value) return { key, value }
  }
  return null
}

export function getAdminContactEmail() {
  return firstConfiguredEnv(['ADMIN_CONTACT_EMAIL'])?.value || CONTACT_ADMIN_EMAIL
}

export function getPublicContactEmail(aliasKey = 'contacto') {
  return CONTACT_ALIAS_MAP.get(aliasKey)?.publicEmail || getAdminContactEmail()
}

export function resolveContactMailbox(aliasLike = 'contacto') {
  const raw = extractEmailAddress(aliasLike) || normalizeEmail(aliasLike)
  const localPart = raw.includes('@') ? raw.split('@')[0] : raw
  const aliasKey = EXTRA_LOCAL_PARTS[localPart] || (CONTACT_ALIAS_MAP.has(localPart) ? localPart : 'contacto')
  const alias = CONTACT_ALIAS_MAP.get(aliasKey)
  const configured = firstConfiguredEnv(alias.envKeys)
  const fallbackEmail = getAdminContactEmail()
  const targetEmail = configured?.value || fallbackEmail
  return {
    key: alias.key,
    label: alias.label,
    localPart: alias.key,
    publicEmail: alias.publicEmail,
    targetEmail,
    fallbackEmail,
    usingFallback: !configured,
    resolvedFrom: configured?.key || 'ADMIN_CONTACT_EMAIL',
    envConfigured: !!configured,
  }
}

export function getContactMailStatus() {
  const aliases = CONTACT_ALIAS_DEFS.map(alias => resolveContactMailbox(alias.key))
  return {
    provider: {
      resendConfigured: !!process.env.RESEND_API_KEY,
      googleWorkspaceMode: 'alias-forwarding',
      inboundSecretConfigured: !!process.env.RESEND_INBOUND_SECRET,
    },
    adminFallbackEmail: getAdminContactEmail(),
    aliases,
    recommendedNextStep: aliases.some(alias => alias.usingFallback)
      ? 'Configurar aliases o forwards reales en Google Workspace. Mientras tanto, todo cae en admin@churchsystem.com.ar.'
      : 'Aliases operativos. El fallback a admin queda como red de seguridad.',
    checkedAt: new Date().toISOString(),
  }
}

export function getContactMailRecipients(keys = []) {
  const unique = new Set()
  for (const key of keys) {
    const mailbox = resolveContactMailbox(key)
    if (mailbox.targetEmail) unique.add(mailbox.targetEmail)
  }
  return [...unique]
}

export async function routeInboundContactEmail(payload = {}, options = {}) {
  const from = String(payload.from || payload.sender || '').trim()
  const to = extractEmailAddress(payload.to || payload.recipient || '')
  const subject = String(payload.subject || '(sin asunto)')
  const text = String(payload.text || payload.text_body || '')
  const html = String(payload.html || payload.html_body || '')
  const localPart = normalizeEmail(to.includes('@') ? to.split('@')[0] : to)
  const mailbox = resolveContactMailbox(localPart || 'contacto')

  if (!mailbox.targetEmail) {
    logger.warn({ to, localPart }, 'Inbound email dropped: no destination configured')
    return { ok: true, dropped: true, reason: 'destination_not_configured' }
  }

  const safeText = escapeHtml(text.slice(0, 6000))
  const safeHtml = html ? html.slice(0, 12000) : ''
  const finalHtml = `<!doctype html>
  <html><body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:18px;color:#0f172a">
    <h2 style="margin:0 0 12px">${options.isSmoke ? 'Smoke test inbound' : 'Inbound'} @churchsystem.com.ar</h2>
    <p><b>Alias:</b> ${escapeHtml(mailbox.publicEmail)}</p>
    <p><b>To:</b> ${escapeHtml(to || mailbox.publicEmail)}</p>
    <p><b>From:</b> ${escapeHtml(from || '(sin remitente)')}</p>
    <p><b>Subject:</b> ${escapeHtml(subject)}</p>
    <hr style="margin:14px 0;border:none;border-top:1px solid #e2e8f0"/>
    ${safeHtml || `<pre style="white-space:pre-wrap;line-height:1.5">${safeText || '(sin contenido)'}</pre>`}
  </body></html>`

  const result = await sendSystemEmail({
    to: mailbox.targetEmail,
    subject: `[Inbound:${mailbox.key}] ${subject}`,
    html: finalHtml,
    text: `Alias: ${mailbox.publicEmail}\nTo: ${to || mailbox.publicEmail}\nFrom: ${from}\nSubject: ${subject}\n\n${text}`.slice(0, 12000),
  })

  logger.info(
    { to, from, localPart: mailbox.key, destination: mailbox.targetEmail, smoke: !!options.isSmoke },
    'Inbound email processed'
  )
  return {
    ok: true,
    mailbox: mailbox.key,
    publicEmail: mailbox.publicEmail,
    routedTo: mailbox.targetEmail,
    usingFallback: mailbox.usingFallback,
    result,
  }
}

export async function runContactMailSmoke({ mode = 'outbound', alias = 'soporte', actorEmail = '', source = 'ui' } = {}) {
  const mailbox = resolveContactMailbox(alias)
  const timestamp = new Date().toISOString()

  if (mode === 'inbound') {
    return routeInboundContactEmail({
      from: actorEmail || 'qa-smoke@external.test',
      to: mailbox.publicEmail,
      subject: `[SMOKE][Inbound] ${mailbox.label} ${timestamp}`,
      text: [
        `Smoke source: ${source}`,
        `Alias publico: ${mailbox.publicEmail}`,
        `Destino real: ${mailbox.targetEmail}`,
        `Fallback admin activo: ${mailbox.usingFallback ? 'si' : 'no'}`,
      ].join('\n'),
    }, { isSmoke: true })
  }

  const result = await sendNotificationEmail({
    to: mailbox.targetEmail,
    subject: `[SMOKE][Outbound] ${mailbox.label} - Church System`,
    title: `Smoke outbound ${mailbox.label}`,
    intro: 'Este correo verifica la ruta de salida del stack Resend + Google Workspace.',
    lines: [
      `Alias publico: ${mailbox.publicEmail}`,
      `Destino real: ${mailbox.targetEmail}`,
      `Fallback admin activo: ${mailbox.usingFallback ? 'si' : 'no'}`,
      `Disparado por: ${actorEmail || 'system'}`,
      `Origen: ${source}`,
      `Fecha: ${timestamp}`,
    ],
  })

  return {
    ok: true,
    mailbox: mailbox.key,
    publicEmail: mailbox.publicEmail,
    routedTo: mailbox.targetEmail,
    usingFallback: mailbox.usingFallback,
    result,
  }
}
