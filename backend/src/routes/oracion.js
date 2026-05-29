import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()
const ESTADOS = ['ACTIVA', 'RESPONDIDA', 'EN_ESPERA', 'ARCHIVADA']

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { estado, page = 1, limit = 20 } = req.query
  const where = [`o."iglesiaId"=$1`, `o."deletedAt" IS NULL`]
  const params = [iglesiaId]
  let idx = 2

  if (estado) { where.push(`o."estado"=$${idx++}`); params.push(estado) }

  const wStr = 'WHERE ' + where.join(' AND ')
  const offset = (Number(page) - 1) * Number(limit)
  const totalRow = await pgOne(`SELECT COUNT(*)::int AS c FROM "Oracion" o ${wStr}`, params)
  const total = Number(totalRow?.c ?? 0)
  const data = await pgMany(
    `SELECT o.*,
            u."nombre" as "autorNombre",
            (SELECT COUNT(*)::int FROM "OracionApoyo" a WHERE a."oracionId"=o."id") as "apoyos"
     FROM "Oracion" o
     LEFT JOIN "User" u ON o."userId"=u."id"
     ${wStr}
     ORDER BY o."id" DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, Number(limit), offset]
  )
  res.json({ data, total, pages: Math.ceil(total / Number(limit)) })
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { titulo, descripcion = '', privado = false } = req.body || {}
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' })

  const row = await pgOne(
    `INSERT INTO "Oracion" ("iglesiaId","userId","titulo","descripcion","privado","estado")
     VALUES ($1,$2,$3,$4,$5,'ACTIVA') RETURNING "id"`,
    [iglesiaId, req.user.id, titulo.trim(), descripcion, !!privado]
  )
  res.status(201).json({ ok: true, id: row.id })
})

router.put('/:id/estado', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { estado } = req.body || {}
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

  const o = await pgOne('SELECT * FROM "Oracion" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [Number(req.params.id), iglesiaId])
  if (!o) return res.status(404).json({ error: 'No encontrada' })
  if (Number(o.userId) !== Number(req.user.id) && req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Sin permisos' })

  await pgExec('UPDATE "Oracion" SET "estado"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "iglesiaId"=$3', [estado, Number(req.params.id), iglesiaId])
  res.json({ ok: true })
})

router.post('/:id/apoyo', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const oracionId = Number(req.params.id)
  const userId = Number(req.user.id)

  const ex = await pgOne('SELECT "id" FROM "OracionApoyo" WHERE "oracionId"=$1 AND "userId"=$2', [oracionId, userId])
  if (ex) {
    await pgExec('DELETE FROM "OracionApoyo" WHERE "oracionId"=$1 AND "userId"=$2', [oracionId, userId])
    return res.json({ ok: true, accion: 'quitado' })
  }
  await pgExec(
    'INSERT INTO "OracionApoyo" ("iglesiaId","oracionId","userId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
    [iglesiaId, oracionId, userId]
  )
  res.json({ ok: true, accion: 'agregado' })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const o = await pgOne('SELECT * FROM "Oracion" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [Number(req.params.id), iglesiaId])
  if (!o) return res.status(404).json({ error: 'No encontrada' })
  if (Number(o.userId) !== Number(req.user.id) && req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Sin permisos' })

  await pgExec('UPDATE "Oracion" SET "deletedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), iglesiaId])
  res.json({ ok: true })
})

export default router
