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
  const limitIdx = idx++
  const offsetIdx = idx++
  const [totalRow, data] = await Promise.all([
    pgOne(`SELECT COUNT(*)::int AS c FROM "Persona" p ${wStr}`, params),
    pgMany(
      `SELECT p."id",p."nombre",p."apellido",p."telefono",p."estado",p."estadoEspiritual",
              p."bautizadoAgua",p."bautizadoEspiritu",p."discipuladoCompletado",
              u."nombre" as "liderNombre",
              COALESCE(seg."totalSeguimientos", 0)::int as "totalSeguimientos",
              COALESCE(prog."materialesCompletados", 0)::int as "materialesCompletados"
       FROM "Persona" p
       LEFT JOIN "User" u ON p."asignadoAUserId"=u."id"
       LEFT JOIN (
         SELECT "personaId", COUNT(*)::int AS "totalSeguimientos"
           FROM "Seguimiento"
          WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
          GROUP BY "personaId"
       ) seg ON seg."personaId"=p."id"
       LEFT JOIN (
         SELECT "personaId", COUNT(*)::int AS "materialesCompletados"
           FROM "DiscipuladoProg"
          WHERE "iglesiaId"=$1 AND "completado"=true
          GROUP BY "personaId"
       ) prog ON prog."personaId"=p."id"
       ${wStr}
       ORDER BY p."estadoEspiritual", p."nombre"
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, Number(limit), offset]
    ),
  ])
  const total = Number(totalRow?.c ?? 0)
  res.json({ data, total, pages: Math.ceil(total / Number(limit)), page: Number(page) })
})

router.get('/stats', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const [porEtapa, bautizados, progreso] = await Promise.all([
    pgMany(
      `SELECT "estadoEspiritual", COUNT(*)::int as "total" FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL GROUP BY "estadoEspiritual"`,
      [iglesiaId]
    ),
    pgOne(
      `SELECT SUM(CASE WHEN "bautizadoAgua" THEN 1 ELSE 0 END)::int as "agua",
              SUM(CASE WHEN "bautizadoEspiritu" THEN 1 ELSE 0 END)::int as "espiritu",
              SUM(CASE WHEN "discipuladoCompletado" THEN 1 ELSE 0 END)::int as "discipulado"
       FROM "Persona" WHERE "iglesiaId"=$1 AND "estado"='ACTIVO' AND "deletedAt" IS NULL`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT dp."material", COUNT(*)::int as "completados"
       FROM "DiscipuladoProg" dp
       WHERE dp."iglesiaId"=$1 AND dp."completado"=true
       GROUP BY dp."material"`,
      [iglesiaId]
    ),
  ])
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


// ── Árbol de discipulado ─────────────────────────────────────

// GET /discipulado/arbol — devuelve nodos + links para el grafo
router.get('/arbol', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  // Aseguramos que la tabla exista (idempotente)
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "DiscipuladoRelacion" (
      "id"             SERIAL PRIMARY KEY,
      "iglesiaId"      INT NOT NULL,
      "discipuladorId" INT NOT NULL,
      "discipuladoId"  INT NOT NULL,
      "fechaInicio"    DATE,
      "activo"         BOOLEAN NOT NULL DEFAULT true,
      "notas"          TEXT,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pgExec(`CREATE INDEX IF NOT EXISTS "DR_iglesia_idx" ON "DiscipuladoRelacion"("iglesiaId")`)

  const relaciones = await pgMany(
    `SELECT r."id", r."discipuladorId", r."discipuladoId", r."fechaInicio", r."activo", r."notas"
     FROM "DiscipuladoRelacion" r
     WHERE r."iglesiaId"=$1`,
    [iglesiaId]
  )

  // IDs de personas involucradas en relaciones
  const ids = new Set()
  relaciones.forEach(r => { ids.add(r.discipuladorId); ids.add(r.discipuladoId) })

  let personas = []
  if (ids.size > 0) {
    const idList = [...ids].join(',')
    personas = await pgMany(
      `SELECT p."id", p."nombre", p."apellido", p."estadoEspiritual", p."bautizadoAgua", p."bautizadoEspiritu",
              p."discipuladoCompletado",
              (SELECT COUNT(*)::int FROM "DiscipuladoRelacion" dr2
               WHERE dr2."iglesiaId"=$1 AND dr2."discipuladorId"=p."id" AND dr2."activo"=true) AS "totalDiscipulos"
       FROM "Persona" p
       WHERE p."iglesiaId"=$1 AND p."deletedAt" IS NULL AND p."id" IN (${idList})`,
      [iglesiaId]
    )
  }

  // Raíces: personas que discipulan pero nadie las discipula dentro de la iglesia
  const discipuladosIds = new Set(relaciones.filter(r => r.activo).map(r => r.discipuladoId))
  const discipuladoresIds = new Set(relaciones.filter(r => r.activo).map(r => r.discipuladorId))
  const raices = [...discipuladoresIds].filter(id => !discipuladosIds.has(id))

  res.json({
    nodos: personas,
    links: relaciones,
    raices
  })
})

// GET /discipulado/arbol/personas — lista liviana para el selector del árbol
router.get('/arbol/personas', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const { search } = req.query
  const params = [iglesiaId]
  let extraWhere = ''
  if (search) { extraWhere = ` AND (p."nombre" ILIKE $2 OR p."apellido" ILIKE $2)`; params.push(`%${search}%`) }
  const rows = await pgMany(
    `SELECT p."id", p."nombre", p."apellido", p."estadoEspiritual"
     FROM "Persona" p WHERE p."iglesiaId"=$1 AND p."deletedAt" IS NULL${extraWhere}
     ORDER BY p."nombre" LIMIT 60`,
    params
  )
  res.json(rows)
})

// POST /discipulado/arbol — crear relación
router.post('/arbol', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const { discipuladorId, discipuladoId, fechaInicio, notas } = req.body || {}
  if (!discipuladorId || !discipuladoId) return res.status(400).json({ error: 'discipuladorId y discipuladoId son requeridos' })
  if (Number(discipuladorId) === Number(discipuladoId)) return res.status(400).json({ error: 'Una persona no puede discipularse a sí misma' })

  // Verificar que ambas personas pertenecen a la iglesia
  const count = await pgOne(
    `SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "id" IN ($2,$3) AND "deletedAt" IS NULL`,
    [iglesiaId, Number(discipuladorId), Number(discipuladoId)]
  )
  if (count?.c !== 2) return res.status(404).json({ error: 'Una o ambas personas no existen en esta iglesia' })

  // Si ya existe una relación activa para el discipulado, desactivarla primero
  await pgExec(
    `UPDATE "DiscipuladoRelacion" SET "activo"=false, "updatedAt"=NOW()
     WHERE "iglesiaId"=$1 AND "discipuladoId"=$2 AND "activo"=true`,
    [iglesiaId, Number(discipuladoId)]
  )

  const row = await pgOne(
    `INSERT INTO "DiscipuladoRelacion"("iglesiaId","discipuladorId","discipuladoId","fechaInicio","notas")
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [iglesiaId, Number(discipuladorId), Number(discipuladoId), fechaInicio || null, notas || null]
  )
  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'ARBOL_CREATE', entidad: 'DISCIPULADO', entidadId: String(row.id), detalle: `${discipuladorId}→${discipuladoId}`, iglesiaId })
  res.status(201).json(row)
})

// DELETE /discipulado/arbol/:id — eliminar / desactivar relación
router.delete('/arbol/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await pgExec(
    `UPDATE "DiscipuladoRelacion" SET "activo"=false,"updatedAt"=NOW()
     WHERE "id"=$1 AND "iglesiaId"=$2`,
    [Number(req.params.id), iglesiaId]
  )
  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'ARBOL_DELETE', entidad: 'DISCIPULADO', entidadId: req.params.id, detalle: 'relacion desactivada', iglesiaId })
  res.json({ ok: true })
})

export default router
