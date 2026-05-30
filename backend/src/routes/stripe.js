/**
 * stripe.js — Checkout con tarjeta vía Stripe
 *
 * Rutas:
 *   POST /stripe/crear-sesion   → Stripe Checkout session (hosted)
 *   POST /stripe/webhook        → webhook de Stripe (payment_intent / checkout)
 */
import { Router } from 'express'
import Stripe from 'stripe'
import logger from '../lib/logger.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { applyDiscount, getPlanPrice, normalizePlan, PLANES } from '../lib/billing.js'

const router = Router()

const STRIPE_SK  = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WHK = process.env.STRIPE_WEBHOOK_SECRET || ''
const PUBLIC_URL = process.env.PUBLIC_URL || ''

function safePublicUrl() {
  const raw = String(PUBLIC_URL || '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.host}`
  } catch { return null }
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

async function getPromo(code = '') {
  if (!code) return null
  const promo = await pgOne('SELECT * FROM "promo_codes" WHERE "code"=$1 LIMIT 1', [String(code).trim().toUpperCase()])
  if (!promo || Number(promo.activo ?? 1) !== 1) return null
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return null
  const maxUsos = Number(promo.max_usos ?? 1)
  if (maxUsos > 0 && Number(promo.usos || 0) >= maxUsos) return null
  if (Number(promo.usado || 0) === 1 && maxUsos <= 1) return null
  if (Number(promo.descuento_porcentaje || 0) <= 0) return null
  return promo
}

// ── POST /stripe/crear-sesion ─────────────────────────────────────
router.post('/crear-sesion', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  if (!STRIPE_SK)
    return res.status(503).json({ error: 'Stripe no configurado. Agregá STRIPE_SECRET_KEY en el servidor.' })
  const base = safePublicUrl()
  if (!base)
    return res.status(503).json({ error: 'PUBLIC_URL no configurado para checkout.' })

  const stripe = new Stripe(STRIPE_SK, { apiVersion: '2024-04-10' })

  const { plan = 'PRO', currency, promo } = req.body || {}
  const cfgAll = await getCfg(req.user.iglesiaId)
  const planKey = normalizePlan(plan)
  const planInfo = PLANES[planKey]
  const selectedCurrency = String(currency || cfgAll.divisa || 'USD').toUpperCase()
  const price = getPlanPrice(planKey, selectedCurrency)
  const promoCode = await getPromo(promo || cfgAll.promoCode)
  const discount = promoCode ? applyDiscount(price.amount, promoCode.descuento_porcentaje) : { amount: price.amount, discountAmount: 0 }
  const nombreIglesia = cfgAll.nombre_iglesia || 'Iglesia'
  const checkoutRef = `${req.user.id}|${req.user.iglesiaId}|${planKey}|${promoCode?.code || ''}|${Date.now()}`

  // Stripe expects amount in smallest currency unit (cents for USD)
  // For zero-decimal currencies (CLP, COP etc) use amount directly
  const ZERO_DECIMAL = ['CLP','COP','ARS','UYU','BRL']
  const unitAmount = ZERO_DECIMAL.includes(price.currency)
    ? Math.round(discount.amount)
    : Math.round(discount.amount * 100)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: price.currency.toLowerCase(),
          product_data: {
            name: `Church System ${planInfo.label.es} — ${nombreIglesia}`,
            description: promoCode
              ? `Suscripción mensual con ${promoCode.descuento_porcentaje}% OFF`
              : `Suscripción mensual — hasta ${planInfo.personas === 99999 ? 'ilimitadas' : planInfo.personas} personas`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      success_url: `${base}/app/configuracion?pago=ok&metodo=stripe`,
      cancel_url: `${base}/app/configuracion?pago=error`,
      metadata: { checkoutRef, iglesiaId: String(req.user.iglesiaId), userId: String(req.user.id), planKey },
      client_reference_id: checkoutRef,
    })

    await setCfg(req.user.iglesiaId, 'plan_pendiente', planKey)
    await setCfg(req.user.iglesiaId, 'checkout_reference', checkoutRef)
    await setCfg(req.user.iglesiaId, 'stripe_session_id', session.id)
    await setCfg(req.user.iglesiaId, 'stripe_last_checkout_at', new Date().toISOString())

    res.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      plan: { id: planKey, label: planInfo.label.es },
      currency: price.currency,
      originalPrice: price.amount,
      finalPrice: discount.amount,
      discount: promoCode ? { code: promoCode.code, percentage: promoCode.descuento_porcentaje } : null,
    })
  } catch (err) {
    logger.error({ err: err.message }, 'Stripe crear-sesion error')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /stripe/webhook ──────────────────────────────────────────
// Stripe llama este endpoint cuando el pago se completa
router.post('/webhook', async (req, res) => {
  res.sendStatus(200)

  if (!STRIPE_SK) return
  const stripe = new Stripe(STRIPE_SK, { apiVersion: '2024-04-10' })

  let event
  try {
    if (STRIPE_WHK) {
      const sig = req.headers['stripe-signature']
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WHK)
    } else {
      event = req.body
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Stripe webhook signature error')
    return
  }

  if (event.type !== 'checkout.session.completed') return

  try {
    const session = event.data.object
    const { iglesiaId, userId, planKey } = session.metadata || {}
    if (!iglesiaId || !planKey) return

    const resolvedPlan = normalizePlan(planKey)
    if (!PLANES[resolvedPlan]) return

    const planInfo = PLANES[resolvedPlan]
    const vence = new Date()
    vence.setMonth(vence.getMonth() + 1)

    const updates = {
      plan:               resolvedPlan,
      plan_label:         planInfo.label.es,
      plan_personas_max:  String(planInfo.personas),
      suscripcion_activa: '1',
      suscripcion_vence:  vence.toISOString().slice(0, 10),
      ultimo_pago:        new Date().toISOString().slice(0, 10),
      stripe_payment_id:  session.payment_intent || session.id,
      plan_pendiente:     '',
      metodo_pago:        'stripe',
    }

    for (const [k, v] of Object.entries(updates)) {
      await pgExec(
        `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
         VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
        [Number(iglesiaId), k, v]
      )
    }

    logger.info({ plan: resolvedPlan, iglesiaId, userId, sessionId: session.id }, 'Stripe pago aprobado')
  } catch (err) {
    logger.error({ err: err.message }, 'Stripe webhook processing error')
  }
})

export default router
