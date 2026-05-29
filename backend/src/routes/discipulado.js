import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()
const MATERIALES = ['BIBLIA_BASICA', 'CONSOLIDACION_1', 'CONSOLIDACION_2', 'DISCIPULADO_1', 'DISCIPULADO_2', 'MINISTERIO']

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { etapa, search, page = 1, limit = 20 } = req.query
  const where = [`p."iglesiaId"=$1`, `p."deletedAt" IS NULL`]
  const params = [iglesiaId]
  let idx = 2

  if (etapa) { where.push(`p."estadoEspiritual"=$${idx++}`); params.push(etapa) }
  if (search) {
    where.push(`(p."nombre" ILIKE $${idx} OR p."apellido" ILIKE $${idx})`)
    params.push(`%${search}%`)
    idx++
  }

  const wStr = 'WHERE ' + where.join(' AND ')
  const offset = (Number(page) - 1) * Number(limit)
  const totalRow = await pgOne(`SELECT COUNT(*)::int AS c FROM "Persona" p ${wStr}`, params)
  const total = Number(totalRow?.c ?? 0)
  const data = await pgMany(
    `SELECT p."id",p."nombre",p."apellido",p."telefono",p."estado",p."estadoEspiritual",
            p."bautizadoAgua",p."bautizadoEspiritu",p."discipuladoCompletado",
            u."nombre" as "liderNombre",
            (SELECT COUNT(*)::int FROM "Seguimiento" s WHERE s."personaId"=p."id" AND s."deletedAt" IS NULL) as "totalSeguimientos",
            (SELECT COUNT(*)::int FROM "DiscipuladoProg" dp WHERE dp."personaId"=p."id" AND dp."completado"=true) as "materialesCompletados"
     FROM "Persona" p
     LEFT JOIN "User" u ON p."asignadoAUserId"=u."id"
     ${wStr}
     ORDER BY p."estadoEspiritual", p."nombre"
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, Number(limit), offset]
  )
  res.json({ data, total, pages: Math.ceil(total / Number(limit)), page: Number(page) })
})

router.get('/stats', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const porEtapa = await pgMany(
    `SELECT "estadoEspiritual", COUNT(*)::int as "total" FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL GROUP BY "estadoEspiritual"`,
    [iglesiaId]
  )
  const bautizados = await pgOne(
    `SELECT SUM(CASE WHEN "bautizadoAgua" THEN 1 ELSE 0 END)::int as "agua",
            SUM(CASE WHEN "bautizadoEspiritu" THEN 1 ELSE 0 END)::int as "espiritu",
            SUM(CASE WHEN "discipuladoCompletado" THEN 1 ELSE 0 END)::int as "discipulado"
     FROM "Persona" WHERE "iglesiaId"=$1 AND "estado"='ACTIVO' AND "deletedAt" IS NULL`,
    [iglesiaId]
  )
  const progreso = await pgMany(
    `SELECT dp."material", COUNT(*)::int as "completados"
     FROM "DiscipuladoProg" dp
     WHERE dp."iglesiaId"=$1 AND dp."completado"=true
     GROUP BY dp."material"`,
    [iglesiaId]
  )
  res.json({ porEtapa, bautizados: bautizados || {}, progreso })
})

router.put('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { estadoEspiritual, bautizadoAgua, bautizadoEspiritu, discipuladoCompletado } = req.body || {}
  const sets = []; const vals = []; let idx = 1
  if (estadoEspiritual !== undefined) { sets.push(`"estadoEspiritual"=$${idx++}`); vals.push(estadoEspiritual) }
  if (bautizadoAgua !== undefined)    { sets.push(`"bautizadoAgua"=$${idx++}`);    vals.push(!!bautizadoAgua) }
  if (bautizadoEspiritu !== undefined){ sets.push(`"bautizadoEspiritu"=$${idx++}`); vals.push(!!bautizadoEspiritu) }
  if (discipuladoCompletado !== undefined){ sets.push(`"discipuladoCompletado"=$${idx++}`); vals.push(!!discipuladoCompletado) }
  if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' })

  sets.push(`"updatedAt"=CURRENT_TIMESTAMP`)
  await pgExec(
    `UPDATE "Persona" SET ${sets.join(',')} WHERE "id"=$${idx++} AND "iglesiaId"=$${idx++}`,
    [...vals, Number(req.params.id), iglesiaId]
  )
  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'DISCIPULADO', entidad: 'PERSONA', entidadId: req.params.id, detalle: estadoEspiritual || 'actualizado', iglesiaId })
  res.json({ ok: true })
})

router.get('/:id/materiales', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const rows = await pgMany(
    'SELECT * FROM "DiscipuladoProg" WHERE "personaId"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), iglesiaId]
  )
  const mapa = {}
  for (const r of rows) mapa[r.material] = r
  res.json(MATERIALES.map(m => ({ material: m, completado: mapa[m]?.completado || false, fecha: mapa[m]?.fecha || null })))
})

router.put('/:id/materiales/:material', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { completado } = req.body || {}
  const { id, material } = req.params
  const fecha = completado ? new Date().toISOString().slice(0, 10) : null

  await pgExec(
    `INSERT INTO "DiscipuladoProg" ("iglesiaId","personaId","material","completado","fecha")
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT ("personaId","material") DO UPDATE SET "completado"=EXCLUDED."completado","fecha"=EXCLUDED."fecha"`,
    [iglesiaId, Number(id), material, !!completado, fecha]
  )
  res.json({ ok: true })
})

export default router
