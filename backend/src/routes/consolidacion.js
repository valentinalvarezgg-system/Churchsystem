import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()
const PASOS = ['bienvenida', 'datos', 'primer_llamada', 'material_entregado', 'segunda_visita', 'conectado_grupo', 'discipulado']

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { estado, page = 1, limit = 20 } = req.query
  const where = [`c."iglesiaId"=$1`, `c."deletedAt" IS NULL`]
  const params = [iglesiaId]
  let idx = 2

  if (estado) { where.push(`c."estado"=$${idx++}`); params.push(estado) }
  if (!['PASTOR_GENERAL', 'CONSOLIDACION'].includes(req.user.rol)) {
    where.push(`c."consolidadorId"=$${idx++}`)
    params.push(Number(req.user.id))
  }

  const wStr = 'WHERE ' + where.join(' AND ')
  const offset = (Number(page) - 1) * Number(limit)
  const totalRow = await pgOne(`SELECT COUNT(*)::int AS c FROM "Consolidacion" c ${wStr}`, params)
  const total = Number(totalRow?.c ?? 0)
  const data = await pgMany(
    `SELECT c.*,
            p."nombre" as "personaNombre", p."apellido" as "personaApellido",
            p."telefono" as "personaTel", p."estado" as "personaEstado",
            u."nombre" as "consolidadorNombre"
     FROM "Consolidacion" c
     JOIN "Persona" p ON c."personaId"=p."id"
     LEFT JOIN "User" u ON c."consolidadorId"=u."id"
     ${wStr}
     ORDER BY c."id" DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, Number(limit), offset]
  )
  res.json({ data, total, pages: Math.ceil(total / Number(limit)), pasos: PASOS })
})

router.get('/stats', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const porEstado = await pgMany(
    `SELECT "estado", COUNT(*)::int as "total" FROM "Consolidacion" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL GROUP BY "estado"`,
    [iglesiaId]
  )
  const tasa = await pgOne(
    `SELECT COUNT(*)::int as "total",
            SUM(CASE WHEN "estado"='COMPLETADA' THEN 1 ELSE 0 END)::int as "completadas"
     FROM "Consolidacion" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`,
    [iglesiaId]
  )
  res.json({ porEstado, tasa })
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { personaId, consolidadorId, notas = '' } = req.body || {}
  if (!personaId) return res.status(400).json({ error: 'personaId requerido' })

  const existe = await pgOne(
    `SELECT "id" FROM "Consolidacion" WHERE "personaId"=$1 AND "iglesiaId"=$2 AND "estado" NOT IN ('COMPLETADA','TRANSFERIDA') AND "deletedAt" IS NULL`,
    [Number(personaId), iglesiaId]
  )
  if (existe) return res.status(409).json({ error: 'Ya tiene un proceso activo' })

  const pasosInicial = JSON.stringify(PASOS.reduce((a, p) => ({ ...a, [p]: false }), {}))
  const row = await pgOne(
    `INSERT INTO "Consolidacion" ("iglesiaId","personaId","consolidadorId","notas","pasos","estado")
     VALUES ($1,$2,$3,$4,$5,'PRIMER_CONTACTO') RETURNING "id"`,
    [iglesiaId, Number(personaId), consolidadorId ? Number(consolidadorId) : Number(req.user.id), notas, pasosInicial]
  )

  await pgExec(
    `UPDATE "Persona" SET "estado"='NUEVO',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2 AND "estado"='VISITANTE'`,
    [Number(personaId), iglesiaId]
  )

  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'CONSOLIDACION', entidad: 'PERSONA', entidadId: personaId, iglesiaId })
  res.status(201).json({ ok: true, id: row.id })
})

router.put('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const c = await pgOne('SELECT * FROM "Consolidacion" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [Number(req.params.id), iglesiaId])
  if (!c) return res.status(404).json({ error: 'No encontrado' })

  const { estado, notas, pasos, consolidadorId } = req.body || {}
  let pasosActuales = {}
  try { pasosActuales = JSON.parse(c.pasos || '{}') } catch (_) {}
  const pasosNuevos = pasos ? { ...pasosActuales, ...pasos } : pasosActuales
  const completados = Object.values(pasosNuevos).filter(Boolean).length
  const estadoFinal = estado || (completados === PASOS.length ? 'COMPLETADA' : c.estado)

  await pgExec(
    `UPDATE "Consolidacion"
     SET "estado"=$1,"notas"=$2,"pasos"=$3,"consolidadorId"=$4,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$5 AND "iglesiaId"=$6`,
    [estadoFinal, notas ?? c.notas, JSON.stringify(pasosNuevos), consolidadorId ? Number(consolidadorId) : c.consolidadorId, Number(req.params.id), iglesiaId]
  )

  if (estadoFinal === 'COMPLETADA') {
    await pgExec(
      `UPDATE "Persona" SET "estado"='ACTIVO',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2`,
      [c.personaId, iglesiaId]
    )
  }
  res.json({ ok: true, estado: estadoFinal, pasosCompletados: completados, total: PASOS.length })
})

export default router
