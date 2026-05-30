export const PLANES = {
  LIDER: {
    nombre: 'Líder', precio: 15,
    modulos: ['dashboard','personas','grupos','perfil','checkin'],
  },
  CULTO: {
    nombre: 'Culto', precio: 30,
    modulos: ['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados'],
  },
  CONSOLIDACION: {
    nombre: 'Consolidación', precio: 50,
    modulos: ['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados','seguimiento','consolidacion','alertas','mensajes'],
  },
  ADMINISTRACION: {
    nombre: 'Administración', precio: 80,
    modulos: ['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados','seguimiento','consolidacion','alertas','mensajes','reportes','historial','users','permisos','configuracion','discipulado','excel-ia'],
  },
  GENERAL: {
    nombre: 'General', precio: 120,
    modulos: ['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados','seguimiento','consolidacion','alertas','mensajes','reportes','historial','users','permisos','configuracion','discipulado','excel-ia','asistente-ia','premium','backup'],
  },
}

export function requirePlan(modulo) {
  return (req, res, next) => {
    const plan = req.user?.plan || 'LIDER'
    const planDef = PLANES[plan]
    if (!planDef || !planDef.modulos.includes(modulo)) {
      return res.status(403).json({ error: 'Módulo no disponible en tu plan', plan, modulo })
    }
    next()
  }
}

