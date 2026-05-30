export const PLANES = {
  STARTER: {
    nombre: 'Starter', precio: 29,
    modulos: ['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados'],
  },
  PRO: {
    nombre: 'Pro', precio: 59,
    modulos: ['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados',
              'seguimiento','consolidacion','alertas','mensajes','reportes','historial',
              'users','permisos','configuracion','discipulado','excel-ia'],
  },
  MAX: {
    nombre: 'Max', precio: 99,
    modulos: ['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados',
              'seguimiento','consolidacion','alertas','mensajes','reportes','historial',
              'users','permisos','configuracion','discipulado','excel-ia',
              'asistente-ia','premium','backup'],
  },
}

// Legacy plan names still accepted (JWT tokens in the wild may have old values)
const LEGACY = {
  LIDER:'STARTER', CULTO:'STARTER',
  CONSOLIDACION:'PRO', ADMINISTRACION:'PRO',
  GENERAL:'MAX',
}

export function requirePlan(modulo) {
  return (req, res, next) => {
    const raw = req.user?.plan || 'STARTER'
    const plan = LEGACY[raw] || raw
    const planDef = PLANES[plan]
    if (!planDef || !planDef.modulos.includes(modulo)) {
      return res.status(403).json({ error: 'Módulo no disponible en tu plan', plan, modulo })
    }
    next()
  }
}
