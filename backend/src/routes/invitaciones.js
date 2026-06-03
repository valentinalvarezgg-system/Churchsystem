import { Router } from 'express'
import crypto from 'crypto'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { sendNotificationEmail } from '../lib/email.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()
const ADMIN = requireRol('PASTOR_GENERAL', 'PASTOR_CULTO')

const FRONT = () => process.env.FRONTEND_URL || process.env.BASE_URL || 'https://churchsystem.com.ar'
const TTL_DAYS = 7

// ── Asegurar tabla ────────────────────────────────────────────────────────────
async function ensureTable() {
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "Invitacion" (
      "id"          SERIAL PRIMARY KEY,
      "iglesiaId"   INTEGER NOT NULL,
      "email"       TEXT NOT NULL,
      "rol"         TEXT NOT NULL DEFAULT 'LIDER',
      "token"       TEXT NOT NULL UNIQUE,
      "estado"      TEXT NOT NULL DEFAULT 'pendiente',
      "invitadoPor" INTEGER,
      "expiresAt"   TIMESTAMPTZ NOT NULL,
      "acceptedAt"  TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pgExec(`CREATE INDEX IF NOT EXISTS idx_invitacion_iglesia ON "Invitacion"("iglesiaId")`)
  await pgExec(`CREATE INDEX IF NOT EXISTS idx_invitacion_token  ON "Invitacion"("token")`)
}
ensureTable().catch(() => {})

// ── GET /invitaciones ─────────────────────────────────────────────────────────
router.get('/', requireAuth, ADMIN, async (req, res) => {
  try {
    const rows = await pgMany(
      `SELECT i.*, u."nombre" AS "invitadoPorNombre"
       FROM "Invitacion" i
       LEFT JOIN "User" u ON u."id" = i."invitadoPor"
       WHERE i."iglesiaId" = $1
       ORDER BY i."createdAt" DESC
       LIMIT 100`,
      [req.user.iglesiaId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /invitaciones ────────────────────────────────────────────────────────
router.post('/', requireAuth, ADMIN, async (req, res) => {
  try {
    const { email, rol = 'LIDER' } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Email requerido' })

    const ROLES_VALIDOS = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF','LIDER']
    if (!ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: 'Rol inválido' })

    // Revocar invitaciones pendientes previas para ese email en esta iglesia
    await pgExec(
      `UPDATE "Invitacion" SET "estado"='revocada', "updatedAt"=NOW()
       WHERE "iglesiaId"=$1 AND lower("email")=lower($2) AND "estado"='pendiente'`,
      [req.user.iglesiaId, email]
    )

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TTL_DAYS * 86400000).toISOString()

    const inv = await pgOne(
      `INSERT INTO "Invitacion"
        ("iglesiaId","email","rol","token","estado","invitadoPor","expiresAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'pendiente',$5,$6,NOW(),NOW())
       RETURNING *`,
      [req.user.iglesiaId, email.toLowerCase(), rol, token, req.user.id, expiresAt]
    )

    const link = `${FRONT()}/registro?invite=${token}`

    // Email de invitación
    await sendNotificationEmail({
      to: email,
      subject: `Invitación a Church System — ${req.user.nombre || req.user.email} te invita`,
      title: 'Fuiste invitado/a a Church System',
      intro: `${req.user.nombre || req.user.email} te invitó a unirte a su equipo en Church System con el rol de ${rol}.`,
      lines: [
        `Esta invitación vence en ${TTL_DAYS} días.`,
        'Si no conocés a quien te invitó, podés ignorar este mensaje.',
      ],
      actionUrl: link,
      actionLabel: 'Aceptar invitación',
    }).catch(() => {})

    registrar({
      userId: req.user.id, email: req.user.email, rol: req.user.rol,
      accion: 'CREAR', entidad: 'INVITACION', entidadId: inv.id,
      detalle: `${email} como ${rol}`, iglesiaId: req.user.iglesiaId,
    })

    res.status(201).json({ ...inv, link })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /invitaciones/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAuth, ADMIN, async (req, res) => {
  try {
    const inv = await pgOne(
      'SELECT * FROM "Invitacion" WHERE "id"=$1 AND "iglesiaId"=$2 LIMIT 1',
      [req.params.id, req.user.iglesiaId]
    )
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' })

    await pgExec(
      `UPDATE "Invitacion" SET "estado"='revocada', "updatedAt"=NOW() WHERE "id"=$1`,
      [inv.id]
    )

    registrar({
      userId: req.user.id, email: req.user.email, rol: req.user.rol,
      accion: 'ELIMINAR', entidad: 'INVITACION', entidadId: inv.id,
      detalle: inv.email, iglesiaId: req.user.iglesiaId,
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /invitaciones/verificar/:token — público, para el flujo de registro ───
router.get('/verificar/:token', async (req, res) => {
  try {
    const inv = await pgOne(
      `SELECT i.*, ig."nombre" AS "iglesiaNombre"
       FROM "Invitacion" i
       JOIN "Iglesia" ig ON ig."id" = i."iglesiaId"
       WHERE i."token"=$1 LIMIT 1`,
      [req.params.token]
    )
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' })
    if (inv.estado !== 'pendiente') return res.status(410).json({ error: 'Invitación ya usada o revocada', estado: inv.estado })
    if (new Date(inv.expiresAt) < new Date()) {
      await pgExec(`UPDATE "Invitacion" SET "estado"='expirada', "updatedAt"=NOW() WHERE "id"=$1`, [inv.id])
      return res.status(410).json({ error: 'Invitación expirada' })
    }
    res.json({
      email: inv.email,
      rol: inv.rol,
      iglesiaId: inv.iglesiaId,
      iglesiaNombre: inv.iglesiaNombre,
      expiresAt: inv.expiresAt,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
