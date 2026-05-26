import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'

const router = Router()

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
  const { twilio_token, anthropic_key, openai_key, groq_key, ...safe } = c
  res.json({
    ...safe,
    twilio_configurado: !!c.twilio_token,
    email_configurado:  !!c.resend_key,
    ia_configurada:     !!(c.anthropic_key || c.openai_key || c.groq_key),
    ia_proveedor:       c.ia_proveedor || 'anthropic',
    anthropic_ok:       !!c.anthropic_key,
    openai_ok:          !!c.openai_key,
    groq_ok:            !!c.groq_key,
  })
})

router.put('/', requireAuth, requireRol('PASTOR_GENERAL'), (req, res) => {
  for (const [key, val] of Object.entries(req.body || {})) {
    if (!ALLOWED.includes(key) || val === '' || val === null || val === undefined) continue
    const ex = db.get('SELECT clave FROM configuracion WHERE clave=?', [key])
    if (ex) db.run('UPDATE configuracion SET valor=? WHERE clave=?', [String(val), key])
    else    db.run('INSERT INTO configuracion (clave,valor) VALUES (?,?)', [key, String(val)])
  }
  // Sincronizar env vars en caliente
  const sync = {
    anthropic_key: 'ANTHROPIC_API_KEY',
    openai_key:    'OPENAI_API_KEY',
    groq_key:      'GROQ_API_KEY',
    twilio_sid:    'TWILIO_ACCOUNT_SID',
    twilio_token:  'TWILIO_AUTH_TOKEN',
    twilio_from:   'TWILIO_WHATSAPP_FROM',
  }
  for (const [field, env] of Object.entries(sync)) {
    if (req.body[field]) process.env[env] = req.body[field]
  }
  res.json({ ok: true })
})

export default router
