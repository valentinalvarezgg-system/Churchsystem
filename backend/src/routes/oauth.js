import { Router } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import logger from '../lib/logger.js'
import { pgExec, pgOne } from '../lib/pg.js'
import { sendNotificationEmail } from '../lib/email.js'
import { exchangeGoogleDriveCode, fetchGoogleUserInfo } from '../lib/google-drive.js'
import { readTenantConfig, upsertTenantConfig } from '../lib/tenant-config.js'
import { getPlanPrice, normalizeCountry, normalizeLanguage, normalizePlan, PLANES } from '../lib/billing.js'
import { issueOAuthBridge, issueSession } from '../lib/sessions.js'

const router = Router()
const SECRET     = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado')
  return process.env.JWT_SECRET
}
function resolveBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim()
  const host = (req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || 4000}`).split(',')[0].trim()
  return `${proto}://${host}`
}

function resolveFrontUrl(req) {
  return process.env.FRONTEND_URL || resolveBaseUrl(req)
}

function normalizeHttpUrl(raw = '') {
  try {
    const u = new URL(String(raw || '').trim())
    if (!['http:', 'https:'].includes(u.protocol)) return null
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

function safeBaseUrl(req) {
  const normalized = normalizeHttpUrl(resolveBaseUrl(req))
  if (!normalized) return null
  if (process.env.NODE_ENV === 'production' && normalized.startsWith('http://')) return null
  return normalized
}

function safeFrontUrl(req) {
  const normalized = normalizeHttpUrl(resolveFrontUrl(req))
  if (!normalized) return null
  if (process.env.NODE_ENV === 'production' && normalized.startsWith('http://')) return null
  return normalized
}

function decodeJwtPayload(token = '') {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function signedOAuthState(req, provider = 'google') {
  const countryInfo = normalizeCountry(req.query.country || 'AR')
  const idioma = normalizeLanguage(req.query.lang || '', countryInfo)
  const plan = normalizePlan(req.query.plan || 'FREE')
  const currency = String(req.query.currency || countryInfo.currency || 'USD').toUpperCase()
  return jwt.sign({
    purpose: 'oauth-signup',
    provider,
    plan,
    country: countryInfo.code,
    currency,
    lang: idioma,
    promo: String(req.query.promo || '').trim().toUpperCase().slice(0, 40),
  }, SECRET(), { expiresIn: '15m' })
}

function readOAuthState(raw = '') {
  try {
    const decoded = jwt.verify(String(raw || ''), SECRET())
    if (decoded?.purpose !== 'oauth-signup') return {}
    const countryInfo = normalizeCountry(decoded.country || 'AR')
    return {
      plan: normalizePlan(decoded.plan || 'FREE'),
      country: countryInfo.code,
      currency: String(decoded.currency || countryInfo.currency || 'USD').toUpperCase(),
      lang: normalizeLanguage(decoded.lang || '', countryInfo),
      promo: String(decoded.promo || '').trim().toUpperCase().slice(0, 40),
    }
  } catch {
    return {}
  }
}

function randomIglesiaToken() {
  return `IGL-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
}

async function requiresSetupForUser(user) {
  if (!user?.iglesiaId || user?.rol !== 'PASTOR_GENERAL') return false
  const cfg = await pgOne(
    `SELECT
       MAX(CASE WHEN "clave"='setup_completado' THEN "valor" END) AS "setupCompletado",
       MAX(CASE WHEN "clave"='onboarding_billing_confirmed' THEN "valor" END) AS "billingConfirmed",
       MAX(CASE WHEN "clave"='onboarding_plan' THEN "valor" END) AS "onboardingPlan",
       MAX(CASE WHEN "clave"='nombre_iglesia' THEN "valor" END) AS "nombreIglesia"
     FROM "Configuracion"
     WHERE "iglesiaId"=$1`,
    [user.iglesiaId]
  ).catch(() => null)
  const completado = cfg?.setupCompletado === '1' || cfg?.setupCompletado === true
  const billingOk = cfg?.billingConfirmed === '1' || cfg?.billingConfirmed === true
  const hasOnboardingState = typeof cfg?.billingConfirmed !== 'undefined' && cfg?.billingConfirmed !== null
    || typeof cfg?.onboardingPlan !== 'undefined' && cfg?.onboardingPlan !== null
  const tieneNombre = !!String(cfg?.nombreIglesia || '').trim()
  const onboardingPlan = normalizePlan(cfg?.onboardingPlan || user.plan || 'FREE')
  const planRequiresBilling = onboardingPlan !== 'FREE'
  return !completado || !tieneNombre || (hasOnboardingState && planRequiresBilling && !billingOk)
}

async function findOrCreateOAuthUser({ provider, providerId, email, nombre = '', emailVerified = true, context = {}, frontUrl = process.env.FRONTEND_URL || process.env.BASE_URL || '' }) {
  const normalizedEmail = String(email || '').toLowerCase()
  let user = await pgOne('SELECT * FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [normalizedEmail])
  let createdNow = false

  if (!user) {
    const countryInfo = normalizeCountry(context.country || 'AR')
    const selectedIdioma = normalizeLanguage(context.lang || '', countryInfo)
    const selectedPlanKey = normalizePlan(context.plan || 'FREE')
    const selectedCurrency = String(context.currency || countryInfo.currency || 'USD').toUpperCase()
    const price = getPlanPrice(selectedPlanKey, selectedCurrency)
    const trialFin = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const role = await pgOne(
      `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
       VALUES ('PASTOR_GENERAL','Pastor General',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
       RETURNING id`
    )
    const iglesia = await pgOne(
      'INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',
      ['Mi Iglesia', randomIglesiaToken()]
    )
    await pgExec(`ALTER TABLE "Iglesia" ADD COLUMN IF NOT EXISTS trial_hasta TIMESTAMPTZ`, []).catch(() => {})
    await pgExec(
      `UPDATE "Iglesia" SET trial_hasta = NOW() + INTERVAL '30 days', "updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`,
      [iglesia.id]
    )
    for (const [clave, valor] of [
      ['trial_inicio', new Date().toISOString().slice(0, 10)],
      ['trial_fin', trialFin],
      ['onboarding_plan', selectedPlanKey],
      ['onboarding_billing_confirmed', '0'],
      ['setup_completado', '0'],
    ]) {
      await pgExec(
        `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
         VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
        [iglesia.id, clave, valor]
      )
    }
    await pgOne(
      `INSERT INTO "User"
        ("nombre","email","password","rol","activo","emailVerificado","plan","expira","oauth_provider","oauth_id","iglesiaId","rolId","pais","divisa","idioma","promoCode","createdAt","updatedAt")
       VALUES
        ($1,$2,$3,'PASTOR_GENERAL',true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        nombre || normalizedEmail,
        normalizedEmail,
        '',
        !!emailVerified,
        selectedPlanKey,
        new Date(Date.now() + 30 * 86400000).toISOString(),
        provider,
        providerId,
        iglesia.id,
        role.id,
        countryInfo.code,
        price.currency,
        selectedIdioma,
        context.promo || '',
      ]
    )
    user = await pgOne('SELECT * FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [normalizedEmail])
    createdNow = true
    const planInfo = PLANES[selectedPlanKey]
    await sendNotificationEmail({
      to: normalizedEmail,
      subject: 'Registro exitoso - Church System',
      title: 'Tu cuenta fue creada',
      intro: `Hola ${nombre || 'Pastor'}, ya tenes tu cuenta de Church System activa.`,
      lines: [
        'El inicio de sesion se realizo con proveedor externo.',
        `Proveedor: ${provider}`,
        `Plan: ${planInfo?.label?.[selectedIdioma] || selectedPlanKey}`,
        'Trial: 30 dias',
      ],
      actionUrl: `${frontUrl}/app`,
    }).catch(() => {})
  } else {
    await pgExec(
      'UPDATE "User" SET "emailVerificado"=$1, "oauth_provider"=$2, "oauth_id"=$3, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4',
      [emailVerified ? true : !!user.emailVerificado, provider, providerId, user.id]
    )
    user = await pgOne('SELECT * FROM "User" WHERE "id"=$1 LIMIT 1', [user.id])
  }

  return { user, createdNow }
}

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const front = safeFrontUrl(req)
  const base = safeBaseUrl(req)
  if (!clientId || !front || !base) return res.redirect(`${resolveFrontUrl(req)}/app/login?error=oauth_not_configured`)

  const redirectUri = `${base}/oauth/google/callback`
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'select_account',
    state:         signedOAuthState(req, 'google'),
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

router.get('/google/drive', (req, res) => {
  const front = safeFrontUrl(req) || resolveFrontUrl(req)
  return res.redirect(`${front}/app/configuracion?sec=integraciones&error=drive_use_config_button`)
})

router.get('/google/drive/callback', async (req, res) => {
  const { code, state } = req.query || {}
  const fallbackFront = safeFrontUrl(req) || resolveFrontUrl(req)
  if (!code || !state) return res.redirect(`${fallbackFront}/app/configuracion?sec=integraciones&error=drive_failed`)

  try {
    const decoded = jwt.verify(String(state), SECRET())
    if (decoded?.purpose !== 'google-drive-connect' || !decoded.iglesiaId) {
      return res.redirect(`${decoded?.frontUrl || fallbackFront}/app/configuracion?sec=integraciones&error=drive_failed`)
    }

    const base = safeBaseUrl(req)
    const redirectUri = base ? `${base}/oauth/google/drive/callback` : ''
    const tokens = await exchangeGoogleDriveCode({ code: String(code), redirectUri })
    const profile = await fetchGoogleUserInfo(tokens.access_token)

    const iglesiaId = Number(decoded.iglesiaId)
    const existing = await readTenantConfig(iglesiaId)
    await upsertTenantConfig(iglesiaId, {
      google_drive_refresh_token: tokens.refresh_token || existing.google_drive_refresh_token || '',
      google_drive_access_token: tokens.access_token,
      google_drive_token_expires_at: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : new Date(Date.now() + 3600 * 1000).toISOString(),
      google_drive_email: profile.email || profile.hd || '',
      google_drive_status: 'connected',
      google_drive_scopes: tokens.scope || 'https://www.googleapis.com/auth/drive.readonly',
      google_drive_connected_at: new Date().toISOString(),
    })

    return res.redirect(`${decoded.frontUrl || fallbackFront}/app/configuracion?sec=integraciones&drive=connected`)
  } catch (err) {
    logger.error({ err: err?.message }, 'Google Drive OAuth error')
    return res.redirect(`${fallbackFront}/app/configuracion?sec=integraciones&error=drive_failed`)
  }
})

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query
  const front = safeFrontUrl(req) || resolveFrontUrl(req)
  const base = safeBaseUrl(req)
  if (!code) return res.redirect(`${front}/app/login?error=no_code`)

  try {
    const clientId     = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri  = base ? `${base}/oauth/google/callback` : null
    if (!clientId || !clientSecret || !redirectUri) return res.redirect(`${front}/app/login?error=oauth_not_configured`)

    // Intercambiar code por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id:clientId, client_secret:clientSecret, redirect_uri:redirectUri, grant_type:'authorization_code' }),
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      logger.error({ tokens, status: tokenRes.status }, 'OAuth error')
      return res.redirect(`${front}/app/login?error=no_token`)
    }

    // Obtener info del usuario
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = await infoRes.json()
    if (!info.email) return res.redirect(`${front}/app/login?error=oauth_failed`)

    const { user, createdNow } = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: info.id,
      email: info.email,
      nombre: info.name || info.given_name || '',
      emailVerified: true,
      context: readOAuthState(state),
      frontUrl: front,
    })

    if (!user.activo) return res.redirect(`${front}/app/login?error=account_disabled`)

    const session = await issueSession(user, req, res)
    const needsSetup = createdNow || await requiresSetupForUser(user)
    const setup = needsSetup ? '&setup=1' : ''
    let bridge = ''
    try {
      bridge = await issueOAuthBridge(session.sessionId, user.id)
    } catch (bridgeErr) {
      logger.error({ err: bridgeErr?.message, userId: user.id }, 'OAuth Google bridge error')
    }
    const bridgeQuery = bridge ? `&bridge=${encodeURIComponent(bridge)}` : ''
    res.redirect(`${front}/app/login?oauth=1${setup}${bridgeQuery}`)

  } catch(err) {
    logger.error({ err: err?.message }, 'OAuth Google error')
    res.redirect(`${front}/app/login?error=oauth_failed`)
  }
})

// ── Apple OAuth ───────────────────────────────────────────────────────────────
function appleClientSecret() {
  const clientId = process.env.APPLE_CLIENT_ID
  const teamId = process.env.APPLE_TEAM_ID
  const keyId = process.env.APPLE_KEY_ID
  const privateKey = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!clientId || !teamId || !keyId || !privateKey) return null
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: 'https://appleid.apple.com',
    issuer: teamId,
    subject: clientId,
    keyid: keyId,
  })
}

router.get('/apple', (req, res) => {
  const clientId = process.env.APPLE_CLIENT_ID
  const front = safeFrontUrl(req)
  const base = safeBaseUrl(req)
  if (!clientId || !appleClientSecret())
    return res.redirect(`${resolveFrontUrl(req)}/app/login?error=apple_not_configured`)

  const redirectUri = process.env.APPLE_REDIRECT_URI || (base ? `${base}/oauth/apple/callback` : '')
  if (!front || !redirectUri) return res.redirect(`${resolveFrontUrl(req)}/app/login?error=apple_not_configured`)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state: signedOAuthState(req, 'apple'),
  })
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`)
})

router.post('/apple/callback', async (req, res) => {
  const { code, id_token, state } = req.body || {}
  const frontUrl = safeFrontUrl(req) || resolveFrontUrl(req)
  const baseUrl = safeBaseUrl(req)
  if (!code && !id_token) return res.redirect(`${frontUrl}/app/login?error=no_code`)

  try {
    const clientId = process.env.APPLE_CLIENT_ID
    const clientSecret = appleClientSecret()
    const redirectUri = process.env.APPLE_REDIRECT_URI || (baseUrl ? `${baseUrl}/oauth/apple/callback` : '')
    if (!clientId || !clientSecret || !redirectUri) return res.redirect(`${frontUrl}/app/login?error=apple_not_configured`)

    let idToken = id_token
    if (code) {
      const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      })
      const tokens = await tokenRes.json()
      idToken = tokens.id_token || idToken
      if (!tokenRes.ok || !idToken) {
        logger.error({ tokens }, 'Apple OAuth error')
        return res.redirect(`${frontUrl}/app/login?error=no_token`)
      }
    }

    const info = decodeJwtPayload(idToken)
    if (!info?.email || info.aud !== clientId)
      return res.redirect(`${frontUrl}/app/login?error=oauth_failed`)

    const { user, createdNow } = await findOrCreateOAuthUser({
      provider: 'apple',
      providerId: info.sub,
      email: info.email,
      nombre: info.email.split('@')[0],
      emailVerified: info.email_verified === true || info.email_verified === 'true',
      context: readOAuthState(state),
      frontUrl,
    })

    if (!user.activo) return res.redirect(`${frontUrl}/app/login?error=account_disabled`)
    const session = await issueSession(user, req, res)
    const needsSetup = createdNow || await requiresSetupForUser(user)
    const setup = needsSetup ? '&setup=1' : ''
    let bridge = ''
    try {
      bridge = await issueOAuthBridge(session.sessionId, user.id)
    } catch (bridgeErr) {
      logger.error({ err: bridgeErr?.message, userId: user.id }, 'OAuth Apple bridge error')
    }
    const bridgeQuery = bridge ? `&bridge=${encodeURIComponent(bridge)}` : ''
    res.redirect(`${frontUrl}/app/login?oauth=1${setup}${bridgeQuery}`)
  } catch (err) {
    logger.error({ err: err?.message }, 'OAuth Apple error')
    res.redirect(`${frontUrl}/app/login?error=oauth_failed`)
  }
})

export default router
