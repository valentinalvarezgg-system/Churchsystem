/**
 * paypal.js — Checkout vía PayPal Orders API v2
 *
 * Rutas:
 *   POST /paypal/crear-orden   → crea una orden PayPal, retorna approve_url
 *   GET  /paypal/capturar      → captura el pago luego de aprobación
 */
import { Router } from 'express'
import https from 'https'
import logger from '../lib/logger.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { applyDiscount, getPlanPrice, normalizePlan, PLANES } from '../lib/billing.js'

const router = Router()

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID || ''
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ''
const PAYPAL_ENV           = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
const PAYPAL_BASE          = PAYPAL_ENV === 'live'
  ? 'api-m.paypal.com'
  : 'api-m.sandbox.paypal.com'
const PUBLIC_URL = process.env.PUBLIC_URL || ''

function safePublicUrl() {
  const raw = String(PUBLIC_URL || '').trim()
  if (!raw) return null
  try { const u = new URL(raw); return `${u.protocol}//${u.host}` } catch { return null }
}

function ppRequest(method, path, body, accessToken) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr)

    const req = https.request({ hostname: PAYPAL_BASE, path, method, headers }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d || '{}')) }
        catch { resolve({ _raw: d }) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function getAccessToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
  return new Promise((resolve, reject) => {
    const body = 'grant_type=client_credentials'
    const req = https.request({
      hostname: PAYPAL_BASE,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d).access_token) }
        catch { reject(new Error('PayPal token parse error')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
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

// ── POST /paypal/crear-orden ──────────────────────────────────────
router.post('/crear-orden', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET)
    return res.status(503).json({ error: 'PayPal no configurado. Agregá PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.' })
  const base = safePublicUrl()
  if (!base)
    return res.status(503).json({ error: 'PUBLIC_URL no configurado para checkout.' })

  const { plan = 'PRO', promo } = req.body || {}
  const cfgAll = await getCfg(req.user.iglesiaId)
  const planKey = normalizePlan(plan)
  const planInfo = PLANES[planKey]
  // PayPal only accepts USD or select currencies — default USD for simplicity
  const price = getPlanPrice(planKey, 'USD')
  const promoCode = await getPromo(promo || cfgAll.promoCode)
  const discount = promoCode ? applyDiscount(price.amount, promoCode.descuento_porcentaje) : { amount: price.amount, discountAmount: 0 }
  const checkoutRef = `${req.user.id}|${req.user.iglesiaId}|${planKey}|${promoCode?.code || ''}|${Date.now()}`

  try {
    const accessToken = await getAccessToken()
    const order = await ppRequest('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: checkoutRef,
        description: `Church System ${planInfo.label.en}`,
        amount: {
          currency_code: 'USD',
          value: discount.amount.toFixed(2),
        },
        custom_id: checkoutRef,
      }],
      application_context: {
        brand_name: 'Church System',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${base}/paypal/capturar?plan=${planKey}&iglesiaId=${req.user.iglesiaId}&ref=${encodeURIComponent(checkoutRef)}`,
        cancel_url: `${base}/app/configuracion?pago=error`,
      },
    }, accessToken)

    if (!order.id) {
      logger.error({ order }, 'PayPal order creation failed')
      return res.status(400).json({ error: order.message || 'Error al crear orden PayPal' })
    }

    const approveUrl = (order.links || []).find(l => l.rel === 'approve')?.href

    await setCfg(req.user.iglesiaId, 'plan_pendiente', planKey)
    await setCfg(req.user.iglesiaId, 'checkout_reference', checkoutRef)
    await setCfg(req.user.iglesiaId, 'paypal_order_id', order.id)
    await setCfg(req.user.iglesiaId, 'paypal_last_checkout_at', new Date().toISOString())

    res.json({
      ok: true,
      orderId: order.id,
      approveUrl,
      plan: { id: planKey, label: planInfo.label.es },
      currency: 'USD',
      originalPrice: price.amount,
      finalPrice: discount.amount,
      discount: promoCode ? { code: promoCode.code, percentage: promoCode.descuento_porcentaje } : null,
    })
  } catch (err) {
    logger.error({ err: err.message }, 'PayPal crear-orden error')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /paypal/capturar ─────────────────────────────────────────
// PayPal redirige aquí luego de que el usuario aprueba el pago
router.get('/capturar', async (req, res) => {
  const { token: orderId, plan, iglesiaId, ref } = req.query
  const base = safePublicUrl() || ''

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !orderId || !iglesiaId) {
    return res.redirect(`${base}/app/configuracion?pago=error`)
  }

  try {
    const accessToken = await getAccessToken()
    const capture = await ppRequest('POST', `/v2/checkout/orders/${orderId}/capture`, {}, accessToken)

    if (capture.status === 'COMPLETED') {
      const planKey = normalizePlan(plan)
      const planInfo = PLANES[planKey]
      const vence = new Date()
      vence.setMonth(vence.getMonth() + 1)

      const updates = {
        plan:               planKey,
        plan_label:         planInfo.label.es,
        plan_personas_max:  String(planInfo.personas),
        suscripcion_activa: '1',
        suscripcion_vence:  vence.toISOString().slice(0, 10),
        ultimo_pago:        new Date().toISOString().slice(0, 10),
        paypal_order_id:    orderId,
        plan_pendiente:     '',
        metodo_pago:        'paypal',
      }

      for (const [k, v] of Object.entries(updates)) {
        await pgExec(
          `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
           VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
          [Number(iglesiaId), k, v]
        )
      }

      logger.info({ plan: planKey, iglesiaId, orderId }, 'PayPal pago capturado')
      return res.redirect(`${base}/app/configuracion?pago=ok&metodo=paypal`)
    }

    logger.warn({ status: capture.status, orderId }, 'PayPal capture not completed')
    return res.redirect(`${base}/app/configuracion?pago=pendiente`)
  } catch (err) {
    logger.error({ err: err.message }, 'PayPal capturar error')
    return res.redirect(`${base}/app/configuracion?pago=error`)
  }
})

export default router
