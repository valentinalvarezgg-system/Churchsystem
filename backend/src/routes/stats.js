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

async function dashboardStats(iglesiaId) {
  await ensureOperationalTenantDataSynced(iglesiaId)
  const hoy = new Date().toISOString().slice(0, 10)
  const mesActual = monthKey()
  const mesPasado = previousMonthKey()

  const personas = n(await pgOne(
    `SELECT COUNT(*)::int AS c
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND COALESCE("estado",'ACTIVO')!='INACTIVO'`,
    [iglesiaId]
  ))
  const activos = n(await pgOne(
    `SELECT COUNT(*)::int AS c
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"='ACTIVO'`,
    [iglesiaId]
  ))
  const visitantes = n(await pgOne(
    `SELECT COUNT(*)::int AS c
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"='VISITANTE'`,
    [iglesiaId]
  ))
  const grupos = n(await pgOne('SELECT COUNT(*)::int AS c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]))
  const cultos = n(await pgOne('SELECT COUNT(*)::int AS c FROM "Culto" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]))
  const nuevosMes = n(await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
    [iglesiaId, mesActual]
  ))
  const nuevosMesPasado = n(await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
    [iglesiaId, mesPasado]
  ))
  const asistencia = await asistenciaResumen(iglesiaId)

  const seguimientosVencidos = n(await pgOne(
    `SELECT COUNT(*)::int AS c
       FROM "Seguimiento"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND "proximoContacto" IS NOT NULL AND "proximoContacto" < $2`,
    [iglesiaId, hoy]
  ))
  const visitantesSinConsolidar = n(await pgOne(
    `SELECT COUNT(*)::int AS c
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND "estado"='VISITANTE'
        AND COALESCE("fechaIngreso", to_char("createdAt",'YYYY-MM-DD')) <= to_char(CURRENT_DATE - INTERVAL '14 days','YYYY-MM-DD')`,
    [iglesiaId]
  ))
  const sinSeguimiento = n(await pgOne(
    `SELECT COUNT(*)::int AS c
       FROM "Persona" p
      WHERE p."iglesiaId"=$1 AND p."deletedAt" IS NULL
        AND p."estado" IN ('ACTIVO','VISITANTE','NUEVO')
        AND NOT EXISTS (
          SELECT 1 FROM "Seguimiento" s
           WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL AND s."personaId"=p."id"
        )`,
    [iglesiaId]
  ))

  const asistenciaReciente = await pgMany(
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
  )

  const proximosContactos = await pgMany(
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
  )

  const cumpleanosRaw = await pgMany(
    `SELECT "id","nombre","apellido","fechaNacimiento","telefono"
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "fechaNacimiento" IS NOT NULL AND "fechaNacimiento" != ''`,
    [iglesiaId]
  )
  const hoyMs = Date.now()
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

  const crecimientoMensual = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const mes = d.toISOString().slice(0, 7)
    const row = await pgOne(
      `SELECT COUNT(*)::int AS c
         FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND to_char("createdAt",'YYYY-MM')=$2`,
      [iglesiaId, mes]
    )
    crecimientoMensual.push({ mes, nuevos: n(row) })
  }

  const actividadReciente = await pgMany(
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
  )

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

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  res.json(await dashboardStats(iglesiaId))
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
    const asist = await asistenciaResumen(iglesiaId, iStr, fStr)
    const nuevos = n(await pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND DATE("createdAt") BETWEEN $2 AND $3`,
      [iglesiaId, iStr, fStr]
    ))
    semanas.push({
      semana: `${inicio.getDate()}/${inicio.getMonth() + 1}`,
      asistencia: asist.presentes,
      cultos: asist.cultos,
      nuevos,
    })
  }
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

