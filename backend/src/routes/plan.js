import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { PLANES, resolvePlan } from '../middlewares/plan.js'
import { pgOne } from '../lib/pg.js'

const router = Router()

// GET /plan/me — plan activo del usuario + datos de suscripción si existen
router.get('/me', requireAuth, async (req, res) => {
  const rawPlan = req.user?.plan || 'STARTER'
  const plan    = resolvePlan(rawPlan)
  const p       = PLANES[plan] || PLANES.STARTER

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
    plan,
    nombre:     p.nombre,
    precio:     p.precio,
    modulos:    p.modulos,
    suscripcion: suscripcion || null,
  })
})

// GET /plan/lista — lista pública de planes con precios (sin auth)
router.get('/lista', (_req, res) => {
  res.json(
    Object.entries(PLANES).map(([key, val]) => ({ key, ...val }))
  )
})

export default router
