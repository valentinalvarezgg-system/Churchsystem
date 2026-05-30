/**
 * mercadopago.js — Integración MercadoPago para suscripciones
 *
 * Rutas:
 *   POST /mp/crear-preferencia   → crea un link de pago
 *   POST /mp/webhook             → recibe notificaciones de pago (IPN)
 *   GET  /mp/estado/:tenantId    → estado actual de la suscripción
 */
import { Router }   from 'express'
import https        from 'https'
import pino from 'pino'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { applyDiscount, getPlanCatalog, getPlanPrice, normalizeCountry, normalizePlan, PLANES } from '../lib/billing.js'

const router = Router()
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || ''
const MP_BASE         = 'https://api.mercadopago.com'
const PUBLIC_URL      = process.env.PUBLIC_URL || ''

function resolvePublicUrl() {
  const raw = String(PUBLIC_URL || '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

const SAFE_PUBLIC_URL = resolvePublicUrl()

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

// ── Helper para llamar a la API de MP ──────────────────────────
function mpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const req     = https.request({
      hostname: 'api.mercadopago.com',
      path,
      method,
      headers: {
        'Authorization':  `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'X-Idempotency-Key': Date.now().toString(),
      }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d)) }
        catch { resolve({ error: d }) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ── POST /mp/crear-preferencia ────────────────────────────────
// Crea un link de pago de MercadoPago para suscribirse
router.post('/crear-preferencia', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  if (!MP_ACCESS_TOKEN)
    return res.status(503).json({ error: 'MercadoPago no configurado. Agregá MP_ACCESS_TOKEN en Configuración.' })
  if (!SAFE_PUBLIC_URL)
    return res.status(503).json({ error: 'PUBLIC_URL no configurado correctamente para checkout.' })

  const { plan = 'CONSOLIDACION', country, currency, promo } = req.body || {}
  const cfgAll = await getCfg(req.user.iglesiaId)
  const planKey = normalizePlan(plan)
  const countryInfo = normalizeCountry(country || cfgAll.pais || cfgAll.country || 'AR')
  const selectedCurrency = String(currency || cfgAll.divisa || countryInfo.currency || 'USD').toUpperCase()
  const price = getPlanPrice(planKey, selectedCurrency)
  const planInfo = PLANES[planKey]
  const promoCode = await getPromo(promo || cfgAll.promoCode)
  const discount = promoCode ? applyDiscount(price.amount, promoCode.descuento_porcentaje) : { amount: price.amount, discountAmount: 0 }
  const nombreIglesia = cfgAll.nombre_iglesia || 'Iglesia'

  try {
    const checkoutRef = `${req.user.id}|${req.user.iglesiaId}|${planKey}|${promoCode?.code || ''}|${Date.now()}`
    const preference = await mpRequest('POST', '/checkout/preferences', {
      items: [{
        id:          `church-system-${planKey}`,
        title:       `Church System ${planInfo.label.es} — ${nombreIglesia}`,
        description: promoCode
          ? `Suscripcion mensual con ${promoCode.descuento_porcentaje}% OFF por ${promoCode.duracion_meses} meses`
          : `Suscripcion mensual hasta ${planInfo.personas === 99999 ? 'ilimitadas' : planInfo.personas} personas`,
        quantity:    1,
        unit_price:  discount.amount,
        currency_id: price.currency,
      }],
      back_urls: {
        success: `${SAFE_PUBLIC_URL}/app/configuracion?pago=ok`,
        failure: `${SAFE_PUBLIC_URL}/app/configuracion?pago=error`,
        pending: `${SAFE_PUBLIC_URL}/app/configuracion?pago=pendiente`,
      },
      auto_return:      'approved',
      notification_url: `${SAFE_PUBLIC_URL}/mp/webhook`,
      external_reference: checkoutRef,
      statement_descriptor: 'CHURCH SYSTEM',
      expires: false,
    })

    if (preference.id) {
      await pgExec(
        `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
         VALUES ($1,'mp_preference_id',$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
        [req.user.iglesiaId, preference.id]
      )
      await pgExec(
        `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
         VALUES ($1,'plan_pendiente',$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
        [req.user.iglesiaId, planKey]
      )
      await pgExec(
        `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
         VALUES ($1,'checkout_reference',$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
        [req.user.iglesiaId, checkoutRef]
      )
      await setCfg(req.user.iglesiaId, 'mp_last_checkout_at', new Date().toISOString())
      await setCfg(req.user.iglesiaId, 'mp_last_checkout_plan', planKey)
      await setCfg(req.user.iglesiaId, 'mp_last_checkout_price', `${price.currency} ${discount.amount}`)

      res.json({
        ok:         true,
        preferenceId: preference.id,
        initPoint:    preference.init_point,          // URL para redirigir al usuario
        sandboxUrl:   preference.sandbox_init_point,  // URL de prueba
        plan:         { id: planKey, label: planInfo.label.es, personas: planInfo.personas },
        currency:     price.currency,
        originalPrice: price.amount,
        finalPrice:   discount.amount,
        discount:     promoCode ? { code: promoCode.code, percentage: promoCode.descuento_porcentaje, months: promoCode.duracion_meses } : null,
      })
    } else {
      res.status(400).json({ error: preference.message || 'Error al crear preferencia' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /mp/webhook — IPN de MercadoPago ─────────────────────
// MercadoPago llama este endpoint cuando se hace un pago
router.post('/webhook', async (req, res) => {
  res.sendStatus(200) // Responder rápido para MP

  const { type, data } = req.body || {}
  if (type !== 'payment') return

  try {
    const payment = await mpRequest('GET', `/v1/payments/${data.id}`, null)

    if (payment.status === 'approved') {
      const [userId, iglesiaId, plan, promo] = (payment.external_reference || '').split('|')
      const planKey = normalizePlan(plan)
      if (!planKey || !PLANES[planKey]) return

      const user = await pgOne(
        'SELECT "iglesiaId","email","nombre" FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1',
        [Number(userId)]
      )
      if (!user?.iglesiaId) return
      if (String(user.iglesiaId) !== String(iglesiaId)) {
        logger.warn({ userId, extIglesiaId: iglesiaId, userIglesiaId: user.iglesiaId }, 'Webhook ignored due to tenant mismatch')
        return
      }
      await setCfg(user.iglesiaId, 'mp_last_webhook_at', new Date().toISOString())
      await setCfg(user.iglesiaId, 'mp_last_webhook_payment_id', payment.id || data.id || '')
      await setCfg(user.iglesiaId, 'mp_last_webhook_status', payment.status || 'unknown')
      const planInfo = PLANES[planKey]
      const vence    = new Date()
      vence.setMonth(vence.getMonth() + 1)

      // Actualizar la suscripción en la DB
      const updates = {
        plan:               planKey,
        plan_label:         planInfo.label.es,
        plan_personas_max:  String(planInfo.personas),
        suscripcion_activa: '1',
        suscripcion_vence:  vence.toISOString().slice(0, 10),
        ultimo_pago:        new Date().toISOString().slice(0, 10),
        mp_payment_id:      String(payment.id),
        divisa:             payment.currency_id || '',
        promoCode:          promo || '',
        plan_pendiente:     '',
      }

      for (const [k, v] of Object.entries(updates)) {
        await pgExec(
          `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
           VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
          [user.iglesiaId, k, v]
        )
      }

      logger.info({ plan: planKey, userId, iglesiaId, paymentId: payment.id }, 'Pago aprobado')
    }
    if (payment?.status && payment?.external_reference) {
      const [, iglesiaId] = String(payment.external_reference).split('|')
      if (iglesiaId) {
        await setCfg(Number(iglesiaId), 'mp_last_webhook_at', new Date().toISOString())
        await setCfg(Number(iglesiaId), 'mp_last_webhook_payment_id', payment.id || data.id || '')
        await setCfg(Number(iglesiaId), 'mp_last_webhook_status', payment.status || 'unknown')
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'MP webhook error')
  }
})

// ── GET /mp/estado — estado de la suscripción ─────────────────
router.get('/estado', requireAuth, async (req, res) => {
  const rows = await pgMany(
    `SELECT "clave", "valor" FROM "Configuracion"
     WHERE ("iglesiaId"=$1 OR "iglesiaId" IS NULL)
       AND "clave" IN ('plan','plan_label','plan_personas_max','suscripcion_activa',
                       'suscripcion_vence','trial_fin','trial_inicio','ultimo_pago','plan_pendiente')
     ORDER BY "iglesiaId" NULLS FIRST`,
    [req.user.iglesiaId]
  )
  const cfg = Object.fromEntries(rows.map(r => [r.clave, r.valor]))

  const hoy        = new Date().toISOString().slice(0, 10)
  const enTrial    = cfg.trial_fin && hoy <= cfg.trial_fin
  const suscActiva = cfg.suscripcion_activa === '1' && cfg.suscripcion_vence >= hoy
  const diasTrial  = cfg.trial_fin
    ? Math.max(0, Math.ceil((new Date(cfg.trial_fin) - new Date()) / 86400000))
    : 0

  res.json({
    ok:          true,
    plan:        cfg.plan || 'estandar',
    planLabel:   cfg.plan_label || 'Estándar',
    personasMax: parseInt(cfg.plan_personas_max || '500'),
    enTrial,
    diasTrial,
    trialFin:    cfg.trial_fin,
    suscActiva,
    suscVence:   cfg.suscripcion_vence,
    activo:      enTrial || suscActiva,
    planPendiente: cfg.plan_pendiente || '',
  })
})

// ── GET /mp/planes — info de planes disponibles ───────────────
router.get('/planes', (req, res) => {
  res.json(getPlanCatalog({ country:req.query.country, language:req.query.lang }))
})

router.get('/catalogo', (req, res) => {
  const country = normalizeCountry(req.query.country || 'AR')
  res.json({
    country,
    plans: getPlanCatalog({ country:country.code, language:req.query.lang }),
  })
})

// ── GET /mp/qa — trazabilidad comercial por tenant ───────────
router.get('/qa', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  const cfg = await getCfg(req.user.iglesiaId)
  return res.json({
    ok: true,
    tenantId: req.user.iglesiaId,
    checkout: {
      reference: cfg.checkout_reference || '',
      pendingPlan: cfg.plan_pendiente || '',
      lastAt: cfg.mp_last_checkout_at || '',
      lastPlan: cfg.mp_last_checkout_plan || '',
      lastPrice: cfg.mp_last_checkout_price || '',
    },
    webhook: {
      lastAt: cfg.mp_last_webhook_at || '',
      paymentId: cfg.mp_last_webhook_payment_id || '',
      status: cfg.mp_last_webhook_status || '',
    },
    subscription: {
      active: cfg.suscripcion_activa === '1',
      plan: cfg.plan || '',
      planLabel: cfg.plan_label || '',
      expiresAt: cfg.suscripcion_vence || '',
      lastPaymentDate: cfg.ultimo_pago || '',
    },
  })
})

export default router
