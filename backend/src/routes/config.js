import { Router } from 'express'
import { pgExec, pgMany } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { sendNotificationEmail, systemFrom } from '../lib/email.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const CONTACT_EMAILS = [
  'contacto@churchsystem.com.ar',
  'ventas@churchsystem.com.ar',
  'soporte@churchsystem.com.ar',
  'legal@churchsystem.com.ar',
  'seguridad@churchsystem.com.ar',
]

const ALLOWED = [
  'nombre_iglesia', 'direccion', 'telefono_iglesia', 'email_iglesia', 'pastor_nombre', 'sitio_web',
  'cultos_dias', 'cultos_turnos', 'culto_duracion', 'culto_capacidad',
  'twilio_sid', 'twilio_token', 'twilio_from',
  'anthropic_key', 'openai_key', 'groq_key',
  'ia_proveedor', 'modelo_anthropic', 'modelo_openai', 'modelo_groq',
  'alerta_sin_asistir', 'alerta_sin_seguimiento', 'alerta_visitante', 'alerta_cumple',
  'seg_frecuencia_default',
  'color_primario', 'logo_url', 'modo_oscuro_default',
  'resend_key', 'email_from', 'email_nombre',
  'setup_completado',
  'sesion_horas', 'max_intentos',
]

async function readTenantConfig(iglesiaId) {
  const cfg = {}
  const rows = await pgMany(
    'SELECT "iglesiaId","clave","valor" FROM "Configuracion" WHERE "iglesiaId"=$1 OR "iglesiaId" IS NULL ORDER BY "iglesiaId" NULLS FIRST',
    [iglesiaId]
  )
  for (const r of rows) {
    try {
      cfg[r.clave] = JSON.parse(r.valor)
    } catch {
      cfg[r.clave] = r.valor
    }
  }
  return cfg
}

function emailDiagnostics(cfg = {}) {
  const from = cfg.email_from || process.env.EMAIL_FROM || systemFrom()
  const emailMatch = String(from).match(/<([^>]+)>/) || String(from).match(/([^\s<>]+@[^\s<>]+)/)
  const fromEmail = emailMatch?.[1] || emailMatch?.[0] || ''
  const domain = fromEmail.split('@')[1] || ''
  const expectedDomains = ['churchsystem.com.ar', 'send.churchsystem.com.ar']
  const renderVars = [
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'BASE_URL',
    'FRONTEND_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'APPLE_CLIENT_ID',
    'APPLE_TEAM_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
    'APPLE_REDIRECT_URI',
    'MP_ACCESS_TOKEN',
    'DATABASE_URL',
    'JWT_SECRET',
  ]
  const missing = renderVars.filter(k => !process.env[k])
  const warnings = []
  if (!process.env.RESEND_API_KEY && !cfg.resend_key) warnings.push('Falta RESEND_API_KEY en Render o Resend API Key en Configuracion.')
  if (!fromEmail) warnings.push('Falta EMAIL_FROM con un remitente valido.')
  if (domain && !expectedDomains.includes(domain)) warnings.push(`El remitente usa ${domain}; verificar que ese dominio este validado en Resend.`)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) warnings.push('Google OAuth no tiene todas las variables en Render.')
  if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) warnings.push('Apple Sign-In no tiene todas las variables en Render.')
  if (!process.env.DATABASE_URL) warnings.push('Falta DATABASE_URL en entorno.')
  if (!process.env.JWT_SECRET) warnings.push('Falta JWT_SECRET en entorno.')

  return {
    ok: warnings.length === 0,
    resendConfigured: !!(process.env.RESEND_API_KEY || cfg.resend_key),
    emailFrom: from,
    fromEmail,
    domain,
    domainLooksValid: expectedDomains.includes(domain),
    contactEmails: CONTACT_EMAILS,
    render: {
      requiredVars: renderVars.map(name => ({ name, configured: !!process.env[name] })),
      missing,
    },
    warnings,
    checkedAt: new Date().toISOString(),
  }
}

router.get('/', requireAuth, wrap(async (req, res) => {
  const cfg = await readTenantConfig(req.user.iglesiaId || 0)
  const { twilio_token, anthropic_key, openai_key, groq_key, resend_key, ...safe } = cfg

  return res.json({
    ...safe,
    twilio_configurado: !!cfg.twilio_token,
    email_configurado: !!(cfg.resend_key || process.env.RESEND_API_KEY),
    ia_configurada: !!(cfg.anthropic_key || cfg.openai_key || cfg.groq_key),
    ia_proveedor: cfg.ia_proveedor || 'anthropic',
    anthropic_ok: !!cfg.anthropic_key,
    openai_ok: !!cfg.openai_key,
    groq_ok: !!cfg.groq_key,
  })
}))

router.get('/email-diagnostics', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const cfg = await readTenantConfig(req.user.iglesiaId || 0)
  return res.json(emailDiagnostics(cfg))
}))

router.post('/email-test', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const cfg = await readTenantConfig(req.user.iglesiaId || 0)
  const diag = emailDiagnostics(cfg)
  try {
    const result = await sendNotificationEmail({
      to: req.user.email,
      subject: 'Prueba de email - Church System',
      title: 'Email de prueba',
      intro: 'Si recibiste este mensaje, la salida de emails desde Church System esta funcionando.',
      lines: [
        `Remitente: ${diag.emailFrom}`,
        `Dominio: ${diag.domain || 'sin detectar'}`,
        `Fecha: ${new Date().toISOString()}`,
      ],
    })
    return res.json({ ok: true, result, diagnostics: diag })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, diagnostics: diag })
  }
}))

router.put('/', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const changed = []
  const iglesiaId = req.user.iglesiaId || null
  for (const [key, val] of Object.entries(req.body || {})) {
    if (!ALLOWED.includes(key) || val === '' || val === null || val === undefined) continue
    await pgExec(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("iglesiaId","clave")
       DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
      [iglesiaId, key, String(val)]
    )
    changed.push(key)
  }

  const sync = {
    anthropic_key: 'ANTHROPIC_API_KEY',
    openai_key: 'OPENAI_API_KEY',
    groq_key: 'GROQ_API_KEY',
    twilio_sid: 'TWILIO_ACCOUNT_SID',
    twilio_token: 'TWILIO_AUTH_TOKEN',
    twilio_from: 'TWILIO_WHATSAPP_FROM',
    resend_key: 'RESEND_API_KEY',
    email_from: 'EMAIL_FROM',
  }
  for (const [field, env] of Object.entries(sync)) {
    if (req.body[field]) process.env[env] = req.body[field]
  }

  const critical = changed.filter(k => [
    'resend_key', 'email_from', 'twilio_sid', 'twilio_token', 'twilio_from',
    'anthropic_key', 'openai_key', 'groq_key', 'sesion_horas', 'max_intentos',
  ].includes(k))

  if (critical.length) {
    await sendNotificationEmail({
      to: req.user.email,
      subject: 'Configuracion critica actualizada - Church System',
      title: 'Configuracion critica actualizada',
      intro: 'Se actualizaron campos sensibles de la plataforma.',
      lines: critical.map(k => `Campo: ${k}`),
      actionUrl: `${process.env.FRONTEND_URL || process.env.BASE_URL || 'https://churchsystem.com.ar'}/app/configuracion`,
      actionLabel: 'Revisar configuracion',
    }).catch(() => {})
  }

  return res.json({ ok: true })
}))

export default router
