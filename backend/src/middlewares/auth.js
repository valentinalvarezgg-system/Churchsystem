import jwt from 'jsonwebtoken'
import logger from '../lib/logger.js'
import { pgOne } from '../lib/pg.js'

function requiredSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no configurado')
  if (['change-me', 'changeme', 'dev', 'secret', 'admin123'].includes(secret)) {
    throw new Error('JWT_SECRET inseguro')
  }
  return secret
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Token requerido' })

  try {
    const payload = jwt.verify(token, requiredSecret())
    const u = await pgOne(
      'SELECT "id","email","nombre","activo","rol","iglesiaId","plan","expira","pais","divisa","idioma" FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1',
      [payload.id]
    )
    if (!u) return res.status(401).json({ error: 'Usuario no encontrado' })
    if (!u.activo) return res.status(403).json({ error: 'Cuenta desactivada' })
    if (!u.iglesiaId && u.rol !== 'GODMODE') return res.status(403).json({ error: 'Usuario sin tenant asignado' })
    if (u.expira && new Date(u.expira) < new Date()) {
      return res.status(403).json({ error: 'Suscripción expirada' })
    }

    req.user = {
      ...payload,
      id: u.id,
      email: u.email || payload.email,
      nombre: u.nombre || payload.nombre,
      rol: u.rol || payload.rol,
      iglesiaId: u.iglesiaId,
      plan: u.plan || payload.plan || 'STARTER',
      pais: u.pais || payload.pais || 'AR',
      divisa: u.divisa || payload.divisa || 'ARS',
      idioma: u.idioma || payload.idioma || 'es',
    }
    req.iglesia_id = Number(u.iglesiaId || 0)
    req.token = token
    return next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn({ path: req.path }, 'Token expired')
      return res.status(401).json({ error: 'Sesión expirada. Ingresá nuevamente.' })
    }
    logger.warn({ path: req.path, err: err.message }, 'Token invalid')
    return res.status(401).json({ error: 'Token inválido' })
  }
}

// ── Middleware para SSE (acepta token en query param) ─────────
export async function requireAuthSSE(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null)

  if (!token) return res.status(401).json({ error: 'Token requerido' })

  try {
    const payload = jwt.verify(token, requiredSecret())
    const u = await pgOne(
      'SELECT "id","email","nombre","activo","rol","iglesiaId","plan","expira","pais","divisa","idioma" FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1',
      [payload.id]
    )
    if (!u) return res.status(401).json({ error: 'Usuario no encontrado' })
    if (!u.activo) return res.status(403).json({ error: 'Cuenta desactivada' })
    if (!u.iglesiaId && u.rol !== 'GODMODE') return res.status(403).json({ error: 'Usuario sin tenant asignado' })
    if (u.expira && new Date(u.expira) < new Date()) {
      return res.status(403).json({ error: 'Suscripción expirada' })
    }
    req.user = {
      ...payload,
      id: u.id,
      email: u.email || payload.email,
      nombre: u.nombre || payload.nombre,
      rol: u.rol || payload.rol,
      iglesiaId: u.iglesiaId,
      plan: u.plan || payload.plan || 'STARTER',
      pais: u.pais || payload.pais || 'AR',
      divisa: u.divisa || payload.divisa || 'ARS',
      idioma: u.idioma || payload.idioma || 'es',
    }
    req.iglesia_id = Number(u.iglesiaId || 0)
    req.token = token
    return next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn({ path: req.path }, 'Token expired')
      return res.status(401).json({ error: 'Sesión expirada. Ingresá nuevamente.' })
    }
    logger.warn({ path: req.path, err: err.message }, 'Token invalid')
    return res.status(401).json({ error: 'Token inválido' })
  }
}

// ── Middleware exclusivo para el portal del miembro ──────────
export async function requireMiembro(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.query.token || null)

  if (!token) return res.status(401).json({ error: 'Token requerido' })

  try {
    const payload = jwt.verify(token, requiredSecret())

    // El portal del miembro usa scope 'MIEMBRO'
    if (payload.scope !== 'MIEMBRO') {
      return res.status(403).json({ error: 'Token no válido para el portal del miembro' })
    }

    // Verificar que la persona sigue activa
    const p = await pgOne(
      `SELECT p."id", p."nombre", p."apellido", p."email", p."estado", p."iglesiaId", p."grupoId"
       FROM "Persona" p
       WHERE p."id"=$1 AND p."iglesiaId"=$2 AND p."deletedAt" IS NULL LIMIT 1`,
      [payload.personaId, payload.iglesiaId]
    )
    if (!p) return res.status(401).json({ error: 'Miembro no encontrado' })
    if (p.estado === 'INACTIVO') return res.status(403).json({ error: 'Cuenta inactiva' })

    req.miembro = { ...payload, ...p }
    return next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sesión expirada' })
    return res.status(401).json({ error: 'Token inválido' })
  }
}

export function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.user?.rol || !roles.includes(req.user.rol)) {
      logger.warn({ userId: req.user?.id, role: req.user?.rol, required: roles, path: req.path }, 'Role check failed')
      return res.status(403).json({ error: 'Permisos insuficientes' })
    }
    next()
  }
}
