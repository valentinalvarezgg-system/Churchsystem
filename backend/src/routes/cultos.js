import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { ensureOperationalTenantDataSynced } from '../lib/core-sync.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import { resolvePlan } from '../middlewares/plan.js'

const router = Router()

// Devuelve IDs de cultos accesibles para el usuario:
// MAX/GODMODE → todos; PRO → solo los asignados; STARTER → [] (sin acceso)
async function getCultosPermitidos(userId, iglesiaId, plan) {
  if (plan === 'MAX' || plan === 'GODMODE') return null // null = sin filtro
  if (plan === 'PRO') {
    const rows = await pgMany(
      'SELECT "cultoId" FROM "CultoAsignado" WHERE "userId"=$1 AND "iglesiaId"=$2',
      [userId, iglesiaId]
    )
    return rows.map(r => r.cultoId)
  }
  return [] // STARTER no tiene acceso a cultos
}

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const plan = resolvePlan(req.user?.plan)
  const permitidos = await getCultosPermitidos(req.user.id, iglesiaId, plan)

  // STARTER no tiene acceso al módulo de asistencia — igual devuelve [] para no romper
  if (Array.isArray(permitidos) && permitidos.length === 0 && plan === 'STARTER') {
    return res.json([])
  }

  let query = `SELECT c.*,
            (SELECT COUNT(*)::int FROM "Asistencia" a WHERE a."cultoId"=c."id" AND a."presente"=true) AS "presentes",
            (SELECT COUNT(*)::int FROM "Asistencia" a WHERE a."cultoId"=c."id") AS "totalRegistrados"
       FROM "Culto" c
      WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL`
  const params = [iglesiaId]

  if (Array.isArray(permitidos)) {
    // PRO con cultos asignados
    query += ` AND c."id" = ANY($2::int[])`
    params.push(permitidos)
  }

  query += ` ORDER BY c."fecha" DESC, c."id" DESC`
  const rows = await pgMany(query, params)
  res.json(rows)
})

router.get('/stats', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const limit = Math.min(Number(req.query.limit || 12), 52)

  const [tendencias, porDia] = await Promise.all([
    pgMany(
      `SELECT c."id", c."nombre", c."fecha", c."cultoDia",
              COUNT(a."id")::int AS "total",
              COALESCE(SUM(CASE WHEN a."presente"=true THEN 1 ELSE 0 END), 0)::int AS "presentes"
         FROM "Culto" c
         LEFT JOIN "Asistencia" a ON a."cultoId"=c."id" AND a."iglesiaId"=$1
        WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
        GROUP BY c."id", c."nombre", c."fecha", c."cultoDia"
        ORDER BY c."fecha" DESC, c."id" DESC
        LIMIT $2`,
      [iglesiaId, limit]
    ),
    pgMany(
      `SELECT c."cultoDia",
              ROUND(AVG(sub."presentes")::numeric, 1)::float AS "promedio",
              COUNT(DISTINCT c."id")::int AS "cultos"
         FROM "Culto" c
         JOIN (
           SELECT "cultoId",
                  SUM(CASE WHEN "presente"=true THEN 1 ELSE 0 END)::int AS "presentes"
             FROM "Asistencia"
            WHERE "iglesiaId"=$1
            GROUP BY "cultoId"
         ) sub ON sub."cultoId"=c."id"
        WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
          AND c."cultoDia" IS NOT NULL AND c."cultoDia" != ''
        GROUP BY c."cultoDia"
        ORDER BY MIN(CASE c."cultoDia"
          WHEN 'LUNES' THEN 1 WHEN 'MARTES' THEN 2 WHEN 'MIERCOLES' THEN 3
          WHEN 'JUEVES' THEN 4 WHEN 'VIERNES' THEN 5 WHEN 'SABADO' THEN 6
          WHEN 'DOMINGO' THEN 7 ELSE 8 END)`,
      [iglesiaId]
    ),
  ])
  tendencias.reverse()

  res.json({ tendencias, porDia })
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const { nombre, fecha, cultoDia = '', cultoTurno = 0, observaciones = '' } = req.body || {}
  if (!nombre?.trim() || !fecha) return res.status(400).json({ error: 'nombre y fecha requeridos' })

  const created = await pgOne(
    `INSERT INTO "Culto" ("iglesiaId","nombre","fecha","cultoDia","cultoTurno","observaciones","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING "id"`,
    [iglesiaId, nombre.trim(), fecha, cultoDia, Number(cultoTurno || 0), observaciones]
  )
  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'CREAR',
    entidad: 'CULTO',
    entidadId: created.id,
    detalle: nombre,
    iglesiaId,
  })
  res.status(201).json({ ok: true, id: created.id })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const plan = resolvePlan(req.user?.plan)
  if (plan !== 'MAX' && !['PASTOR_GENERAL'].includes(req.user.rol))
    return res.status(403).json({ error: 'Solo usuarios MAX pueden eliminar cultos' })

  const cultoId = Number(req.params.id)
  await pgExec('DELETE FROM "Asistencia" WHERE "cultoId"=$1 AND "iglesiaId"=$2', [cultoId, iglesiaId])
  await pgExec('UPDATE "Culto" SET "deletedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2', [cultoId, iglesiaId])
  res.json({ ok: true })
})

router.get('/:id/asistencia', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const plan = resolvePlan(req.user?.plan)
  const cultoId = Number(req.params.id)

  // PRO solo puede acceder a sus cultos asignados
  if (plan === 'PRO') {
    const asignado = await pgOne(
      'SELECT "id" FROM "CultoAsignado" WHERE "userId"=$1 AND "cultoId"=$2 AND "iglesiaId"=$3 LIMIT 1',
      [req.user.id, cultoId, iglesiaId]
    )
    if (!asignado) return res.status(403).json({ error: 'No tenés acceso a este culto' })
  }

  const culto = await pgOne(
    'SELECT * FROM "Culto" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [cultoId, iglesiaId]
  )
  if (!culto) return res.status(404).json({ error: 'Culto no encontrado' })

  const { search = '' } = req.query
  const params = [cultoId, iglesiaId]
  let where = ''
  if (search) {
    params.push(`%${search}%`)
    where = `AND (p."nombre" ILIKE $3 OR p."apellido" ILIKE $3)`
  }

  const personas = await pgMany(
    `SELECT p."id",p."nombre",p."apellido",p."estado",p."cultoDia",
            COALESCE(a."presente",false) as "presente"
       FROM "Persona" p
       LEFT JOIN "Asistencia" a ON a."personaId"=p."id" AND a."cultoId"=$1
      WHERE p."iglesiaId"=$2 AND p."deletedAt" IS NULL ${where}
      ORDER BY p."nombre" ASC`,
    params
  )

  const presentes = personas.filter(p => p.presente).length
  res.json({
    culto,
    personas,
    stats: {
      total: personas.length,
      presentes,
      ausentes: personas.length - presentes,
    },
  })
})

router.post('/:id/asistencia', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const { presentes = [] } = req.body || {}
  const cultoId = Number(req.params.id)
  const presentesIds = Array.from(new Set((presentes || []).map(Number).filter(Boolean)))

  await pgExec(
    `INSERT INTO "Asistencia" ("iglesiaId","cultoId","personaId","presente","createdAt")
     SELECT $1, $2, p."id", p."id" = ANY($3::int[]), CURRENT_TIMESTAMP
       FROM "Persona" p
      WHERE p."iglesiaId"=$1 AND p."deletedAt" IS NULL
     ON CONFLICT ("cultoId","personaId") DO UPDATE SET "presente"=EXCLUDED."presente"`,
    [iglesiaId, cultoId, presentesIds]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'ASISTENCIA',
    entidad: 'CULTO',
    entidadId: cultoId,
    detalle: `${presentesIds.length} presentes`,
    iglesiaId,
  })
  res.json({ ok: true, presentes: presentesIds.length })
})

export default router
