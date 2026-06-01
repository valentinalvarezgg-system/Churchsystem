import { Router } from 'express'
import { pgMany } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const clean = v => String(v || '').replace(/^(?:OK|LISTO|[✔☑])\s*/i, '').trim()

router.get('/', requireAuth, wrap(async (req, res) => {
  const { q = '', limit = 8 } = req.query
  const term = String(q).trim()
  const iglesiaId = Number(req.user.iglesiaId)
  if (term.length < 2) return res.json([])
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant invalido' })

  const s = `%${term}%`
  const lim = Math.min(Number(limit) || 8, 20)
  const [personas, grupos, cultos] = await Promise.all([
    pgMany(
      `SELECT "id", "nombre", "apellido", "email", "telefono", "estado", 'persona' AS "tipo"
       FROM "Persona"
       WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
         AND ("nombre" ILIKE $2 OR "apellido" ILIKE $2 OR "email" ILIKE $2 OR "telefono" ILIKE $2)
       ORDER BY "nombre" ASC
       LIMIT $3`,
      [iglesiaId, s, lim]
    ),
    pgMany(
      `SELECT "id", "nombre", "descripcion", 'grupo' AS "tipo"
       FROM "Grupo"
       WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "nombre" ILIKE $2
       ORDER BY "nombre" ASC
       LIMIT 3`,
      [iglesiaId, s]
    ),
    pgMany(
      `SELECT "id", "nombre", "fecha", 'culto' AS "tipo"
       FROM "Culto"
       WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "nombre" ILIKE $2
       ORDER BY "fecha" DESC
       LIMIT 3`,
      [iglesiaId, s]
    ),
  ])

  res.json([
    ...personas.map(p => ({
      ...p,
      apellido: clean(p.apellido),
      nombre: clean(p.nombre),
      detalle: p.telefono || p.email || p.estado || '',
    })),
    ...grupos.map(g => ({ ...g, detalle: g.descripcion || 'Grupo' })),
    ...cultos.map(c => ({ ...c, detalle: `Culto · ${c.fecha}` })),
  ])
}))

export default router
