import { Router } from 'express'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function isDisponible(promo) {
  if (!promo) return false
  if (Number(promo.activo ?? 1) !== 1) return false
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return false
  const maxUsos = Number(promo.max_usos ?? 1)
  if (maxUsos > 0 && Number(promo.usos || 0) >= maxUsos) return false
  if (Number(promo.usado || 0) === 1 && maxUsos <= 1) return false
  return true
}

router.get('/', requireAuth, requireRol('GODMODE'), wrap(async (_req, res) => {
  const codes = await pgMany('SELECT * FROM "promo_codes" ORDER BY "createdAt" DESC')
  return res.json(codes.map(c => ({ ...c, disponible: isDisponible(c) })))
}))

router.post('/', requireAuth, requireRol('GODMODE'), wrap(async (req, res) => {
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

  const normalized = String(code).toUpperCase().trim()
  const exists = await pgOne('SELECT id FROM "promo_codes" WHERE "code"=$1 LIMIT 1', [normalized])
  if (exists) return res.status(400).json({ error: 'El código ya existe' })

  await pgExec(
    `INSERT INTO "promo_codes"
      ("code","dias_extra","tipo","descuento_porcentaje","duracion_meses","max_usos","expiresAt","usado","usos","activo")
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,1)`,
    [
      normalized,
      parseInt(dias_extra, 10) || 0,
      String(tipo || 'DISCOUNT'),
      parseInt(descuento_porcentaje, 10) || 0,
      parseInt(duracion_meses, 10) || 0,
      Math.max(0, parseInt(max_usos, 10) || 0),
      expiresAt || null,
    ]
  )

  return res.json({ ok: true })
}))

router.get('/validar/:code', wrap(async (req, res) => {
  const promo = await pgOne(
    'SELECT * FROM "promo_codes" WHERE "code"=$1 LIMIT 1',
    [String(req.params.code || '').toUpperCase().trim()]
  )
  if (!isDisponible(promo)) return res.status(404).json({ valido: false, error: 'Invitacion no disponible' })
  return res.json({
    valido: true,
    code: promo.code,
    tipo: promo.tipo,
    dias_extra: Number(promo.dias_extra || 0),
    descuento_porcentaje: Number(promo.descuento_porcentaje || 0),
    duracion_meses: Number(promo.duracion_meses || 0),
  })
}))

export default router
