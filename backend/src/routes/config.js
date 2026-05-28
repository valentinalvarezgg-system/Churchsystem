import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { sendNotificationEmail, systemFrom } from '../lib/email.js'

const router = Router()
const CONTACT_EMAILS = [
  'contacto@churchsystem.com.ar',
  'ventas@churchsystem.com.ar',
  'soporte@churchsystem.com.ar',
  'legal@churchsystem.com.ar',
  'seguridad@churchsystem.com.ar',
]

// Todos los campos permitidos
const ALLOWED = [
  // Iglesia
  'nombre_iglesia','direccion','telefono_iglesia','email_iglesia','pastor_nombre','sitio_web',
  // Cultos
  'cultos_dias','cultos_turnos','culto_duracion','culto_capacidad',
  // Integraciones
  'twilio_sid','twilio_token','twilio_from',
  'anthropic_key','openai_key','groq_key',
  'ia_proveedor','modelo_anthropic','modelo_openai','modelo_groq',
  // Alertas
  'alerta_sin_asistir','alerta_sin_seguimiento','alerta_visitante','alerta_cumple',
  // Seguimiento
  'seg_frecuencia_default',
  // Apariencia
  'color_primario','logo_url','modo_oscuro_default',
  // Email
  'resend_key','email_from','email_nombre',
  // Setup
  'setup_completado',
  // Seguridad
  'sesion_horas','max_intentos',
]

router.get('/', requireAuth, (_req, res) => {
  const rows = db.all('SELECT clave, valor FROM configuracion')
  const c = {}
  for (const r of rows) {
    try { c[r.clave] = JSON.parse(r.valor) } catch { c[r.clave] = r.valor }
  }
  // Nunca exponer secrets
  const { twilio_token, anthropic_key, openai_key, groq_key, resend_key, ...safe } = c
  res.json({
    ...safe,
    twilio_configurado: !!c.twilio_token,
    email_configurado:  !!(c.resend_key || process.env.RESEND_API_KEY),
    ia_configurada:     !!(c.anthropic_key || c.openai_key || c.groq_key),
    ia_proveedor:       c.ia_proveedor || 'anthropic',
    anthropic_ok:       !!c.anthropic_key,
    openai_ok:          !!c.openai_key,
    groq_ok:            !!c.groq_key,
  })
})

function getConfigObject() {
  const rows = db.all('SELECT clave, valor FROM configuracion')
  return Object.fromEntries(rows.map(r => [r.clave, r.valor]))
}

function emailDiagnostics() {
  const cfg = getConfigObject()
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
  ]
  const missing = renderVars.filter(k => !process.env[k])
  const warnings = []
  if (!process.env.RESEND_API_KEY && !cfg.resend_key) warnings.push('Falta RESEND_API_KEY en Render o Resend API Key en Configuracion.')
  if (!fromEmail) warnings.push('Falta EMAIL_FROM con un remitente valido.')
  if (domain && !expectedDomains.includes(domain)) warnings.push(`El remitente usa ${domain}; verificar que ese dominio este validado en Resend.`)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) warnings.push('Google OAuth no tiene todas las variables en Render.')
  if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) warnings.push('Apple Sign-In no tiene todas las variables en Render.')

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

router.get('/email-diagnostics', requireAuth, requireRol('PASTOR_GENERAL'), (_req, res) => {
  res.json(emailDiagnostics())
})

router.post('/email-test', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  const diag = emailDiagnostics()
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
    res.json({ ok: true, result, diagnostics: diag })
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message, diagnostics: diag })
  }
})

router.put('/', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  const changed = []
  for (const [key, val] of Object.entries(req.body || {})) {
    if (!ALLOWED.includes(key) || val === '' || val === null || val === undefined) continue
    const ex = db.get('SELECT clave FROM configuracion WHERE clave=?', [key])
    if (ex) db.run('UPDATE configuracion SET valor=? WHERE clave=?', [String(val), key])
    else    db.run('INSERT INTO configuracion (clave,valor) VALUES (?,?)', [key, String(val)])
    changed.push(key)
  }
  // Sincronizar env vars en caliente
  const sync = {
    anthropic_key: 'ANTHROPIC_API_KEY',
    openai_key:    'OPENAI_API_KEY',
    groq_key:      'GROQ_API_KEY',
    twilio_sid:    'TWILIO_ACCOUNT_SID',
    twilio_token:  'TWILIO_AUTH_TOKEN',
    twilio_from:   'TWILIO_WHATSAPP_FROM',
    resend_key:    'RESEND_API_KEY',
    email_from:    'EMAIL_FROM',
  }
  for (const [field, env] of Object.entries(sync)) {
    if (req.body[field]) process.env[env] = req.body[field]
  }
  const critical = changed.filter(k => [
    'resend_key','email_from','twilio_sid','twilio_token','twilio_from',
    'anthropic_key','openai_key','groq_key','sesion_horas','max_intentos',
  ].includes(k))
  if (critical.length) {
    await sendNotificationEmail({
      to:req.user.email,
      subject:'Configuracion critica actualizada - Church System',
      title:'Configuracion critica actualizada',
      intro:'Se actualizaron campos sensibles de la plataforma.',
      lines:critical.map(k => `Campo: ${k}`),
      actionUrl:`${process.env.FRONTEND_URL || process.env.BASE_URL || 'https://churchsystem.com.ar'}/app/configuracion`,
      actionLabel:'Revisar configuracion',
    }).catch(() => {})
  }
  res.json({ ok: true })
})

export default router
