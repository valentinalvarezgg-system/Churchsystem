import { Router } from 'express'
import https from 'https'
import crypto from 'crypto'
import logger from '../lib/logger.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { COMMERCIAL_PLANS, getCommercialPlan, normalizePlan } from '../lib/billing.js'
import { montoARS, getCotizacion } from '../lib/pricing.js'
import { sendNotificationEmail, buildSystemEmail, sendSystemEmail } from '../lib/email.js'

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

function normalizeKnownPlan(raw = '') {
  const text = String(raw || '').trim()
  if (!text) return ''
  const direct = text.toUpperCase().replace(/\s+/g, '_')
  if (COMMERCIAL_PLANS[direct]) return direct

  const normalized = normalizePlan(text)
  const aliases = new Set([
    'lider',
    'culto',
    'consolidacion',
    'administracion',
    'general',
    'basico',
    'estandar',
    'pro',
    'starter',
    'max',
    'free',
    'church100',
    'church_100',
    'church500',
    'church_500',
    'church1000',
    'church_1000',
  ])
  return aliases.has(text.toLowerCase()) && COMMERCIAL_PLANS[normalized] ? normalized : ''
}

function detectPlanInText(raw = '') {
  const text = String(raw || '').toUpperCase()
  return Object.keys(COMMERCIAL_PLANS)
    .filter(plan => plan !== 'FREE')
    .sort((a, b) => b.length - a.length)
    .find(plan => text.includes(plan) || text.includes(plan.replace('_', ' '))) || ''
}

function planFromExternalReference(ref = '') {
  return normalizeKnownPlan(String(ref || '').split('|')[2]) || ''
}

function toIsoOrNull(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function ensureSubscriptionSchema() {
  if (schemaReadyPromise) return schemaReadyPromise
  schemaReadyPromise = (async () => {
    // Columna trial_hasta en Iglesia (idempotente)
    await pgExec(`ALTER TABLE "Iglesia" ADD COLUMN IF NOT EXISTS trial_hasta TIMESTAMPTZ`).catch(() => {})

    // Tabla de suscripciones recurrentes (fuente de verdad)
    await pgExec(`
      CREATE TABLE IF NOT EXISTS suscripciones (
        id              UUID        PRIMARY KEY,
        iglesia_id      INTEGER     NOT NULL REFERENCES "Iglesia"(id) ON DELETE CASCADE,
        proveedor       TEXT        NOT NULL DEFAULT 'mercadopago',
        preapproval_id  TEXT        UNIQUE,
        plan            TEXT        NOT NULL,
        estado          TEXT        NOT NULL DEFAULT 'pending',
        monto_usd       NUMERIC(10,2),
        monto_ars       NUMERIC(12,2),
        cotizacion      NUMERIC(10,2),
        proximo_cobro_at TIMESTAMPTZ,
        gracia_hasta    TIMESTAMPTZ,
        last_event      TEXT,
        creado_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await pgExec(`CREATE INDEX IF NOT EXISTS idx_suscripciones_iglesia ON suscripciones(iglesia_id)`)
    await pgExec(`CREATE INDEX IF NOT EXISTS idx_suscripciones_estado  ON suscripciones(estado)`)

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

    const defaults = Object.values(COMMERCIAL_PLANS)
      .filter(plan => !plan.free)
      .map(plan => [plan.key, plan.labels.es, Number(plan.prices.ARS || 0), Number(plan.prices.USD || 0)])
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

async function syncSubscriptionRecord({
  iglesiaId,
  proveedor,
  subscriptionId,
  plan,
  estado = 'pending',
  amountUsd = null,
  amountArs = null,
  cotizacion = null,
  proximoCobro = null,
  graciaHasta = null,
  lastEvent = null,
}) {
  await ensureSubscriptionSchema()
  const planKey = normalizeKnownPlan(plan) || normalizePlan(plan || 'PRO')
  await pgExec(
    `INSERT INTO suscripciones
       (id, iglesia_id, proveedor, preapproval_id, plan, estado, monto_usd, monto_ars, cotizacion,
        proximo_cobro_at, gracia_hasta, last_event, creado_at, actualizado_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT (preapproval_id) DO UPDATE
       SET iglesia_id=$2,
           proveedor=$3,
           plan=$5,
           estado=$6,
           monto_usd=COALESCE($7, suscripciones.monto_usd),
           monto_ars=COALESCE($8, suscripciones.monto_ars),
           cotizacion=COALESCE($9, suscripciones.cotizacion),
           proximo_cobro_at=$10,
           gracia_hasta=$11,
           last_event=COALESCE($12, suscripciones.last_event),
           actualizado_at=CURRENT_TIMESTAMP`,
    [
      crypto.randomUUID(),
      iglesiaId,
      proveedor,
      String(subscriptionId || ''),
      planKey,
      String(estado || 'pending').toLowerCase(),
      amountUsd,
      amountArs,
      cotizacion,
      toIsoOrNull(proximoCobro),
      toIsoOrNull(graciaHasta),
      lastEvent,
    ]
  )
  return planKey
}

export async function getBillingEstadoSummary(iglesiaId) {
  await ensureSubscriptionSchema()

  const rows = await pgMany(
    `SELECT "clave","valor" FROM "Configuracion"
      WHERE "iglesiaId"=$1
        AND "clave" IN ('trial_inicio','trial_fin','suscripcion_activa','plan','suscripcion_vence','plan_pendiente','checkout_reference')`,
    [iglesiaId]
  )
  const cfg  = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
  const hoy  = new Date().toISOString().slice(0, 10)

  const enTrial    = !!(cfg.trial_fin && hoy <= cfg.trial_fin)
  const diasTrial  = cfg.trial_fin
    ? Math.max(0, Math.ceil((new Date(cfg.trial_fin) - new Date()) / 86400000))
    : 0
  const suscActiva = cfg.suscripcion_activa === '1' && !!(cfg.suscripcion_vence && hoy <= cfg.suscripcion_vence)

  const activeSus = await pgOne(
    `SELECT id, preapproval_id, proveedor, plan, estado, monto_usd, monto_ars, proximo_cobro_at, gracia_hasta
       FROM suscripciones
      WHERE iglesia_id=$1
        AND lower(estado) IN ('authorized','active')
      ORDER BY actualizado_at DESC, creado_at DESC
      LIMIT 1`,
    [iglesiaId]
  ).catch(() => null)

  const graceSus = activeSus || await pgOne(
    `SELECT id, preapproval_id, proveedor, plan, estado, monto_usd, monto_ars, proximo_cobro_at, gracia_hasta
       FROM suscripciones
      WHERE iglesia_id=$1
        AND gracia_hasta IS NOT NULL
      ORDER BY gracia_hasta DESC, actualizado_at DESC
      LIMIT 1`,
    [iglesiaId]
  ).catch(() => null)

  const pendingSus = await pgOne(
    `SELECT id, preapproval_id, proveedor, plan, estado, monto_usd, monto_ars, proximo_cobro_at, gracia_hasta
       FROM suscripciones
      WHERE iglesia_id=$1
        AND lower(estado) IN ('pending','approval_pending','created')
      ORDER BY actualizado_at DESC, creado_at DESC
      LIMIT 1`,
    [iglesiaId]
  ).catch(() => null)

  const enGracia   = !!(graceSus?.gracia_hasta && new Date(graceSus.gracia_hasta) > new Date())
  const diasGracia = graceSus?.gracia_hasta
    ? Math.max(0, Math.ceil((new Date(graceSus.gracia_hasta) - new Date()) / 86400000))
    : 0
  const paidPlan = activeSus?.plan || (suscActiva ? cfg.plan : null)
  const gracePlan = graceSus?.plan || cfg.plan || 'FREE'
  const pendingPlan = pendingSus?.plan || cfg.plan_pendiente || null

  let efectivePlan = 'FREE'
  if (enTrial) efectivePlan = 'PRO'
  else if (suscActiva) efectivePlan = paidPlan || 'FREE'
  else if (enGracia) efectivePlan = gracePlan || 'FREE'

  const [montoProInfo, montoMaxInfo] = await Promise.all([
    montoARS('PRO').catch(() => ({ usd: 12, ars: 14400, cotizacion: 1200 })),
    montoARS('MAX').catch(() => ({ usd: 25, ars: 30000, cotizacion: 1200 })),
  ])

  return {
    ok:            true,
    enTrial,
    diasTrial,
    trialInicio:   cfg.trial_inicio || null,
    trialFin:      cfg.trial_fin    || null,
    suscActiva,
    suscVence:     cfg.suscripcion_vence || null,
    planPago:      paidPlan || null,
    preapprovalId: activeSus?.preapproval_id || null,
    proveedor:     activeSus?.proveedor || null,
    estadoSus:     activeSus?.estado || (suscActiva ? 'authorized' : null),
    proximoCobro:  activeSus?.proximo_cobro_at || null,
    planPendiente: pendingPlan,
    estadoPendiente: pendingSus?.estado || (cfg.plan_pendiente ? 'pending' : null),
    pendingPreapprovalId: pendingSus?.preapproval_id || null,
    checkoutReference: cfg.checkout_reference || null,
    enGracia,
    diasGracia,
    graciasHasta:  graceSus?.gracia_hasta || null,
    efectivePlan,
    montoPRO:      montoProInfo,
    montoMAX:      montoMaxInfo,
  }
}

export async function getOnboardingProgress(iglesiaId) {
  const [personas, grupos, cultos, comunicados, users] = await Promise.all([
    pgOne(`SELECT COUNT(*)::int AS n FROM "Persona"  WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "Grupo"    WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "Culto"    WHERE "iglesiaId"=$1`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "Mensaje"  WHERE "iglesiaId"=$1`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "User"     WHERE "iglesiaId"=$1 AND "activo"=true AND "deletedAt" IS NULL`, [iglesiaId]).catch(() => ({ n: 0 })),
  ])

  return {
    ok: true,
    personas:     Number(personas?.n || 0),
    grupos:       Number(grupos?.n   || 0),
    cultos:       Number(cultos?.n   || 0),
    comunicados:  Number(comunicados?.n || 0),
    users:        Number(users?.n    || 0),
  }
}

async function updatePaymentBySubscription(subscriptionId, nextStatus, metadataPatch = {}) {
  const current = await pgOne('SELECT * FROM payments WHERE subscription_id=$1 ORDER BY id DESC LIMIT 1', [subscriptionId])
  if (!current) return null
  const merged = { ...(current.metadata || {}), ...(metadataPatch || {}) }
  await pgExec(
    `UPDATE payments
        SET status=$2, metadata=$3::jsonb, updated_at=CURRENT_TIMESTAMP
      WHERE id=$1`,
    [current.id, nextStatus, JSON.stringify(merged)]
  )
  return { ...current, status: nextStatus, metadata: merged }
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
    const planName = normalizePlan(req.body?.planName || req.body?.plan || 'PRO')
    const frequency = asFrequency(req.body?.frequency)
    if (planName === 'FREE') {
      return res.status(400).json({ error: 'El plan Free no requiere checkout de suscripción.' })
    }
    const plan = await getPlan(planName, frequency)
    if (!plan) return res.status(404).json({ error: 'Plan de suscripción no encontrado.' })

    const baseUrl = resolvePublicUrl(req)
    if (!baseUrl) return res.status(503).json({ error: 'Falta URL pública para checkout.' })

    if (platform === 'mercadopago') {
      if (!MP_ACCESS_TOKEN) return res.status(503).json({ error: 'Falta MP_ACCESS_TOKEN.' })
      const payerEmail = String(req.user?.email || '').trim()
      if (!payerEmail) {
        return res.status(400).json({ error: 'Falta email del usuario para crear la suscripción en Mercado Pago.' })
      }
      const months = FREQUENCY_TO_MONTHS[frequency]
      const amount = Number(plan.price_ars || 0)
      const extRef = `${req.user.id}|${req.user.iglesiaId}|${planName}|${frequency}|${Date.now()}`
      const payload = {
        reason: `Church System ${planName} (${frequency})`,
        payer_email: payerEmail,
        external_reference: extRef,
        auto_recurring: {
          frequency: months,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'ARS',
        },
        back_url: `${baseUrl}/app/billing?pago=ok&metodo=mercadopago`,
        notification_url: `${baseUrl}/payments/mercadopago/webhook${MP_WEBHOOK_SECRET ? `?secret=${encodeURIComponent(MP_WEBHOOK_SECRET)}` : ''}`,
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
      await syncSubscriptionRecord({
        iglesiaId: req.user.iglesiaId,
        proveedor: 'mercadopago',
        subscriptionId: createRes.data.id,
        plan: planName,
        estado: 'pending',
        amountArs: amount,
        proximoCobro: createRes.data.next_payment_date || null,
        lastEvent: `created:${createRes.data.status || 'pending'}`,
      })
      logger.info({ platform, planName, frequency, userId: req.user.id, subscriptionId: createRes.data.id }, 'Subscription created')
      return res.json({
        ok: true,
        platform: 'mercadopago',
        checkoutUrl: createRes.data.init_point || createRes.data.sandbox_init_point || '',
        checkout_url: createRes.data.init_point || createRes.data.sandbox_init_point || '',
        init_point: createRes.data.init_point || '',
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
        return_url: `${baseUrl}/app/billing?pago=ok&metodo=paypal`,
        cancel_url: `${baseUrl}/app/billing?pago=error&metodo=paypal`,
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
    await syncSubscriptionRecord({
      iglesiaId: req.user.iglesiaId,
      proveedor: 'paypal',
      subscriptionId: ppCreate.data.id,
      plan: planName,
      estado: 'pending',
      amountUsd: Number(plan.price_usd || 0),
      lastEvent: `created:${ppCreate.data.status || 'APPROVAL_PENDING'}`,
    })
    logger.info({ platform, planName, frequency, userId: req.user.id, subscriptionId: ppCreate.data.id }, 'Subscription created')
    return res.json({
      ok: true,
      platform: 'paypal',
      checkoutUrl: approve,
      approvalUrl: approve,
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
          WHEN 'CHURCH_100' THEN 4
          WHEN 'CHURCH_500' THEN 5
          WHEN 'CHURCH_1000' THEN 6
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
    personas: getCommercialPlan(r.name)?.personas || 99999,
    includedWhatsApp: getCommercialPlan(r.name)?.includedWhatsApp || 0,
    includedSms: getCommercialPlan(r.name)?.includedSms || 0,
    audience: getCommercialPlan(r.name)?.audience || 'church',
    accessTier: getCommercialPlan(r.name)?.accessTier || 'STARTER',
    mpPlanId: r.mp_plan_id || '',
    paypalPlanId: r.paypal_plan_id || '',
  }))
  return res.json({ ok: true, items })
})

router.get('/subscriptions/:userId(\\d+)', requireAuth, async (req, res) => {
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

async function handleMercadoPagoWebhook(req, res) {
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
      const planKey = planFromExternalReference(extRef) || detectPlanInText(detail.data.reason) || 'PRO'
      if (userId && iglesiaId) {
        const existingId = await updatePaymentBySubscription(String(detail.data.id), status, { webhook: req.body || {}, extRef })
        if (!existingId) {
          await savePaymentRow({
            userId: Number(userId),
            iglesiaId: Number(iglesiaId),
            platform: 'mercadopago',
            subscriptionId: String(detail.data.id),
            planName: planKey,
            amount: Number(detail.data.auto_recurring?.transaction_amount || 0),
            currency: String(detail.data.auto_recurring?.currency_id || 'ARS'),
            status,
            metadata: { webhook: req.body || {}, extRef },
          })
        }
      }
      // Sincronizar tabla suscripciones + activar/degradar plan
      if (userId && iglesiaId) {
        procesarWebhookSuscripcion(Number(iglesiaId), String(detail.data.id), detail.data).catch(err => {
          logger.warn({ err: err.message }, 'procesarWebhookSuscripcion error (non-fatal)')
        })
      }
      logger.info({ subscriptionId: detail.data.id, status }, 'MercadoPago webhook processed')
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error({ err: err.message }, 'MercadoPago webhook failed')
    return res.status(500).json({ ok: false })
  }
}

router.post('/payments/mercadopago/webhook', handleMercadoPagoWebhook)
router.post('/api/payments/mercadopago/webhook', handleMercadoPagoWebhook)

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

    const payment = await updatePaymentBySubscription(String(subscriptionId), status, { webhook: req.body || {} })
    if (payment?.iglesia_id) {
      const planKey = normalizeKnownPlan(payment.plan_name) || 'PRO'
      await syncSubscriptionRecord({
        iglesiaId: payment.iglesia_id,
        proveedor: 'paypal',
        subscriptionId: String(subscriptionId),
        plan: planKey,
        estado: status,
        amountUsd: Number(payment.amount || 0),
        proximoCobro: req.body?.resource?.billing_info?.next_billing_time || null,
        lastEvent: `paypal:${evt}:${status}`,
      })
      if (status === 'authorized') await activarPlan(payment.iglesia_id, planKey, req.body?.resource?.billing_info?.next_billing_time || null)
      if (status === 'cancelled') await degradarAFree(payment.iglesia_id)
    }
    logger.info({ subscriptionId, event: evt, status }, 'PayPal webhook processed')
    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error({ err: err.message }, 'PayPal webhook failed')
    return res.status(500).json({ ok: false })
  }
})

// ── Helpers internos para activar/degradar plan ───────────────
async function activarPlan(iglesiaId, plan, proximoCobro) {
  const planKey = normalizeKnownPlan(plan) || normalizePlan(plan || 'PRO')
  const planInfo = getCommercialPlan(planKey)
  const proximoCobroIso = toIsoOrNull(proximoCobro)
  const vence = proximoCobroIso
    ? proximoCobroIso.slice(0, 10)
    : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10) })()
  const updates = {
    plan:               planKey,
    plan_label:         planInfo?.labels?.es || planKey,
    plan_personas_max:  String(planInfo?.personas || 0),
    suscripcion_activa: '1',
    suscripcion_vence:  vence,
    ultimo_pago:        new Date().toISOString().slice(0, 10),
    plan_pendiente:     '',
    checkout_reference: '',
    onboarding_plan:    planKey,
    onboarding_billing_confirmed: '1',
  }
  for (const [k, v] of Object.entries(updates)) {
    await pgExec(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
      [iglesiaId, k, v]
    )
  }
}

async function degradarAFree(iglesiaId) {
  for (const [k, v] of [
    ['suscripcion_activa', '0'],
    ['plan', 'FREE'],
    ['plan_label', 'Free'],
    ['plan_personas_max', '50'],
    ['plan_pendiente', ''],
  ]) {
    await pgExec(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
      [iglesiaId, k, v]
    )
  }
}

async function getAdminEmail(iglesiaId) {
  const u = await pgOne(
    `SELECT email, nombre FROM "User"
      WHERE "iglesiaId"=$1 AND "rol"='PASTOR_GENERAL' AND "activo"=true AND "deletedAt" IS NULL
      ORDER BY id ASC LIMIT 1`,
    [iglesiaId]
  )
  return u
}

// ── POST /subscriptions/crear — Preapproval con ARS dinámico ──
router.post('/subscriptions/crear', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  await ensureSubscriptionSchema()
  if (!MP_ACCESS_TOKEN) return res.status(503).json({ error: 'Falta MP_ACCESS_TOKEN.' })

  const planKey = normalizePlan(String(req.body?.plan || 'PRO').toUpperCase())
  const commercialPlan = getCommercialPlan(planKey)
  if (!commercialPlan || commercialPlan.free) {
    return res.status(400).json({ error: 'Plan inválido o gratuito. Elegí un plan pago para iniciar checkout.' })
  }

  const payerEmail = String(req.user?.email || '').trim()
  if (!payerEmail) return res.status(400).json({ error: 'Email del usuario requerido.' })

  const baseUrl = resolvePublicUrl(req)
  if (!baseUrl) return res.status(503).json({ error: 'Falta URL pública para checkout.' })

  try {
    const { usd, ars, cotizacion } = await montoARS(planKey)
    const extRef = `${req.user.id}|${req.user.iglesiaId}|${planKey}|mensual|${Date.now()}`

    const createRes = await mpRequest('POST', '/preapproval', {
      reason:             `Church System ${planKey}`,
      payer_email:        payerEmail,
      external_reference: extRef,
      auto_recurring: {
        frequency:          1,
        frequency_type:     'months',
        transaction_amount: ars,
        currency_id:        'ARS',
      },
      back_url: `${baseUrl}/app/billing?pago=ok`,
      notification_url: `${baseUrl}/payments/mercadopago/webhook${MP_WEBHOOK_SECRET ? `?secret=${encodeURIComponent(MP_WEBHOOK_SECRET)}` : ''}`,
    })

    if (createRes.status < 200 || createRes.status >= 300 || !createRes.data?.id) {
      logger.error({ response: createRes.data }, 'MP preapproval crear error')
      return res.status(400).json({ error: createRes.data?.message || 'No se pudo crear suscripción en MP.' })
    }

    await pgExec(
      `INSERT INTO suscripciones (id, iglesia_id, preapproval_id, plan, estado, monto_usd, monto_ars, cotizacion)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7)
       ON CONFLICT (preapproval_id) DO UPDATE
         SET estado='pending', actualizado_at=CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), req.user.iglesiaId, createRes.data.id, planKey, usd, ars, cotizacion]
    )

    logger.info({ planKey, iglesiaId: req.user.iglesiaId, preapprovalId: createRes.data.id }, 'Suscripción creada')
    return res.json({
      ok:            true,
      preapprovalId: createRes.data.id,
      initPoint:     createRes.data.init_point || '',
      plan:          planKey,
      monto:         { usd, ars, cotizacion },
    })
  } catch (err) {
    logger.error({ err: err.message }, 'Error creando suscripción')
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /subscriptions/billing-estado — Estado unificado de billing ──
router.get('/subscriptions/billing-estado', requireAuth, async (req, res) => {
  const iglesiaId = req.user.iglesiaId
  res.json(await getBillingEstadoSummary(iglesiaId))
})

// ── GET /subscriptions/onboarding-progreso ───────────────────────
router.get('/subscriptions/onboarding-progreso', requireAuth, async (req, res) => {
  const iglesiaId = req.user.iglesiaId
  res.json(await getOnboardingProgress(iglesiaId))
})

// ── Webhook MP extendido: maneja preapproval + payment ────────────
// Nota: El webhook original en /payments/mercadopago/webhook sigue activo
// para la tabla payments. Esta nueva lógica sincroniza la tabla suscripciones
// y activa/degrada el plan de la iglesia.
async function procesarWebhookSuscripcion(iglesiaId, preapprovalId, mpData) {
  await ensureSubscriptionSchema()
  const statusRaw   = String(mpData.status || '').toLowerCase()
  const proximoCobro = mpData.next_payment_date || null

  const sus = await pgOne(
    `SELECT id, plan, estado, last_event, gracia_hasta FROM suscripciones WHERE preapproval_id=$1 LIMIT 1`,
    [preapprovalId]
  ).catch(() => null)

  // Idempotencia: saltar si ya procesamos este estado exacto
  const eventKey = `${statusRaw}:${proximoCobro || ''}`
  if (sus?.last_event === eventKey) return

  const planKey = normalizeKnownPlan(sus?.plan)
    || planFromExternalReference(mpData.external_reference)
    || detectPlanInText(mpData.reason)
    || 'PRO'

  if (statusRaw === 'authorized') {
    await syncSubscriptionRecord({
      iglesiaId,
      proveedor: 'mercadopago',
      subscriptionId: preapprovalId,
      plan: planKey,
      estado: 'authorized',
      amountArs: Number(mpData.auto_recurring?.transaction_amount || 0),
      proximoCobro,
      graciaHasta: null,
      lastEvent: eventKey,
    })
    await activarPlan(iglesiaId, planKey, proximoCobro)

    const admin = await getAdminEmail(iglesiaId).catch(() => null)
    if (admin?.email) {
      sendNotificationEmail({
        to:          admin.email,
        subject:     `¡Suscripción ${planKey} activada! — Church System`,
        title:       `Plan ${planKey} activo`,
        intro:       `Hola ${admin.nombre}, tu suscripción al plan ${planKey} fue autorizada correctamente.`,
        lines:       ['Tu iglesia ahora tiene acceso completo a todos los módulos del plan.'],
        actionUrl:   `${process.env.FRONTEND_URL || process.env.PUBLIC_URL || ''}/app`,
        actionLabel: 'Ir al panel',
      }).catch(() => {})
    }
    logger.info({ iglesiaId, planKey, preapprovalId }, 'Suscripción autorizada')

  } else if (['payment_in_process', 'pending'].includes(statusRaw)) {
    // Pago pendiente en cobro recurrente → iniciar gracia si no hay
    if (!sus?.gracia_hasta || new Date(sus.gracia_hasta) < new Date()) {
      const graciaHasta = new Date(Date.now() + 7 * 86400000).toISOString()
      await syncSubscriptionRecord({
        iglesiaId,
        proveedor: 'mercadopago',
        subscriptionId: preapprovalId,
        plan: planKey,
        estado: 'pending',
        graciaHasta,
        lastEvent: eventKey,
      })
      const admin = await getAdminEmail(iglesiaId).catch(() => null)
      if (admin?.email) {
        sendNotificationEmail({
          to:          admin.email,
          subject:     'Pago fallido — 7 días de gracia — Church System',
          title:       'Hubo un problema con tu pago',
          intro:       `Hola ${admin.nombre}, no pudimos procesar el cobro de tu suscripción.`,
          lines:       ['Tenés 7 días para actualizar tu método de pago antes de perder el acceso.'],
          actionUrl:   `${process.env.FRONTEND_URL || process.env.PUBLIC_URL || ''}/app/billing`,
          actionLabel: 'Actualizar método de pago',
        }).catch(() => {})
      }
    }

  } else if (['cancelled', 'paused'].includes(statusRaw)) {
    await syncSubscriptionRecord({
      iglesiaId,
      proveedor: 'mercadopago',
      subscriptionId: preapprovalId,
      plan: planKey,
      estado: statusRaw,
      graciaHasta: sus?.gracia_hasta || null,
      lastEvent: eventKey,
    })
    // Si no hay gracia activa, degradar a FREE
    const graciaActiva = sus?.gracia_hasta && new Date(sus.gracia_hasta) > new Date()
    if (!graciaActiva) {
      await degradarAFree(iglesiaId)
      const admin = await getAdminEmail(iglesiaId).catch(() => null)
      if (admin?.email) {
        sendNotificationEmail({
          to:          admin.email,
          subject:     'Suscripción cancelada — Church System',
          title:       'Tu suscripción fue cancelada',
          intro:       `Hola ${admin.nombre}, tu plan fue cambiado al plan gratuito.`,
          lines:       ['Podés volver a suscribirte en cualquier momento desde Configuración → Facturación.'],
          actionUrl:   `${process.env.FRONTEND_URL || process.env.PUBLIC_URL || ''}/app/billing`,
          actionLabel: 'Ver planes',
        }).catch(() => {})
      }
    }
    logger.info({ iglesiaId, status: statusRaw, preapprovalId }, 'Suscripción cancelada/pausada')
  }
}

export default router
