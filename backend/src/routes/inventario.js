import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'

const router = Router()
const canManage = [requireAuth, requireRol('PASTOR_GENERAL', 'PASTOR_CULTO', 'STAFF')]
const CONDITIONS = new Set(['NUEVO', 'BUENO', 'REGULAR', 'REPARACION', 'BAJA'])

let schemaPromise = null
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pgExec(`
        CREATE TABLE IF NOT EXISTS "InventarioSeccion" (
          "id" SERIAL PRIMARY KEY,
          "iglesiaId" INT NOT NULL,
          "nombre" TEXT NOT NULL,
          "descripcion" TEXT,
          "orden" INT NOT NULL DEFAULT 0,
          "deletedAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await pgExec(`
        CREATE TABLE IF NOT EXISTS "InventarioItem" (
          "id" SERIAL PRIMARY KEY,
          "iglesiaId" INT NOT NULL,
          "seccionId" INT NOT NULL REFERENCES "InventarioSeccion"("id"),
          "nombre" TEXT NOT NULL,
          "codigo" TEXT,
          "cantidad" INT NOT NULL DEFAULT 0 CHECK ("cantidad" >= 0),
          "stockMinimo" INT NOT NULL DEFAULT 0 CHECK ("stockMinimo" >= 0),
          "estado" TEXT NOT NULL DEFAULT 'BUENO',
          "ubicacion" TEXT,
          "responsable" TEXT,
          "observaciones" TEXT,
          "deletedAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      await pgExec(`CREATE INDEX IF NOT EXISTS "InventarioSeccion_iglesia_idx" ON "InventarioSeccion"("iglesiaId") WHERE "deletedAt" IS NULL`)
      await pgExec(`CREATE INDEX IF NOT EXISTS "InventarioItem_iglesia_seccion_idx" ON "InventarioItem"("iglesiaId", "seccionId") WHERE "deletedAt" IS NULL`)
      await pgExec(`CREATE UNIQUE INDEX IF NOT EXISTS "InventarioSeccion_nombre_uq" ON "InventarioSeccion"("iglesiaId", LOWER("nombre")) WHERE "deletedAt" IS NULL`)
      await pgExec(`CREATE UNIQUE INDEX IF NOT EXISTS "InventarioItem_codigo_uq" ON "InventarioItem"("iglesiaId", LOWER("codigo")) WHERE "deletedAt" IS NULL AND "codigo" IS NOT NULL`)
    })().catch(err => {
      schemaPromise = null
      throw err
    })
  }
  return schemaPromise
}

function cleanText(value, max = 500) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, max) : null
}

function nonNegativeInt(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

router.get('/', requireAuth, async (req, res) => {
  await ensureSchema()
  const iglesiaId = Number(req.user.iglesiaId)
  const [secciones, items, resumen] = await Promise.all([
    pgMany(`
      SELECT s.*, COUNT(i."id")::INT AS "totalItems",
             COALESCE(SUM(i."cantidad"), 0)::INT AS "totalUnidades"
      FROM "InventarioSeccion" s
      LEFT JOIN "InventarioItem" i ON i."seccionId"=s."id"
        AND i."iglesiaId"=s."iglesiaId" AND i."deletedAt" IS NULL
      WHERE s."iglesiaId"=$1 AND s."deletedAt" IS NULL
      GROUP BY s."id"
      ORDER BY s."orden", s."nombre"
    `, [iglesiaId]),
    pgMany(`
      SELECT i.*
      FROM "InventarioItem" i
      JOIN "InventarioSeccion" s ON s."id"=i."seccionId"
        AND s."iglesiaId"=i."iglesiaId" AND s."deletedAt" IS NULL
      WHERE i."iglesiaId"=$1 AND i."deletedAt" IS NULL
      ORDER BY i."nombre"
    `, [iglesiaId]),
    pgOne(`
      SELECT COUNT(*)::INT AS "totalItems",
             COALESCE(SUM("cantidad"), 0)::INT AS "totalUnidades",
             COUNT(*) FILTER (WHERE "cantidad" <= "stockMinimo")::INT AS "stockBajo",
             COUNT(*) FILTER (WHERE "estado" IN ('REPARACION','BAJA'))::INT AS "requierenAtencion"
      FROM "InventarioItem"
      WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
    `, [iglesiaId]),
  ])
  res.json({ secciones, items, resumen })
})

router.post('/secciones', ...canManage, async (req, res) => {
  await ensureSchema()
  const iglesiaId = Number(req.user.iglesiaId)
  const nombre = cleanText(req.body?.nombre, 80)
  if (!nombre) return res.status(400).json({ error: 'El nombre de la sección es obligatorio' })
  const ordenRow = await pgOne(`SELECT COALESCE(MAX("orden"), -1) + 1 AS orden FROM "InventarioSeccion" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`, [iglesiaId])
  try {
    const row = await pgOne(`
      INSERT INTO "InventarioSeccion"("iglesiaId","nombre","descripcion","orden")
      VALUES($1,$2,$3,$4) RETURNING *
    `, [iglesiaId, nombre, cleanText(req.body?.descripcion), ordenRow?.orden || 0])
    return res.status(201).json(row)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una sección con ese nombre' })
    throw err
  }
})

router.put('/secciones/:id', ...canManage, async (req, res) => {
  await ensureSchema()
  const iglesiaId = Number(req.user.iglesiaId)
  const id = Number(req.params.id)
  const nombre = cleanText(req.body?.nombre, 80)
  if (!Number.isInteger(id) || !nombre) return res.status(400).json({ error: 'Datos de sección inválidos' })
  try {
    const row = await pgOne(`
      UPDATE "InventarioSeccion" SET "nombre"=$1,"descripcion"=$2,"updatedAt"=NOW()
      WHERE "id"=$3 AND "iglesiaId"=$4 AND "deletedAt" IS NULL RETURNING *
    `, [nombre, cleanText(req.body?.descripcion), id, iglesiaId])
    if (!row) return res.status(404).json({ error: 'Sección no encontrada' })
    return res.json(row)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una sección con ese nombre' })
    throw err
  }
})

router.delete('/secciones/:id', ...canManage, async (req, res) => {
  await ensureSchema()
  const iglesiaId = Number(req.user.iglesiaId)
  const id = Number(req.params.id)
  const used = await pgOne(`SELECT COUNT(*)::INT AS total FROM "InventarioItem" WHERE "seccionId"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL`, [id, iglesiaId])
  if (used?.total > 0) return res.status(409).json({ error: 'Mové o eliminá los artículos antes de borrar esta sección' })
  const result = await pgExec(`UPDATE "InventarioSeccion" SET "deletedAt"=NOW(),"updatedAt"=NOW() WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL`, [id, iglesiaId])
  if (!result.rowCount) return res.status(404).json({ error: 'Sección no encontrada' })
  res.json({ ok: true })
})

router.post('/items', ...canManage, async (req, res) => {
  await ensureSchema()
  const iglesiaId = Number(req.user.iglesiaId)
  const nombre = cleanText(req.body?.nombre, 120)
  const seccionId = Number(req.body?.seccionId)
  if (!nombre || !Number.isInteger(seccionId)) return res.status(400).json({ error: 'Nombre y sección son obligatorios' })
  const section = await pgOne(`SELECT "id" FROM "InventarioSeccion" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL`, [seccionId, iglesiaId])
  if (!section) return res.status(400).json({ error: 'La sección seleccionada no existe' })
  const estado = CONDITIONS.has(req.body?.estado) ? req.body.estado : 'BUENO'
  try {
    const row = await pgOne(`
      INSERT INTO "InventarioItem"("iglesiaId","seccionId","nombre","codigo","cantidad","stockMinimo","estado","ubicacion","responsable","observaciones")
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [iglesiaId, seccionId, nombre, cleanText(req.body?.codigo, 60), nonNegativeInt(req.body?.cantidad), nonNegativeInt(req.body?.stockMinimo), estado, cleanText(req.body?.ubicacion, 120), cleanText(req.body?.responsable, 120), cleanText(req.body?.observaciones, 1000)])
    return res.status(201).json(row)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un artículo con ese código' })
    throw err
  }
})

router.put('/items/:id', ...canManage, async (req, res) => {
  await ensureSchema()
  const iglesiaId = Number(req.user.iglesiaId)
  const id = Number(req.params.id)
  const nombre = cleanText(req.body?.nombre, 120)
  const seccionId = Number(req.body?.seccionId)
  if (!Number.isInteger(id) || !nombre || !Number.isInteger(seccionId)) return res.status(400).json({ error: 'Datos del artículo inválidos' })
  const section = await pgOne(`SELECT "id" FROM "InventarioSeccion" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL`, [seccionId, iglesiaId])
  if (!section) return res.status(400).json({ error: 'La sección seleccionada no existe' })
  const estado = CONDITIONS.has(req.body?.estado) ? req.body.estado : 'BUENO'
  try {
    const row = await pgOne(`
      UPDATE "InventarioItem" SET "seccionId"=$1,"nombre"=$2,"codigo"=$3,"cantidad"=$4,
        "stockMinimo"=$5,"estado"=$6,"ubicacion"=$7,"responsable"=$8,"observaciones"=$9,"updatedAt"=NOW()
      WHERE "id"=$10 AND "iglesiaId"=$11 AND "deletedAt" IS NULL RETURNING *
    `, [seccionId, nombre, cleanText(req.body?.codigo, 60), nonNegativeInt(req.body?.cantidad), nonNegativeInt(req.body?.stockMinimo), estado, cleanText(req.body?.ubicacion, 120), cleanText(req.body?.responsable, 120), cleanText(req.body?.observaciones, 1000), id, iglesiaId])
    if (!row) return res.status(404).json({ error: 'Artículo no encontrado' })
    return res.json(row)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un artículo con ese código' })
    throw err
  }
})

router.delete('/items/:id', ...canManage, async (req, res) => {
  await ensureSchema()
  const result = await pgExec(`UPDATE "InventarioItem" SET "deletedAt"=NOW(),"updatedAt"=NOW() WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL`, [Number(req.params.id), Number(req.user.iglesiaId)])
  if (!result.rowCount) return res.status(404).json({ error: 'Artículo no encontrado' })
  res.json({ ok: true })
})

export default router
