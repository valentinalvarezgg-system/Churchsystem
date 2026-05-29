import logger from '../lib/logger.js'
import db from '../lib/db.js'

/**
 * TENANT MIDDLEWARE
 * Injects iglesia_id into request context for multi-tenant isolation
 * This middleware MUST be applied to all private routes
 */
export async function tenantMiddleware(req, res, next) {
  try {
    // Extract iglesia_id from JWT payload or request
    const iglesia_id =
      req.user?.iglesiaId ||
      req.params.iglesia_id ||
      req.body?.iglesia_id ||
      req.query?.iglesia_id

    if (!iglesia_id) {
      logger.warn({ userId: req.user?.id, path: req.path }, '❌ No iglesia_id in context')
      return res.status(400).json({ error: 'Iglesia ID requerido' })
    }

    // Validate iglesia exists
    const iglesia = db.get('SELECT id, nombre FROM iglesias WHERE id = ?', [iglesia_id])
    if (!iglesia) {
      logger.warn({ iglesia_id }, '❌ Iglesia not found')
      return res.status(404).json({ error: 'Iglesia no encontrada' })
    }

    // Inject into request
    req.iglesia_id = iglesia_id
    req.iglesia = iglesia

    logger.debug({ userId: req.user?.id, iglesia_id }, '✅ Tenant context loaded')
    next()
  } catch (err) {
    logger.error({ error: err.message }, '❌ Tenant middleware error')
    return res.status(500).json({ error: 'Error de contexto' })
  }
}

/**
 * HELPER: Build WHERE clause for tenant isolation
 * Usage: db.get('SELECT * FROM personas ' + tenantFilter('p'), [iglesia_id])
 */
export function tenantFilter(tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : ''
  return `WHERE ${prefix}iglesia_id = ?`
}
