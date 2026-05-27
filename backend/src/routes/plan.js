import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { PLANES } from '../middlewares/plan.js'

const router = Router()

router.get('/me', requireAuth, (req, res) => {
  const plan = req.user?.plan || 'LIDER'
  const p = PLANES[plan] || PLANES.LIDER
  res.json({ plan, nombre: p.nombre, precio: p.precio, modulos: p.modulos })
})

router.get('/lista', (_req, res) => {
  res.json(Object.entries(PLANES).map(([key, val]) => ({ key, ...val })))
})

export default router
