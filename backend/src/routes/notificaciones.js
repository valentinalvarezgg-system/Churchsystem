import { Router }  from 'express'
import webpush      from 'web-push'
import db           from '../lib/db.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'

const router = Router()

// Configurar VAPID (solo si están definidas las keys)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@churchsystem.com.ar',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// Asegurar tabla
function ensureTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      userId    INTEGER NOT NULL,
      endpoint  TEXT    NOT NULL UNIQUE,
      keys      TEXT    NOT NULL,
      createdAt TEXT    DEFAULT (datetime('now'))
    )
  `)
}

// ── GET /notificaciones/vapid-key ──────────────────────────────
router.get('/vapid-key', requireAuth, (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
})

// ── POST /notificaciones/subscribe ────────────────────────────
router.post('/subscribe', requireAuth, (req, res) => {
  const { subscription } = req.body
  if (!subscription?.endpoint || !subscription?.keys)
    return res.status(400).json({ error: 'Suscripción inválida' })

  ensureTable()
  try {
    db.run(
      `INSERT INTO push_subscriptions (userId, endpoint, keys)
       VALUES (?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET userId=excluded.userId, keys=excluded.keys`,
      [req.user.id, subscription.endpoint, JSON.stringify(subscription.keys)]
    )
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── DELETE /notificaciones/unsubscribe ─────────────────────────
router.delete('/unsubscribe', requireAuth, (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'Endpoint requerido' })
  ensureTable()
  db.run('DELETE FROM push_subscriptions WHERE userId=? AND endpoint=?', [req.user.id, endpoint])
  res.json({ ok: true })
})

// ── POST /notificaciones/test ──────────────────────────────────
router.post('/test', requireAuth, async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY)
    return res.status(400).json({ error: 'VAPID no configurado' })

  ensureTable()
  const subs = db.all('SELECT endpoint, keys FROM push_subscriptions WHERE userId=?', [req.user.id])
  if (!subs.length)
    return res.status(404).json({ error: 'No hay suscripciones activas' })

  let ok = 0, errors = 0
  for (const row of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: JSON.parse(row.keys) },
        JSON.stringify({ title: '🔔 Church System', body: '¡Notificaciones activas!', url: '/' })
      )
      ok++
    } catch (err) {
      errors++
      if (err.statusCode === 410)
        db.run('DELETE FROM push_subscriptions WHERE endpoint=?', [row.endpoint])
    }
  }
  res.json({ ok: true, enviadas: ok, errores: errors })
})

// ── Función exportada para scheduler diario ────────────────────
export async function enviarAlertas() {
  if (!process.env.VAPID_PUBLIC_KEY) return
  ensureTable()

  const hoy = new Date().toISOString().slice(0, 10)

  const cumpleanos = db.get(
    `SELECT COUNT(*) as n FROM personas
     WHERE strftime('%m-%d', fechaNacimiento) = strftime('%m-%d', 'now') AND estado != 'INACTIVO'`
  )?.n || 0

  const vencidos = db.get(
    `SELECT COUNT(*) as n FROM seguimientos
     WHERE proximo_contacto <= ? AND estado = 'PENDIENTE'`, [hoy]
  )?.n || 0

  const visitantes = db.get(
    `SELECT COUNT(*) as n FROM personas
     WHERE estado = 'VISITANTE' AND fecha_ingreso <= date('now', '-30 days')`
  )?.n || 0

  const alertas = [
    ...(cumpleanos > 0 ? [`🎂 ${cumpleanos} cumpleaños hoy`] : []),
    ...(vencidos   > 0 ? [`⏰ ${vencidos} seguimientos vencidos`] : []),
    ...(visitantes > 0 ? [`👋 ${visitantes} visitantes sin consolidar`] : []),
  ]
  if (!alertas.length) return

  const admins = db.all(
    `SELECT id FROM users WHERE rol IN ('PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION')`
  ).map(r => r.id)
  if (!admins.length) return

  const placeholders = admins.map(() => '?').join(',')
  const subs = db.all(
    `SELECT endpoint, keys FROM push_subscriptions WHERE userId IN (${placeholders})`, admins
  )

  const payload = JSON.stringify({
    title: '🔔 Alertas pastorales',
    body: alertas.join(' · '),
    url: '/alertas'
  })

  for (const row of subs) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: JSON.parse(row.keys) }, payload)
    } catch (err) {
      if (err.statusCode === 410)
        db.run('DELETE FROM push_subscriptions WHERE endpoint=?', [row.endpoint])
    }
  }
  console.log(`⏰  Alertas enviadas: ${alertas.join(', ')}`)
}

export default router
