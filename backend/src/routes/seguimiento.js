import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { ensureOperationalTenantDataSynced } from '../lib/core-sync.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/:personaId', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const rows = await pgMany(
    `SELECT s.*, u."nombre" AS "autorNombre", u."email" AS "autorEmail"
       FROM "Seguimiento" s
       LEFT JOIN "User" u ON s."userId"=u."id"
      WHERE s."iglesiaId"=$1 AND s."personaId"=$2 AND s."deletedAt" IS NULL
      ORDER BY s."id" DESC`,
    [iglesiaId, Number(req.params.personaId)]
  )
  res.json(rows)
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const { personaId, tipo = 'CONTACTO', nota = '', proximoContacto = null } = req.body || {}
  if (!personaId) return res.status(400).json({ error: 'personaId requerido' })

  const created = await pgOne(
    `INSERT INTO "Seguimiento"
      ("iglesiaId","personaId","userId","tipo","nota","proximoContacto","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING *`,
    [iglesiaId, Number(personaId), Number(req.user.id), tipo, nota, proximoContacto || null]
  )
  res.status(201).json(created)
})

router.delete('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const s = await pgOne(
    'SELECT * FROM "Seguimiento" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), iglesiaId]
  )
  if (!s) return res.status(404).json({ error: 'No encontrado' })
  if (Number(s.userId || 0) !== Number(req.user.id) && req.user.rol !== 'PASTOR_GENERAL') {
    return res.status(403).json({ error: 'Sin permisos' })
  }
  await pgExec('UPDATE "Seguimiento" SET "deletedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), iglesiaId])
  res.json({ ok: true })
})

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureOperationalTenantDataSynced(iglesiaId)

  const limit = Number(req.query.limit || 20)
  const rows = await pgMany(
    `SELECT s.*, u."nombre" AS "autorNombre", p."nombre" AS "personaNombre", p."apellido" AS "personaApellido"
       FROM "Seguimiento" s
       LEFT JOIN "User" u ON s."userId"=u."id"
       LEFT JOIN "Persona" p ON s."personaId"=p."id"
      WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL
      ORDER BY s."id" DESC
      LIMIT $2`,
    [iglesiaId, limit]
  )
  res.json(rows)
})

export default router

