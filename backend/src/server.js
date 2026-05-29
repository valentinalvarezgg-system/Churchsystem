import 'dotenv/config'
import express from 'express'
import os from 'os'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import pino from 'pino'
import { pgOne } from './lib/pg.js'
import { requireLaunchEnvironment } from './lib/env.js'
import { sanitizeBody, securityLogger, errorHandler } from './middlewares/security.js'
import authRouter          from './routes/auth.js'
import personasRouter      from './routes/personas.js'
import gruposRouter        from './routes/grupos.js'
import usersRouter         from './routes/users.js'
import historialRouter     from './routes/historial.js'
import seguimientoRouter   from './routes/seguimiento.js'
import cultosRouter        from './routes/cultos.js'
import statsRouter         from './routes/stats.js'
import importRouter        from './routes/import.js'
import mensajesRouter      from './routes/mensajes.js'
import alertasRouter       from './routes/alertas.js'
import exportRouter        from './routes/export.js'
import perfilRouter        from './routes/persona_perfil.js'
import iaRouter            from './routes/ia.js'
import configRouter        from './routes/config.js'
import finanzasRouter      from './routes/finanzas.js'
import eventosRouter       from './routes/eventos.js'
import reportesRouter      from './routes/reportes.js'
import discipuladoRouter   from './routes/discipulado.js'
import busquedaRouter      from './routes/busqueda.js'
import perfilUsuarioRouter from './routes/perfil_usuario.js'
import backupRouter        from './routes/backup.js'
import permisosRouter      from './routes/permisos.js'
import excelIaRouter       from './routes/excel_ia.js'
import { tenantMiddleware } from './middlewares/tenant.js'
import mpRouter          from './routes/mercadopago.js'
import planRouter from './routes/plan.js'
import iglesiaRouter from './routes/iglesia.js'
import verificacionRouter from './routes/verificacion.js'
import registroRouter      from './routes/registro.js'
import notificacionesRouter from './routes/notificaciones.js'
import checkinRouter       from './routes/checkin.js'
import oracionRouter       from './routes/oracion.js'
import comunicadosRouter   from './routes/comunicados.js'
import consolidacionRouter from './routes/consolidacion.js'
import bugReportRouter     from './routes/bug-report.js'
import promoCodesRouter    from './routes/promo-codes.js'
import oauthRouter         from './routes/oauth.js'

const app  = express()
const PORT = process.env.PORT || 4000
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
const launchEnv = requireLaunchEnvironment()
for (const warning of launchEnv.warnings) logger.warn({ warning }, 'Launch environment warning')

app.use(helmet({ contentSecurityPolicy:false, crossOriginEmbedderPolicy:false }))
const allowedOrigins = [
  'https://churchsystem.com.ar',
  'https://www.churchsystem.com.ar',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(v => v.trim()).filter(Boolean) : []),
]
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error('Origen no permitido por CORS'))
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}))
app.use(express.json({ limit:'10mb' }))
app.use(express.urlencoded({ extended:false, limit:'1mb' }))
app.disable('x-powered-by')
app.use(rateLimit({ windowMs:15*60*1000, max:500 }))
app.use('/auth/login', rateLimit({ windowMs:60*60*1000, max:10, skipSuccessfulRequests:true, message:{ error:'Demasiados intentos.' } }))
app.use('/ia', rateLimit({ windowMs:60*1000, max:20, message:{ error:'Límite de IA.' } }))
app.use(sanitizeBody)
app.use(securityLogger)
app.use(tenantMiddleware)

app.get('/health', (_req,res) => res.json({ status:'ok' }))
// Servir fotos de personas estáticamente
const __dirname_fotos = path.join(process.cwd(), 'uploads', 'fotos')
app.use('/fotos', express.static(__dirname_fotos))

app.use('/auth',          authRouter)
app.use('/personas',      personasRouter)
app.use('/grupos',        gruposRouter)
app.use('/users',         usersRouter)
app.use('/historial',     historialRouter)
app.use('/seguimiento',   seguimientoRouter)
app.use('/cultos',        cultosRouter)
app.use('/stats',         statsRouter)
app.use('/import',        importRouter)
app.use('/mensajes',      mensajesRouter)
app.use('/alertas',       alertasRouter)
app.use('/export',        exportRouter)
app.use('/perfil',        perfilRouter)
app.use('/ia',            iaRouter)
app.use('/config',        configRouter)
app.use('/finanzas',      finanzasRouter)
app.use('/eventos',       eventosRouter)
app.use('/reportes',      reportesRouter)
app.use('/discipulado',   discipuladoRouter)
app.use('/busqueda',      busquedaRouter)
app.use('/mi-perfil',     perfilUsuarioRouter)
app.use('/backup',        backupRouter)
app.use('/permisos',      permisosRouter)
app.use('/excel-ia',      excelIaRouter)
app.use('/notificaciones', notificacionesRouter)
app.use('/registro',       registroRouter)
app.use('/mp',             mpRouter)
app.use('/checkin',       checkinRouter)
app.use('/oracion',       oracionRouter)
app.use('/comunicados',   comunicadosRouter)
app.use('/consolidacion', consolidacionRouter)
app.use('/bug-report',    bugReportRouter)
app.use('/promo-codes',   promoCodesRouter)
app.use('/oauth',         oauthRouter)
app.use('/verificacion',  verificacionRouter)
app.use('/plan',          planRouter)
app.use('/iglesia',       iglesiaRouter)

// ── Frontend buildeado ───────────────────────────────────────────────────────
const _DIST = path.join(process.cwd(), '..', 'frontend', 'dist')

// ── Landing page pública ──────────────────────────────────────────────────────
import { fileURLToPath as _ftu } from 'url'
const _LANDING = path.join(path.dirname(_ftu(import.meta.url)), '..', '..', 'landing', 'index.html')
const _PAGE_REGISTRO = path.join(path.dirname(_ftu(import.meta.url)), '..', '..', 'landing', 'registro.html')

// Ruta raíz → landing (si existe), sino → SPA
if (fs.existsSync(_LANDING)) {
  app.get('/', (_req, res) => res.sendFile(_LANDING))
  app.get('/registro', (_req, res) => {
    if (fs.existsSync(_PAGE_REGISTRO)) res.sendFile(_PAGE_REGISTRO)
    else res.sendFile(_LANDING)
  })
  // /app → SPA React
  app.use('/app', express.static(_DIST))
  app.get('/app/*', (_req, res) => res.sendFile(path.join(_DIST, 'index.html')))
  logger.info({ route:'/', mode:'landing' }, 'Landing activa')
  logger.info({ route:'/app', mode:'spa' }, 'App React activa')
}

if (fs.existsSync(_DIST)) {
  app.use(express.static(_DIST))
  app.get('*', (req, res) => {
    // Las rutas de API de checkin: /checkin/token/*, /checkin/info/*, /checkin/registrar/*, /checkin/descriptores
    // La página pública /checkin/:id/:token → SPA (no API)
    const isCheckinApi = /^\/checkin\/(token|info|registrar|descriptores)\//.test(req.path)
    const isApi = isCheckinApi || new RegExp('^/(auth|personas|grupos|cultos|stats|alertas|mensajes|config|ia|fotos|export|finanzas|historial|reportes|discipulado|consolidacion|seguimiento|oracion|comunicados|eventos|backup|users|permisos|perfil|import|busqueda)').test(req.path)
    if (isApi) return res.status(404).json({ error: 'Ruta no encontrada' })
    res.sendFile(path.join(_DIST, 'index.html'))
  })
  logger.info({ dist:_DIST }, 'Frontend estatico activo')
}

app.use((_req,res) => res.status(404).json({ error:'Ruta no encontrada' }))
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
    const claves = { anthropic_key:'ANTHROPIC_API_KEY', twilio_sid:'TWILIO_ACCOUNT_SID', twilio_token:'TWILIO_AUTH_TOKEN', twilio_from:'TWILIO_WHATSAPP_FROM' }
    for (const [k,env] of Object.entries(claves)) {
      const r = db.get('SELECT valor FROM configuracion WHERE clave=?',[k])
      if (r?.valor) process.env[env] = r.valor
    }
  } catch {}
}

async function seedAdmin() {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Seed admin omitido en production')
    return
  }
  const exists = await pgOne('SELECT id FROM "User" WHERE "rol"=$1 AND "deletedAt" IS NULL LIMIT 1', ['PASTOR_GENERAL'])
  if (!exists) {
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
  // Plantillas por defecto
  const db = await getLegacyDbIfAllowed()
  if (db && !db.get('SELECT id FROM plantillas_mensaje LIMIT 1')) {
    const plantillas = [
      ['Bienvenida','WHATSAPP','Hola {nombre}! 🙏 Bienvenido/a a nuestra iglesia. ¡Nos alegra tenerte!'],
      ['Recordatorio culto','WHATSAPP','Hola {nombre}! Te recordamos que mañana tenemos culto. ¡Te esperamos! 🙌'],
      ['Cumpleaños','WHATSAPP','🎂 Feliz cumpleaños {nombre}! Que Dios te bendiga en este nuevo año. ¡Te queremos!'],
      ['Seguimiento','WHATSAPP','Hola {nombre}, ¿cómo estás? Estuvimos pensando en vos. 🙏 Bendiciones!'],
    ]
    for (const [n,t,c] of plantillas) db.run('INSERT INTO plantillas_mensaje (nombre,tipo,contenido) VALUES (?,?,?)',[n,t,c])
  }
}

await cargarConfigEnv()

seedAdmin().then(async () => {
  await cargarConfigEnv()
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Church System iniciado')
    const localIP = Object.values(os.networkInterfaces()).flat()
      .find(n => n.family==='IPv4' && !n.internal)?.address || '??'
    logger.info({ local:`http://localhost:${PORT}`, network:`http://${localIP}:${PORT}` }, 'Endpoints de arranque')
    // Programar alertas diarias a las 8:30 AM
    const now = new Date(), target = new Date()
    target.setHours(8, 30, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    const ms = target - now
    const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000)
    logger.info({ nextAlertsIn: `${h}h ${m}m` }, 'Programacion de alertas')
    setTimeout(async () => {
      try {
        const mod = await import('./routes/notificaciones.js').catch(() => null)
        if (mod?.enviarAlertas) await mod.enviarAlertas()
      } catch (e) { logger.error({ err:e.message }, 'Error de alertas') }
    }, ms)
  })
})
