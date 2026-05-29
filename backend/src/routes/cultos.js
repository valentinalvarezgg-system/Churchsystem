import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { ensureOperationalTenantDataSynced } from '../lib/core-sync.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const rows = await pgMany(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM "Asistencia" a WHERE a."cultoId"=c."id" AND a."presente"=true) AS "presentes",
            (SELECT COUNT(*)::int FROM "Asistencia" a WHERE a."cultoId"=c."id") AS "totalRegistrados"
       FROM "Culto" c
      WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
      ORDER BY c."fecha" DESC, c."id" DESC`,
    [iglesiaId]
  )
  res.json(rows)
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
  if (!['PASTOR_GENERAL', 'PASTOR_CULTO'].includes(req.user.rol)) return res.status(403).json({ error: 'No autorizado' })

  const cultoId = Number(req.params.id)
  await pgExec('DELETE FROM "Asistencia" WHERE "cultoId"=$1 AND "iglesiaId"=$2', [cultoId, iglesiaId])
  await pgExec('UPDATE "Culto" SET "deletedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2', [cultoId, iglesiaId])
  res.json({ ok: true })
})

router.get('/:id/asistencia', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const cultoId = Number(req.params.id)
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
  const ids = await pgMany('SELECT "id" FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])
  const presentSet = new Set((presentes || []).map(Number))

  for (const row of ids) {
    await pgExec(
      `INSERT INTO "Asistencia" ("iglesiaId","cultoId","personaId","presente","createdAt")
       VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT ("cultoId","personaId") DO UPDATE SET "presente"=EXCLUDED."presente"`,
      [iglesiaId, cultoId, Number(row.id), presentSet.has(Number(row.id))]
    )
  }

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'ASISTENCIA',
    entidad: 'CULTO',
    entidadId: cultoId,
    detalle: `${presentSet.size} presentes`,
    iglesiaId,
  })
  res.json({ ok: true, presentes: presentSet.size })
})

export default router

