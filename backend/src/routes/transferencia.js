/**
 * transferencia.js — Suscripción por transferencia bancaria manual
 *
 * Rutas:
 *   POST /transferencia/solicitar         → registra la solicitud pendiente
 *   GET  /transferencia/datos-bancarios   → retorna CBU/alias/datos para el usuario
 *
 * La aprobación la hace el GODMODE desde /godmode/transferencias/aprobar
 */
import { Router } from 'express'
import logger from '../lib/logger.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { normalizePlan, PLANES, getPlanPrice } from '../lib/billing.js'

const router = Router()

const DATOS_BANCARIOS = {
  banco:   process.env.TRANSFERENCIA_BANCO   || 'Banco Galicia',
  alias:   process.env.TRANSFERENCIA_ALIAS   || 'churchsystem.mp',
  cbu:     process.env.TRANSFERENCIA_CBU     || '',
  titular: process.env.TRANSFERENCIA_TITULAR || 'Church System SAS',
  cuit:    process.env.TRANSFERENCIA_CUIT    || '',
  nota:    'Indicar en el concepto el email y nombre de la iglesia.',
}

async function getCfg(iglesiaId) {
  const rows = await pgMany(
    'SELECT "clave","valor" FROM "Configuracion" WHERE "iglesiaId"=$1 OR "iglesiaId" IS NULL ORDER BY "iglesiaId" NULLS FIRST',
    [iglesiaId]
  )
  return Object.fromEntries(rows.map(r => [r.clave, r.valor]))
}

async function setCfg(iglesiaId, clave, valor) {
  await pgExec(
    `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
     VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
    [iglesiaId, clave, String(valor ?? '')]
  )
}

// ── POST /transferencia/solicitar ─────────────────────────────────
router.post('/solicitar', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  const { plan = 'PRO' } = req.body || {}
  const planKey = normalizePlan(plan)
  const planInfo = PLANES[planKey]
  const cfgAll = await getCfg(req.user.iglesiaId)
  const price = getPlanPrice(planKey, cfgAll.divisa || 'ARS')

  const checkoutRef = `${req.user.id}|${req.user.iglesiaId}|${planKey}||${Date.now()}`

  await setCfg(req.user.iglesiaId, 'plan_pendiente', planKey)
  await setCfg(req.user.iglesiaId, 'transferencia_solicitada', '1')
  await setCfg(req.user.iglesiaId, 'transferencia_plan', planKey)
  await setCfg(req.user.iglesiaId, 'transferencia_monto', `${price.currency} ${price.amount}`)
  await setCfg(req.user.iglesiaId, 'transferencia_fecha', new Date().toISOString())
  await setCfg(req.user.iglesiaId, 'checkout_reference', checkoutRef)
  await setCfg(req.user.iglesiaId, 'metodo_pago_pendiente', 'transferencia')

  logger.info({ iglesiaId: req.user.iglesiaId, plan: planKey, price }, 'Transferencia solicitada')

  res.json({
    ok: true,
    plan: { id: planKey, label: planInfo.label.es },
    monto: `${price.currency} ${price.amount}`,
    datos: DATOS_BANCARIOS,
    mensaje: `Tu solicitud fue registrada. Una vez que realices la transferencia y la validemos, tu plan ${planInfo.label.es} se activará en menos de 24hs hábiles.`,
  })
})

// ── GET /transferencia/datos-bancarios ────────────────────────────
router.get('/datos-bancarios', requireAuth, (_req, res) => {
  res.json({ ok: true, datos: DATOS_BANCARIOS })
})

export default router
