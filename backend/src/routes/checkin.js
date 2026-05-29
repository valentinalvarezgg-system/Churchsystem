import { Router } from 'express'
import { createHash } from 'crypto'
import os from 'os'
import { pgExec, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()
const SECRET_QR = process.env.QR_SECRET || 'church-qr-2024'
const FRONTEND_PORT = process.env.FRONTEND_PORT || process.env.PORT || '4000'

function getLocalIP() {
  const nets = Object.values(os.networkInterfaces()).flat()
  return nets.find(n => n.family === 'IPv4' && !n.internal)?.address || 'localhost'
}

const token = (id) => createHash('sha256').update(`${id}:${SECRET_QR}`).digest('hex').slice(0, 16)

router.get('/token/:cultoId', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const culto = await pgOne(
    'SELECT * FROM "Culto" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL',
    [Number(req.params.cultoId), iglesiaId]
  )
  if (!culto) return res.status(404).json({ error: 'Culto no encontrado' })

  const t = token(culto.id)
  const ip = getLocalIP()
  const publicUrl = process.env.PUBLIC_URL
  const url = publicUrl
    ? `${publicUrl}/checkin/${culto.id}/${t}`
    : `http://${ip}:${FRONTEND_PORT}/checkin/${culto.id}/${t}`
  res.json({ token: t, url, culto, ip })
})

router.get('/info/:cultoId/:tok', async (req, res) => {
  if (req.params.tok !== token(req.params.cultoId)) return res.status(403).json({ error: 'QR inválido' })

  const culto = await pgOne(
    'SELECT "id","nombre","fecha","cultoDia","iglesiaId" FROM "Culto" WHERE "id"=$1 AND "deletedAt" IS NULL',
    [Number(req.params.cultoId)]
  )
  if (!culto) return res.status(404).json({ error: 'No encontrado' })

  const totalRow = await pgOne(
    'SELECT COUNT(*)::int AS c FROM "Asistencia" WHERE "cultoId"=$1 AND "presente"=true',
    [culto.id]
  )
  res.json({ culto, totalPresentes: Number(totalRow?.c ?? 0) })
})

router.post('/registrar/:cultoId/:tok', async (req, res) => {
  if (req.params.tok !== token(req.params.cultoId)) return res.status(403).json({ error: 'QR inválido' })

  const culto = await pgOne(
    'SELECT "id","iglesiaId" FROM "Culto" WHERE "id"=$1 AND "deletedAt" IS NULL',
    [Number(req.params.cultoId)]
  )
  if (!culto) return res.status(404).json({ error: 'Culto no encontrado' })

  const { nombre, telefono } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })

  const iglesiaId = culto.iglesiaId

  let persona = null
  if (telefono) {
    const digits = telefono.replace(/\D/g, '').slice(-8)
    persona = await pgOne(
      `SELECT * FROM "Persona" WHERE "iglesiaId"=$1 AND REGEXP_REPLACE("telefono",'\\D','','g') LIKE $2 AND "deletedAt" IS NULL LIMIT 1`,
      [iglesiaId, `%${digits}`]
    ).catch(() => null)
  }
  if (!persona) {
    persona = await pgOne(
      `SELECT * FROM "Persona" WHERE "iglesiaId"=$1 AND "nombre" ILIKE $2 AND "deletedAt" IS NULL LIMIT 1`,
      [iglesiaId, `%${nombre.trim().split(' ')[0]}%`]
    )
  }
  if (!persona) {
    const row = await pgOne(
      `INSERT INTO "Persona" ("iglesiaId","nombre","telefono","estado","createdAt","updatedAt")
       VALUES ($1,$2,$3,'VISITANTE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`,
      [iglesiaId, nombre.trim(), telefono || '']
    )
    persona = row
  }

  await pgExec(
    `INSERT INTO "Asistencia" ("iglesiaId","cultoId","personaId","presente","createdAt")
     VALUES ($1,$2,$3,true,CURRENT_TIMESTAMP)
     ON CONFLICT ("cultoId","personaId") DO UPDATE SET "presente"=true`,
    [iglesiaId, culto.id, persona.id]
  )

  const totalRow = await pgOne(
    'SELECT COUNT(*)::int AS c FROM "Asistencia" WHERE "cultoId"=$1 AND "presente"=true',
    [culto.id]
  )
  res.json({ ok: true, persona: { nombre: persona.nombre, estado: persona.estado }, totalPresentes: Number(totalRow?.c ?? 0) })
})

router.get('/descriptores', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const personas = await pgMany(
    `SELECT "id","nombre","apellido","fotoUrl","estado"
     FROM "Persona"
     WHERE "iglesiaId"=$1 AND "fotoUrl" IS NOT NULL AND "fotoUrl"!='' AND "deletedAt" IS NULL
     ORDER BY "apellido","nombre"`,
    [iglesiaId]
  )
  res.json(personas)
})

export default router
