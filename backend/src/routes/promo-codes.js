import { Router } from 'express'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import db from '../lib/db.js'

const router = Router()

router.get('/promo-codes', requireAuth, requireRol('PASTOR_GENERAL'), (req, res) => {
  const codes = db.all('SELECT * FROM promo_codes ORDER BY createdAt DESC')
  res.json(codes)
})

router.post('/promo-codes', requireAuth, requireRol('PASTOR_GENERAL'), (req, res) => {
  const { code, dias_extra } = req.body
  if (!code || !dias_extra) return res.status(400).json({ error: 'Faltan campos' })
  
  const exists = db.get('SELECT id FROM promo_codes WHERE code = ?', [code.toUpperCase()])
  if (exists) return res.status(400).json({ error: 'El código ya existe' })
  
  db.run('INSERT INTO promo_codes (code, dias_extra, usado) VALUES (?, ?, 0)', 
    [code.toUpperCase(), parseInt(dias_extra)])
  
  res.json({ ok: true })
})

export default router
