/**
 * analytics.js — Insights y gráficos por plan
 *
 * STARTER: seguimiento, discipulado, estado espiritual
 * PRO:     asistencia tendencia (cultos asignados), consolidación, mensajes
 * MAX:     todo + crecimiento global, usuarios activos
 *
 * GET /analytics/resumen      → KPIs + todos los datos del plan en una sola llamada
 */
import { Router } from 'express'
import { pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { resolvePlan } from '../middlewares/plan.js'
import logger from '../lib/logger.js'

const router = Router()

function n(row) { return row?.c ?? row?.total ?? 0 }

// Semanas etiquetadas (últimas N semanas)
function weekLabels(n) {
  const labels = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`)
  }
  return labels
}

// ── GET /analytics/resumen ──────────────────────────────────────────
router.get('/resumen', requireAuth, async (req, res) => {
 try {
  const iglesiaId = Number(req.user.iglesiaId)
  const plan = resolvePlan(req.user?.plan || 'STARTER')
  const userId = Number(req.user.id)

  // ── Datos STARTER (todos los planes los reciben) ──────────────────
  const [totalPersonas, personasActivas, visitantes, totalGrupos, seguimientosActivos] = await Promise.all([
    pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"=\'ACTIVO\'', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado"=\'VISITANTE\'', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne(`SELECT COUNT(*)::int AS c FROM "Seguimiento" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
           AND "createdAt" >= NOW() - INTERVAL '30 days'`, [iglesiaId]),
  ])

  // Seguimiento trend últimas 8 semanas
  const seguimientoTrend = await pgMany(
    `SELECT TO_CHAR(DATE_TRUNC('week', "createdAt"), 'DD/MM') AS semana,
            COUNT(*)::int AS total
       FROM "Seguimiento"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND "createdAt" >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY DATE_TRUNC('week', "createdAt")`,
    [iglesiaId]
  )

  // Estado espiritual distribución
  const estadoEspiritual = await pgMany(
    `SELECT COALESCE("estadoEspiritual",'Sin datos') AS estado, COUNT(*)::int AS total
       FROM "Persona"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
      GROUP BY "estadoEspiritual"
      ORDER BY total DESC`,
    [iglesiaId]
  )

  // Discipulado trend (últimas 4 semanas de actividad en seguimiento por tipo)
  const discipuladoProgreso = await pgMany(
    `SELECT COALESCE(s."tipo",'General') AS etapa, COUNT(*)::int AS total
       FROM "Seguimiento" s
      WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL
      GROUP BY s."tipo"
      ORDER BY total DESC
      LIMIT 8`,
    [iglesiaId]
  )

  // Personas sin seguimiento en +30 días
  const sinSeguimiento = await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Persona" p
      WHERE p."iglesiaId"=$1 AND p."deletedAt" IS NULL AND p."estado"='ACTIVO'
        AND NOT EXISTS (
          SELECT 1 FROM "Seguimiento" s
           WHERE s."personaId"=p."id" AND s."deletedAt" IS NULL
             AND s."createdAt" >= NOW() - INTERVAL '30 days'
        )`,
    [iglesiaId]
  )

  const starter = {
    kpis: {
      totalPersonas: n(totalPersonas),
      personasActivas: n(personasActivas),
      visitantes: n(visitantes),
      totalGrupos: n(totalGrupos),
      seguimientosActivos: n(seguimientosActivos),
      sinSeguimiento: n(sinSeguimiento),
    },
    seguimientoTrend,
    estadoEspiritual,
    discipuladoProgreso,
  }

  if (plan === 'STARTER') return res.json({ plan, ...starter })

  // ── Datos PRO (PRO + MAX) ─────────────────────────────────────────
  // Determinar cultos accesibles (PRO: solo asignados; MAX: todos)
  let cultoFilter = `c."iglesiaId"=$1 AND c."deletedAt" IS NULL`
  const filterParams = [iglesiaId]
  if (plan === 'PRO') {
    const asignados = await pgMany(
      'SELECT "cultoId" FROM "CultoAsignado" WHERE "userId"=$1 AND "iglesiaId"=$2',
      [userId, iglesiaId]
    )
    if (asignados.length > 0) {
      const ids = asignados.map(a => a.cultoId)
      cultoFilter += ` AND c."id" = ANY($2)`
      filterParams.push(ids)
    } else {
      // PRO sin cultos asignados → devuelve datos vacíos para cultos
      const proVacio = {
        kpis: { totalCultos: 0, promedioAsistencia: 0, ultimaAsistencia: 0, nuevosMes: 0, mensajesMes: 0 },
        asistenciaTrend: [],
        consolidacionEstados: [],
      }
      return res.json({ plan, ...starter, ...proVacio })
    }
  }

  const [totalCultos, ultimoCulto, nuevosMes] = await Promise.all([
    pgOne(`SELECT COUNT(*)::int AS c FROM "Culto" c WHERE ${cultoFilter}`, filterParams),
    pgOne(
      `SELECT c."id", c."nombre", c."fecha",
              COUNT(a."id") FILTER (WHERE a."presente"=true)::int AS presentes,
              COUNT(a."id")::int AS total
         FROM "Culto" c
         LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
        WHERE ${cultoFilter}
        GROUP BY c."id"
        ORDER BY c."fecha" DESC LIMIT 1`,
      filterParams
    ),
    pgOne(
      `SELECT COUNT(*)::int AS c FROM "Consolidacion"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
          AND "createdAt" >= NOW() - INTERVAL '30 days'`,
      [iglesiaId]
    ),
  ])

  // Asistencia trend — últimos 8 cultos (accesibles)
  const asistenciaTrend = await pgMany(
    `SELECT TO_CHAR(c."fecha"::date,'DD/MM') AS fecha,
            COUNT(a."id") FILTER (WHERE a."presente"=true)::int AS presentes,
            COUNT(a."id")::int AS total
       FROM "Culto" c
       LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
      WHERE ${cultoFilter}
      GROUP BY c."id", c."fecha"
      ORDER BY c."fecha" DESC
      LIMIT 8`,
    filterParams
  )

  // Promedio asistencia
  const promedioRow = await pgOne(
    `SELECT AVG(sub.presentes)::numeric(10,1) AS avg FROM (
       SELECT COUNT(a."id") FILTER (WHERE a."presente"=true) AS presentes
         FROM "Culto" c
         LEFT JOIN "Asistencia" a ON a."cultoId"=c."id"
        WHERE ${cultoFilter}
        GROUP BY c."id"
      ) sub`,
    filterParams
  )

  // Consolidación por estado
  const consolidacionEstados = await pgMany(
    `SELECT "estado", COUNT(*)::int AS total
       FROM "Consolidacion"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
      GROUP BY "estado" ORDER BY total DESC`,
    [iglesiaId]
  )

  // Mensajes enviados últimos 30 días
  const mensajesMes = await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Mensaje"
      WHERE "iglesiaId"=$1
        AND "createdAt" >= NOW() - INTERVAL '30 days'`,
    [iglesiaId]
  )

  const pro = {
    kpis: {
      totalCultos: n(totalCultos),
      promedioAsistencia: Number(promedioRow?.avg || 0),
      ultimaAsistencia: ultimoCulto?.presentes || 0,
      nuevosMes: n(nuevosMes),
      mensajesMes: n(mensajesMes),
    },
    asistenciaTrend: [...asistenciaTrend].reverse(), // cronológico
    consolidacionEstados,
  }

  if (plan === 'PRO') return res.json({ plan, ...starter, ...pro })

  // ── Datos MAX (solo MAX) ──────────────────────────────────────────
  const [totalUsuarios, crecimientoMensual] = await Promise.all([
    pgOne(`SELECT COUNT(*)::int AS c FROM "User" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "activo"=true`, [iglesiaId]),
    pgMany(
      `SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"),'Mon') AS mes,
              COUNT(*)::int AS total
         FROM "Persona"
        WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt")`,
      [iglesiaId]
    ),
  ])

  const max = {
    kpis: { totalUsuarios: n(totalUsuarios) },
    crecimientoMensual,
  }

  return res.json({ plan, ...starter, ...pro, ...max })
 } catch (err) {
  logger.error({ err: err.message, stack: err.stack }, 'Error en /analytics/resumen')
  return res.status(500).json({ error: 'Error al cargar analytics', detalle: err.message })
 }
})

export default router
