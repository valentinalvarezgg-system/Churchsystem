/**
 * culto-asignaciones.js — Asignación de cultos a usuarios PRO
 *
 * Un usuario MAX puede asignar qué cultos puede gestionar cada usuario PRO.
 * Un usuario PRO solo ve y audita los cultos que tiene asignados.
 *
 * Rutas:
 *   GET  /culto-asignaciones            → lista asignaciones (MAX: todas; PRO: las propias)
 *   POST /culto-asignaciones            → asignar culto a usuario (MAX only)
 *   DELETE /culto-asignaciones/:id      → quitar asignación (MAX only)
 *   GET  /culto-asignaciones/usuarios   → usuarios PRO con sus asignaciones (MAX only)
 */
import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { requirePlan, resolvePlan } from '../middlewares/plan.js'

const router = Router()

function requireMax(req, res, next) {
  const plan = resolvePlan(req.user?.plan || 'STARTER')
  if (plan !== 'MAX' && req.user?.rol !== 'PASTOR_GENERAL' && req.user?.rol !== 'GODMODE') {
    return res.status(403).json({ error: 'Solo usuarios MAX pueden gestionar asignaciones' })
  }
  next()
}

// GET /culto-asignaciones
router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const plan = resolvePlan(req.user?.plan || 'STARTER')

  if (plan === 'MAX' || req.user?.rol === 'PASTOR_GENERAL' || req.user?.rol === 'GODMODE') {
    // MAX ve todas las asignaciones de la iglesia
    const rows = await pgMany(
      `SELECT ca.*,
              u."nombre" AS "usuarioNombre", u."email" AS "usuarioEmail",
              c."nombre" AS "cultoNombre", c."fecha" AS "cultoFecha", c."cultoDia", c."cultoTurno"
         FROM "CultoAsignado" ca
         JOIN "User" u ON u."id"=ca."userId"
         JOIN "Culto" c ON c."id"=ca."cultoId"
        WHERE ca."iglesiaId"=$1
        ORDER BY c."fecha" DESC, u."nombre"`,
      [iglesiaId]
    )
    return res.json(rows)
  }

  // PRO/STARTER solo ven sus propias asignaciones
  const rows = await pgMany(
    `SELECT ca."id", ca."cultoId",
            c."nombre" AS "cultoNombre", c."fecha" AS "cultoFecha", c."cultoDia", c."cultoTurno"
       FROM "CultoAsignado" ca
       JOIN "Culto" c ON c."id"=ca."cultoId"
      WHERE ca."userId"=$1 AND ca."iglesiaId"=$2
      ORDER BY c."fecha" DESC`,
    [req.user.id, iglesiaId]
  )
  return res.json(rows)
})

// GET /culto-asignaciones/usuarios — usuarios PRO y sus cultos asignados (MAX only)
router.get('/usuarios', requireAuth, requireMax, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const usuarios = await pgMany(
    `SELECT u."id", u."nombre", u."email", u."rol", u."plan",
            COALESCE(
              json_agg(
                json_build_object('id', ca."id", 'cultoId', ca."cultoId",
                  'cultoNombre', c."nombre", 'cultoFecha', c."fecha")
              ) FILTER (WHERE ca."id" IS NOT NULL),
              '[]'
            ) AS "asignaciones"
       FROM "User" u
       LEFT JOIN "CultoAsignado" ca ON ca."userId"=u."id" AND ca."iglesiaId"=$1
       LEFT JOIN "Culto" c ON c."id"=ca."cultoId"
      WHERE u."iglesiaId"=$1 AND u."deletedAt" IS NULL
      GROUP BY u."id"
      ORDER BY u."nombre"`,
    [iglesiaId]
  )
  return res.json(usuarios)
})

// POST /culto-asignaciones — asignar culto a usuario (MAX only)
router.post('/', requireAuth, requireMax, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const { userId, cultoId } = req.body || {}
  if (!userId || !cultoId) return res.status(400).json({ error: 'userId y cultoId son requeridos' })

  // Verificar que el usuario y culto pertenezcan a esta iglesia
  const [usuario, culto] = await Promise.all([
    pgOne('SELECT "id","nombre","plan" FROM "User" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1', [Number(userId), iglesiaId]),
    pgOne('SELECT "id","nombre","fecha" FROM "Culto" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1', [Number(cultoId), iglesiaId]),
  ])
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado en esta iglesia' })
  if (!culto) return res.status(404).json({ error: 'Culto no encontrado en esta iglesia' })

  try {
    const row = await pgOne(
      `INSERT INTO "CultoAsignado" ("userId","cultoId","iglesiaId","asignadoPor","createdAt")
       VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
       ON CONFLICT ("userId","cultoId","iglesiaId") DO UPDATE SET "asignadoPor"=$4
       RETURNING *`,
      [Number(userId), Number(cultoId), iglesiaId, req.user.id]
    )
    return res.json({ ok: true, asignacion: row, usuario, culto })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// DELETE /culto-asignaciones/:id — quitar asignación (MAX only)
router.delete('/:id', requireAuth, requireMax, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  await pgExec(
    'DELETE FROM "CultoAsignado" WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), iglesiaId]
  )
  return res.json({ ok: true })
})

export default router
