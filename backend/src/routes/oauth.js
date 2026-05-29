import { Router } from 'express'
import jwt from 'jsonwebtoken'
import pino from 'pino'
import { pgExec, pgOne } from '../lib/pg.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
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

function decodeJwtPayload(token = '') {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function signSession(user) {
  const payload = {
    id: user.id,
    email: user.email,
    rol: user.rol,
    nombre: user.nombre,
    cultoDia: user.cultoDia,
    cultoTurno: user.cultoTurno,
    plan: user.plan || 'GENERAL',
    iglesiaId: user.iglesiaId || null,
    pais: user.pais || 'AR',
    divisa: user.divisa || 'ARS',
    idioma: user.idioma || 'es',
  }
  return jwt.sign(payload, SECRET(), { expiresIn: '8h' })
}

async function findOrCreateOAuthUser({ provider, providerId, email, nombre = '', emailVerified = true, frontUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:4000' }) {
  const normalizedEmail = String(email || '').toLowerCase()
  let user = await pgOne('SELECT * FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [normalizedEmail])

  if (!user) {
    const role = await pgOne(
      `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
       VALUES ('PASTOR_GENERAL','Pastor General',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
       RETURNING id`
    )
    const iglesia = await pgOne(
      'INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',
      ['Mi Iglesia', `IGL-${Date.now()}`]
    )
    const expira = new Date(Date.now() + 14 * 86400000).toISOString()
    await pgOne(
      `INSERT INTO "User"
        ("nombre","email","password","rol","activo","emailVerificado","plan","expira","oauth_provider","oauth_id","iglesiaId","rolId","createdAt","updatedAt")
       VALUES
        ($1,$2,$3,'PASTOR_GENERAL',true,$4,'GENERAL',$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING id`,
      [nombre || normalizedEmail, normalizedEmail, '', !!emailVerified, expira, provider, providerId, iglesia.id, role.id]
    )
    user = await pgOne('SELECT * FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [normalizedEmail])
    await sendNotificationEmail({
      to: normalizedEmail,
      subject: 'Registro exitoso - Church System',
      title: 'Tu cuenta fue creada',
      intro: `Hola ${nombre || 'Pastor'}, ya tenes tu cuenta de Church System activa.`,
      lines: ['El inicio de sesion se realizo con proveedor externo.', `Proveedor: ${provider}`],
      actionUrl: `${frontUrl}/app`,
    }).catch(() => {})
  } else {
    await pgExec(
      'UPDATE "User" SET "emailVerificado"=$1, "oauth_provider"=$2, "oauth_id"=$3, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4',
      [emailVerified ? true : !!user.emailVerificado, provider, providerId, user.id]
    )
    user = await pgOne('SELECT * FROM "User" WHERE "id"=$1 LIMIT 1', [user.id])
  }

  return user
}

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.redirect(`${resolveFrontUrl(req)}/app/login?error=oauth_not_configured`)

  const redirectUri = `${resolveBaseUrl(req)}/oauth/google/callback`
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'select_account',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

router.get('/google/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.redirect(`${resolveFrontUrl(req)}/app/login?error=no_code`)

  try {
    const clientId     = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri  = `${resolveBaseUrl(req)}/oauth/google/callback`
    if (!clientId || !clientSecret) return res.redirect(`${resolveFrontUrl(req)}/app/login?error=oauth_not_configured`)

    // Intercambiar code por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id:clientId, client_secret:clientSecret, redirect_uri:redirectUri, grant_type:'authorization_code' }),
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      logger.error({ tokens, status: tokenRes.status }, 'OAuth error')
      return res.redirect(`${resolveFrontUrl(req)}/app/login?error=no_token`)
    }

    // Obtener info del usuario
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = await infoRes.json()
    if (!info.email) return res.redirect(`${resolveFrontUrl(req)}/app/login?error=oauth_failed`)

    const user = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: info.id,
      email: info.email,
      nombre: info.name || info.given_name || '',
      emailVerified: true,
      frontUrl: resolveFrontUrl(req),
    })

    if (!user.activo) return res.redirect(`${resolveFrontUrl(req)}/app/login?error=account_disabled`)

    const token = signSession(user)
    res.redirect(`${resolveFrontUrl(req)}/app/login?token=${token}`)

  } catch(err) {
    logger.error({ err: err?.message }, 'OAuth Google error')
    res.redirect(`${resolveFrontUrl(req)}/app/login?error=oauth_failed`)
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
  if (!clientId || !appleClientSecret())
    return res.redirect(`${resolveFrontUrl(req)}/app/login?error=apple_not_configured`)

  const redirectUri = process.env.APPLE_REDIRECT_URI || `${resolveBaseUrl(req)}/oauth/apple/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
  })
  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`)
})

router.post('/apple/callback', async (req, res) => {
  const { code, id_token } = req.body || {}
  const frontUrl = resolveFrontUrl(req)
  const baseUrl = resolveBaseUrl(req)
  if (!code && !id_token) return res.redirect(`${frontUrl}/app/login?error=no_code`)

  try {
    const clientId = process.env.APPLE_CLIENT_ID
    const clientSecret = appleClientSecret()
    const redirectUri = process.env.APPLE_REDIRECT_URI || `${baseUrl}/oauth/apple/callback`
    if (!clientId || !clientSecret) return res.redirect(`${frontUrl}/app/login?error=apple_not_configured`)

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

    const user = await findOrCreateOAuthUser({
      provider: 'apple',
      providerId: info.sub,
      email: info.email,
      nombre: info.email.split('@')[0],
      emailVerified: info.email_verified === true || info.email_verified === 'true',
      frontUrl,
    })

    if (!user.activo) return res.redirect(`${frontUrl}/app/login?error=account_disabled`)
    const token = signSession(user)
    res.redirect(`${frontUrl}/app/login?token=${token}`)
  } catch (err) {
    logger.error({ err: err?.message }, 'OAuth Apple error')
    res.redirect(`${frontUrl}/app/login?error=oauth_failed`)
  }
})

export default router
