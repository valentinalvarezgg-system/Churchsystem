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
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.query.token || null)

  if (!token) return res.status(401).json({ error: 'Token requerido' })

  try {
    const payload = jwt.verify(token, requiredSecret())
    const u = await pgOne(
      'SELECT "id","email","nombre","activo","rol","iglesiaId","plan","expira","pais","divisa","idioma" FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1',
      [payload.id]
    )
    if (!u) return res.status(401).json({ error: 'Usuario no encontrado' })
    if (!u.activo) return res.status(403).json({ error: 'Cuenta desactivada' })
    if (!u.iglesiaId) return res.status(403).json({ error: 'Usuario sin tenant asignado' })
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
      plan: u.plan || payload.plan || 'GENERAL',
      pais: u.pais || payload.pais || 'AR',
      divisa: u.divisa || payload.divisa || 'ARS',
      idioma: u.idioma || payload.idioma || 'es',
    }
    req.iglesia_id = Number(u.iglesiaId)
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

export function requireTenant(req, res, next) {
  const requested = Number(req.params.iglesia_id || req.body?.iglesia_id || req.query?.iglesia_id || req.iglesia_id)
  if (!requested || requested !== Number(req.user?.iglesiaId)) {
    return res.status(403).json({ error: 'Sin acceso a esta iglesia' })
  }
  next()
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

export const requireRole = requireRol

export function requirePermiso(modulo, nivelMinimo = 1) {
  return async (req, res, next) => {
    if (req.user?.rol === 'PASTOR_GENERAL') return next()
    try {
      const permiso = await pgOne(
        'SELECT * FROM "Permiso" WHERE "userId"=$1 AND "iglesiaId"=$2 LIMIT 1',
        [req.user.id, req.user.iglesiaId]
      )
      if (!permiso) return next()
      if (Number(permiso[modulo] ?? 0) < nivelMinimo) {
        return res.status(403).json({ error: `Sin acceso a ${modulo}` })
      }
    } catch (err) {
      logger.warn({ err: err.message, modulo }, 'Permission check skipped')
    }
    return next()
  }
}
