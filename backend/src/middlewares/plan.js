import { resolveAccessTier } from '../lib/billing.js'
import { pgMany } from '../lib/pg.js'

export const PLANES = {
  STARTER: {
    nombre: 'Starter', precio: 29,
    modulos: [
      'dashboard','personas','grupos','perfil','checkin',
      'comunicados','seguimiento','discipulado','analytics',
    ],
  },
  PRO: {
    nombre: 'Pro', precio: 59,
    modulos: [
      'dashboard','personas','grupos','perfil','checkin',
      'comunicados','seguimiento','discipulado','analytics',
      'asistencia','calendario','mensajes','alertas',
      'reportes','historial','consolidacion','configuracion',
    ],
  },
  MAX: {
    nombre: 'Max', precio: 99,
    modulos: [
      'dashboard','personas','grupos','perfil','checkin',
      'comunicados','seguimiento','discipulado','analytics',
      'asistencia','calendario','mensajes','alertas',
      'reportes','historial','consolidacion','configuracion',
      'users','permisos','excel-ia','asistente-ia','backup','premium',
    ],
  },
}

export function resolvePlan(raw = 'STARTER') {
  return resolveAccessTier(raw)
}

/**
 * Calcula el plan efectivo de una iglesia considerando:
 *   1. Trial activo  → PRO
 *   2. Suscripción authorized con gracia activa → mantiene el plan suscripto
 *   3. Suscripción authorized sin gracia → plan suscripto
 *   4. Sin nada activo → plan del usuario (JWT)
 */
async function effectivePlan(iglesiaId, userPlan) {
  if (!iglesiaId) return resolvePlan(userPlan || 'STARTER')
  try {
    const rows = await pgMany(
      `SELECT "clave","valor" FROM "Configuracion"
        WHERE "iglesiaId"=$1
          AND "clave" IN ('trial_fin','suscripcion_activa','plan','suscripcion_vence')`,
      [iglesiaId]
    )
    const cfg = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
    const hoy = new Date().toISOString().slice(0, 10)

    // Trial activo → acceso PRO completo
    if (cfg.trial_fin && hoy <= cfg.trial_fin) return 'PRO'

    // Suscripción paga vigente
    if (cfg.suscripcion_activa === '1' && cfg.suscripcion_vence && hoy <= cfg.suscripcion_vence) {
      return resolvePlan(cfg.plan || userPlan || 'STARTER')
    }

    // Gracia: buscar en tabla suscripciones
    try {
      const sus = await pgMany(
        `SELECT plan, gracia_hasta FROM suscripciones
          WHERE iglesia_id=$1 AND gracia_hasta > NOW()
          ORDER BY creado_at DESC LIMIT 1`,
        [iglesiaId]
      )
      if (sus.length > 0) return resolvePlan(sus[0].plan || userPlan || 'STARTER')
    } catch { /* tabla puede no existir aún */ }

    return resolvePlan(userPlan || 'STARTER')
  } catch {
    return resolvePlan(userPlan || 'STARTER')
  }
}

export function requirePlan(modulo) {
  return async (req, res, next) => {
    const plan    = await effectivePlan(req.user?.iglesiaId, req.user?.plan)
    const planDef = PLANES[plan]
    if (!planDef || !planDef.modulos.includes(modulo)) {
      return res.status(403).json({ error: 'Módulo no disponible en tu plan', plan, modulo })
    }
    req.effectivePlan = plan
    next()
  }
}

export function injectPlan(req, _res, next) {
  req.plan = resolvePlan(req.user?.plan || 'STARTER')
  next()
}
