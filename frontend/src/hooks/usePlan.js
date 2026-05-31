import { useState, useEffect, useCallback } from 'react'
import { apiFetch, getUser } from '../services/api.js'

const LEGACY = { LIDER:'STARTER', CULTO:'STARTER', CONSOLIDACION:'PRO', ADMINISTRACION:'PRO', GENERAL:'MAX' }

const FALLBACK = {
  STARTER:[
    'dashboard','personas','grupos','perfil','checkin',
    'comunicados','seguimiento','discipulado','analytics',
  ],
  PRO:[
    'dashboard','personas','grupos','perfil','checkin',
    'comunicados','seguimiento','discipulado','analytics',
    'asistencia','calendario','mensajes','alertas',
    'reportes','historial','consolidacion','configuracion',
  ],
  MAX:[
    'dashboard','personas','grupos','perfil','checkin',
    'comunicados','seguimiento','discipulado','analytics',
    'asistencia','calendario','mensajes','alertas',
    'reportes','historial','consolidacion','configuracion',
    'users','permisos','excel-ia','asistente-ia','backup','premium',
  ],
}
let _cache = null

export function usePlan() {
  const user = getUser()
  const rawPlan = user?.plan || 'MAX'
  const planKey = LEGACY[rawPlan] || rawPlan
  const [plan, setPlan] = useState(_cache || { plan:planKey, modulos:FALLBACK[planKey]||FALLBACK.MAX, loading:true })

  useEffect(() => {
    if (_cache) { setPlan({..._cache, loading:false}); return }
    apiFetch('/plan/me').then(res => {
      const normalizedPlan = LEGACY[res.plan] || res.plan
      const mods = res.modulos?.length ? res.modulos : (FALLBACK[normalizedPlan] || FALLBACK.MAX)
      _cache = { ...res, plan: normalizedPlan, modulos: mods, loading:false }
      setPlan(_cache)
    }).catch(() => {
      const fb = { plan:planKey, modulos:FALLBACK[planKey]||FALLBACK.MAX, loading:false }
      _cache = fb
      setPlan(fb)
    })
  }, [planKey])

  const tiene = useCallback((mod) => plan.modulos?.includes(mod) ?? false, [plan.modulos])
  return { ...plan, tiene }
}
export default usePlan
