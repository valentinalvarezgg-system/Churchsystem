import 'dotenv/config'
import express from 'express'
import os from 'os'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import db from './lib/db.js'
import logger, { httpLogger } from './lib/logger.js'
import { sanitizeBody, securityLogger, errorHandler } from './middlewares/security.js'
import authRouter from './routes/auth.js'
import personasRouter from './routes/personas.js'
import gruposRouter from './routes/grupos.js'
import usersRouter from './routes/users.js'
import historialRouter from './routes/historial.js'
import seguimientoRouter from './routes/seguimiento.js'
import cultosRouter from './routes/cultos.js'
import statsRouter from './routes/stats.js'
import importRouter from './routes/import.js'
import mensajesRouter from './routes/mensajes.js'
import alertasRouter from './routes/alertas.js'
import exportRouter from './routes/export.js'
import perfilRouter from './routes/persona_perfil.js'
import iaRouter from './routes/ia.js'
import configRouter from './routes/config.js'
import finanzasRouter from './routes/finanzas.js'
import eventosRouter from './routes/eventos.js'
import reportesRouter from './routes/reportes.js'
import discipuladoRouter from './routes/discipulado.js'
import busquedaRouter from './routes/busqueda.js'
import perfilUsuarioRouter from './routes/perfil_usuario.js'
import backupRouter from './routes/backup.js'
import permisosRouter from './routes/permisos.js'
import excelIaRouter from './routes/excel_ia.js'
import { tenantMiddleware } from './middlewares/tenant.js'
import mpRouter from './routes/mercadopago.js'
import planRouter from './routes/plan.js'
import iglesiaRouter from './routes/iglesia.js'
import verificacionRouter from './routes/verificacion.js'
import registroRouter from './routes/registro.js'
import notificacionesRouter from './routes/notificaciones.js'
import checkinRouter from './routes/checkin.js'
import oracionRouter from './routes/oracion.js'
import comunicadosRouter from './routes/comunicados.js'
import consolidacionRouter from './routes/consolidacion.js'
import bugReportRouter from './routes/bug-report.js'
import promoCodesRouter from './routes/promo-codes.js'
import oauthRouter from './routes/oauth.js'

const app = express()
const PORT = process.env.PORT || 4000

// ────────────────────────────────────────────────────────────
// SECURITY VALIDATION ON STARTUP (CRITICAL)
// ────────────────────────────────────────────────────────────
function validateSecurityConfig() {
  const errors = []

  // JWT_SECRET validation
  if (!process.env.JWT_SECRET) {
    errors.push('❌ JWT_SECRET not set in environment')
  } else if (process.env.JWT_SECRET === 'change-me' || process.env.JWT_SECRET === 'dev') {
    errors.push('❌ JWT_SECRET has unsafe default value')
  }

  // NODE_ENV check
  if (!process.env.NODE_ENV) {
    logger.warn('⚠️  NODE_ENV not set, defaulting to development')
    process.env.NODE_ENV = 'development'
  }

  if (errors.length > 0) {
    logger.error(errors, '🔒 SECURITY VALIDATION FAILED')
    process.exit(1)
  }

  logger.info('✅ Security configuration validated')
}

validateSecurityConfig()

// ────────────────────────────────────────────────────────────
// SECURITY HEADERS
// ────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))

// ────────────────────────────────────────────────────────────
// CORS - STRICT WHITELIST (not cb(null, true))
// ────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .filter(Boolean) || [
    'https://churchsystem.com.ar',
    'https://www.churchsystem.com.ar',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ]

logger.info({ origins: ALLOWED_ORIGINS }, '🔐 CORS whitelist configured')

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true)
      } else {
        logger.warn({ origin, allowed: ALLOWED_ORIGINS }, '🚫 CORS request rejected')
        cb(new Error('CORS not allowed'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// ────────────────────────────────────────────────────────────
// BODY PARSING & SANITIZATION
// ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.disable('x-powered-by')
app.use(sanitizeBody)

// ────────────────────────────────────────────────────────────
// LOGGING (structured with pino, not console.log)
// ────────────────────────────────────────────────────────────
app.use(httpLogger())
app.use(securityLogger)

// ────────────────────────────────────────────────────────────
// RATE LIMITING
// ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes. Reintentar después.' },
})

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de login. Reintentar en 1 hora.' },
})

app.use(generalLimiter)
app.use('/auth/login', loginLimiter)
app.use('/ia', rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Límite de IA.' } }))

// ────────────────────────────────────────────────────────────
// HEALTHCHECK (Standard format: {status:ok})
// ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  try {
    // Test DB connection
    const result = db.get('SELECT 1 as status')
    res.json({
      status: 'ok',
      version: '2.6.0',
      db: 'connected',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    })
  } catch (err) {
    logger.error({ error: err.message }, 'Healthcheck failed')
    res.status(503).json({
      status: 'error',
      error: 'Database disconnected',
      timestamp: new Date().toISOString(),
    })
  }
})

// ────────────────────────────────────────────────────────────
// STATIC FILES
// ────────────────────────────────────────────────────────────
const __dirname_fotos = path.join(process.cwd(), 'uploads', 'fotos')
if (!fs.existsSync(__dirname_fotos)) {
  fs.mkdirSync(__dirname_fotos, { recursive: true })
}
app.use('/fotos', express.static(__dirname_fotos))

// ────────────────────────────────────────────────────────────
// ROUTES
// ────────────────────────────────────────────────────────────
app.use('/auth', authRouter)
app.use('/personas', personasRouter)
app.use('/grupos', gruposRouter)
app.use('/users', usersRouter)
app.use('/historial', historialRouter)
app.use('/seguimiento', seguimientoRouter)
app.use('/cultos', cultosRouter)
app.use('/stats', statsRouter)
app.use('/import', importRouter)
app.use('/mensajes', mensajesRouter)
app.use('/alertas', alertasRouter)
app.use('/export', exportRouter)
app.use('/perfil', perfilRouter)
app.use('/ia', iaRouter)
app.use('/config', configRouter)
app.use('/finanzas', finanzasRouter)
app.use('/eventos', eventosRouter)
app.use('/reportes', reportesRouter)
app.use('/discipulado', discipuladoRouter)
app.use('/busqueda', busquedaRouter)
app.use('/mi-perfil', perfilUsuarioRouter)
app.use('/backup', backupRouter)
app.use('/permisos', permisosRouter)
app.use('/excel-ia', excelIaRouter)
app.use('/notificaciones', notificacionesRouter)
app.use('/registro', registroRouter)
app.use('/mp', mpRouter)
app.use('/checkin', checkinRouter)
app.use('/oracion', oracionRouter)
app.use('/comunicados', comunicadosRouter)
app.use('/consolidacion', consolidacionRouter)
app.use('/bug-report', bugReportRouter)
app.use('/promo-codes', promoCodesRouter)
app.use('/oauth', oauthRouter)
app.use('/verificacion', verificacionRouter)
app.use('/plan', planRouter)
app.use('/iglesia', iglesiaRouter)

// ────────────────────────────────────────────────────────────
// FRONTEND (SPA + Landing)
// ────────────────────────────────────────────────────────────
const _DIST = path.join(process.cwd(), '..', 'frontend', 'dist')
const _LANDING = path.join(process.cwd(), '..', 'landing', 'index.html')
const _PAGE_REGISTRO = path.join(process.cwd(), '..', 'landing', 'registro.html')

if (fs.existsSync(_LANDING)) {
  app.get('/', (_req, res) => res.sendFile(_LANDING))
  app.get('/registro', (_req, res) => {
    if (fs.existsSync(_PAGE_REGISTRO)) res.sendFile(_PAGE_REGISTRO)
    else res.sendFile(_LANDING)
  })
  app.use('/app', express.static(_DIST))
  app.get('/app/*', (_req, res) => res.sendFile(path.join(_DIST, 'index.html')))
  logger.info({ landing: _LANDING }, '🏠 Landing page enabled')
}

if (fs.existsSync(_DIST)) {
  app.use(express.static(_DIST))
  app.get('*', (req, res) => {
    const isCheckinApi = /^\/checkin\/(token|info|registrar|descriptores)\//.test(req.path)
    const isApi =
      isCheckinApi ||
      /^\/(auth|personas|grupos|cultos|stats|alertas|mensajes|config|ia|fotos|export|finanzas|historial|reportes|discipulado|consolidacion|seguimiento|oracion|mp|plan|oauth|verificacion)/.test(
        req.path
      )
    if (isApi) return res.status(404).json({ error: 'Ruta no encontrada' })
    res.sendFile(path.join(_DIST, 'index.html'))
  })
  logger.info({ dist: _DIST }, '🌐 Frontend SPA enabled')
}

// ────────────────────────────────────────────────────────────
// 404 HANDLER
// ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

// ────────────────────────────────────────────────────────────
// ERROR HANDLER
// ────────────────────────────────────────────────────────────
app.use(errorHandler)

// ────────────────────────────────────────────────────────────
// STARTUP
// ────────────────────────────────────────────────────────────
function cargarConfigEnv() {
  try {
    const claves = {
      anthropic_key: 'ANTHROPIC_API_KEY',
      twilio_sid: 'TWILIO_ACCOUNT_SID',
      twilio_token: 'TWILIO_AUTH_TOKEN',
      twilio_from: 'TWILIO_WHATSAPP_FROM',
    }
    for (const [k, env] of Object.entries(claves)) {
      const r = db.get('SELECT valor FROM configuracion WHERE clave=?', [k])
      if (r?.valor) process.env[env] = r.valor
    }
  } catch (err) {
    logger.debug({ error: err.message }, 'Config loading skipped')
  }
}

async function seedAdmin() {
  try {
    const exists = db.get("SELECT id FROM users WHERE rol='PASTOR_GENERAL' LIMIT 1")
    if (!exists) {
      const hash = await bcrypt.hash('admin123', 10)
      db.run('INSERT INTO users (email,password,nombre,rol) VALUES (?,?,?,?)', [
        'admin@iglesia.com',
        hash,
        'Administrador',
        'PASTOR_GENERAL',
      ])
      logger.info('✅ Admin user created (admin@iglesia.com / admin123)')
    }

    // Default templates
    if (!db.get('SELECT id FROM plantillas_mensaje LIMIT 1')) {
      const plantillas = [
        ['Bienvenida', 'WHATSAPP', 'Hola {nombre}! 🙏 Bienvenido/a a nuestra iglesia. ¡Nos alegra tenerte!'],
        ['Recordatorio culto', 'WHATSAPP', 'Hola {nombre}! Te recordamos que mañana tenemos culto. ¡Te esperamos! 🙌'],
        ['Cumpleaños', 'WHATSAPP', '🎂 Feliz cumpleaños {nombre}! Que Dios te bendiga en este nuevo año. ¡Te queremos!'],
        ['Seguimiento', 'WHATSAPP', 'Hola {nombre}, ¿cómo estás? Estuvimos pensando en vos. 🙏 Bendiciones!'],
      ]
      for (const [n, t, c] of plantillas) {
        db.run('INSERT INTO plantillas_mensaje (nombre,tipo,contenido) VALUES (?,?,?)', [n, t, c])
      }
    }
  } catch (err) {
    logger.error({ error: err.message }, 'Seed failed')
  }
}

cargarConfigEnv()

seedAdmin().then(() => {
  cargarConfigEnv()
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(
      {
        port: PORT,
        version: '2.6.0',
        env: process.env.NODE_ENV,
        security: 'validated',
      },
      '⛪ Church System Started'
    )
    logger.info(`🌐 http://localhost:${PORT}`)
    logger.info(`📡 /health: http://localhost:${PORT}/health`)

    const localIP =
      Object.values(os.networkInterfaces())
        .flat()
        .find((n) => n.family === 'IPv4' && !n.internal)?.address || '??'
    logger.info(`📱 Network: http://${localIP}:${PORT}`)

    // Schedule alerts
    const now = new Date()
    const target = new Date()
    target.setHours(8, 30, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    const ms = target - now
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    logger.info(`⏰ Daily alerts scheduled in ${h}h ${m}m`)
  })
})

// ────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ────────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  logger.info('📌 Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info('📌 Shutting down (SIGTERM)...')
  process.exit(0)
})
