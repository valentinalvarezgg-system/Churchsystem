import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { ensureOperationalTenantDataSynced } from '../lib/core-sync.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import XLSX from '../lib/xlsx-safe.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const { page = 1, limit = 30, desde, hasta, tipo } = req.query
  const where = ['f."iglesiaId"=$1', 'f."deletedAt" IS NULL']
  const params = [iglesiaId]
  let idx = params.length + 1

  if (desde) { where.push(`f."fecha">=$${idx++}`); params.push(desde) }
  if (hasta) { where.push(`f."fecha"<=$${idx++}`); params.push(hasta) }
  if (tipo) { where.push(`f."tipo"=$${idx++}`); params.push(tipo) }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const offset = (Number(page) - 1) * Number(limit)
  const totales = await pgOne(`SELECT COUNT(*)::int as registros, COALESCE(SUM("monto"),0)::float8 as total FROM "Finanza" f ${w}`, params)
  const porTipo = await pgMany(
    `SELECT "tipo", COUNT(*)::int as qty, COALESCE(SUM("monto"),0)::float8 as subtotal
       FROM "Finanza" f ${w}
      GROUP BY "tipo"`,
    params
  )
  const data = await pgMany(
    `SELECT f.*, c."nombre" as "cultoNombre", u."nombre" as "autorNombre"
       FROM "Finanza" f
       LEFT JOIN "Culto" c ON f."cultoId"=c."id"
       LEFT JOIN "User" u ON f."userId"=u."id"
       ${w}
      ORDER BY f."fecha" DESC, f."id" DESC
      LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, Number(limit), offset]
  )
  const total = Number(totales?.registros || 0)
  const tendencia = await pgMany(
    `SELECT to_char(to_date("fecha",'YYYY-MM-DD'),'YYYY-MM') as mes,
            COALESCE(SUM("monto"),0)::float8 as total,
            COUNT(*)::int as qty
       FROM "Finanza"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND to_date("fecha",'YYYY-MM-DD') >= (CURRENT_DATE - INTERVAL '8 months')
      GROUP BY to_char(to_date("fecha",'YYYY-MM-DD'),'YYYY-MM')
      ORDER BY mes ASC`,
    [iglesiaId]
  )

  res.json({
    data,
    total,
    pages: Math.ceil(total / Number(limit)),
    totales,
    porTipo,
    tendencia,
    currency: req.user.divisa || 'ARS',
    country: req.user.pais || 'AR',
    lang: req.user.idioma || 'es',
  })
})

router.get('/resumen-mensual', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const rows = await pgMany(
    `SELECT to_char(to_date("fecha",'YYYY-MM-DD'),'YYYY-MM') as mes, "tipo",
            COALESCE(SUM("monto"),0)::float8 as total, COUNT(*)::int as qty
       FROM "Finanza"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
        AND to_date("fecha",'YYYY-MM-DD') >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY mes,"tipo"
      ORDER BY mes ASC`,
    [iglesiaId]
  )
  res.json(rows)
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const { monto, tipo = 'OFRENDA', fecha, cultoId = null, descripcion = '', anonimo = true } = req.body || {}
  if (!monto || !fecha) return res.status(400).json({ error: 'monto y fecha requeridos' })

  const created = await pgOne(
    `INSERT INTO "Finanza"
      ("iglesiaId","monto","tipo","fecha","cultoId","descripcion","anonimo","userId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING "id"`,
    [iglesiaId, Number(monto), tipo, fecha, cultoId ? Number(cultoId) : null, descripcion, !!anonimo, Number(req.user.id)]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'REGISTRAR',
    entidad: 'FINANZA',
    entidadId: created.id,
    detalle: `${tipo} $${monto}`,
    iglesiaId,
  })
  res.status(201).json({ ok: true, id: created.id })
})

router.put('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const f = await pgOne(
    'SELECT * FROM "Finanza" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), iglesiaId]
  )
  if (!f) return res.status(404).json({ error: 'No encontrado' })

  const m = { ...f, ...req.body }
  await pgExec(
    `UPDATE "Finanza"
     SET "monto"=$1, "tipo"=$2, "fecha"=$3, "cultoId"=$4, "descripcion"=$5, "anonimo"=$6, "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$7 AND "iglesiaId"=$8`,
    [Number(m.monto), m.tipo, m.fecha, m.cultoId ? Number(m.cultoId) : null, m.descripcion || '', !!m.anonimo, Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await pgExec(
    'UPDATE "Finanza" SET "deletedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

router.get('/export', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const { desde, hasta } = req.query
  const where = ['f."iglesiaId"=$1', 'f."deletedAt" IS NULL']
  const params = [iglesiaId]
  let idx = 2
  if (desde) { where.push(`f."fecha">=$${idx++}`); params.push(desde) }
  if (hasta) { where.push(`f."fecha"<=$${idx++}`); params.push(hasta) }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const rows = await pgMany(
    `SELECT f."fecha", f."tipo", f."monto", f."descripcion", c."nombre" as "culto"
       FROM "Finanza" f
       LEFT JOIN "Culto" c ON f."cultoId"=c."id"
       ${w}
      ORDER BY f."fecha" DESC`,
    params
  )
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Finanzas')
  const buf = await XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=\"finanzas.xlsx\"')
  res.send(buf)
})

export default router

