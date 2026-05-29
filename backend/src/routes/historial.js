import { Router } from 'express'
import { pgMany, pgOne } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/', requireAuth, requireRol('PASTOR_GENERAL','CONSOLIDACION'), wrap(async (req, res) => {
  const { page = 1, limit = 50, entidad, accion } = req.query
  const iglesiaId = Number(req.user.iglesiaId)
  const lim = Math.min(Number(limit) || 50, 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * lim
  const where = ['"iglesiaId"=$1']
  const params = [iglesiaId]

  if (entidad) {
    params.push(String(entidad))
    where.push(`"entity"=$${params.length}`)
  }
  if (accion) {
    params.push(String(accion))
    where.push(`"action"=$${params.length}`)
  }

  const wStr = `WHERE ${where.join(' AND ')}`
  const totalRow = await pgOne(`SELECT COUNT(*)::int AS c FROM "AuditLog" ${wStr}`, params)
  const data = await pgMany(
    `SELECT
       "id",
       "userId",
       "action" AS "accion",
       "entity" AS "entidad",
       "entityId" AS "entidadId",
       "detail" AS "detalle",
       "createdAt"
     FROM "AuditLog"
     ${wStr}
     ORDER BY "id" DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, lim, offset]
  )
  const total = Number(totalRow?.c || 0)
  res.json({ data, total, page: Number(page), pages: Math.ceil(total / lim) })
}))

export default router

