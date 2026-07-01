import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth, requireAuthSSE } from '../middlewares/auth.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Clientes SSE activos: Map<grupoId, Set<res>>
const sseClients = new Map()

function broadcast(grupoId, data) {
  const clients = sseClients.get(String(grupoId))
  if (!clients) return
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const res of clients) {
    try { res.write(payload) } catch { clients.delete(res) }
  }
}

const initChat = async () => {
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "GrupoMensaje" (
      "id"        SERIAL PRIMARY KEY,
      "iglesiaId" INT NOT NULL,
      "grupoId"   INT NOT NULL,
      "userId"    INT NOT NULL,
      "texto"     TEXT NOT NULL,
      "tipo"      TEXT NOT NULL DEFAULT 'TEXTO',
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pgExec(`CREATE INDEX IF NOT EXISTS "GM_grupo_idx" ON "GrupoMensaje"("grupoId","createdAt")`)
}

// GET /chat/:grupoId/mensajes — historial paginado
router.get('/:grupoId/mensajes', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const grupoId   = Number(req.params.grupoId)
  await initChat()

  // Verificar que el user tiene acceso al grupo
  const g = await pgOne('SELECT "id" FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [grupoId, iglesiaId])
  if (!g) return res.status(403).json({ error: 'Sin acceso' })

  const { before, limit = 40 } = req.query
  const params = [grupoId, iglesiaId, Number(limit)]
  let extra = ''
  if (before) { extra = ` AND m."id" < $${params.push(Number(before))}`; }

  const rows = await pgMany(
    `SELECT m.*, u."nombre" AS "autorNombre", u."rol" AS "autorRol"
     FROM "GrupoMensaje" m
     LEFT JOIN "User" u ON m."userId"=u."id"
     WHERE m."grupoId"=$1 AND m."iglesiaId"=$2${extra}
     ORDER BY m."createdAt" DESC LIMIT $3`,
    params
  )
  res.json(rows.reverse())
}))

// POST /chat/:grupoId/mensajes — enviar mensaje
router.post('/:grupoId/mensajes', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const grupoId   = Number(req.params.grupoId)
  await initChat()

  const g = await pgOne('SELECT "id" FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [grupoId, iglesiaId])
  if (!g) return res.status(403).json({ error: 'Sin acceso' })

  const { texto, tipo = 'TEXTO' } = req.body || {}
  if (!texto?.trim()) return res.status(400).json({ error: 'texto requerido' })

  const row = await pgOne(
    `INSERT INTO "GrupoMensaje"("iglesiaId","grupoId","userId","texto","tipo")
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [iglesiaId, grupoId, req.user.id, texto.trim(), tipo]
  )
  const msg = { ...row, autorNombre: req.user.nombre || req.user.email, autorRol: req.user.rol }

  // Broadcast SSE a todos los conectados en este grupo
  broadcast(grupoId, { tipo: 'MENSAJE', mensaje: msg })

  res.status(201).json(msg)
}))

// GET /chat/:grupoId/stream — SSE real-time
router.get('/:grupoId/stream', requireAuthSSE, (req, res) => {
  const grupoId = String(req.params.grupoId)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Registrar cliente
  if (!sseClients.has(grupoId)) sseClients.set(grupoId, new Set())
  sseClients.get(grupoId).add(res)

  // Ping cada 25s para mantener conexión
  const ping = setInterval(() => { try { res.write(': ping\n\n') } catch {} }, 25000)

  req.on('close', () => {
    clearInterval(ping)
    sseClients.get(grupoId)?.delete(res)
  })
})

export default router
