import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

// ── Asegurar tabla ────────────────────────────────────────────────────────────
async function ensureTable() {
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "Sesion" (
      "id"          TEXT PRIMARY KEY,
      "userId"      INTEGER NOT NULL,
      "iglesiaId"   INTEGER,
      "userAgent"   TEXT,
      "dispositivo" TEXT,
      "navegador"   TEXT,
      "ip"          TEXT,
      "pais"        TEXT,
      "current"     BOOLEAN NOT NULL DEFAULT false,
      "lastActive"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "revokedAt"   TIMESTAMPTZ
    )
  `)
  await pgExec(`CREATE INDEX IF NOT EXISTS idx_sesion_user ON "Sesion"("userId")`)
}
ensureTable().catch(() => {})

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseUA(ua = '') {
  const s = ua.toLowerCase()
  let dispositivo = '💻 Desktop'
  if (s.includes('iphone'))            dispositivo = '📱 iPhone'
  else if (s.includes('android'))      dispositivo = '📱 Android'
  else if (s.includes('ipad'))         dispositivo = '📟 iPad'
  else if (s.includes('mobile'))       dispositivo = '📱 Móvil'

  let navegador = 'Otro'
  if (s.includes('edg/'))              navegador = 'Edge'
  else if (s.includes('chrome'))       navegador = 'Chrome'
  else if (s.includes('firefox'))      navegador = 'Firefox'
  else if (s.includes('safari'))       navegador = 'Safari'
  else if (s.includes('opera'))        navegador = 'Opera'

  return { dispositivo, navegador }
}

function getIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    '—'
  )
}

// ── POST /sesiones/touch — llamado en cada login para registrar/actualizar sesión
router.post('/touch', requireAuth, async (req, res) => {
  try {
    const ua = req.headers['user-agent'] || ''
    const { dispositivo, navegador } = parseUA(ua)
    const ip = getIP(req)
    const sessionId = req.headers['x-session-id'] || `sess_${req.user.id}_${Date.now()}`

    // Marcar todas las demás como no-current
    await pgExec(
      `UPDATE "Sesion" SET "current"=false WHERE "userId"=$1 AND "id"!=$2`,
      [req.user.id, sessionId]
    )

    // Upsert sesión actual
    await pgExec(
      `INSERT INTO "Sesion"
        ("id","userId","iglesiaId","userAgent","dispositivo","navegador","ip","current","lastActive","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW(),NOW())
       ON CONFLICT ("id") DO UPDATE SET
        "lastActive"=NOW(), "current"=true, "ip"=$7, "revokedAt"=NULL`,
      [sessionId, req.user.id, req.user.iglesiaId || null, ua.slice(0,300), dispositivo, navegador, ip]
    )

    // Limpiar sesiones viejas (> 30 días sin actividad)
    await pgExec(
      `DELETE FROM "Sesion" WHERE "userId"=$1 AND "lastActive" < NOW() - INTERVAL '30 days'`,
      [req.user.id]
    ).catch(() => {})

    res.json({ ok: true, sessionId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /sesiones — listar sesiones activas del usuario actual ────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await pgMany(
      `SELECT "id","dispositivo","navegador","ip","pais","current","lastActive","createdAt"
       FROM "Sesion"
       WHERE "userId"=$1 AND "revokedAt" IS NULL
       ORDER BY "current" DESC, "lastActive" DESC
       LIMIT 20`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /sesiones/:id — revocar una sesión ─────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const sesion = await pgOne(
      'SELECT * FROM "Sesion" WHERE "id"=$1 AND "userId"=$2 LIMIT 1',
      [req.params.id, req.user.id]
    )
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' })
    if (sesion.current) return res.status(400).json({ error: 'No podés cerrar tu sesión actual desde acá' })

    await pgExec(
      `UPDATE "Sesion" SET "revokedAt"=NOW(), "current"=false WHERE "id"=$1`,
      [req.params.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /sesiones — cerrar todas menos la actual ───────────────────────────
router.delete('/', requireAuth, async (req, res) => {
  try {
    const currentId = req.headers['x-session-id']
    await pgExec(
      `UPDATE "Sesion" SET "revokedAt"=NOW(), "current"=false
       WHERE "userId"=$1 AND "current"=false AND "revokedAt" IS NULL
       ${currentId ? 'AND "id"!=$2' : ''}`,
      currentId ? [req.user.id, currentId] : [req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
