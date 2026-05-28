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
import { requireAuth, requireRol } from '../middlewares/auth.js'
import db           from '../lib/db.js'
import { applyDiscount, getPlanCatalog, getPlanPrice, normalizeCountry, normalizePlan, PLANES } from '../lib/billing.js'

const router = Router()

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || ''
const MP_BASE         = 'https://api.mercadopago.com'
const PUBLIC_URL      = process.env.PUBLIC_URL || 'https://churchsystem.com.ar'

function getCfg() {
  return Object.fromEntries(db.all('SELECT clave, valor FROM configuracion').map(r => [r.clave, r.valor]))
}

function getPromo(code = '') {
  if (!code) return null
  const promo = db.get('SELECT * FROM promo_codes WHERE code=?', [String(code).trim().toUpperCase()])
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

  const { plan = 'CONSOLIDACION', country, currency, promo } = req.body || {}
  const cfgAll = getCfg()
  const planKey = normalizePlan(plan)
  const countryInfo = normalizeCountry(country || cfgAll.pais || cfgAll.country || 'AR')
  const selectedCurrency = String(currency || cfgAll.divisa || countryInfo.currency || 'USD').toUpperCase()
  const price = getPlanPrice(planKey, selectedCurrency)
  const planInfo = PLANES[planKey]
  const promoCode = getPromo(promo || cfgAll.promoCode)
  const discount = promoCode ? applyDiscount(price.amount, promoCode.descuento_porcentaje) : { amount: price.amount, discountAmount: 0 }
  const nombreIglesia = cfgAll.nombre_iglesia || 'Iglesia'

  try {
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
        success: `${PUBLIC_URL}/app/configuracion?pago=ok`,
        failure: `${PUBLIC_URL}/app/configuracion?pago=error`,
        pending: `${PUBLIC_URL}/app/configuracion?pago=pendiente`,
      },
      auto_return:      'approved',
      notification_url: `${PUBLIC_URL}/mp/webhook`,
      external_reference: `${req.user.id}|${planKey}|${promoCode?.code || ''}|${Date.now()}`,
      statement_descriptor: 'CHURCH SYSTEM',
      expires: false,
    })

    if (preference.id) {
      // Guardar la preferencia en la DB
      db.run(
        `INSERT INTO configuracion (clave, valor)
         VALUES ('mp_preference_id', ?)
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
        [preference.id]
      )
      db.run(
        `INSERT INTO configuracion (clave, valor)
         VALUES ('plan_pendiente', ?)
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
        [plan]
      )

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
      const [userId, plan, promo] = (payment.external_reference || '').split('|')
      const planKey = normalizePlan(plan)
      if (!planKey || !PLANES[planKey]) return

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
      }

      for (const [k, v] of Object.entries(updates)) {
        db.run(
          `INSERT INTO configuracion (clave, valor)
           VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
          [k, v]
        )
      }

      console.log(`💰  Pago aprobado — plan:${planKey} userId:${userId} MP:${payment.id}`)
    }
  } catch (err) {
    console.error('MP webhook error:', err.message)
  }
})

// ── GET /mp/estado — estado de la suscripción ─────────────────
router.get('/estado', requireAuth, (req, res) => {
  const rows = db.all(
    `SELECT clave, valor FROM configuracion
     WHERE clave IN ('plan','plan_label','plan_personas_max','suscripcion_activa',
                    'suscripcion_vence','trial_fin','trial_inicio','ultimo_pago')`
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

export default router
