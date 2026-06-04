import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { ensureCoreTenantDataSynced } from '../lib/core-sync.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const rows = await pgMany(
    `SELECT g.*,
            u."nombre" AS "liderNombre",
            (SELECT COUNT(*)::int FROM "Persona" p WHERE p."grupoId"=g."id" AND p."iglesiaId"=g."iglesiaId" AND p."deletedAt" IS NULL) AS "totalPersonas"
       FROM "Grupo" g
       LEFT JOIN "User" u ON g."liderId"=u."id"
      WHERE g."iglesiaId"=$1 AND g."deletedAt" IS NULL
      ORDER BY g."id" DESC`,
    [Number(req.user.iglesiaId)]
  )
  res.json(rows)
})

router.get('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const g = await pgOne(
    'SELECT * FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  if (!g) return res.status(404).json({ error: 'No encontrado' })

  const miembros = await pgMany(
    'SELECT "id","nombre","apellido","telefono","estado" FROM "Persona" WHERE "grupoId"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  res.json({ ...g, miembros })
})

router.post('/', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const { nombre, cultoDia = '', cultoTurno = 0, liderId = null, descripcion = '' } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })

  const created = await pgOne(
    `INSERT INTO "Grupo" ("iglesiaId","nombre","cultoDia","cultoTurno","liderId","descripcion","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING "id"`,
    [Number(req.user.iglesiaId), nombre.trim(), cultoDia, Number(cultoTurno || 0), liderId ? Number(liderId) : null, descripcion]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'CREAR',
    entidad: 'GRUPO',
    entidadId: created.id,
    detalle: nombre,
    iglesiaId: req.user.iglesiaId,
  })
  res.status(201).json({ ok: true, id: created.id })
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const g = await pgOne(
    'SELECT * FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  if (!g) return res.status(404).json({ error: 'No encontrado' })

  const m = { ...g, ...req.body }
  await pgExec(
    `UPDATE "Grupo"
     SET "nombre"=$1, "cultoDia"=$2, "cultoTurno"=$3, "liderId"=$4, "descripcion"=$5, "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$6 AND "iglesiaId"=$7`,
    [m.nombre, m.cultoDia || '', Number(m.cultoTurno || 0), m.liderId ? Number(m.liderId) : null, m.descripcion || '', Number(req.params.id), Number(req.user.iglesiaId)]
  )
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  if (req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'No autorizado' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  await pgExec(
    'UPDATE "Persona" SET "grupoId"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "grupoId"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  await pgExec(
    'UPDATE "Grupo" SET "deletedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  res.json({ ok: true })
})

// ── Estadísticas de crecimiento del grupo ───────────────────
router.get('/:id/stats', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const grupoId   = Number(req.params.id)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const g = await pgOne(
    'SELECT "id","nombre" FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL',
    [grupoId, iglesiaId]
  )
  if (!g) return res.status(404).json({ error: 'Grupo no encontrado' })

  // Crecimiento mensual: cuántas personas se unieron al grupo cada mes (últimos 12 meses)
  const crecimiento = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    const mes = d.toISOString().slice(0, 7)
    const row = await pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
       WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
         AND to_char("createdAt",'YYYY-MM')=$3`,
      [iglesiaId, grupoId, mes]
    )
    crecimiento.push({ mes, nuevos: Number(row?.c || 0) })
  }

  // Distribución por etapa espiritual
  const porEtapa = await pgMany(
    `SELECT "estadoEspiritual", COUNT(*)::int AS total
     FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
     GROUP BY "estadoEspiritual"`,
    [iglesiaId, grupoId]
  )

  // Distribución por estado (ACTIVO / VISITANTE / INACTIVO)
  const porEstado = await pgMany(
    `SELECT "estado", COUNT(*)::int AS total
     FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
     GROUP BY "estado"`,
    [iglesiaId, grupoId]
  )

  // Total actual y bautizados
  const resumen = await pgOne(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN "bautizadoAgua" THEN 1 ELSE 0 END)::int AS bautizados,
            SUM(CASE WHEN "discipuladoCompletado" THEN 1 ELSE 0 END)::int AS discipulados
     FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL`,
    [iglesiaId, grupoId]
  )

  // Miembro más reciente
  const ultimo = await pgOne(
    `SELECT "nombre","apellido","createdAt" FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
     ORDER BY "createdAt" DESC LIMIT 1`,
    [iglesiaId, grupoId]
  )

  res.json({ grupo: g, crecimiento, porEtapa, porEstado, resumen: resumen || {}, ultimo })
})

export default router

