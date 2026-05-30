import { Router } from 'express'
import { pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()

function isGodModeUser(req) {
  const allowed = String(process.env.GODMODE_EMAILS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
  return !!req.user?.email && allowed.includes(String(req.user.email).toLowerCase())
}

function requireGodMode(req, res, next) {
  if (!isGodModeUser(req)) return res.status(403).json({ error: 'GodMode no habilitado para este usuario' })
  return next()
}

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
