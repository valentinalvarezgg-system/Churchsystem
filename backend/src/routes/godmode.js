import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { normalizePlan, PLANES } from '../lib/billing.js'
import { sendNotificationEmail } from '../lib/email.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const router = Router()

function requireGodMode(req, res, next) {
  if (req.user?.rol !== 'GODMODE') return res.status(403).json({ error: 'GodMode no habilitado para este usuario' })
  return next()
}

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado')
  return process.env.JWT_SECRET
}

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
  }
}

async function issueSession(req, user) {
  const payload = userPayload(user)
  const accessToken = signAccessToken(payload)
  const refreshToken = createRefreshToken()
  await pgOne(
    'INSERT INTO "user_sessions" ("userId","refreshToken","userAgent","ip","expiresAt","revoked","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW() + INTERVAL \'30 days\',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
    [user.id, refreshToken, String(req.headers['user-agent'] || ''), String(req.ip || '')]
  )
  return { token: accessToken, refreshToken, user: payload }
}

router.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })
  const user = await pgOne(
    'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "activo"=true AND "deletedAt" IS NULL LIMIT 1',
    [String(email).toLowerCase()]
  )
  if (!user || user.rol !== 'GODMODE') return res.status(401).json({ error: 'Credenciales inválidas' })
  const ok = await bcrypt.compare(password, user.password || '')
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' })
  const session = await issueSession(req, user)
  return res.json(session)
})

router.get('/overview', requireAuth, requireGodMode, async (_req, res) => {
  const [users, churches, plans, payments, oauth, mailCfg] = await Promise.all([
    pgOne('SELECT COUNT(*)::int AS total FROM "User" WHERE "deletedAt" IS NULL'),
    pgOne('SELECT COUNT(*)::int AS total FROM "Iglesia" WHERE "deletedAt" IS NULL'),
    pgMany('SELECT "plan", COUNT(*)::int AS total FROM "User" WHERE "deletedAt" IS NULL GROUP BY "plan" ORDER BY total DESC'),
    pgMany(
      `SELECT c."iglesiaId", i."nombre" AS iglesia, c."valor" AS ultimoPago
       FROM "Configuracion" c
       LEFT JOIN "Iglesia" i ON i."id" = c."iglesiaId"
       WHERE c."clave"='ultimo_pago'
       ORDER BY c."updatedAt" DESC
       LIMIT 20`
    ),
    pgMany(
      `SELECT u."id", u."email", u."nombre", u."iglesiaId", i."nombre" AS iglesia, u."oauth_provider", u."createdAt"
       FROM "User" u
       LEFT JOIN "Iglesia" i ON i."id" = u."iglesiaId"
       WHERE u."deletedAt" IS NULL AND u."oauth_provider" IS NOT NULL AND u."oauth_provider" <> ''
       ORDER BY u."createdAt" DESC
       LIMIT 50`
    ),
    pgMany(
      `SELECT c."iglesiaId", i."nombre" AS iglesia, c."clave", c."valor", c."updatedAt"
       FROM "Configuracion" c
       LEFT JOIN "Iglesia" i ON i."id" = c."iglesiaId"
       WHERE c."clave" IN ('email_from','resend_key','resend_status')
       ORDER BY c."updatedAt" DESC
       LIMIT 100`
    ),
  ])

  const paidChurchIds = new Set(payments.map(p => Number(p.iglesiaid || p.iglesiaId)).filter(Boolean))
  const allChurchRows = await pgMany('SELECT "id","nombre","createdAt" FROM "Iglesia" WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 100')
  const billing = allChurchRows.map(ch => ({
    iglesiaId: ch.id,
    iglesia: ch.nombre,
    createdAt: ch.createdAt,
    pagoRegistrado: paidChurchIds.has(Number(ch.id)),
  }))

  const ownerInbox = String(process.env.OWNER_REPORTS_EMAIL || '').trim().toLowerCase()
  const supportInbox = String(process.env.SUPPORT_EMAIL || 'soporte@churchsystem.com.ar').trim().toLowerCase()

  res.json({
    kpis: {
      totalUsers: Number(users?.total || 0),
      totalChurches: Number(churches?.total || 0),
      paidChurches: billing.filter(b => b.pagoRegistrado).length,
      unpaidChurches: billing.filter(b => !b.pagoRegistrado).length,
    },
    plans,
    billing,
    recentPayments: payments,
    oauthAccounts: oauth,
    mailConfigs: mailCfg,
    mailboxHint: {
      info: 'Para centralizar reportes, usar OWNER_REPORTS_EMAIL y reenviar soporte/bugs ahí.',
      recommended: ownerInbox || 'reports@churchsystem.com.ar',
      ownerInboxConfigured: !!ownerInbox,
      ownerInbox,
      supportInbox,
    },
    generatedAt: new Date().toISOString(),
  })
})

// ── GET /godmode/transferencias ────────────────────────────────────
router.get('/transferencias', requireAuth, requireGodMode, async (_req, res) => {
  const rows = await pgMany(
    `SELECT c."iglesiaId",
       MAX(CASE WHEN c."clave"='transferencia_plan' THEN c."valor" END) AS plan,
       MAX(CASE WHEN c."clave"='transferencia_monto' THEN c."valor" END) AS monto,
       MAX(CASE WHEN c."clave"='transferencia_fecha' THEN c."valor" END) AS fecha,
       MAX(CASE WHEN c."clave"='nombre_iglesia' THEN c."valor" END) AS iglesia
     FROM "Configuracion" c
     WHERE c."clave" IN ('transferencia_solicitada','transferencia_plan','transferencia_monto','transferencia_fecha','nombre_iglesia')
     GROUP BY c."iglesiaId"
     HAVING MAX(CASE WHEN c."clave"='transferencia_solicitada' THEN c."valor" END) = '1'
     ORDER BY MAX(CASE WHEN c."clave"='transferencia_fecha' THEN c."valor" END) DESC NULLS LAST`,
    []
  )
  return res.json({ ok: true, pendientes: rows })
})

// ── POST /godmode/transferencias/aprobar ──────────────────────────
router.post('/transferencias/aprobar', requireAuth, requireGodMode, async (req, res) => {
  const { iglesiaId, plan } = req.body || {}
  if (!iglesiaId) return res.status(400).json({ error: 'iglesiaId requerido' })

  const planKey = normalizePlan(plan || 'PRO')
  const planInfo = PLANES[planKey]
  const vence = new Date()
  vence.setMonth(vence.getMonth() + 1)

  async function set(clave, valor) {
    await pgExec(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
      [Number(iglesiaId), clave, String(valor ?? '')]
    )
  }

  await set('plan', planKey)
  await set('plan_label', planInfo.label.es)
  await set('plan_personas_max', String(planInfo.personas))
  await set('suscripcion_activa', '1')
  await set('suscripcion_vence', vence.toISOString().slice(0, 10))
  await set('ultimo_pago', new Date().toISOString().slice(0, 10))
  await set('plan_pendiente', '')
  await set('transferencia_solicitada', '0')
  await set('metodo_pago', 'transferencia')

  return res.json({ ok: true, iglesiaId, plan: planKey, vence: vence.toISOString().slice(0, 10) })
})

router.post('/mail-test', requireAuth, requireGodMode, async (req, res) => {
  const ownerInbox = String(process.env.OWNER_REPORTS_EMAIL || '').trim()
  if (!ownerInbox) return res.status(400).json({ ok: false, error: 'OWNER_REPORTS_EMAIL no configurado' })
  const result = await sendNotificationEmail({
    to: ownerInbox,
    subject: 'GodMode mail test - Church System',
    title: 'Prueba de inbox central',
    intro: 'Este es un envío de verificación desde GodMode.',
    lines: [
      `Usuario: ${req.user.email}`,
      `Fecha: ${new Date().toISOString()}`,
      'Si recibiste este mail, la ruta de reportes central está operativa.',
    ],
  })
  return res.json({ ok: true, result, ownerInbox })
})

export default router
