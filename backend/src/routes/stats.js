import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import db from '../lib/db.js'

const router = Router()

function n(row, key = 'c') {
  return Number(row?.[key] ?? 0)
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

function previousMonthKey() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return monthKey(d)
}

function variation(current, previous) {
  if (!previous) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function asistenciaResumen(where = '', params = []) {
  const rows = db.all(
    `SELECT c.id,
            COUNT(a.id) as total,
            COUNT(CASE WHEN a.presente=1 THEN 1 END) as presentes
       FROM cultos c
       LEFT JOIN asistencias a ON a.cultoId = c.id
       ${where}
       GROUP BY c.id`,
    params
  )
  const total = rows.reduce((acc, r) => acc + Number(r.total || 0), 0)
  const presentes = rows.reduce((acc, r) => acc + Number(r.presentes || 0), 0)
  return {
    cultos: rows.length,
    total,
    presentes,
    promedio: total > 0 ? Math.round((presentes / total) * 100) : 0,
  }
}

function dashboardStats() {
  const hoy = new Date().toISOString().slice(0, 10)
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()

  const personas = n(db.get('SELECT COUNT(*) as c FROM personas WHERE estado != "INACTIVO"'))
  const activos = n(db.get("SELECT COUNT(*) as c FROM personas WHERE estado='ACTIVO'"))
  const visitantes = n(db.get("SELECT COUNT(*) as c FROM personas WHERE estado='VISITANTE'"))
  const grupos = n(db.get('SELECT COUNT(*) as c FROM grupos'))
  const cultos = n(db.get('SELECT COUNT(*) as c FROM cultos'))
  const nuevosMes = n(db.get('SELECT COUNT(*) as c FROM personas WHERE substr(createdAt,1,7)=?', [mesActual]))
  const nuevosMesPasado = n(db.get('SELECT COUNT(*) as c FROM personas WHERE substr(createdAt,1,7)=?', [mesPasado]))
  const asistencia = asistenciaResumen()

  const totales = {
    personas,
    activos,
    visitantes,
    grupos,
    cultos,
    pctAsistencia: asistencia.promedio,
    nuevosMes,
    variacionPersonas: variation(nuevosMes, nuevosMesPasado),
    seguimientosVencidos: n(db.get(
      `SELECT COUNT(*) as c FROM seguimientos
       WHERE proximoContacto IS NOT NULL AND proximoContacto < ?`,
      [hoy]
    )),
    visitantesSinConsolidar: n(db.get(
      `SELECT COUNT(*) as c FROM personas
       WHERE estado='VISITANTE' AND fechaIngreso <= date('now','-14 days')`
    )),
    consolidacionActiva: n(db.get("SELECT COUNT(*) as c FROM consolidaciones WHERE estado != 'COMPLETADA'")),
    oracionesActivas: n(db.get("SELECT COUNT(*) as c FROM oracion WHERE estado='ACTIVA'")),
    sinSeguimiento: n(db.get(
      `SELECT COUNT(*) as c FROM personas p
       WHERE p.estado IN ('ACTIVO','VISITANTE','NUEVO')
         AND NOT EXISTS (SELECT 1 FROM seguimientos s WHERE s.personaId=p.id)`
    )),
  }

  const asistenciaReciente = db.all(
    `SELECT c.id, c.nombre, c.fecha,
            COUNT(a.id) as total,
            COUNT(CASE WHEN a.presente=1 THEN 1 END) as presentes
       FROM cultos c
       LEFT JOIN asistencias a ON a.cultoId = c.id
       GROUP BY c.id
       ORDER BY c.fecha DESC, c.id DESC
       LIMIT 5`
  )

  const proximosContactos = db.all(
    `SELECT s.personaId, s.tipo, s.proximoContacto, p.nombre, p.apellido
       FROM seguimientos s
       JOIN personas p ON p.id = s.personaId
      WHERE s.proximoContacto IS NOT NULL
        AND s.id IN (SELECT MAX(id) FROM seguimientos WHERE proximoContacto IS NOT NULL GROUP BY personaId)
      ORDER BY s.proximoContacto ASC
      LIMIT 8`
  )

  const cumpleanos = db.all(
    `SELECT id, nombre, apellido, fechaNacimiento, strftime('%m-%d', fechaNacimiento) as cumDia
       FROM personas
      WHERE fechaNacimiento IS NOT NULL AND fechaNacimiento != '' AND estado != 'INACTIVO'`
  ).filter(p => {
    const [m, d] = String(p.cumDia || '').split('-').map(Number)
    if (!m || !d) return false
    const target = new Date(new Date().getFullYear(), m - 1, d)
    if (target < new Date()) target.setFullYear(target.getFullYear() + 1)
    const days = Math.ceil((target - new Date()) / 86400000)
    return days >= 0 && days <= 30
  }).sort((a, b) => String(a.cumDia).localeCompare(String(b.cumDia))).slice(0, 8)

  const crecimientoMensual = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const mes = d.toISOString().slice(0, 7)
    crecimientoMensual.push({
      mes,
      nuevos: n(db.get('SELECT COUNT(*) as c FROM personas WHERE substr(createdAt,1,7)=?', [mes])),
    })
  }

  const actividadReciente = db.all(
    `SELECT accion, entidad, entidadId, detalle, email as usuario, fecha as createdAt
       FROM auditoria
      ORDER BY id DESC
      LIMIT 12`
  )

  return {
    totales,
    asistenciaReciente,
    proximosContactos,
    cumpleanos,
    crecimientoMensual,
    actividadReciente,
    syncedAt: new Date().toISOString(),
  }
}

router.get('/', requireAuth, (_req, res) => {
  res.json(dashboardStats())
})

router.get('/personas', requireAuth, (_req, res) => {
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()
  const total = n(db.get('SELECT COUNT(*) as c FROM personas WHERE estado != "INACTIVO"'))
  const nuevosMes = n(db.get('SELECT COUNT(*) as c FROM personas WHERE substr(createdAt,1,7)=?', [mesActual]))
  const nuevosMesPasado = n(db.get('SELECT COUNT(*) as c FROM personas WHERE substr(createdAt,1,7)=?', [mesPasado]))
  res.json({ total, mes:nuevosMes, variacion:variation(nuevosMes, nuevosMesPasado), nuevosMes })
})

router.get('/asistencias', requireAuth, (_req, res) => {
  const actual = asistenciaResumen()
  const mesPasado = previousMonthKey()
  const pasado = asistenciaResumen("WHERE substr(c.fecha,1,7)=?", [mesPasado])
  const mesActual = monthKey()
  const totalMes = asistenciaResumen("WHERE substr(c.fecha,1,7)=?", [mesActual]).presentes
  res.json({ promedio: actual.promedio, variacion: variation(actual.promedio, pasado.promedio), totalMes })
})

router.get('/grupos', requireAuth, (_req, res) => {
  const total = n(db.get('SELECT COUNT(*) as c FROM grupos'))
  const mesPasado = previousMonthKey()
  const totalPasado = n(db.get('SELECT COUNT(*) as c FROM grupos WHERE substr(createdAt,1,7) <= ?', [mesPasado]))
  const miembrosTotal = n(db.get('SELECT COUNT(*) as c FROM personas WHERE grupoId IS NOT NULL'))
  res.json({ total, variacion: variation(total, totalPasado), miembrosProm: total > 0 ? Math.round(miembrosTotal / total) : 0 })
})

router.get('/seguimientos', requireAuth, (_req, res) => {
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()
  const mes = n(db.get('SELECT COUNT(*) as c FROM seguimientos WHERE substr(createdAt,1,7)=?', [mesActual]))
  const prev = n(db.get('SELECT COUNT(*) as c FROM seguimientos WHERE substr(createdAt,1,7)=?', [mesPasado]))
  res.json({ mes, variacion: variation(mes, prev) })
})

router.get('/consolidacion', requireAuth, (_req, res) => {
  const totalConsolidados = n(db.get('SELECT COUNT(*) as c FROM personas WHERE estadoEspiritual IN ("CONSOLIDADO","MINISTERIO")'))
  const mesPasado = previousMonthKey()
  const pasado = n(db.get('SELECT COUNT(*) as c FROM personas WHERE estadoEspiritual IN ("CONSOLIDADO","MINISTERIO") AND substr(createdAt,1,7) <= ?', [mesPasado]))
  const meta = 150
  res.json({ totalConsolidados, variacion: variation(totalConsolidados, pasado), meta })
})

router.get('/tendencia', requireAuth, (_req, res) => {
  const semanas = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const inicio = new Date(d)
    inicio.setDate(d.getDate() - d.getDay())
    const fin = new Date(inicio)
    fin.setDate(inicio.getDate() + 6)
    const iStr = inicio.toISOString().slice(0, 10)
    const fStr = fin.toISOString().slice(0, 10)
    const asist = asistenciaResumen('WHERE c.fecha BETWEEN ? AND ?', [iStr, fStr])
    const nuevos = n(db.get('SELECT COUNT(*) as c FROM personas WHERE DATE(createdAt) BETWEEN ? AND ?', [iStr, fStr]))
    semanas.push({
      semana: `${inicio.getDate()}/${inicio.getMonth() + 1}`,
      asistencia: asist.presentes,
      cultos: asist.cultos,
      nuevos,
    })
  }
  res.json({ semanas })
})

router.get('/actividad', requireAuth, (_req, res) => {
  const personas = db.all('SELECT id, nombre, apellido, estado, createdAt FROM personas ORDER BY createdAt DESC LIMIT 5') || []
  const seguimientos = db.all('SELECT s.*, p.nombre, p.apellido FROM seguimientos s LEFT JOIN personas p ON s.personaId = p.id ORDER BY s.createdAt DESC LIMIT 5') || []
  const cultos = db.all('SELECT * FROM cultos ORDER BY fecha DESC LIMIT 3') || []
  const eventos = db.all('SELECT * FROM eventos ORDER BY fecha DESC LIMIT 3') || []
  res.json({ personas, seguimientos, cultos, eventos })
})

export default router
