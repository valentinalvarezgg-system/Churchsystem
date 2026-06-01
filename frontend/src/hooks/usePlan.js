import { useState, useEffect, useCallback } from 'react'
import { apiFetch, getUser } from '../services/api.js'
import { normalizeCommercialPlan, resolveAccessTier } from '../lib/commercialPlans.js'

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
  const rawPlan = user?.plan || 'STARTER'
  const commercialPlan = normalizeCommercialPlan(rawPlan) || 'STARTER'
  const planKey = resolveAccessTier(rawPlan)
  const [plan, setPlan] = useState(
    _cache || {
      plan: planKey,
      commercialPlan,
      modulos: FALLBACK[planKey] || FALLBACK.STARTER,
      loading: true,
    }
  )

  useEffect(() => {
    if (_cache) { setPlan({..._cache, loading:false}); return }
    apiFetch('/plan/me').then(res => {
      const resolvedCommercialPlan = normalizeCommercialPlan(res.commercialMeta?.key || res.commercialPlan || rawPlan) || commercialPlan
      const normalizedPlan = resolveAccessTier(res.plan || resolvedCommercialPlan)
      const mods = res.modulos?.length ? res.modulos : (FALLBACK[normalizedPlan] || FALLBACK.STARTER)
      _cache = {
        ...res,
        plan: normalizedPlan,
        commercialPlan: resolvedCommercialPlan,
        modulos: mods,
        loading: false,
      }
      setPlan(_cache)
    }).catch(() => {
      const fb = {
        plan: planKey,
        commercialPlan,
        modulos: FALLBACK[planKey] || FALLBACK.STARTER,
        loading: false,
      }
      _cache = fb
      setPlan(fb)
    })
  }, [commercialPlan, planKey, rawPlan])

  const tiene = useCallback((mod) => plan.modulos?.includes(mod) ?? false, [plan.modulos])
  return { ...plan, tiene }
}
export default usePlan
