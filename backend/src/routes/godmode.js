import { Router } from 'express'
import { pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
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
