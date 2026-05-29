import jwt from 'jsonwebtoken'
import logger from '../lib/logger.js'

// ────────────────────────────────────────────────────────────
// JWT SECRET VALIDATION (Fail-safe)
// ────────────────────────────────────────────────────────────
function getJWTSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('❌ CRITICAL: JWT_SECRET environment variable is not set')
  }
  if (secret === 'change-me' || secret === 'dev') {
    throw new Error('❌ CRITICAL: JWT_SECRET has an unsafe default value. Set a secure value in .env')
  }
  return secret
}

// ────────────────────────────────────────────────────────────
// MIDDLEWARE: Require Authentication
// ────────────────────────────────────────────────────────────
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      logger.warn({ path: req.path }, '🔐 No token provided')
      return res.status(401).json({ error: 'Token requerido' })
    }

    let payload
    try {
      payload = jwt.verify(token, getJWTSecret())
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.warn({ email: payload?.email }, '⏱️ Token expired')
        return res.status(401).json({ error: 'Token expirado' })
      }
      logger.warn({ error: err.message }, '❌ Token invalid')
      return res.status(401).json({ error: 'Token inválido' })
    }

    // Validate user is still active
    const user = req.user || { id: payload.id, activo: true, expira: null }
    if (!user.activo) {
      logger.warn({ userId: user.id }, '🚫 User inactive')
      return res.status(403).json({ error: 'Usuario desactivado' })
    }

    // Validate subscription
    if (user.expira && new Date(user.expira) < new Date()) {
      logger.warn({ userId: user.id }, '📅 Subscription expired')
      return res.status(403).json({ error: 'Suscripción expirada' })
    }

    req.user = user
    req.token = token
    next()
  } catch (err) {
    logger.error({ error: err.message }, '🔐 Auth middleware error')
    return res.status(500).json({ error: 'Error de autenticación' })
  }
}

// ────────────────────────────────────────────────────────────
// MIDDLEWARE: Validate Tenant Access
// ────────────────────────────────────────────────────────────
export function requireTenant(req, res, next) {
  try {
    const iglesia_id = Number(req.params.iglesia_id || req.body.iglesia_id || req.query.iglesia_id || req.iglesia_id)

    if (!iglesia_id || iglesia_id !== req.iglesia_id) {
      logger.warn(
        {
          userId: req.user?.id,
          requested: iglesia_id,
          actual: req.iglesia_id,
        },
        '🚫 Tenant mismatch detected'
      )
      return res.status(403).json({ error: 'Sin acceso a esta iglesia' })
    }

    next()
  } catch (err) {
    logger.error({ error: err.message }, '🚫 Tenant validation error')
    res.status(403).json({ error: 'Error validando iglesia' })
  }
}

// ────────────────────────────────────────────────────────────
// MIDDLEWARE: Require Specific Role
// ────────────────────────────────────────────────────────────
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.rol)) {
      logger.warn(
        {
          userId: req.user?.id,
          userRole: req.user?.rol,
          required: allowedRoles,
          path: req.path,
        },
        '🔒 Role check failed'
      )
      return res.status(403).json({ error: 'Permisos insuficientes' })
    }
    next()
  }
}
