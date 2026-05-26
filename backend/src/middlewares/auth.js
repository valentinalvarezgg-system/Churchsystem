import jwt from 'jsonwebtoken'
import db  from '../lib/db.js'

export function requireAuth(req, res, next) {
  // Aceptar token desde header O query param (para descargas directas)
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.query.token || null)

  if (!token) return res.status(401).json({ error: 'Token requerido' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev')
    req.user = payload
    const u = db.get('SELECT activo, rol FROM users WHERE id=?', [payload.id])
    if (!u)        return res.status(401).json({ error: 'Usuario no encontrado' })
    if (!u.activo) return res.status(401).json({ error: 'Cuenta desactivada' })
    req.user.rol = u.rol
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Sesión expirada. Ingresá nuevamente.' })
    res.status(401).json({ error: 'Token inválido' })
  }
}

export function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.user?.rol || !roles.includes(req.user.rol))
      return res.status(403).json({ error: 'Permisos insuficientes' })
    next()
  }
}

export function requirePermiso(modulo, nivelMinimo = 1) {
  return (req, res, next) => {
    if (req.user?.rol === 'PASTOR_GENERAL') return next()
    try {
      const p = db.get('SELECT * FROM permisos WHERE userId=?', [req.user.id])
      if (!p) return res.status(403).json({ error: `Sin permiso para ${modulo}` })
      if (Number(p[modulo] ?? 0) < nivelMinimo)
        return res.status(403).json({ error: `Sin acceso a ${modulo}` })
      next()
    } catch { next() }
  }
}
