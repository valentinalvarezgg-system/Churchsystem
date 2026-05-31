import { Router } from 'express'
import https from 'https'
import logger from '../lib/logger.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'

const router = Router()

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || ''
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ''
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ''
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
const PAYPAL_BASE = PAYPAL_ENV === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com'
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || ''
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || ''

const FREQUENCY_TO_MONTHS = {
  mensual: 1,
  trimestral: 3,
  anual: 12,
}

let schemaReadyPromise = null

function resolvePublicUrl(req) {
  for (const raw of [process.env.FRONTEND_URL, process.env.PUBLIC_URL, process.env.BASE_URL]) {
    try {
      const u = new URL(String(raw || '').trim())
      if (['http:', 'https:'].includes(u.protocol)) return `${u.protocol}//${u.host}`
    } catch {}
  }
  try {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim()
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
    if (!host) return null
    const u = new URL(`${proto}://${host}`)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function ppRequest(method, path, body, accessToken) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr)

    const req = https.request({ hostname: PAYPAL_BASE, path, method, headers }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          resolve({ status: res.statusCode || 0, data: parsed })
        } catch {
          resolve({ status: res.statusCode || 0, data: { raw: data } })
        }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

function mpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const headers = {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    }
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr)

    const req = https.request({ hostname: 'api.mercadopago.com', path, method, headers }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          resolve({ status: res.statusCode || 0, data: parsed })
        } catch {
          resolve({ status: res.statusCode || 0, data: { raw: data } })
        }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function getPayPalAccessToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
  return new Promise((resolve, reject) => {
    const body = 'grant_type=client_credentials'
    const req = https.request({
      hostname: PAYPAL_BASE,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}')
          if (!parsed.access_token) return reject(new Error('No se obtuvo token de PayPal'))
          resolve(parsed.access_token)
        } catch {
          reject(new Error('No se pudo parsear token PayPal'))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function asFrequency(raw = '') {
  const key = String(raw || '').trim().toLowerCase()
  return FREQUENCY_TO_MONTHS[key] ? key : 'mensual'
}

function normalizePlatform(raw = '') {
  const key = String(raw || '').trim().toLowerCase()
  return key === 'paypal' ? 'paypal' : 'mercadopago'
}

async function ensureSubscriptionSchema() {
  if (schemaReadyPromise) return schemaReadyPromise
  schemaReadyPromise = (async () => {
    await pgExec(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_ars NUMERIC(12,2) NOT NULL DEFAULT 0,
        price_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
        frequency TEXT NOT NULL,
        mp_plan_id TEXT,
        paypal_plan_id TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (name, frequency)
      )
    `)
    await pgExec(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        iglesia_id INTEGER NOT NULL REFERENCES "Iglesia"(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pgExec('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)')
    await pgExec('CREATE INDEX IF NOT EXISTS idx_payments_iglesia_id ON payments(iglesia_id)')
    await pgExec('CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id)')
    await pgExec('CREATE INDEX IF NOT EXISTS idx_payments_platform_status ON payments(platform, status)')

    const defaults = [
      ['STARTER', 'Starter', 29000, 29],
      ['PRO', 'Pro', 59000, 59],
      ['MAX', 'Max', 99000, 99],
    ]
    const freqs = ['mensual', 'trimestral', 'anual']
    for (const [name, description, ars, usd] of defaults) {
      for (const f of freqs) {
        const m = FREQUENCY_TO_MONTHS[f]
        await pgExec(
          `INSERT INTO subscription_plans
             (name, description, price_ars, price_usd, frequency, active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           ON CONFLICT (name, frequency) DO NOTHING`,
          [name, description, Number(ars) * m, Number(usd) * m, f]
        )
      }
    }
  })()
  return schemaReadyPromise
}

async function getPlan(name, frequency) {
  await ensureSubscriptionSchema()
  return pgOne(
    `SELECT *
       FROM subscription_plans
      WHERE upper(name) = upper($1)
        AND frequency = $2
        AND active = true
      LIMIT 1`,
    [String(name || '').trim(), asFrequency(frequency)]
  )
}

async function savePaymentRow({
  userId, iglesiaId, platform, subscriptionId, planName, amount, currency, status, metadata = {},
}) {
  return pgOne(
    `INSERT INTO payments
      (user_id, iglesia_id, platform, subscription_id, plan_name, amount, currency, status, metadata, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING *`,
    [userId, iglesiaId, platform, subscriptionId, planName, amount, currency, status, JSON.stringify(metadata || {})]
  )
}

async function updatePaymentBySubscription(subscriptionId, nextStatus, metadataPatch = {}) {
  const current = await pgOne('SELECT id, metadata FROM payments WHERE subscription_id=$1 ORDER BY id DESC LIMIT 1', [subscriptionId])
  if (!current) return null
  const merged = { ...(current.metadata || {}), ...(metadataPatch || {}) }
  await pgExec(
    `UPDATE payments
        SET status=$2, metadata=$3::jsonb, updated_at=CURRENT_TIMESTAMP
      WHERE id=$1`,
    [current.id, nextStatus, JSON.stringify(merged)]
  )
  return current.id
}

async function verifyPayPalWebhook(req) {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_WEBHOOK_ID) return false
  const accessToken = await getPayPalAccessToken()
  const payload = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: PAYPAL_WEBHOOK_ID,
    webhook_event: req.body,
  }
  const verification = await ppRequest('POST', '/v1/notifications/verify-webhook-signature', payload, accessToken)
  return verification.status >= 200
    && verification.status < 300
    && String(verification.data?.verification_status || '').toUpperCase() === 'SUCCESS'
}

function verifyMpWebhook(req) {
  if (!MP_WEBHOOK_SECRET) return false
  const incoming = String(req.query.secret || req.headers['x-webhook-secret'] || '')
  return incoming && incoming === MP_WEBHOOK_SECRET
}

router.post('/subscriptions/create', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  try {
    const platform = normalizePlatform(req.body?.platform)
    const planName = String(req.body?.planName || 'PRO').trim().toUpperCase()
    const frequency = asFrequency(req.body?.frequency)
    const plan = await getPlan(planName, frequency)
    if (!plan) return res.status(404).json({ error: 'Plan de suscripción no encontrado.' })

    const baseUrl = resolvePublicUrl(req)
    if (!baseUrl) return res.status(503).json({ error: 'Falta URL pública para checkout.' })

    if (platform === 'mercadopago') {
      if (!MP_ACCESS_TOKEN) return res.status(503).json({ error: 'Falta MP_ACCESS_TOKEN.' })
      const months = FREQUENCY_TO_MONTHS[frequency]
      const amount = Number(plan.price_ars || 0)
      const extRef = `${req.user.id}|${req.user.iglesiaId}|${planName}|${frequency}|${Date.now()}`
      const payload = {
        reason: `Church System ${planName} (${frequency})`,
        external_reference: extRef,
        auto_recurring: {
          frequency: months,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'ARS',
        },
        back_url: `${baseUrl}/app/configuracion?pago=ok&metodo=mercadopago`,
        notification_url: `${baseUrl}/api/payments/mercadopago/webhook${MP_WEBHOOK_SECRET ? `?secret=${encodeURIComponent(MP_WEBHOOK_SECRET)}` : ''}`,
        status: 'authorized',
      }
      const createRes = await mpRequest('POST', '/preapproval', payload)
      if (createRes.status < 200 || createRes.status >= 300 || !createRes.data?.id) {
        logger.error({ response: createRes.data }, 'MercadoPago preapproval error')
        return res.status(400).json({ error: createRes.data?.message || 'No se pudo crear suscripción en Mercado Pago.' })
      }
      await savePaymentRow({
        userId: req.user.id,
        iglesiaId: req.user.iglesiaId,
        platform: 'mercadopago',
        subscriptionId: createRes.data.id,
        planName,
        amount,
        currency: 'ARS',
        status: createRes.data.status || 'authorized',
        metadata: { frequency, extRef, init_point: createRes.data.init_point || '' },
      })
      logger.info({ platform, planName, frequency, userId: req.user.id, subscriptionId: createRes.data.id }, 'Subscription created')
      return res.json({
        ok: true,
        platform: 'mercadopago',
        checkoutUrl: createRes.data.init_point || createRes.data.sandbox_init_point || '',
        subscriptionId: createRes.data.id,
      })
    }

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: 'Faltan credenciales de PayPal.' })
    if (!plan.paypal_plan_id) return res.status(400).json({ error: 'Este plan no tiene paypal_plan_id configurado.' })
    const accessToken = await getPayPalAccessToken()
    const customId = `${req.user.id}|${req.user.iglesiaId}|${planName}|${frequency}|${Date.now()}`
    const createPayload = {
      plan_id: plan.paypal_plan_id,
      quantity: '1',
      custom_id: customId,
      application_context: {
        brand_name: 'Church System',
        return_url: `${baseUrl}/app/configuracion?pago=ok&metodo=paypal`,
        cancel_url: `${baseUrl}/app/configuracion?pago=error&metodo=paypal`,
      },
    }
    const ppCreate = await ppRequest('POST', '/v1/billing/subscriptions', createPayload, accessToken)
    if (ppCreate.status < 200 || ppCreate.status >= 300 || !ppCreate.data?.id) {
      logger.error({ response: ppCreate.data }, 'PayPal subscription create error')
      return res.status(400).json({ error: ppCreate.data?.message || 'No se pudo crear suscripción en PayPal.' })
    }
    const approve = (ppCreate.data.links || []).find(l => l.rel === 'approve')?.href || ''
    await savePaymentRow({
      userId: req.user.id,
      iglesiaId: req.user.iglesiaId,
      platform: 'paypal',
      subscriptionId: ppCreate.data.id,
      planName,
      amount: Number(plan.price_usd || 0),
      currency: 'USD',
      status: ppCreate.data.status || 'APPROVAL_PENDING',
      metadata: { frequency, customId },
    })
    logger.info({ platform, planName, frequency, userId: req.user.id, subscriptionId: ppCreate.data.id }, 'Subscription created')
    return res.json({
      ok: true,
      platform: 'paypal',
      checkoutUrl: approve,
      subscriptionId: ppCreate.data.id,
    })
  } catch (err) {
    logger.error({ err: err.message }, 'Subscription create failed')
    return res.status(500).json({ error: 'Error creando la suscripción.' })
  }
})

router.get('/subscriptions/plans', requireAuth, async (req, res) => {
  const platform = normalizePlatform(req.query.platform)
  const frequency = asFrequency(req.query.frequency)
  await ensureSubscriptionSchema()
  const rows = await pgMany(
    `SELECT id, name, description, price_ars, price_usd, frequency, mp_plan_id, paypal_plan_id, active
       FROM subscription_plans
      WHERE active = true
        AND frequency = $1
      ORDER BY
        CASE upper(name)
          WHEN 'STARTER' THEN 1
          WHEN 'PRO' THEN 2
          WHEN 'MAX' THEN 3
          ELSE 99
        END ASC`,
    [frequency]
  )
  const items = rows.map(r => ({
    id: String(r.name || '').toUpperCase(),
    label: String(r.name || ''),
    description: r.description || '',
    frequency: r.frequency,
    price: platform === 'paypal' ? Number(r.price_usd || 0) : Number(r.price_ars || 0),
    currency: platform === 'paypal' ? 'USD' : 'ARS',
    personas: r.name?.toUpperCase() === 'STARTER' ? 300 : r.name?.toUpperCase() === 'PRO' ? 1000 : 99999,
    mpPlanId: r.mp_plan_id || '',
    paypalPlanId: r.paypal_plan_id || '',
  }))
  return res.json({ ok: true, items })
})

router.get('/subscriptions/:userId', requireAuth, async (req, res) => {
  const askedId = Number(req.params.userId || 0)
  const isSameUser = askedId === Number(req.user.id)
  const canAdmin = req.user.rol === 'PASTOR_GENERAL'
  if (!isSameUser && !canAdmin) return res.status(403).json({ error: 'No autorizado.' })
  const rows = await pgMany(
    `SELECT id, user_id, iglesia_id, platform, subscription_id, plan_name, amount, currency, status, created_at, updated_at
       FROM payments
      WHERE user_id = $1
        AND iglesia_id = $2
      ORDER BY created_at DESC
      LIMIT 20`,
    [askedId, req.user.iglesiaId]
  )
  return res.json({ ok: true, items: rows, current: rows[0] || null })
})

router.put('/subscriptions/:id/cancel', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  try {
    const paymentId = Number(req.params.id || 0)
    const payment = await pgOne(
      `SELECT *
         FROM payments
        WHERE id=$1
          AND iglesia_id=$2
        LIMIT 1`,
      [paymentId, req.user.iglesiaId]
    )
    if (!payment) return res.status(404).json({ error: 'Suscripción no encontrada.' })

    if (payment.platform === 'mercadopago') {
      if (!MP_ACCESS_TOKEN) return res.status(503).json({ error: 'Falta MP_ACCESS_TOKEN.' })
      const cancelRes = await mpRequest('PUT', `/preapproval/${payment.subscription_id}`, { status: 'cancelled' })
      if (cancelRes.status < 200 || cancelRes.status >= 300) {
        return res.status(400).json({ error: cancelRes.data?.message || 'No se pudo cancelar en Mercado Pago.' })
      }
    } else if (payment.platform === 'paypal') {
      if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: 'Faltan credenciales PayPal.' })
      const accessToken = await getPayPalAccessToken()
      const cancelRes = await ppRequest('POST', `/v1/billing/subscriptions/${payment.subscription_id}/cancel`, { reason: 'Cancelled by user' }, accessToken)
      if (cancelRes.status < 200 || cancelRes.status >= 300) {
        return res.status(400).json({ error: cancelRes.data?.message || 'No se pudo cancelar en PayPal.' })
      }
    }

    await pgExec(
      `UPDATE payments
          SET status='cancelled', updated_at=CURRENT_TIMESTAMP
        WHERE id=$1`,
      [paymentId]
    )
    logger.info({ paymentId, platform: payment.platform, userId: req.user.id }, 'Subscription cancelled')
    return res.json({ ok: true, id: paymentId, status: 'cancelled' })
  } catch (err) {
    logger.error({ err: err.message }, 'Cancel subscription failed')
    return res.status(500).json({ error: 'Error cancelando suscripción.' })
  }
})

router.post('/payments/mercadopago/webhook', async (req, res) => {
  try {
    if (MP_WEBHOOK_SECRET && !verifyMpWebhook(req)) return res.status(401).json({ ok: false, error: 'Invalid webhook signature' })

    const eventType = String(req.body?.type || req.body?.topic || req.body?.action || '')
    const dataId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id
    if (!dataId) return res.status(200).json({ ok: true })

    if (!eventType.includes('subscription') && !eventType.includes('preapproval')) {
      return res.status(200).json({ ok: true })
    }

    const detail = await mpRequest('GET', `/preapproval/${dataId}`, null)
    if (detail.status >= 200 && detail.status < 300 && detail.data?.id) {
      const statusRaw = String(detail.data.status || '').toLowerCase()
      const status = ['authorized', 'paused', 'cancelled'].includes(statusRaw) ? statusRaw : statusRaw || 'unknown'
      const extRef = String(detail.data.external_reference || '')
      const [userId, iglesiaId] = extRef.split('|')
      if (userId && iglesiaId) {
        const existingId = await updatePaymentBySubscription(String(detail.data.id), status, { webhook: req.body || {}, extRef })
        if (!existingId) {
          await savePaymentRow({
            userId: Number(userId),
            iglesiaId: Number(iglesiaId),
            platform: 'mercadopago',
            subscriptionId: String(detail.data.id),
            planName: String(detail.data.reason || 'UNKNOWN'),
            amount: Number(detail.data.auto_recurring?.transaction_amount || 0),
            currency: String(detail.data.auto_recurring?.currency_id || 'ARS'),
            status,
            metadata: { webhook: req.body || {}, extRef },
          })
        }
      }
      logger.info({ subscriptionId: detail.data.id, status }, 'MercadoPago webhook processed')
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error({ err: err.message }, 'MercadoPago webhook failed')
    return res.status(500).json({ ok: false })
  }
})

router.post('/payments/paypal/webhook', async (req, res) => {
  try {
    const verified = await verifyPayPalWebhook(req)
    if (!verified) return res.status(401).json({ ok: false, error: 'Invalid webhook signature' })

    const evt = String(req.body?.event_type || '')
    const subscriptionId = req.body?.resource?.id
      || req.body?.resource?.billing_agreement_id
      || req.body?.resource?.supplementary_data?.related_ids?.subscription_id

    if (!subscriptionId) return res.status(200).json({ ok: true })

    let status = null
    if (evt === 'BILLING.SUBSCRIPTION.ACTIVATED' || evt === 'PAYMENT.SALE.COMPLETED') status = 'authorized'
    if (evt === 'BILLING.SUBSCRIPTION.CANCELLED') status = 'cancelled'
    if (!status) return res.status(200).json({ ok: true })

    await updatePaymentBySubscription(String(subscriptionId), status, { webhook: req.body || {} })
    logger.info({ subscriptionId, event: evt, status }, 'PayPal webhook processed')
    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error({ err: err.message }, 'PayPal webhook failed')
    return res.status(500).json({ ok: false })
  }
})

export default router
