import { useState, useEffect, useCallback } from 'react'
import { apiFetch, getUser } from '../services/api.js'

const FALLBACK = {
  LIDER:['dashboard','personas','grupos','perfil','checkin'],
  CULTO:['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados'],
  CONSOLIDACION:['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados','seguimiento','consolidacion','alertas','mensajes'],
  ADMINISTRACION:['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados','seguimiento','consolidacion','alertas','mensajes','reportes','historial','users','permisos','configuracion','discipulado','excel-ia'],
  GENERAL:['dashboard','personas','grupos','perfil','checkin','asistencia','calendario','comunicados','seguimiento','consolidacion','alertas','mensajes','reportes','historial','users','permisos','configuracion','discipulado','excel-ia','asistente-ia','premium','backup'],
}
let _cache = null

export function usePlan() {
  const user = getUser()
  const planKey = user?.plan || 'GENERAL'
  const [plan, setPlan] = useState(_cache || { plan:planKey, modulos:FALLBACK[planKey]||FALLBACK.GENERAL, loading:true })

  useEffect(() => {
    if (_cache) { setPlan({..._cache, loading:false}); return }
    apiFetch('/plan/me').then(res => { _cache = {...res, loading:false}; setPlan(_cache) })
      .catch(() => { const fb = {plan:planKey, modulos:FALLBACK[planKey]||FALLBACK.GENERAL, loading:false}; _cache=fb; setPlan(fb) })
  }, [planKey])

  const tiene = useCallback((mod) => plan.modulos?.includes(mod) ?? false, [plan.modulos])
  return { ...plan, tiene }
}
export default usePlan
