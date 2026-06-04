import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireMiembro } from '../middlewares/auth.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const SECRET = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET no configurado')
  return s
}

function signMiembroToken(persona, iglesiaId) {
  return jwt.sign(
    { scope: 'MIEMBRO', personaId: persona.id, iglesiaId, nombre: persona.nombre, apellido: persona.apellido },
    SECRET(),
    { expiresIn: '30d' }
  )
}

// Asegurar columnas de acceso en Persona
const initAcceso = async () => {
  await pgExec(`ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "portalEmail" TEXT`).catch(() => {})
  await pgExec(`ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "portalPassword" TEXT`).catch(() => {})
  await pgExec(`ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "portalActivo" BOOLEAN NOT NULL DEFAULT false`).catch(() => {})
  await pgExec(`CREATE UNIQUE INDEX IF NOT EXISTS "Persona_portalEmail_idx" ON "Persona"("iglesiaId","portalEmail") WHERE "portalEmail" IS NOT NULL`).catch(() => {})
}

// ── POST /miembro/auth/login ─────────────────────────────────
router.post('/auth/login', wrap(async (req, res) => {
  await initAcceso()
  const { email = '', password = '', iglesiaToken = '' } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  // Resolver iglesia por token o dominio
  let iglesiaId = null
  if (iglesiaToken) {
    const ig = await pgOne('SELECT "id" FROM "Iglesia" WHERE "token"=$1 AND "deletedAt" IS NULL LIMIT 1', [String(iglesiaToken).toUpperCase()])
    iglesiaId = ig?.id || null
  }

  const whereIglesia = iglesiaId ? `AND p."iglesiaId"=$2` : ''
  const params = iglesiaId ? [email.toLowerCase(), iglesiaId] : [email.toLowerCase()]

  const persona = await pgOne(
    `SELECT * FROM "Persona"
     WHERE lower(COALESCE(p."portalEmail", p."email"))=$1 ${whereIglesia}
       AND p."portalActivo"=true AND p."deletedAt" IS NULL LIMIT 1`.replace(/p\./g, ''),
    params
  )

  if (!persona) return res.status(401).json({ error: 'Email o contraseña incorrectos' })
  if (!persona.portalPassword) return res.status(401).json({ error: 'Tu cuenta no tiene contraseña configurada. Pedile al encargado que te active el acceso.' })

  const ok = await bcrypt.compare(String(password), persona.portalPassword)
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' })

  const token = signMiembroToken(persona, persona.iglesiaId)
  res.json({
    token,
    persona: {
      id: persona.id, nombre: persona.nombre, apellido: persona.apellido,
      email: persona.portalEmail || persona.email, iglesiaId: persona.iglesiaId
    }
  })
}))

// ── POST /miembro/auth/set-password ─────────────────────────
// El admin activa el acceso de un miembro y le asigna contraseña inicial
router.post('/auth/set-password', wrap(async (req, res) => {
  await initAcceso()
  // Requiere auth de admin (usando header Bearer del staff)
  const header = req.headers.authorization || ''
  const adminToken = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!adminToken) return res.status(401).json({ error: 'Se requiere autenticación de admin' })

  let adminPayload
  try { adminPayload = jwt.verify(adminToken, SECRET()) } catch { return res.status(401).json({ error: 'Token admin inválido' }) }
  if (!['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(adminPayload.rol)) {
    return res.status(403).json({ error: 'Sin permisos para activar miembros' })
  }

  const { personaId, email, password, activar = true } = req.body || {}
  if (!personaId || !password) return res.status(400).json({ error: 'personaId y password requeridos' })
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  const hash = await bcrypt.hash(String(password), 10)
  await pgExec(
    `UPDATE "Persona"
     SET "portalEmail"=COALESCE($1,"portalEmail"), "portalPassword"=$2, "portalActivo"=$3, "updatedAt"=NOW()
     WHERE "id"=$4 AND "iglesiaId"=$5`,
    [email || null, hash, !!activar, Number(personaId), adminPayload.iglesiaId]
  )
  res.json({ ok: true })
}))

// ── POST /miembro/auth/cambiar-password ─────────────────────
router.post('/auth/cambiar-password', requireMiembro, wrap(async (req, res) => {
  const { passwordActual, passwordNuevo } = req.body || {}
  if (!passwordActual || !passwordNuevo) return res.status(400).json({ error: 'Se requieren ambas contraseñas' })
  if (passwordNuevo.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  const persona = await pgOne('SELECT "portalPassword" FROM "Persona" WHERE "id"=$1', [req.miembro.id])
  const ok = await bcrypt.compare(String(passwordActual), persona?.portalPassword || '')
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' })

  const hash = await bcrypt.hash(String(passwordNuevo), 10)
  await pgExec('UPDATE "Persona" SET "portalPassword"=$1,"updatedAt"=NOW() WHERE "id"=$2', [hash, req.miembro.id])
  res.json({ ok: true })
}))

// ── GET /miembro/perfil ──────────────────────────────────────
router.get('/perfil', requireMiembro, wrap(async (req, res) => {
  const { personaId, iglesiaId } = req.miembro
  const p = await pgOne(
    `SELECT p."id", p."nombre", p."apellido", p."email", p."portalEmail",
            p."telefono", p."fechaNacimiento", p."estado", p."estadoEspiritual",
            p."bautizadoAgua", p."bautizadoEspiritu", p."discipuladoCompletado",
            p."ocupacion", p."createdAt", p."grupoId", p."notas",
            g."nombre" AS "grupoNombre",
            i."nombre" AS "iglesiaNombre"
     FROM "Persona" p
     LEFT JOIN "Grupo" g ON p."grupoId"=g."id"
     LEFT JOIN "Iglesia" i ON p."iglesiaId"=i."id"
     WHERE p."id"=$1 AND p."iglesiaId"=$2 AND p."deletedAt" IS NULL`,
    [personaId, iglesiaId]
  )
  if (!p) return res.status(404).json({ error: 'Perfil no encontrado' })
  res.json(p)
}))

// ── PUT /miembro/perfil ──────────────────────────────────────
// Solo puede editar datos de contacto propios
router.put('/perfil', requireMiembro, wrap(async (req, res) => {
  const { personaId, iglesiaId } = req.miembro
  const { telefono, email, ocupacion } = req.body || {}
  await pgExec(
    `UPDATE "Persona"
     SET "telefono"=COALESCE($1,"telefono"),
         "portalEmail"=COALESCE($2,"portalEmail"),
         "ocupacion"=COALESCE($3,"ocupacion"),
         "updatedAt"=NOW()
     WHERE "id"=$4 AND "iglesiaId"=$5`,
    [telefono||null, email||null, ocupacion||null, personaId, iglesiaId]
  )
  res.json({ ok: true })
}))

// ── GET /miembro/asistencia ──────────────────────────────────
router.get('/asistencia', requireMiembro, wrap(async (req, res) => {
  const { personaId, iglesiaId } = req.miembro
  const rows = await pgMany(
    `SELECT a."id", a."fecha", a."tipo", a."presente", a."createdAt"
     FROM "Asistencia" a
     WHERE a."personaId"=$1 AND a."iglesiaId"=$2
     ORDER BY a."createdAt" DESC LIMIT 50`,
    [personaId, iglesiaId]
  )
  const total = rows.length
  const presentes = rows.filter(r => r.presente).length
  res.json({ historial: rows, total, presentes, porcentaje: total ? Math.round(presentes/total*100) : 0 })
}))

// ── GET /miembro/eventos ─────────────────────────────────────
router.get('/eventos', requireMiembro, wrap(async (req, res) => {
  const { iglesiaId } = req.miembro
  const rows = await pgMany(
    `SELECT "id","titulo","tipo","fecha","hora","lugar","descripcion"
     FROM "Evento"
     WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "fecha" >= CURRENT_DATE
     ORDER BY "fecha" ASC LIMIT 20`,
    [iglesiaId]
  )
  res.json(rows)
}))

// ── GET /miembro/comunicados ─────────────────────────────────
router.get('/comunicados', requireMiembro, wrap(async (req, res) => {
  const { iglesiaId } = req.miembro
  const rows = await pgMany(
    `SELECT c."id", c."titulo", c."contenido", c."tipo", c."createdAt", c."fijado"
     FROM "Comunicado" c
     WHERE c."iglesiaId"=$1 AND c."archivado"=false
       AND (c."destinatarios"='TODOS' OR c."destinatarios" IS NULL)
       AND (c."scheduledAt" IS NULL OR c."scheduledAt" <= NOW())
     ORDER BY c."fijado" DESC, c."createdAt" DESC LIMIT 20`,
    [iglesiaId]
  )
  res.json(rows)
}))

// ── GET /miembro/discipulado ─────────────────────────────────
router.get('/discipulado', requireMiembro, wrap(async (req, res) => {
  const { personaId, iglesiaId } = req.miembro
  const [disc, materiales] = await Promise.all([
    pgOne(
      `SELECT d."estadoEspiritual", d."bautizadoAgua", d."bautizadoEspiritu", d."discipuladoCompletado"
       FROM "Persona" d WHERE d."id"=$1 AND d."iglesiaId"=$2`,
      [personaId, iglesiaId]
    ),
    pgMany(
      `SELECT dm."material", dm."completado", dm."fecha"
       FROM "DiscipuladoMaterial" dm WHERE dm."personaId"=$1`,
      [personaId]
    ).catch(() => [])
  ])
  res.json({ ...disc, materiales })
}))

export default router
