import jwt from 'jsonwebtoken'
import { pgOne } from '../lib/pg.js'

function requiredSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no configurado')
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
      'SELECT "id","activo","rol","iglesiaId" FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1',
      [payload.id]
    )
    if (!u) return res.status(401).json({ error: 'Usuario no encontrado' })
    if (!u.activo) return res.status(401).json({ error: 'Cuenta desactivada' })
    if (!u.iglesiaId) return res.status(403).json({ error: 'Usuario sin tenant asignado' })

    req.user = { ...payload, rol: u.rol || payload.rol, iglesiaId: u.iglesiaId ?? null }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada. Ingresá nuevamente.' })
    }
    return res.status(401).json({ error: 'Token inválido' })
  }
}

export function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.user?.rol || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Permisos insuficientes' })
    }
    next()
  }
}

export function requirePermiso(modulo, nivelMinimo = 1) {
  return async (req, res, next) => {
    if (req.user?.rol === 'PASTOR_GENERAL') return next()
    try {
      const pgPermiso = await pgOne(
        'SELECT * FROM "Permiso" WHERE "userId"=$1 AND "iglesiaId"=$2 LIMIT 1',
        [req.user.id, req.user.iglesiaId]
      )
      if (pgPermiso) {
        if (Number(pgPermiso[modulo] ?? 0) < nivelMinimo) {
          return res.status(403).json({ error: `Sin acceso a ${modulo}` })
        }
        return next()
      }
    } catch {
      return next()
    }
    return next()
  }
}
