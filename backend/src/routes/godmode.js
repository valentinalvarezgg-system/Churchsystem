import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { normalizePlan, PLANES } from '../lib/billing.js'
import { getContactMailStatus, runContactMailSmoke } from '../lib/contact-mail.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import logger from '../lib/logger.js'

const router = Router()

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado')
  return process.env.JWT_SECRET
}

// ── Schema bootstrap (idempotente) ───────────────────────────────────────────
let _schemaReady = false
async function ensureGodModeSchema() {
  if (_schemaReady) return
  await pgExec(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "es_superadmin" BOOLEAN NOT NULL DEFAULT false`).catch(() => {})
  await pgExec(`
    CREATE TABLE IF NOT EXISTS godmode_audit (
      id         SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      accion     TEXT    NOT NULL,
      detalle    JSONB   NOT NULL DEFAULT '{}',
      ip         TEXT,
      creado_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {})
  await pgExec(`CREATE INDEX IF NOT EXISTS idx_godmode_audit_usuario ON godmode_audit(usuario_id)`).catch(() => {})
  _schemaReady = true
}

// ── Audit log ─────────────────────────────────────────────────────────────────
async function auditLog(userId, accion, detalle, ip) {
  await pgExec(
    `INSERT INTO godmode_audit (usuario_id, accion, detalle, ip, creado_at)
     VALUES ($1,$2,$3::jsonb,$4,CURRENT_TIMESTAMP)`,
    [userId, accion, JSON.stringify(detalle || {}), String(ip || '')]
  ).catch(err => logger.warn({ err: err.message }, 'godmode_audit write failed (non-fatal)'))
}

// ── Middleware: es_superadmin verificado contra DB en cada request ───────────
// No confiar en el JWT — releer de DB explícitamente.
async function requiereSuperadmin(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'No autenticado' })
  await ensureGodModeSchema()
  const u = await pgOne(
    `SELECT "es_superadmin","activo" FROM "User"
      WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1`,
    [req.user.id]
  ).catch(() => null)
  if (!u || !u.activo || !u.es_superadmin) {
    logger.warn({ userId: req.user.id, path: req.path }, 'GodMode: acceso denegado (es_superadmin=false)')
    return res.status(403).json({ error: 'Acceso superadmin requerido' })
  }
  return next()
}

// ── Middleware: sesión fresca — último login hace menos de 12 h ──────────────
async function requireFreshSession(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'No autenticado' })
  const session = await pgOne(
    `SELECT "createdAt" FROM "user_sessions"
      WHERE "userId"=$1 AND "revoked"=0
      ORDER BY "createdAt" DESC LIMIT 1`,
    [req.user.id]
  ).catch(() => null)
  if (!session) {
    return res.status(401).json({ error: 'Sesión no encontrada. Re-ingresá para continuar.', code: 'RELOGIN_REQUIRED' })
  }
  const ageMs = Date.now() - new Date(session.createdAt).getTime()
  if (ageMs > 12 * 3600 * 1000) {
    return res.status(401).json({ error: 'Sesión expirada (más de 12 h). Re-ingresá para continuar.', code: 'FRESH_SESSION_REQUIRED' })
  }
  return next()
}

// ── Stack de protección compuesto ────────────────────────────────────────────
const gdProtect = [requireAuth, requiereSuperadmin, requireFreshSession]

// ── Helpers ───────────────────────────────────────────────────────────────────
function signAccessToken(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: '15m' })
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('hex')
}

function userPayload(user) {
  return {
    id: user.id,
    email: user.email,
    rol: user.rol,
    nombre: user.nombre,
    plan: user.plan || 'GODMODE',
    iglesiaId: user.iglesiaId || 1,
    pais: user.pais || 'AR',
    divisa: user.divisa || 'USD',
    idioma: user.idioma || 'es',
    es_superadmin: !!user.es_superadmin,
  }
}

async function ensureGodModeUserFromEnv(inputEmail = '') {
  const envEmail = String(process.env.GODMODE_USER_EMAIL || '').trim().toLowerCase()
  const envPassword = String(process.env.GODMODE_USER_PASSWORD || '').trim()
  if (!envEmail || !envPassword) return null
  if (inputEmail && inputEmail !== envEmail) return null

  const role = await pgOne(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ('GODMODE','GodMode',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`
  )
  const iglesia = await pgOne(
    `INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt")
     VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("token") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`,
    ['GodMode', 'GODMODE-ROOT']
  ).catch(() => pgOne('SELECT "id" FROM "Iglesia" WHERE "token"=$1 LIMIT 1', ['GODMODE-ROOT']))

  const exists = await pgOne(
    'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "deletedAt" IS NULL LIMIT 1',
    [envEmail]
  )
  if (exists) return exists

  const hash = await bcrypt.hash(envPassword, 12)
  const created = await pgOne(
    `INSERT INTO "User"
      ("email","password","nombre","apellido","activo","emailVerificado","iglesiaId","rolId","createdAt","updatedAt",
       "rol","plan","pais","divisa","idioma","iglesia","es_superadmin")
     VALUES
      ($1,$2,'Owner','GodMode',true,true,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
       'GODMODE','GODMODE','AR','USD','es','GodMode',true)
     RETURNING *`,
    [envEmail, hash, iglesia.id, role.id]
  )
  return created
}

async function elevateEnvOwnerToGodMode(user, envPassword) {
  const role = await pgOne(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ('GODMODE','GodMode',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`
  )
  const iglesia = await pgOne(
    `INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt")
     VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("token") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`,
    ['GodMode', 'GODMODE-ROOT']
  ).catch(() => pgOne('SELECT "id" FROM "Iglesia" WHERE "token"=$1 LIMIT 1', ['GODMODE-ROOT']))
  const nextHash = await bcrypt.hash(envPassword, 12)
  await pgExec(
    `UPDATE "User"
        SET "rol"='GODMODE', "plan"='GODMODE', "iglesiaId"=$1, "rolId"=$2,
            "activo"=true, "emailVerificado"=true, "password"=$3,
            "es_superadmin"=true, "updatedAt"=CURRENT_TIMESTAMP
      WHERE "id"=$4`,
    [iglesia.id, role.id, nextHash, user.id]
  )
  return pgOne('SELECT * FROM "User" WHERE "id"=$1 LIMIT 1', [user.id])
}

async function issueGodModeSession(req, user) {
  const payload = userPayload(user)
  const accessToken = signAccessToken(payload)
  const refreshToken = createRefreshToken()
  await pgOne(
    `INSERT INTO "user_sessions"
      ("userId","refreshToken","userAgent","ip","expiresAt","revoked","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,NOW() + INTERVAL '30 days',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [user.id, refreshToken, String(req.headers['user-agent'] || ''), String(req.ip || '')]
  )
  return { token: accessToken, refreshToken, user: payload }
}

// ── POST /godmode/login ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  await ensureGodModeSchema()
  const { email = '', password = '' } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  const normalizedEmail = String(email).toLowerCase().trim()
  const inputPassword   = String(password)
  const envEmail        = String(process.env.GODMODE_USER_EMAIL || '').trim().toLowerCase()
  const envPassword     = String(process.env.GODMODE_USER_PASSWORD || '').trim()
  const isEnvOwner      = normalizedEmail === envEmail && !!envPassword

  let user = await pgOne(
    'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "activo"=true AND "deletedAt" IS NULL LIMIT 1',
    [normalizedEmail]
  )
  if (!user) user = await ensureGodModeUserFromEnv(normalizedEmail)

  // Reclamo de cuenta: si el email coincide con el env y la contraseña cruda también → elevar
  if (user && user.rol !== 'GODMODE' && isEnvOwner && inputPassword === envPassword) {
    user = await elevateEnvOwnerToGodMode(user, envPassword)
  }

  if (!user || user.rol !== 'GODMODE') {
    const hasEnv = !!envEmail && !!envPassword
    logger.warn({ email: normalizedEmail }, 'GodMode login: rol no es GODMODE')
    return res.status(401).json({ error: hasEnv ? 'Credenciales inválidas' : 'GodMode no configurado en servidor.' })
  }

  // Segunda verificación: flag es_superadmin en DB
  if (!user.es_superadmin) {
    logger.warn({ userId: user.id }, 'GodMode login: es_superadmin=false')
    return res.status(403).json({
      error: 'Acceso superadmin no habilitado. Ejecutá: node scripts/make-superadmin.mjs <email>',
      code: 'SUPERADMIN_NOT_ENABLED',
    })
  }

  let ok = await bcrypt.compare(inputPassword, user.password || '')
  if (!ok && isEnvOwner && String(password) === envPassword) {
    const newHash = await bcrypt.hash(envPassword, 12)
    await pgExec('UPDATE "User" SET "password"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2', [newHash, user.id])
    user.password = newHash
    ok = true
  }
  if (!ok) {
    logger.warn({ userId: user.id }, 'GodMode login: contraseña incorrecta')
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }

  const session = await issueGodModeSession(req, user)
  await auditLog(user.id, 'LOGIN', { ip: req.ip }, req.ip)
  logger.info({ userId: user.id, email: user.email }, 'GodMode login exitoso')
  return res.json(session)
})

// ── GET /godmode/overview ─────────────────────────────────────────────────────
router.get('/overview', ...gdProtect, async (_req, res) => {
  const [users, churches, plans, payments, oauth, mailCfg] = await Promise.all([
    pgOne('SELECT COUNT(*)::int AS total FROM "User" WHERE "deletedAt" IS NULL'),
    pgOne('SELECT COUNT(*)::int AS total FROM "Iglesia" WHERE "deletedAt" IS NULL'),
    pgMany('SELECT "plan", COUNT(*)::int AS total FROM "User" WHERE "deletedAt" IS NULL GROUP BY "plan" ORDER BY total DESC'),
    pgMany(
      `SELECT c."iglesiaId", i."nombre" AS iglesia, c."valor" AS ultimoPago
         FROM "Configuracion" c
         LEFT JOIN "Iglesia" i ON i."id" = c."iglesiaId"
        WHERE c."clave"='ultimo_pago'
        ORDER BY c."updatedAt" DESC LIMIT 20`
    ),
    pgMany(
      `SELECT u."id", u."email", u."nombre", u."iglesiaId", i."nombre" AS iglesia,
              u."oauth_provider", u."createdAt"
         FROM "User" u
         LEFT JOIN "Iglesia" i ON i."id" = u."iglesiaId"
        WHERE u."deletedAt" IS NULL
          AND u."oauth_provider" IS NOT NULL AND u."oauth_provider" <> ''
        ORDER BY u."createdAt" DESC LIMIT 50`
    ),
    pgMany(
      `SELECT c."iglesiaId", i."nombre" AS iglesia, c."clave", c."valor", c."updatedAt"
         FROM "Configuracion" c
         LEFT JOIN "Iglesia" i ON i."id" = c."iglesiaId"
        WHERE c."clave" IN ('email_from','resend_key','resend_status')
        ORDER BY c."updatedAt" DESC LIMIT 100`
    ),
  ])

  const paidChurchIds = new Set(payments.map(p => Number(p.iglesiaid || p.iglesiaId)).filter(Boolean))
  const allChurchRows = await pgMany('SELECT "id","nombre","createdAt" FROM "Iglesia" WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 100')
  const billing = allChurchRows.map(ch => ({
    iglesiaId: ch.id, iglesia: ch.nombre, createdAt: ch.createdAt,
    pagoRegistrado: paidChurchIds.has(Number(ch.id)),
  }))

  const contactMail = getContactMailStatus()
  const ownerInbox  = String(process.env.OWNER_REPORTS_EMAIL || '').trim().toLowerCase()
  const supportInbox = contactMail.aliases.find(a => a.key === 'soporte')?.targetEmail || contactMail.adminFallbackEmail

  res.json({
    kpis: {
      totalUsers: Number(users?.total || 0),
      totalChurches: Number(churches?.total || 0),
      paidChurches: billing.filter(b => b.pagoRegistrado).length,
      unpaidChurches: billing.filter(b => !b.pagoRegistrado).length,
    },
    plans, billing, recentPayments: payments, oauthAccounts: oauth, mailConfigs: mailCfg,
    contactMail,
    mailboxHint: {
      recommended: ownerInbox || contactMail.adminFallbackEmail,
      ownerInboxConfigured: !!ownerInbox, ownerInbox, supportInbox,
    },
    generatedAt: new Date().toISOString(),
  })
})

// ── GET /godmode/transferencias ───────────────────────────────────────────────
router.get('/transferencias', ...gdProtect, async (_req, res) => {
  const rows = await pgMany(
    `SELECT c."iglesiaId",
       MAX(CASE WHEN c."clave"='transferencia_plan'   THEN c."valor" END) AS plan,
       MAX(CASE WHEN c."clave"='transferencia_monto'  THEN c."valor" END) AS monto,
       MAX(CASE WHEN c."clave"='transferencia_fecha'  THEN c."valor" END) AS fecha,
       MAX(CASE WHEN c."clave"='nombre_iglesia'       THEN c."valor" END) AS iglesia
     FROM "Configuracion" c
     WHERE c."clave" IN ('transferencia_solicitada','transferencia_plan','transferencia_monto','transferencia_fecha','nombre_iglesia')
     GROUP BY c."iglesiaId"
     HAVING MAX(CASE WHEN c."clave"='transferencia_solicitada' THEN c."valor" END) = '1'
     ORDER BY MAX(CASE WHEN c."clave"='transferencia_fecha' THEN c."valor" END) DESC NULLS LAST`,
    []
  )
  return res.json({ ok: true, pendientes: rows })
})

// ── POST /godmode/transferencias/aprobar ─────────────────────────────────────
router.post('/transferencias/aprobar', ...gdProtect, async (req, res) => {
  const { iglesiaId, plan } = req.body || {}
  if (!iglesiaId) return res.status(400).json({ error: 'iglesiaId requerido' })

  const planKey  = normalizePlan(plan || 'PRO')
  const planInfo = PLANES[planKey]
  const vence    = new Date(); vence.setMonth(vence.getMonth() + 1)

  async function set(clave, valor) {
    await pgExec(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
      [Number(iglesiaId), clave, String(valor ?? '')]
    )
  }
  await set('plan',                   planKey)
  await set('plan_label',             planInfo.label.es)
  await set('plan_personas_max',      String(planInfo.personas))
  await set('suscripcion_activa',     '1')
  await set('suscripcion_vence',      vence.toISOString().slice(0, 10))
  await set('ultimo_pago',            new Date().toISOString().slice(0, 10))
  await set('plan_pendiente',         '')
  await set('transferencia_solicitada','0')
  await set('metodo_pago',            'transferencia')

  await auditLog(req.user.id, 'APROBAR_TRANSFERENCIA', { iglesiaId, plan: planKey, vence: vence.toISOString().slice(0, 10) }, req.ip)
  return res.json({ ok: true, iglesiaId, plan: planKey, vence: vence.toISOString().slice(0, 10) })
})

// ── POST /godmode/mail-test ───────────────────────────────────────────────────
router.post('/mail-test', ...gdProtect, async (req, res) => {
  const mode  = String(req.body?.mode  || 'outbound').toLowerCase()
  const alias = String(req.body?.alias || 'soporte').toLowerCase()
  if (!['outbound', 'inbound'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'mode debe ser outbound o inbound' })
  }
  const result = await runContactMailSmoke({ mode, alias, actorEmail: req.user.email, source: 'godmode' })
  await auditLog(req.user.id, 'MAIL_TEST', { mode, alias }, req.ip)
  return res.json({ ok: true, ...result, contactMail: getContactMailStatus() })
})

// ── GET /godmode/audit-log ────────────────────────────────────────────────────
router.get('/audit-log', ...gdProtect, async (_req, res) => {
  await ensureGodModeSchema()
  const rows = await pgMany(
    `SELECT a.id, a.usuario_id, u.email, a.accion, a.detalle, a.ip, a.creado_at
       FROM godmode_audit a
       LEFT JOIN "User" u ON u.id = a.usuario_id
      ORDER BY a.creado_at DESC
      LIMIT 200`
  ).catch(() => [])
  return res.json({ ok: true, items: rows })
})

export default router
