import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

// Endpoints mock para dashboard premium
// TODO: reemplazar con queries reales a la DB

router.get('/personas', requireAuth, (req, res) => {
  res.json({
    total: 1274,
    mes: 37,
    variacion: 12,
    nuevosMes: 42
  })
})

router.get('/asistencias', requireAuth, (req, res) => {
  res.json({
    promedio: 62,
    variacion: -4,
    totalMes: 3209
  })
})

router.get('/grupos', requireAuth, (req, res) => {
  res.json({
    total: 63,
    variacion: 1,
    miembrosProm: 17
  })
})

router.get('/seguimientos', requireAuth, (req, res) => {
  res.json({
    mes: 412,
    variacion: 7
  })
})

router.get('/consolidacion', requireAuth, (req, res) => {
  res.json({
    totalConsolidados: 126,
    variacion: 3,
    meta: 150
  })
})

export default router
