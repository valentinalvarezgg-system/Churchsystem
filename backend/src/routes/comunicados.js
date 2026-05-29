import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { page = 1, limit = 15 } = req.query
  const where = [`c."iglesiaId"=$1`, `c."archivado"=false`]
  const params = [iglesiaId]
  let idx = 2

  if (!['PASTOR_GENERAL', 'CONSOLIDACION'].includes(req.user.rol)) {
    where.push(`(c."destinatarios"='TODOS' OR c."destinatarios"=$${idx++})`)
    params.push(req.user.rol)
  }

  const wStr = 'WHERE ' + where.join(' AND ')
  const offset = (Number(page) - 1) * Number(limit)
  const totalRow = await pgOne(`SELECT COUNT(*)::int AS c FROM "Comunicado" c ${wStr}`, params)
  const total = Number(totalRow?.c ?? 0)
  const data = await pgMany(
    `SELECT c.*,u."nombre" as "autorNombre"
     FROM "Comunicado" c
     LEFT JOIN "User" u ON c."userId"=u."id"
     ${wStr}
     ORDER BY c."fijado" DESC, c."id" DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, Number(limit), offset]
  )
  res.json({ data, total, pages: Math.ceil(total / Number(limit)) })
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { titulo, contenido, tipo = 'GENERAL', destinatarios = 'TODOS', fijado = false } = req.body || {}
  if (!titulo?.trim() || !contenido?.trim()) return res.status(400).json({ error: 'Título y contenido requeridos' })

  const row = await pgOne(
    `INSERT INTO "Comunicado" ("iglesiaId","userId","titulo","contenido","tipo","destinatarios","fijado")
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING "id"`,
    [iglesiaId, req.user.id, titulo.trim(), contenido.trim(), tipo, destinatarios, !!fijado]
  )
  res.status(201).json({ ok: true, id: row.id })
})

router.put('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const c = await pgOne('SELECT * FROM "Comunicado" WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), iglesiaId])
  if (!c) return res.status(404).json({ error: 'No encontrado' })
  if (Number(c.userId) !== Number(req.user.id) && req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Sin permisos' })

  const m = { ...c, ...req.body }
  await pgExec(
    `UPDATE "Comunicado"
     SET "titulo"=$1,"contenido"=$2,"tipo"=$3,"destinatarios"=$4,"fijado"=$5,"archivado"=$6,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$7 AND "iglesiaId"=$8`,
    [m.titulo, m.contenido, m.tipo, m.destinatarios, !!m.fijado, !!m.archivado, Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const c = await pgOne('SELECT * FROM "Comunicado" WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), iglesiaId])
  if (!c || (Number(c.userId) !== Number(req.user.id) && req.user.rol !== 'PASTOR_GENERAL')) return res.status(403).json({ error: 'Sin permisos' })

  await pgExec('UPDATE "Comunicado" SET "archivado"=true,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), iglesiaId])
  res.json({ ok: true })
})

export default router
