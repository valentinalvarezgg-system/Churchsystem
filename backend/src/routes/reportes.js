import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { ensureOperationalTenantDataSynced } from '../lib/core-sync.js'
import { pgMany, pgOne } from '../lib/pg.js'

const router = Router()
const GENERAL_PERIODS = {
  semana: { label: 'Semana', days: 7 },
  mes: { label: 'Mes', months: 1 },
  bimestre: { label: 'Bimestre', months: 2 },
  trimestre: { label: 'Trimestre', months: 3 },
  cuatrimestre: { label: 'Cuatrimestre', months: 4 },
  semestre: { label: 'Semestre', months: 6 },
  anual: { label: 'Anual', months: 12 },
}

function n(row, key = 'c') {
  return Number(row?.[key] ?? 0)
}

function iso(date) {
  return date.toISOString().slice(0, 10)
}

function getGeneralRange(periodo = 'semana') {
  const key = GENERAL_PERIODS[periodo] ? periodo : 'semana'
  const cfg = GENERAL_PERIODS[key]
  const now = new Date()
  const hasta = iso(now)
  const desdeDate = new Date(now)

  if (cfg.days) {
    desdeDate.setDate(now.getDate() - cfg.days + 1)
  } else {
    desdeDate.setDate(1)
    desdeDate.setMonth(now.getMonth() - cfg.months + 1)
  }

  return { key, label: cfg.label, desde: iso(desdeDate), hasta }
}

router.get('/semanal', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - hoy.getDay() + 1)
  const dom = new Date(lunes)
  dom.setDate(lunes.getDate() + 6)
  const desde = lunes.toISOString().slice(0, 10)
  const hasta = dom.toISOString().slice(0, 10)

  const nuevasPersonas = await pgMany(
    `SELECT "id","nombre","apellido","estado","cultoDia","createdAt"
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND DATE("createdAt") BETWEEN $2 AND $3
      ORDER BY "createdAt" DESC`,
    [iglesiaId, desde, hasta]
  )

  const cultos = await pgMany(
    `SELECT c."id", c."nombre", c."fecha",
            COUNT(CASE WHEN a."presente"=true THEN 1 END)::int as presentes,
            COUNT(a."id")::int as total
       FROM "Culto" c
       LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
      WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
        AND c."fecha" BETWEEN $2 AND $3
      GROUP BY c."id"
      ORDER BY c."fecha"`,
    [iglesiaId, desde, hasta]
  )

  const seguimientos = await pgMany(
    `SELECT "tipo", COUNT(*)::int as qty
       FROM "Seguimiento"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND DATE("createdAt") BETWEEN $2 AND $3
      GROUP BY "tipo"`,
    [iglesiaId, desde, hasta]
  )

  const mensajes = { qty: 0, enviados: 0 }
  const ofrendas = await pgOne(
    `SELECT COUNT(*)::int as qty, COALESCE(SUM("monto"),0)::float8 as total
       FROM "Finanza"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND "fecha" BETWEEN $2 AND $3`,
    [iglesiaId, desde, hasta]
  )

  const totales = {
    personas: n(await pgOne('SELECT COUNT(*)::int as c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])),
    activos: n(await pgOne('SELECT COUNT(*)::int as c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"=\'ACTIVO\'', [iglesiaId])),
    visitantes: n(await pgOne('SELECT COUNT(*)::int as c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"=\'VISITANTE\'', [iglesiaId])),
    grupos: n(await pgOne('SELECT COUNT(*)::int as c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])),
  }

  res.json({
    periodo: { desde, hasta },
    nuevasPersonas,
    cultos,
    seguimientos,
    mensajes,
    ofrendas: ofrendas || { qty: 0, total: 0 },
    totales,
    generadoEl: new Date().toISOString(),
  })
})

router.get('/mensual', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const m = String(req.query.mes || new Date().toISOString().slice(0, 7))
  const [y, mo] = m.split('-').map(Number)
  const desde = `${m}-01`
  const hasta = new Date(y, mo, 0).toISOString().slice(0, 10)

  const personas = await pgMany(
    `SELECT COALESCE("estado",'ACTIVO') AS "estado", COUNT(*)::int AS "total"
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
      GROUP BY COALESCE("estado",'ACTIVO')`,
    [iglesiaId]
  )

  const crecimiento = await pgMany(
    `SELECT to_char("createdAt",'DD') AS dia, COUNT(*)::int AS qty
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND to_char("createdAt",'YYYY-MM')=$2
      GROUP BY to_char("createdAt",'DD')
      ORDER BY dia`,
    [iglesiaId, m]
  )

  const asistencia = await pgMany(
    `SELECT c."nombre", c."fecha",
            COUNT(CASE WHEN a."presente"=true THEN 1 END)::int as presentes,
            COUNT(a."id")::int as total
       FROM "Culto" c
       LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
      WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
        AND to_char(to_date(c."fecha",'YYYY-MM-DD'),'YYYY-MM')=$2
      GROUP BY c."id"
      ORDER BY c."fecha"`,
    [iglesiaId, m]
  )

  const finanzas = await pgMany(
    `SELECT "tipo", COALESCE(SUM("monto"),0)::float8 as total, COUNT(*)::int as qty
       FROM "Finanza"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND to_char(to_date("fecha",'YYYY-MM-DD'),'YYYY-MM')=$2
      GROUP BY "tipo"`,
    [iglesiaId, m]
  )

  res.json({
    mes: m,
    desde,
    hasta,
    personas,
    crecimiento,
    asistencia,
    finanzas,
    totalOfrendas: finanzas.reduce((a, b) => a + Number(b.total || 0), 0),
    generadoEl: new Date().toISOString(),
  })
})

router.get('/general', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const periodo = getGeneralRange(String(req.query.periodo || 'semana'))
  const { desde, hasta } = periodo

  const nuevasPersonas = await pgMany(
    `SELECT "id","nombre","apellido","estado","cultoDia","createdAt"
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND DATE("createdAt") BETWEEN $2 AND $3
      ORDER BY "createdAt" DESC
      LIMIT 100`,
    [iglesiaId, desde, hasta]
  )

  const cultos = await pgMany(
    `SELECT c."id", c."nombre", c."fecha", c."cultoDia",
            COUNT(CASE WHEN a."presente"=true THEN 1 END)::int as presentes,
            COUNT(a."id")::int as total
       FROM "Culto" c
       LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
      WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
        AND c."fecha" BETWEEN $2 AND $3
      GROUP BY c."id"
      ORDER BY c."fecha"`,
    [iglesiaId, desde, hasta]
  )

  const seguimientos = await pgMany(
    `SELECT "tipo", COUNT(*)::int as qty
       FROM "Seguimiento"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND DATE("createdAt") BETWEEN $2 AND $3
      GROUP BY "tipo"
      ORDER BY qty DESC`,
    [iglesiaId, desde, hasta]
  )

  const crecimiento = await pgMany(
    `SELECT DATE("createdAt")::text AS fecha, COUNT(*)::int AS qty
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND DATE("createdAt") BETWEEN $2 AND $3
      GROUP BY DATE("createdAt")
      ORDER BY fecha`,
    [iglesiaId, desde, hasta]
  )

  const totales = {
    personas: n(await pgOne('SELECT COUNT(*)::int as c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])),
    activos: n(await pgOne('SELECT COUNT(*)::int as c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"=\'ACTIVO\'', [iglesiaId])),
    visitantes: n(await pgOne('SELECT COUNT(*)::int as c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"=\'VISITANTE\'', [iglesiaId])),
    grupos: n(await pgOne('SELECT COUNT(*)::int as c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])),
    nuevosPeriodo: nuevasPersonas.length,
    cultosPeriodo: cultos.length,
    seguimientosPeriodo: seguimientos.reduce((acc, row) => acc + Number(row.qty || 0), 0),
  }

  res.json({
    tipo: 'general',
    periodo,
    nuevasPersonas,
    cultos,
    seguimientos,
    crecimiento,
    totales,
    generadoEl: new Date().toISOString(),
  })
})

export default router
