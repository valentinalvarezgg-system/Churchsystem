import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const hoy = new Date().toISOString().slice(0, 10)
  const desde = req.query.desde || hoy
  const hasta = req.query.hasta || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

  const data = await pgMany(
    `SELECT e.*,u."nombre" as "autorNombre"
     FROM "Evento" e
     LEFT JOIN "User" u ON e."userId"=u."id"
     WHERE e."iglesiaId"=$1 AND e."fecha" BETWEEN $2 AND $3 AND e."deletedAt" IS NULL
     ORDER BY e."fecha" ASC, e."hora" ASC`,
    [iglesiaId, desde, hasta]
  )
  res.json(data)
})

router.get('/proximos', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const hoy = new Date().toISOString().slice(0, 10)
  const data = await pgMany(
    `SELECT * FROM "Evento" WHERE "iglesiaId"=$1 AND "fecha">=$2 AND "deletedAt" IS NULL ORDER BY "fecha" ASC LIMIT 10`,
    [iglesiaId, hoy]
  )
  res.json(data)
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { titulo, tipo = 'EVENTO', fecha, hora = '', lugar = '', descripcion = '', todoElDia = false } = req.body || {}
  if (!titulo?.trim() || !fecha) return res.status(400).json({ error: 'titulo y fecha requeridos' })

  const row = await pgOne(
    `INSERT INTO "Evento" ("iglesiaId","userId","titulo","tipo","fecha","hora","lugar","descripcion","todoElDia")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING "id"`,
    [iglesiaId, req.user.id, titulo.trim(), tipo, fecha, hora, lugar, descripcion, !!todoElDia]
  )
  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'CREAR', entidad: 'EVENTO', entidadId: row.id, detalle: titulo, iglesiaId })
  res.status(201).json({ ok: true, id: row.id })
})

router.put('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const ev = await pgOne('SELECT * FROM "Evento" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [Number(req.params.id), iglesiaId])
  if (!ev) return res.status(404).json({ error: 'No encontrado' })

  const m = { ...ev, ...req.body }
  await pgExec(
    `UPDATE "Evento"
     SET "titulo"=$1,"tipo"=$2,"fecha"=$3,"hora"=$4,"lugar"=$5,"descripcion"=$6,"todoElDia"=$7,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$8 AND "iglesiaId"=$9`,
    [m.titulo, m.tipo, m.fecha, m.hora || '', m.lugar || '', m.descripcion || '', !!m.todoElDia, Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  await pgExec(
    'UPDATE "Evento" SET "deletedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

export default router
