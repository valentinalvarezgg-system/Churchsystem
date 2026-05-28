import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

// ── GET /reportes/semanal ────────────────────────────────────────────────────
router.get('/semanal', requireAuth, (_req, res) => {
  const hoy   = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - hoy.getDay() + 1)
  const dom = new Date(lunes)
  dom.setDate(lunes.getDate() + 6)
  const desde = lunes.toISOString().slice(0, 10)
  const hasta  = dom.toISOString().slice(0, 10)

  res.json({
    periodo:       { desde, hasta },
    nuevasPersonas: db.all(
      `SELECT id, nombre, apellido, estado, cultoDia, createdAt
       FROM personas WHERE DATE(createdAt) BETWEEN ? AND ?
       ORDER BY createdAt DESC`, [desde, hasta]
    ),
    cultos: db.all(
      `SELECT c.nombre, c.fecha,
         COUNT(CASE WHEN a.presente=1 THEN 1 END) as presentes,
         COUNT(a.id) as total
       FROM cultos c
       LEFT JOIN asistencias a ON a.cultoId=c.id
       WHERE c.fecha BETWEEN ? AND ?
       GROUP BY c.id ORDER BY c.fecha`, [desde, hasta]
    ),
    seguimientos: db.all(
      `SELECT tipo, COUNT(*) as qty FROM seguimientos
       WHERE DATE(createdAt) BETWEEN ? AND ? GROUP BY tipo`, [desde, hasta]
    ),
    mensajes: db.get(
      `SELECT COUNT(*) as qty, SUM(enviado) as enviados
       FROM mensajes WHERE DATE(createdAt) BETWEEN ? AND ?`, [desde, hasta]
    ),
    ofrendas: db.get(
      `SELECT COUNT(*) as qty, COALESCE(SUM(monto),0) as total
       FROM finanzas WHERE fecha BETWEEN ? AND ?`, [desde, hasta]
    ),
    totales: {
      personas:  Number(db.get('SELECT COUNT(*) as c FROM personas')?.c ?? 0),
      activos:   Number(db.get("SELECT COUNT(*) as c FROM personas WHERE estado='ACTIVO'")?.c ?? 0),
      visitantes:Number(db.get("SELECT COUNT(*) as c FROM personas WHERE estado='VISITANTE'")?.c ?? 0),
      grupos:    Number(db.get('SELECT COUNT(*) as c FROM grupos')?.c ?? 0),
    },
    generadoEl: new Date().toISOString()
  })
})

// ── GET /reportes/mensual?mes=YYYY-MM ────────────────────────────────────────
router.get('/mensual', requireAuth, (req, res) => {
  const m = req.query.mes || new Date().toISOString().slice(0, 7)

  // Calcular rango del mes correctamente
  const [y, mo] = m.split('-').map(Number)
  const desde   = `${m}-01`
  const hasta   = new Date(y, mo, 0).toISOString().slice(0, 10) // último día del mes

  const finanzas = db.all(
    `SELECT tipo, SUM(monto) as total, COUNT(*) as qty
     FROM finanzas WHERE strftime('%Y-%m', fecha)=?
     GROUP BY tipo`, [m]
  )

  res.json({
    mes: m, desde, hasta,
    personas: db.all("SELECT estado, COUNT(*) as total FROM personas GROUP BY estado"),
    crecimiento: db.all(
      `SELECT strftime('%d', createdAt) as dia, COUNT(*) as qty
       FROM personas WHERE strftime('%Y-%m', createdAt)=?
       GROUP BY dia ORDER BY dia`, [m]
    ),
    asistencia: db.all(
      `SELECT c.nombre, c.fecha,
         COUNT(CASE WHEN a.presente=1 THEN 1 END) as presentes,
         COUNT(a.id) as total
       FROM cultos c
       LEFT JOIN asistencias a ON a.cultoId=c.id
       WHERE strftime('%Y-%m', c.fecha)=?
       GROUP BY c.id ORDER BY c.fecha`, [m]
    ),
    finanzas,
    totalOfrendas: finanzas.reduce((a, b) => a + Number(b.total), 0),
    generadoEl: new Date().toISOString()
  })
})

export default router
