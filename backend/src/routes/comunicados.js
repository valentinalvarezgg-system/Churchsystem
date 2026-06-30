import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()
let schemaReady = null

// Variables dinámicas disponibles para plantillas
export const VARIABLES_DISPONIBLES = ['{nombre}','{fecha}','{evento}','{lugar}','{hora}','{iglesia}']

// Interpola variables en el contenido usando un mapa de valores
export function interpolarVariables(texto, vars = {}) {
  if (!texto) return texto
  return texto
    .replace(/\{nombre\}/g, vars.nombre || '{nombre}')
    .replace(/\{fecha\}/g, vars.fecha || '{fecha}')
    .replace(/\{evento\}/g, vars.evento || '{evento}')
    .replace(/\{lugar\}/g, vars.lugar || '{lugar}')
    .replace(/\{hora\}/g, vars.hora || '{hora}')
    .replace(/\{iglesia\}/g, vars.iglesia || '{iglesia}')
}

function ensureComunicadosSchema() {
  if (!schemaReady) {
    schemaReady = pgExec(`
      ALTER TABLE "Comunicado"
      ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ
    `).catch(err => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

router.get('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureComunicadosSchema()

  const { page = 1, limit = 15 } = req.query
  const where = [`c."iglesiaId"=$1`, `c."archivado"=false`]
  const params = [iglesiaId]
  let idx = 2

  // Solo mostrar programados que ya son visibles (scheduledAt <= ahora) o los no programados
  where.push(`(c."scheduledAt" IS NULL OR c."scheduledAt" <= NOW())`)

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

// GET /comunicados/programados — lista de comunicados pendientes de publicar (solo admins)
router.get('/programados', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureComunicadosSchema()
  if (!['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permisos' })
  }
  const rows = await pgMany(
    `SELECT c.*,u."nombre" as "autorNombre"
     FROM "Comunicado" c
     LEFT JOIN "User" u ON c."userId"=u."id"
     WHERE c."iglesiaId"=$1 AND c."archivado"=false AND c."scheduledAt" > NOW()
     ORDER BY c."scheduledAt" ASC`,
    [iglesiaId]
  )
  res.json(rows)
})

router.post('/', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureComunicadosSchema()

  const {
    titulo, contenido, tipo = 'GENERAL', destinatarios = 'TODOS',
    fijado = false, scheduledAt = null
  } = req.body || {}
  if (!titulo?.trim() || !contenido?.trim()) return res.status(400).json({ error: 'Título y contenido requeridos' })

  const scheduled = scheduledAt ? new Date(scheduledAt) : null
  // Si es programado en el futuro, no publicar todavía (scheduledAt lo controla)
  const row = await pgOne(
    `INSERT INTO "Comunicado" ("iglesiaId","userId","titulo","contenido","tipo","destinatarios","fijado","scheduledAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "id"`,
    [iglesiaId, req.user.id, titulo.trim(), contenido.trim(), tipo, destinatarios, !!fijado, scheduled]
  )
  res.status(201).json({ ok: true, id: row.id, programado: !!scheduled })
})

router.put('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureComunicadosSchema()

  const c = await pgOne('SELECT * FROM "Comunicado" WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), iglesiaId])
  if (!c) return res.status(404).json({ error: 'No encontrado' })
  if (Number(c.userId) !== Number(req.user.id) && req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Sin permisos' })

  const m = { ...c, ...req.body }
  const scheduled = m.scheduledAt ? new Date(m.scheduledAt) : null
  await pgExec(
    `UPDATE "Comunicado"
     SET "titulo"=$1,"contenido"=$2,"tipo"=$3,"destinatarios"=$4,"fijado"=$5,"archivado"=$6,"scheduledAt"=$7,"updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$8 AND "iglesiaId"=$9`,
    [m.titulo, m.contenido, m.tipo, m.destinatarios, !!m.fijado, !!m.archivado, scheduled, Number(req.params.id), iglesiaId]
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
