import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { PLANES, resolvePlan } from '../middlewares/plan.js'
import { pgOne } from '../lib/pg.js'
import { getCommercialPlan, getPlanCatalog, normalizePlan } from '../lib/billing.js'

const router = Router()

// GET /plan/me — plan activo del usuario + datos de suscripción si existen
router.get('/me', requireAuth, async (req, res) => {
  const rawPlan = req.user?.plan || 'STARTER'
  const commercialPlan = normalizePlan(rawPlan)
  const plan = resolvePlan(rawPlan)
  const p = PLANES[plan] || PLANES.STARTER
  const commercial = getCommercialPlan(rawPlan)

  // Buscar suscripción activa de la iglesia (puede no existir aún)
  let suscripcion = null
  try {
    suscripcion = await pgOne(
      `SELECT id, platform, plan_name, status, amount, currency, created_at, updated_at
         FROM payments
        WHERE iglesia_id = $1
          AND status IN ('active','authorized','approved','ACTIVE')
        ORDER BY created_at DESC
        LIMIT 1`,
      [Number(req.user.iglesiaId)]
    )
  } catch {
    // La tabla payments puede no existir aún — no es un error
  }

  res.json({
    commercialPlan,
    commercialMeta: commercial ? {
      key: commercial.key,
      audience: commercial.audience,
      featured: commercial.featured,
      free: commercial.free,
      brandingRequired: commercial.brandingRequired,
      personas: commercial.personas,
      includedWhatsApp: commercial.includedWhatsApp,
      includedSms: commercial.includedSms,
      labels: commercial.labels,
      descriptions: commercial.descriptions,
    } : null,
    plan,
    nombre: p.nombre,
    precio: p.precio,
    modulos: p.modulos,
    suscripcion: suscripcion || null,
  })
})

// GET /plan/lista — lista pública de planes con precios (sin auth)
router.get('/lista', (req, res) => {
  res.json(getPlanCatalog({
    country: req.query.country || 'AR',
    language: req.query.lang || req.headers['accept-language'] || 'es',
  }))
})

export default router
