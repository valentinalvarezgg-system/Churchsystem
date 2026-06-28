import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { pgMany, pgOne } from '../lib/pg.js'
import { ensureOperationalTenantDataSynced } from '../lib/core-sync.js'

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

function startOfWeek(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

async function asistenciaResumen(iglesiaId, dateFrom = null, dateTo = null) {
  const params = [iglesiaId]
  let extra = ''
  if (dateFrom && dateTo) {
    params.push(dateFrom, dateTo)
    extra = 'AND c."fecha" BETWEEN $2 AND $3'
  }
  const rows = await pgMany(
    `SELECT c."id",
            COUNT(a."id")::int as total,
            COUNT(CASE WHEN a."presente"=true THEN 1 END)::int as presentes
       FROM "Culto" c
       LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
      WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL ${extra}
      GROUP BY c."id"`,
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

async function weeklyTrendStats(iglesiaId, weeks = 12) {
  const fromDate = startOfWeek(new Date())
  fromDate.setDate(fromDate.getDate() - (weeks - 1) * 7)
  const from = fromDate.toISOString().slice(0, 10)

  const [asistenciaRows, nuevosRows] = await Promise.all([
    pgMany(
      `SELECT DATE_TRUNC('week', TO_DATE(c."fecha",'YYYY-MM-DD'))::date AS semana,
              COUNT(a."id") FILTER (WHERE a."presente"=true)::int AS presentes,
              COUNT(DISTINCT c."id")::int AS cultos
         FROM "Culto" c
         LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
        WHERE c."iglesiaId"=$1
          AND c."deletedAt" IS NULL
          AND TO_DATE(c."fecha",'YYYY-MM-DD') >= $2::date
        GROUP BY 1
        ORDER BY 1 ASC`,
      [iglesiaId, from]
    ),
    pgMany(
      `SELECT DATE_TRUNC('week', "createdAt")::date AS semana,
              COUNT(*)::int AS nuevos
         FROM "Persona"
        WHERE "iglesiaId"=$1
          AND "deletedAt" IS NULL
          AND "createdAt" >= $2::date
        GROUP BY 1
        ORDER BY 1 ASC`,
      [iglesiaId, from]
    ),
  ])

  const asistenciaMap = new Map(
    (asistenciaRows || []).map(row => [
      new Date(row.semana).toISOString().slice(0, 10),
      { asistencia: Number(row.presentes || 0), cultos: Number(row.cultos || 0) },
    ])
  )
  const nuevosMap = new Map(
    (nuevosRows || []).map(row => [
      new Date(row.semana).toISOString().slice(0, 10),
      Number(row.nuevos || 0),
    ])
  )

  const result = []
  for (let i = 0; i < weeks; i++) {
    const current = new Date(fromDate)
    current.setDate(fromDate.getDate() + i * 7)
    const key = current.toISOString().slice(0, 10)
    const asistencia = asistenciaMap.get(key) || { asistencia: 0, cultos: 0 }
    result.push({
      semana: `${current.getDate()}/${current.getMonth() + 1}`,
      asistencia: asistencia.asistencia,
      cultos: asistencia.cultos,
      nuevos: Number(nuevosMap.get(key) || 0),
    })
  }
  return result
}

async function dashboardStats(iglesiaId) {
  await ensureOperationalTenantDataSynced(iglesiaId)
  const hoy = new Date().toISOString().slice(0, 10)
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()
  const crecimientoInicio = new Date()
  crecimientoInicio.setDate(1)
  crecimientoInicio.setMonth(crecimientoInicio.getMonth() - 11)

  const [
    personasRow,
    activosRow,
    visitantesRow,
    gruposRow,
    cultosRow,
    nuevosMesRow,
    nuevosMesPasadoRow,
    asistencia,
    seguimientosVencidosRow,
    visitantesSinConsolidarRow,
    sinSeguimientoRow,
    asistenciaReciente,
    proximosContactos,
    cumpleanosRaw,
    actividadReciente,
    crecimientoRows,
  ] = await Promise.all([
    pgOne(
      `SELECT COUNT(*)::int AS c
         FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND COALESCE("estado",'ACTIVO')!='INACTIVO'`,
      [iglesiaId]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c
         FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"='ACTIVO'`,
      [iglesiaId]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c
         FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"='VISITANTE'`,
      [iglesiaId]
    ),
    pgOne('SELECT COUNT(*)::int AS c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Culto" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
      [iglesiaId, mesActual]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
      [iglesiaId, mesPasado]
    ),
    asistenciaResumen(iglesiaId),
    pgOne(
      `SELECT COUNT(*)::int AS c
         FROM "Seguimiento"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
          AND "proximoContacto" IS NOT NULL AND "proximoContacto" < $2`,
      [iglesiaId, hoy]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c
         FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
          AND "estado"='VISITANTE'
          AND COALESCE("fechaIngreso", to_char("createdAt",'YYYY-MM-DD')) <= to_char(CURRENT_DATE - INTERVAL '14 days','YYYY-MM-DD')`,
      [iglesiaId]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c
         FROM "Persona" p
        WHERE p."iglesiaId"=$1 AND p."deletedAt" IS NULL
          AND p."estado" IN ('ACTIVO','VISITANTE','NUEVO')
          AND NOT EXISTS (
            SELECT 1 FROM "Seguimiento" s
             WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL AND s."personaId"=p."id"
          )`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT c."id", c."nombre", c."fecha",
              COUNT(a."id")::int as total,
              COUNT(CASE WHEN a."presente"=true THEN 1 END)::int as presentes
         FROM "Culto" c
         LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
        WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
        GROUP BY c."id"
        ORDER BY c."fecha" DESC, c."id" DESC
        LIMIT 5`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT s."personaId", s."tipo", s."proximoContacto", p."nombre", p."apellido"
         FROM "Seguimiento" s
         JOIN "Persona" p ON p."id"=s."personaId"
        WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL
          AND s."proximoContacto" IS NOT NULL
          AND s."id" IN (
            SELECT MAX("id")
              FROM "Seguimiento"
             WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "proximoContacto" IS NOT NULL
             GROUP BY "personaId"
          )
        ORDER BY s."proximoContacto" ASC
        LIMIT 8`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT "id","nombre","apellido","fechaNacimiento","telefono"
         FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "fechaNacimiento" IS NOT NULL AND "fechaNacimiento" != ''`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT a."action" AS "accion",
              a."entity" AS "entidad",
              a."entityId" AS "entidadId",
              COALESCE(a."detail",'') AS "detalle",
              COALESCE(u."email",'sistema') AS "usuario",
              a."createdAt"
         FROM "AuditLog" a
         LEFT JOIN "User" u ON a."userId"=u."id"
        WHERE a."iglesiaId"=$1
        ORDER BY a."id" DESC
        LIMIT 12`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT to_char("createdAt",'YYYY-MM') AS mes, COUNT(*)::int AS c
         FROM "Persona"
        WHERE "iglesiaId"=$1
          AND "deletedAt" IS NULL
          AND "createdAt" >= $2::date
        GROUP BY 1
        ORDER BY 1 ASC`,
      [iglesiaId, crecimientoInicio.toISOString().slice(0, 10)]
    ),
  ])

  const personas = n(personasRow)
  const activos = n(activosRow)
  const visitantes = n(visitantesRow)
  const grupos = n(gruposRow)
  const cultos = n(cultosRow)
  const nuevosMes = n(nuevosMesRow)
  const nuevosMesPasado = n(nuevosMesPasadoRow)
  const seguimientosVencidos = n(seguimientosVencidosRow)
  const visitantesSinConsolidar = n(visitantesSinConsolidarRow)
  const sinSeguimiento = n(sinSeguimientoRow)

  const cumpleanos = cumpleanosRaw.map(p => {
    const cumDia = String(p.fechaNacimiento || '').slice(5, 10)
    const [m, d] = cumDia.split('-').map(Number)
    if (!m || !d) return null
    const target = new Date(new Date().getFullYear(), m - 1, d)
    target.setHours(0, 0, 0, 0)
    if (target.getTime() < new Date().setHours(0,0,0,0)) target.setFullYear(target.getFullYear() + 1)
    const dias = Math.ceil((target.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    return { ...p, cumDia, dias }
  })
    .filter(p => p && p.dias >= 0 && p.dias <= 30)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 10)

  const crecimientoMap = new Map((crecimientoRows || []).map(row => [row.mes, Number(row.c || 0)]))
  const crecimientoMensual = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const mes = d.toISOString().slice(0, 7)
    crecimientoMensual.push({ mes, nuevos: Number(crecimientoMap.get(mes) || 0) })
  }

  return {
    totales: {
      personas,
      activos,
      visitantes,
      grupos,
      cultos,
      pctAsistencia: asistencia.promedio,
      nuevosMes,
      variacionPersonas: variation(nuevosMes, nuevosMesPasado),
      seguimientosVencidos,
      visitantesSinConsolidar,
      consolidacionActiva: 0,
      oracionesActivas: 0,
      sinSeguimiento,
    },
    asistenciaReciente,
    proximosContactos,
    cumpleanos,
    crecimientoMensual,
    actividadReciente,
    syncedAt: new Date().toISOString(),
  }
}

async function premiumDashboardStats(iglesiaId) {
  await ensureOperationalTenantDataSynced(iglesiaId)
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()
  const prevMonthDate = new Date()
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
  const prevMonthFrom = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1).toISOString().slice(0, 10)
  const prevMonthTo = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [
    totalPersonasRow,
    nuevosMesRow,
    nuevosMesPasadoRow,
    asistenciaActual,
    asistenciaPasada,
    gruposRow,
    seguimientosMesRow,
    seguimientosPrevRow,
    consolidadosRow,
    personasRecientes,
    seguimientosRecientes,
  ] = await Promise.all([
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND COALESCE("estado",'ACTIVO')!='INACTIVO'`,
      [iglesiaId]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
      [iglesiaId, mesActual]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
      [iglesiaId, mesPasado]
    ),
    asistenciaResumen(iglesiaId),
    asistenciaResumen(iglesiaId, prevMonthFrom, prevMonthTo),
    pgOne('SELECT COUNT(*)::int AS c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Seguimiento"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
      [iglesiaId, mesActual]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Seguimiento"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
      [iglesiaId, mesPasado]
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estadoEspiritual" IN ('CONSOLIDADO','MINISTERIO')`,
      [iglesiaId]
    ),
    pgMany(
      'SELECT "id","nombre","apellido","estado","createdAt" FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 5',
      [iglesiaId]
    ),
    pgMany(
      `SELECT s."id", s."tipo", s."createdAt", p."nombre", p."apellido"
         FROM "Seguimiento" s
         LEFT JOIN "Persona" p ON s."personaId"=p."id"
        WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL
        ORDER BY s."createdAt" DESC
        LIMIT 5`,
      [iglesiaId]
    ),
  ])

  const tendencia = await weeklyTrendStats(iglesiaId, 12)

  return {
    kpis: {
      personas: { total: n(totalPersonasRow), variacion: variation(n(nuevosMesRow), n(nuevosMesPasadoRow)) },
      asist: { promedio: asistenciaActual.promedio, variacion: variation(asistenciaActual.promedio, asistenciaPasada.promedio) },
      grupos: { total: n(gruposRow), variacion: 0 },
      seg: { mes: n(seguimientosMesRow), variacion: variation(n(seguimientosMesRow), n(seguimientosPrevRow)) },
      consol: { totalConsolidados: n(consolidadosRow), variacion: 0 },
    },
    tendencia,
    actividad: {
      personas: personasRecientes,
      seguimientos: seguimientosRecientes,
      cultos: [],
      eventos: [],
    },
    syncedAt: new Date().toISOString(),
  }
}

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  res.json(await dashboardStats(iglesiaId))
})

router.get('/premium', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  res.json(await premiumDashboardStats(iglesiaId))
})

router.get('/personas', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()
  const total = n(await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND COALESCE("estado",'ACTIVO')!='INACTIVO'`,
    [iglesiaId]
  ))
  const nuevosMes = n(await pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",\'YYYY-MM\')=$2', [iglesiaId, mesActual]))
  const nuevosMesPasado = n(await pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",\'YYYY-MM\')=$2', [iglesiaId, mesPasado]))
  res.json({ total, mes: nuevosMes, variacion: variation(nuevosMes, nuevosMesPasado), nuevosMes })
})

router.get('/asistencias', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)
  const actual = await asistenciaResumen(iglesiaId)
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  const ini = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
  const pasado = await asistenciaResumen(iglesiaId, ini, fin)
  const mes = monthKey()
  const totalMes = n(await pgOne(
    `SELECT COUNT(*)::int AS c
       FROM "Asistencia" a
       JOIN "Culto" c ON c."id"=a."cultoId"
      WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
        AND a."presente"=true
        AND to_char(to_date(c."fecha",'YYYY-MM-DD'),'YYYY-MM')=$2`,
    [iglesiaId, mes]
  ))
  res.json({ promedio: actual.promedio, variacion: variation(actual.promedio, pasado.promedio), totalMes })
})

router.get('/grupos', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)
  const total = n(await pgOne('SELECT COUNT(*)::int AS c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]))
  const miembrosTotal = n(await pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "grupoId" IS NOT NULL', [iglesiaId]))
  res.json({ total, variacion: 0, miembrosProm: total > 0 ? Math.round(miembrosTotal / total) : 0 })
})

router.get('/seguimientos', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()
  const mes = n(await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Seguimiento"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
    [iglesiaId, mesActual]
  ))
  const prev = n(await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Seguimiento"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
    [iglesiaId, mesPasado]
  ))
  res.json({ mes, variacion: variation(mes, prev) })
})

router.get('/consolidacion', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const totalConsolidados = n(await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estadoEspiritual" IN ('CONSOLIDADO','MINISTERIO')`,
    [iglesiaId]
  ))
  res.json({ totalConsolidados, variacion: 0, meta: 150 })
})

router.get('/tendencia', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)
  const semanas = await weeklyTrendStats(iglesiaId, 12)
  res.json({ semanas })
})

router.get('/actividad', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)
  const personas = await pgMany(
    'SELECT "id","nombre","apellido","estado","createdAt" FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 5',
    [iglesiaId]
  )
  const seguimientos = await pgMany(
    `SELECT s.*, p."nombre", p."apellido"
       FROM "Seguimiento" s
       LEFT JOIN "Persona" p ON s."personaId"=p."id"
      WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL
      ORDER BY s."createdAt" DESC
      LIMIT 5`,
    [iglesiaId]
  )
  const cultos = await pgMany(
    'SELECT * FROM "Culto" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL ORDER BY "fecha" DESC LIMIT 3',
    [iglesiaId]
  )
  res.json({ personas, seguimientos, cultos, eventos: [] })
})

export default router
