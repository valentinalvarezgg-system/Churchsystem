import { Router } from 'express'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import db from '../lib/db.js'

const router = Router()

function isDisponible(promo) {
  if (!promo) return false
  if (Number(promo.activo ?? 1) !== 1) return false
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return false
  const maxUsos = Number(promo.max_usos ?? 1)
  if (maxUsos > 0 && Number(promo.usos || 0) >= maxUsos) return false
  if (Number(promo.usado || 0) === 1 && maxUsos <= 1) return false
  return true
}

router.get('/', requireAuth, requireRol('PASTOR_GENERAL'), (_req, res) => {
  const codes = db.all('SELECT * FROM promo_codes ORDER BY createdAt DESC')
  res.json(codes.map(c => ({ ...c, disponible: isDisponible(c) })))
})

router.post('/', requireAuth, requireRol('PASTOR_GENERAL'), (req, res) => {
  const {
    code,
    dias_extra = 0,
    tipo = 'DISCOUNT',
    descuento_porcentaje = 15,
    duracion_meses = 3,
    max_usos = 1,
    expiresAt = null,
  } = req.body || {}
  if (!code) return res.status(400).json({ error: 'Falta el codigo' })
  
  const exists = db.get('SELECT id FROM promo_codes WHERE code = ?', [code.toUpperCase()])
  if (exists) return res.status(400).json({ error: 'El código ya existe' })
  
  db.run(
    `INSERT INTO promo_codes
      (code, dias_extra, tipo, descuento_porcentaje, duracion_meses, max_usos, expiresAt, usado, usos, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`,
    [
      code.toUpperCase(),
      parseInt(dias_extra) || 0,
      tipo,
      parseInt(descuento_porcentaje) || 0,
      parseInt(duracion_meses) || 0,
      Math.max(0, parseInt(max_usos) || 0),
      expiresAt || null,
    ]
  )
  
  res.json({ ok: true })
})

router.get('/validar/:code', (req, res) => {
  const promo = db.get('SELECT * FROM promo_codes WHERE code=?', [String(req.params.code || '').toUpperCase()])
  if (!isDisponible(promo)) return res.status(404).json({ valido:false, error:'Invitacion no disponible' })
  res.json({
    valido:true,
    code: promo.code,
    tipo: promo.tipo,
    dias_extra: Number(promo.dias_extra || 0),
    descuento_porcentaje: Number(promo.descuento_porcentaje || 0),
    duracion_meses: Number(promo.duracion_meses || 0),
  })
})

export default router
