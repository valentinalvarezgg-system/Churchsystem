import 'dotenv/config'
import express from 'express'
import os from 'os'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import logger, { httpLogger } from './lib/logger.js'
import { pgOne } from './lib/pg.js'
import { requireLaunchEnvironment } from './lib/env.js'
import { sanitizeBody, securityLogger, errorHandler } from './middlewares/security.js'
import { tenantMiddleware } from './middlewares/tenant.js'
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
import mpRouter from './routes/mercadopago.js'
import ministeriosRouter from './routes/ministerios.js'
import stripeRouter from './routes/stripe.js'
import paypalRouter from './routes/paypal.js'
import transferenciaRouter from './routes/transferencia.js'
import planRouter from './routes/plan.js'
import cultoAsignacionesRouter from './routes/culto-asignaciones.js'
import analyticsRouter from './routes/analytics.js'
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
import godmodeRouter from './routes/godmode.js'
import resendInboundRouter from './routes/resend-inbound.js'
import subscriptionsRouter from './routes/subscriptions.js'

const app = express()
const PORT = process.env.PORT || 4000
const launchEnv = requireLaunchEnvironment()
for (const warning of launchEnv.warnings) logger.warn({ warning }, 'Launch environment warning')
const LEGAL_HIDE_FINANZAS_ORACION = (() => {
  if (typeof process.env.LEGAL_HIDE_FINANZAS_ORACION === 'string') {
    return process.env.LEGAL_HIDE_FINANZAS_ORACION.toLowerCase() === 'true'
  }
  return process.env.NODE_ENV === 'production'
})()

const originEnv = [
  ...(process.env.CORS_ORIGINS || '').split(','),
  ...(process.env.ALLOWED_ORIGINS || '').split(','),
].map(v => v.trim()).filter(Boolean)

const allowedOrigins = [
  'https://churchsystem.com.ar',
  'https://www.churchsystem.com.ar',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  ...originEnv,
]

app.set('trust proxy', 1) // Cloudflare Tunnel pasa X-Forwarded-For — necesario para rate-limit y logs de IP reales
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    logger.warn({ origin }, 'CORS origin rejected')
    return cb(new Error('Origen no permitido por CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
// Stripe webhook needs raw body BEFORE global JSON parser for signature verification
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.disable('x-powered-by')
app.use(httpLogger())
app.use(sanitizeBody)
app.use(securityLogger)
app.use(tenantMiddleware)

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'Demasiadas solicitudes.' } }))
app.use('/auth/login', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos.' },
}))
app.use('/ia', rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Límite de IA.' } }))

function blockLegalModule(req, res, next) {
  if (!LEGAL_HIDE_FINANZAS_ORACION) return next()
  logger.warn({ path: req.path, method: req.method }, 'Legal module temporarily disabled')
  return res.status(404).json({ error: 'Ruta no encontrada' })
}

app.get('/health', async (_req, res) => {
  try {
    await pgOne('SELECT 1 AS status')
    return res.json({ status: 'ok' })
  } catch (err) {
    logger.error({ err: err.message }, 'Healthcheck failed')
    return res.status(503).json({ status: 'error' })
  }
})

const fotosDir = path.join(process.cwd(), 'uploads', 'fotos')
if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true })
app.use('/fotos', express.static(fotosDir))

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
app.use('/finanzas', blockLegalModule, finanzasRouter)
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
app.use('/ministerios', ministeriosRouter)
app.use('/stripe', stripeRouter)
app.use('/paypal', paypalRouter)
app.use('/transferencia', transferenciaRouter)
app.use('/culto-asignaciones', cultoAsignacionesRouter)
app.use('/analytics', analyticsRouter)
app.use('/checkin', checkinRouter)
app.use('/oracion', blockLegalModule, oracionRouter)
app.use('/comunicados', comunicadosRouter)
app.use('/consolidacion', consolidacionRouter)
app.use('/bug-report', bugReportRouter)
app.use('/promo-codes', promoCodesRouter)
app.use('/oauth', oauthRouter)
app.use('/godmode', godmodeRouter)
app.use('/webhooks', resendInboundRouter)
app.use('/verificacion', verificacionRouter)
app.use('/plan', planRouter)
app.use('/iglesia', iglesiaRouter)
app.use('/', subscriptionsRouter)

const distDir = path.join(process.cwd(), '..', 'frontend', 'dist')
const landingFile = path.join(process.cwd(), '..', 'landing', 'index.html')
const registroFile = path.join(process.cwd(), '..', 'landing', 'registro.html')

if (fs.existsSync(landingFile)) {
  app.get('/', (_req, res) => res.sendFile(landingFile))
  app.get('/registro', (_req, res) => {
    if (fs.existsSync(registroFile)) return res.sendFile(registroFile)
    return res.sendFile(landingFile)
  })
  app.use('/app', express.static(distDir))
  app.get('/app/*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
  logger.info({ route: '/', mode: 'landing' }, 'Landing activa')
  logger.info({ route: '/app', mode: 'spa' }, 'App React activa')
}

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res) => {
    const isCheckinApi = /^\/checkin\/(token|info|registrar|descriptores)\//.test(req.path)
    const isApi = isCheckinApi || /^\/(api|auth|personas|grupos|cultos|stats|alertas|mensajes|config|ia|fotos|export|finanzas|historial|reportes|discipulado|consolidacion|seguimiento|oracion|comunicados|eventos|backup|users|permisos|perfil|import|busqueda|mp|stripe|paypal|transferencia|plan|oauth|verificacion|iglesia|notificaciones|promo-codes|bug-report|mi-perfil|excel-ia|godmode|culto-asignaciones|analytics)/.test(req.path)
    if (isApi) return res.status(404).json({ error: 'Ruta no encontrada' })
    return res.sendFile(path.join(distDir, 'index.html'))
  })
  logger.info({ dist: distDir }, 'Frontend estatico activo')
}

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))
app.use(errorHandler)

async function getLegacyDbIfAllowed() {
  if (process.env.ALLOW_LEGACY_SQLJS !== 'true') return null
  const mod = await import('./lib/db.js')
  return mod.default
}

async function cargarConfigEnv() {
  const db = await getLegacyDbIfAllowed()
  if (!db) return
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
    logger.debug({ err: err.message }, 'Legacy config loading skipped')
  }
}

async function seedAdmin() {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Seed admin omitido en production')
    return
  }
  const exists = await pgOne('SELECT id FROM "User" WHERE "rol"=$1 AND "deletedAt" IS NULL LIMIT 1', ['PASTOR_GENERAL'])
  if (exists) return

  const iglesia = await pgOne(
    'INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',
    ['Iglesia Principal', 'MAIN-IGLESIA']
  ).catch(() => pgOne('SELECT id FROM "Iglesia" WHERE "token"=$1 LIMIT 1', ['MAIN-IGLESIA']))
  const role = await pgOne(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ('PASTOR_GENERAL','Pastor General',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`
  )
  const hash = await bcrypt.hash('admin123', 10)
  await pgOne(
    `INSERT INTO "User"
      ("email","password","nombre","apellido","activo","emailVerificado","iglesiaId","rolId","createdAt","updatedAt",
       "rol","plan","pais","divisa","idioma","iglesia")
     VALUES
      ('admin@iglesia.com',$1,'Administrador','',true,true,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
       'PASTOR_GENERAL','GENERAL','AR','ARS','es','Iglesia Principal')
     RETURNING id`,
    [hash, iglesia.id, role.id]
  )
  logger.info('Usuario admin seed creado en PostgreSQL')
}

async function seedGodModeUser() {
  const email = String(process.env.GODMODE_USER_EMAIL || '').trim().toLowerCase()
  const password = String(process.env.GODMODE_USER_PASSWORD || '').trim()
  if (!email || !password) return
  const role = await pgOne(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ('GODMODE','GodMode',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`
  )
  const iglesia = await pgOne(
    'INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("token") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP RETURNING id',
    ['GodMode', 'GODMODE-ROOT']
  ).catch(() => pgOne('SELECT "id" FROM "Iglesia" WHERE "token"=$1 LIMIT 1', ['GODMODE-ROOT']))

  const exists = await pgOne('SELECT id FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [email])
  if (exists) {
    await pgOne(
      `UPDATE "User"
         SET "rol"='GODMODE',
             "plan"='GODMODE',
             "activo"=true,
             "emailVerificado"=true,
             "rolId"=$1,
             "iglesiaId"=$2,
             "updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$3
       RETURNING id`,
      [role.id, iglesia.id, exists.id]
    )
    return
  }
  const hash = await bcrypt.hash(password, 12)
  await pgOne(
    `INSERT INTO "User"
      ("email","password","nombre","apellido","activo","emailVerificado","iglesiaId","rolId","createdAt","updatedAt",
       "rol","plan","pais","divisa","idioma","iglesia")
     VALUES
      ($1,$2,'Owner','GodMode',true,true,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
       'GODMODE','GODMODE','AR','USD','es','GodMode')
     RETURNING id`,
    [email, hash, iglesia.id, role.id]
  )
  logger.info({ email }, 'Usuario GODMODE creado')
}

await cargarConfigEnv()

// Auto-crear tabla CultoAsignado si no existe (nueva en v2.8/block-05)
try {
  await import('./lib/pg.js').then(({ pgExec }) => pgExec(`
    CREATE TABLE IF NOT EXISTS "CultoAsignado" (
      "id"          SERIAL PRIMARY KEY,
      "userId"      INTEGER NOT NULL,
      "cultoId"     INTEGER NOT NULL,
      "iglesiaId"   INTEGER NOT NULL,
      "asignadoPor" INTEGER,
      "createdAt"   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("userId","cultoId","iglesiaId")
    )
  `))
} catch (err) {
  logger.warn({ err: err.message }, 'CultoAsignado table init skipped')
}

seedAdmin().then(async () => {
  await seedGodModeUser()
  app.listen(PORT, '0.0.0.0', () => {
    const localIP = Object.values(os.networkInterfaces()).flat()
      .find(n => n.family === 'IPv4' && !n.internal)?.address || '??'
    logger.info({ port: PORT }, 'Church System iniciado')
    logger.info({ local: `http://localhost:${PORT}`, network: `http://${localIP}:${PORT}` }, 'Endpoints de arranque')

    const now = new Date()
    const target = new Date()
    target.setHours(8, 30, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    const ms = target - now
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    logger.info({ nextAlertsIn: `${h}h ${m}m` }, 'Programacion de alertas')
    setTimeout(async () => {
      try {
        const mod = await import('./routes/notificaciones.js').catch(() => null)
        if (mod?.enviarAlertas) await mod.enviarAlertas()
      } catch (err) {
        logger.error({ err: err.message }, 'Error de alertas')
      }
    }, ms)
  })
})

process.on('SIGINT', () => {
  logger.info('Shutting down gracefully')
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info('Shutting down SIGTERM')
  process.exit(0)
})

// Red de seguridad: un error async no manejado NO debe tumbar el proceso.
// Se loguea y el servidor sigue vivo (launchd igual lo reiniciaría, pero esto evita el downtime).
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: reason?.message || String(reason), stack: reason?.stack }, 'Unhandled promise rejection — proceso continúa')
})

process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught exception — proceso continúa')
})
