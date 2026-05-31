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

// JWTs existentes con planes viejos siguen funcionando
const LEGACY = {
  LIDER:'STARTER', CULTO:'STARTER',
  CONSOLIDACION:'PRO', ADMINISTRACION:'PRO',
  GENERAL:'PRO',
}

export function resolvePlan(raw = 'STARTER') {
  return LEGACY[raw] || raw
}

export function requirePlan(modulo) {
  return (req, res, next) => {
    const plan = resolvePlan(req.user?.plan || 'STARTER')
    const planDef = PLANES[plan]
    if (!planDef || !planDef.modulos.includes(modulo)) {
      return res.status(403).json({ error: 'Módulo no disponible en tu plan', plan, modulo })
    }
    next()
  }
}

// Middleware que inyecta el plan resuelto en req.plan para facilitar filtros
export function injectPlan(req, _res, next) {
  req.plan = resolvePlan(req.user?.plan || 'STARTER')
  next()
}
