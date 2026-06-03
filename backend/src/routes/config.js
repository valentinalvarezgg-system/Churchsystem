import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { pgExec } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { sendNotificationEmail, systemFrom } from '../lib/email.js'
import { buildGoogleDriveAuthUrl } from '../lib/google-drive.js'
import { readTenantConfig } from '../lib/tenant-config.js'

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
  'wa_provider', 'wa_phone_number_id', 'wa_business_account_id', 'wa_access_token', 'wa_verify_token', 'wa_status', 'wa_display_phone_number', 'wa_verified_name',
  'google_drive_refresh_token', 'google_drive_access_token', 'google_drive_token_expires_at', 'google_drive_email', 'google_drive_status', 'google_drive_scopes', 'google_drive_connected_at',
  'anthropic_key', 'openai_key', 'groq_key',
  'ia_proveedor', 'modelo_anthropic', 'modelo_openai', 'modelo_groq',
  'alerta_sin_asistir', 'alerta_sin_seguimiento', 'alerta_visitante', 'alerta_cumple',
  'seg_frecuencia_default',
  'color_primario', 'logo_url', 'modo_oscuro_default',
  'resend_key', 'email_from', 'email_nombre',
  'setup_completado',
  'sesion_horas', 'max_intentos',
]

function emailDiagnostics(cfg = {}) {
  const from = cfg.email_from || process.env.EMAIL_FROM || systemFrom()
  const emailMatch = String(from).match(/<([^>]+)>/) || String(from).match(/([^\s<>]+@[^\s<>]+)/)
  const fromEmail = emailMatch?.[1] || emailMatch?.[0] || ''
  const domain = fromEmail.split('@')[1] || ''
  const expectedDomains = ['churchsystem.com.ar', 'send.churchsystem.com.ar']
  const renderVars = [
    'RESEND_API_KEY',
    'RESEND_INBOUND_SECRET',
    'OWNER_REPORTS_EMAIL',
    'SUPPORT_EMAIL',
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
    'META_APP_ID',
    'META_APP_SECRET',
    'META_API_VERSION',
    'META_SYSTEM_TOKEN',
    'META_VERIFY_TOKEN',
    'META_WEBHOOK_VERIFY_TOKEN',
    'META_ACCESS_TOKEN',
    'META_PHONE_NUMBER_ID',
    'META_WABA_ID',
    'META_EMBEDDED_SIGNUP_CONFIG_ID',
    'META_REDIRECT_URI',
  ]
  const missing = renderVars.filter(k => !process.env[k])
  const warnings = []
  if (!process.env.RESEND_API_KEY && !cfg.resend_key) warnings.push('Falta RESEND_API_KEY en Render o Resend API Key en Configuracion.')
  if (!process.env.RESEND_INBOUND_SECRET) warnings.push('Falta RESEND_INBOUND_SECRET para recibir emails inbound de Resend.')
  if (!fromEmail) warnings.push('Falta EMAIL_FROM con un remitente valido.')
  if (domain && !expectedDomains.includes(domain)) warnings.push(`El remitente usa ${domain}; verificar que ese dominio este validado en Resend.`)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) warnings.push('Google OAuth no tiene todas las variables en Render.')
  if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) warnings.push('Apple Sign-In no tiene todas las variables en Render.')
  if (!process.env.DATABASE_URL) warnings.push('Falta DATABASE_URL en entorno.')
  if (!process.env.JWT_SECRET) warnings.push('Falta JWT_SECRET en entorno.')
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) warnings.push('Meta App ID/Secret incompletos para WhatsApp Cloud API.')
  if (!(process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN)) warnings.push('Falta META_WEBHOOK_VERIFY_TOKEN para validar webhook de WhatsApp.')

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

function commercialDiagnostics(cfg = {}) {
  const mpConfigured = !!process.env.MP_ACCESS_TOKEN
  const publicUrlRaw = String(process.env.PUBLIC_URL || '').trim()
  const frontUrlRaw = String(process.env.FRONTEND_URL || '').trim()
  const baseUrlRaw = String(process.env.BASE_URL || '').trim()
  const oauthGoogleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const oauthAppleConfigured = !!(
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  )
  const mpCurrency = String(cfg.divisa || cfg.currency || cfg.pais || 'ARS').toUpperCase()
  const promoCode = String(cfg.promoCode || '').trim().toUpperCase()
  const baseUrl = String(process.env.BASE_URL || '').trim()
  const expectedGoogleCallback = baseUrl ? `${baseUrl}/oauth/google/callback` : ''
  const expectedAppleCallback = String(process.env.APPLE_REDIRECT_URI || '').trim() || (baseUrl ? `${baseUrl}/oauth/apple/callback` : '')
  const checks = [
    { key: 'mp_access_token', ok: mpConfigured, detail: mpConfigured ? 'Configurado' : 'Falta MP_ACCESS_TOKEN' },
    { key: 'public_url', ok: !!publicUrlRaw, detail: publicUrlRaw || 'Falta PUBLIC_URL' },
    { key: 'frontend_url', ok: !!frontUrlRaw, detail: frontUrlRaw || 'Falta FRONTEND_URL' },
    { key: 'base_url', ok: !!baseUrlRaw, detail: baseUrlRaw || 'Falta BASE_URL' },
    { key: 'google_oauth', ok: oauthGoogleConfigured, detail: oauthGoogleConfigured ? 'Google OAuth OK' : 'Google OAuth incompleto' },
    { key: 'apple_oauth', ok: oauthAppleConfigured, detail: oauthAppleConfigured ? 'Apple Sign-In OK' : 'Apple Sign-In incompleto' },
    { key: 'email_sender', ok: !!(cfg.resend_key || process.env.RESEND_API_KEY), detail: cfg.resend_key || process.env.RESEND_API_KEY ? 'Email saliente OK' : 'Email saliente incompleto' },
    {
      key: 'whatsapp_cloud',
      ok: !!(
        cfg.wa_phone_number_id ||
        process.env.META_PHONE_NUMBER_ID
      ) && !!(
        cfg.wa_access_token ||
        process.env.META_SYSTEM_TOKEN ||
        process.env.META_ACCESS_TOKEN
      ),
      detail: (cfg.wa_phone_number_id || process.env.META_PHONE_NUMBER_ID)
        ? 'WhatsApp Cloud preparado'
        : 'WhatsApp Cloud sin numero conectado',
    },
    {
      key: 'google_drive',
      ok: !!cfg.google_drive_refresh_token || String(cfg.google_drive_status || '').toLowerCase() === 'connected',
      detail: cfg.google_drive_email
        ? `Drive conectado: ${cfg.google_drive_email}`
        : 'Google Drive sin conectar',
    },
  ]
  return {
    ok: checks.every(c => c.ok),
    checks,
    billing: {
      currentPlan: cfg.plan || 'STARTER',
      pendingPlan: cfg.plan_pendiente || '',
      suscripcionActiva: cfg.suscripcion_activa === '1',
      suscripcionVence: cfg.suscripcion_vence || '',
      trialFin: cfg.trial_fin || '',
      currencyHint: mpCurrency,
      promoCode: promoCode || null,
    },
    oauth: {
      expectedGoogleCallback,
      expectedAppleCallback,
      frontLoginUrl: frontUrlRaw ? `${frontUrlRaw}/app/login` : '',
    },
    whatsapp: {
      provider: cfg.wa_provider || 'meta_cloud',
      phoneNumberId: cfg.wa_phone_number_id || process.env.META_PHONE_NUMBER_ID || '',
      businessAccountId: cfg.wa_business_account_id || process.env.META_WABA_ID || '',
      webhookVerifyTokenConfigured: !!(cfg.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN),
    },
    checkedAt: new Date().toISOString(),
  }
}

function launchReadiness(cfg = {}) {
  const commercial = commercialDiagnostics(cfg)
  const email = emailDiagnostics(cfg)
  const checks = [
    { key: 'jwt_secret', ok: !!process.env.JWT_SECRET, detail: process.env.JWT_SECRET ? 'JWT_SECRET configurado' : 'Falta JWT_SECRET' },
    { key: 'database_url', ok: String(process.env.DATABASE_URL || '').includes('sslmode=require'), detail: process.env.DATABASE_URL ? 'DATABASE_URL configurado' : 'Falta DATABASE_URL' },
    { key: 'backend_url', ok: !!process.env.BASE_URL, detail: process.env.BASE_URL || 'Falta BASE_URL' },
    { key: 'frontend_url', ok: !!process.env.FRONTEND_URL, detail: process.env.FRONTEND_URL || 'Falta FRONTEND_URL' },
    { key: 'commercial', ok: commercial.ok, detail: commercial.ok ? 'Cobro y OAuth OK' : 'Cobro/OAuth incompleto' },
    { key: 'email', ok: email.ok, detail: email.ok ? 'Email saliente OK' : 'Email saliente incompleto' },
  ]
  const passed = checks.filter(c => c.ok).length
  return {
    ok: checks.every(c => c.ok),
    score: `${passed}/${checks.length}`,
    checks,
    checkedAt: new Date().toISOString(),
  }
}

router.post('/google-drive/connect-url', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const base = String(process.env.BASE_URL || process.env.FRONTEND_URL || '').trim().replace(/\/$/, '')
  const front = String(process.env.FRONTEND_URL || process.env.BASE_URL || '').trim().replace(/\/$/, '')
  const state = jwt.sign({
    purpose: 'google-drive-connect',
    iglesiaId: req.user.iglesiaId || null,
    userId: req.user.id || null,
    frontUrl: front,
  }, process.env.JWT_SECRET, { expiresIn: '10m' })

  const url = buildGoogleDriveAuthUrl({ state, baseUrl: base })
  if (!url) return res.status(500).json({ error: 'Google Drive no está configurado' })
  return res.json({ ok: true, url })
}))

router.get('/', requireAuth, wrap(async (req, res) => {
  const cfg = await readTenantConfig(req.user.iglesiaId || 0)
  const {
    twilio_token,
    anthropic_key,
    openai_key,
    groq_key,
    resend_key,
    google_drive_refresh_token,
    google_drive_access_token,
    google_drive_token_expires_at,
    ...safe
  } = cfg

  return res.json({
    ...safe,
    twilio_configurado: !!cfg.twilio_token,
    whatsapp_cloud_configurado: !!(cfg.wa_phone_number_id || process.env.META_PHONE_NUMBER_ID) && !!(cfg.wa_access_token || process.env.META_SYSTEM_TOKEN || process.env.META_ACCESS_TOKEN),
    email_configurado: !!(cfg.resend_key || process.env.RESEND_API_KEY),
    ia_configurada: !!(cfg.anthropic_key || cfg.openai_key || cfg.groq_key),
    ia_proveedor: cfg.ia_proveedor || 'anthropic',
    anthropic_ok: !!cfg.anthropic_key,
    openai_ok: !!cfg.openai_key,
    groq_ok: !!cfg.groq_key,
    google_drive_configurado: !!(cfg.google_drive_refresh_token || String(cfg.google_drive_status || '').toLowerCase() === 'connected'),
    google_drive_status: cfg.google_drive_status || 'disconnected',
    google_drive_email: cfg.google_drive_email || '',
    google_drive_connected_at: cfg.google_drive_connected_at || '',
  })
}))

router.get('/email-diagnostics', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const cfg = await readTenantConfig(req.user.iglesiaId || 0)
  return res.json(emailDiagnostics(cfg))
}))

router.get('/commercial-diagnostics', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const cfg = await readTenantConfig(req.user.iglesiaId || 0)
  return res.json(commercialDiagnostics(cfg))
}))

router.get('/launch-readiness', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const cfg = await readTenantConfig(req.user.iglesiaId || 0)
  return res.json(launchReadiness(cfg))
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
    wa_access_token: 'META_SYSTEM_TOKEN',
    wa_verify_token: 'META_WEBHOOK_VERIFY_TOKEN',
    wa_phone_number_id: 'META_PHONE_NUMBER_ID',
    wa_business_account_id: 'META_WABA_ID',
    resend_key: 'RESEND_API_KEY',
    email_from: 'EMAIL_FROM',
  }
  for (const [field, env] of Object.entries(sync)) {
    if (req.body[field]) process.env[env] = req.body[field]
  }
  if (req.body.wa_access_token) process.env.META_ACCESS_TOKEN = req.body.wa_access_token
  if (req.body.wa_verify_token) process.env.META_VERIFY_TOKEN = req.body.wa_verify_token

  const critical = changed.filter(k => [
    'resend_key', 'email_from', 'twilio_sid', 'twilio_token', 'twilio_from',
    'wa_access_token', 'wa_verify_token', 'wa_phone_number_id', 'wa_business_account_id',
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
