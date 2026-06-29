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

// ── RSVP — Confirmación de asistencia ────────────────────────

// GET /eventos/:id/rsvp — obtener resumen de confirmaciones (requiere auth)
router.get('/:id/rsvp', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  const eventoId  = Number(req.params.id)

  await pgExec(`
    CREATE TABLE IF NOT EXISTS "EventoRSVP" (
      "id"         SERIAL PRIMARY KEY,
      "iglesiaId"  INT NOT NULL,
      "eventoId"   INT NOT NULL,
      "personaId"  INT,
      "nombre"     TEXT NOT NULL DEFAULT '',
      "respuesta"  TEXT NOT NULL DEFAULT 'SI',   -- SI | NO | TALVEZ
      "token"      TEXT UNIQUE,
      "createdAt"  TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
  await pgExec(`CREATE INDEX IF NOT EXISTS "EventoRSVP_evento_idx" ON "EventoRSVP"("eventoId")`).catch(() => {})

  const [resumen, detalle] = await Promise.all([
    pgMany(
      `SELECT r."respuesta", COUNT(*)::int AS total
       FROM "EventoRSVP" r WHERE r."eventoId"=$1 AND r."iglesiaId"=$2
       GROUP BY r."respuesta"`,
      [eventoId, iglesiaId]
    ),
    pgMany(
      `SELECT r."id",r."nombre",r."respuesta",r."createdAt",p."apellido"
       FROM "EventoRSVP" r
       LEFT JOIN "Persona" p ON r."personaId"=p."id" AND p."iglesiaId"=r."iglesiaId"
       WHERE r."eventoId"=$1 AND r."iglesiaId"=$2
       ORDER BY r."createdAt" DESC`,
      [eventoId, iglesiaId]
    ),
  ])
  const si     = resumen.find(r => r.respuesta === 'SI')?.total || 0
  const no     = resumen.find(r => r.respuesta === 'NO')?.total || 0
  const talvez = resumen.find(r => r.respuesta === 'TALVEZ')?.total || 0
  res.json({ si, no, talvez, total: si + no + talvez, detalle })
})

// POST /eventos/:id/rsvp — crear/actualizar confirmación por token único
// Requiere auth o token anónimo (para links de WhatsApp/email)
router.post('/:id/rsvp', async (req, res) => {
  const eventoId = Number(req.params.id)
  const { respuesta, nombre, personaId, token, iglesiaId: bodyIglesiaId } = req.body || {}

  if (!['SI','NO','TALVEZ'].includes(respuesta)) {
    return res.status(400).json({ error: 'respuesta debe ser SI, NO o TALVEZ' })
  }

  // Resolución del iglesiaId: viene del body (link público) o del user autenticado
  const iglesiaId = Number(req.user?.iglesiaId || bodyIglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'iglesiaId requerido' })

  await pgExec(`
    CREATE TABLE IF NOT EXISTS "EventoRSVP" (
      "id"         SERIAL PRIMARY KEY,
      "iglesiaId"  INT NOT NULL,
      "eventoId"   INT NOT NULL,
      "personaId"  INT,
      "nombre"     TEXT NOT NULL DEFAULT '',
      "respuesta"  TEXT NOT NULL DEFAULT 'SI',
      "token"      TEXT UNIQUE,
      "createdAt"  TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})

  // Si viene token, upsert por token; si viene personaId, upsert por persona+evento
  if (token) {
    await pgExec(
      `INSERT INTO "EventoRSVP"("iglesiaId","eventoId","personaId","nombre","respuesta","token")
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT("token") DO UPDATE SET "respuesta"=EXCLUDED."respuesta","updatedAt"=NOW()`,
      [iglesiaId, eventoId, personaId||null, nombre||'Anónimo', respuesta, token]
    )
  } else if (personaId) {
    await pgExec(
      `INSERT INTO "EventoRSVP"("iglesiaId","eventoId","personaId","nombre","respuesta")
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [iglesiaId, eventoId, Number(personaId), nombre||'', respuesta]
    )
    await pgExec(
      `UPDATE "EventoRSVP" SET "respuesta"=$1,"updatedAt"=NOW()
       WHERE "eventoId"=$2 AND "personaId"=$3 AND "iglesiaId"=$4`,
      [respuesta, eventoId, Number(personaId), iglesiaId]
    )
  } else {
    return res.status(400).json({ error: 'Se requiere token o personaId' })
  }

  const ev = await pgOne('SELECT "titulo","fecha" FROM "Evento" WHERE "id"=$1', [eventoId])
  res.json({ ok: true, evento: ev?.titulo, fecha: ev?.fecha, respuesta })
})

// GET /eventos/rsvp/confirmar — endpoint público para links de WhatsApp
// ?token=xxx&r=SI&ig=123
router.get('/rsvp/confirmar', async (req, res) => {
  const { token, r, ig } = req.query
  if (!token || !r || !ig) return res.status(400).send('<p>Link inválido</p>')
  if (!['SI','NO','TALVEZ'].includes(r)) return res.status(400).send('<p>Respuesta inválida</p>')

  try {
    await pgExec(
      `UPDATE "EventoRSVP" SET "respuesta"=$1,"updatedAt"=NOW() WHERE "token"=$2`,
      [r, token]
    )
    const label = r === 'SI' ? '✅ ¡Confirmado! Te esperamos.' : r === 'NO' ? '❌ Entendido, gracias por avisarnos.' : '🤔 Anotado como "Tal vez", ¡esperamos verte!'
    res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmación</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F8FAFC}.card{background:#fff;border-radius:16px;padding:32px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}h2{font-size:22px;margin-bottom:8px}p{color:#64748B;font-size:14px}</style></head><body><div class="card"><h2>${label}</h2><p>Podés cerrar esta ventana.</p></div></body></html>`)
  } catch {
    res.status(500).send('<p>Error al procesar la confirmación</p>')
  }
})

export default router
