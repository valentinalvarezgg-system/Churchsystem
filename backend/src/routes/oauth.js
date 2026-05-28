import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../lib/db.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()
const SECRET     = () => process.env.JWT_SECRET || 'dev'
const BASE_URL   = () => process.env.BASE_URL || 'http://localhost:4000'
const FRONT_URL  = () => process.env.FRONTEND_URL || BASE_URL()

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

async function findOrCreateOAuthUser({ provider, providerId, email, nombre = '', emailVerified = true }) {
  const normalizedEmail = String(email || '').toLowerCase()
  let user = db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail])

  if (!user) {
    const expira = new Date(Date.now() + 14 * 86400000).toISOString()
    const result = db.run(
      `INSERT INTO users (nombre, email, password, rol, activo, emailVerificado, plan, expira, oauth_provider, oauth_id)
       VALUES (?,?,?,?,1,?,?,?, ?, ?)`,
      [nombre || normalizedEmail, normalizedEmail, '', 'PASTOR_GENERAL', emailVerified ? 1 : 0, 'GENERAL', expira, provider, providerId]
    )
    user = db.get('SELECT * FROM users WHERE id = ?', [result.lastID])
    await sendNotificationEmail({
      to: normalizedEmail,
      subject: 'Registro exitoso - Church System',
      title: 'Tu cuenta fue creada',
      intro: `Hola ${nombre || 'Pastor'}, ya tenes tu cuenta de Church System activa.`,
      lines: ['El inicio de sesion se realizo con proveedor externo.', `Proveedor: ${provider}`],
      actionUrl: `${FRONT_URL()}/app`,
    }).catch(() => {})
  } else {
    db.run(
      'UPDATE users SET emailVerificado=?, oauth_provider=?, oauth_id=? WHERE id=?',
      [emailVerified ? 1 : user.emailVerificado, provider, providerId, user.id]
    )
    user = db.get('SELECT * FROM users WHERE id = ?', [user.id])
  }

  return user
}

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.redirect(`${FRONT_URL()}/app/login?error=oauth_not_configured`)

  const redirectUri = `${BASE_URL()}/oauth/google/callback`
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
  if (!code) return res.redirect(`${FRONT_URL()}/app/login?error=no_code`)

  try {
    const clientId     = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri  = `${BASE_URL()}/oauth/google/callback`

    // Intercambiar code por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id:clientId, client_secret:clientSecret, redirect_uri:redirectUri, grant_type:'authorization_code' }),
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      console.error('OAuth error:', tokens)
      return res.redirect(`${FRONT_URL()}/app/login?error=no_token`)
    }

    // Obtener info del usuario
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const info = await infoRes.json()
    if (!info.email) return res.redirect(`${FRONT_URL()}/app/login?error=oauth_failed`)

    const user = await findOrCreateOAuthUser({
      provider: 'google',
      providerId: info.id,
      email: info.email,
      nombre: info.name || info.given_name || '',
      emailVerified: true,
    })

    if (!user.activo) return res.redirect(`${FRONT_URL()}/app/login?error=account_disabled`)

    const token = signSession(user)
    res.redirect(`${FRONT_URL()}/app/login?token=${token}`)

  } catch(err) {
    console.error('OAuth Google error:', err)
    res.redirect(`${FRONT_URL()}/app/login?error=oauth_failed`)
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

router.get('/apple', (_req, res) => {
  const clientId = process.env.APPLE_CLIENT_ID
  if (!clientId || !appleClientSecret())
    return res.redirect(`${FRONT_URL()}/app/login?error=apple_not_configured`)

  const redirectUri = process.env.APPLE_REDIRECT_URI || `${BASE_URL()}/oauth/apple/callback`
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
  if (!code && !id_token) return res.redirect(`${FRONT_URL()}/app/login?error=no_code`)

  try {
    const clientId = process.env.APPLE_CLIENT_ID
    const clientSecret = appleClientSecret()
    const redirectUri = process.env.APPLE_REDIRECT_URI || `${BASE_URL()}/oauth/apple/callback`
    if (!clientId || !clientSecret) return res.redirect(`${FRONT_URL()}/app/login?error=apple_not_configured`)

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
        console.error('Apple OAuth error:', tokens)
        return res.redirect(`${FRONT_URL()}/app/login?error=no_token`)
      }
    }

    const info = decodeJwtPayload(idToken)
    if (!info?.email || info.aud !== clientId)
      return res.redirect(`${FRONT_URL()}/app/login?error=oauth_failed`)

    const user = await findOrCreateOAuthUser({
      provider: 'apple',
      providerId: info.sub,
      email: info.email,
      nombre: info.email.split('@')[0],
      emailVerified: info.email_verified === true || info.email_verified === 'true',
    })

    if (!user.activo) return res.redirect(`${FRONT_URL()}/app/login?error=account_disabled`)
    const token = signSession(user)
    res.redirect(`${FRONT_URL()}/app/login?token=${token}`)
  } catch (err) {
    console.error('OAuth Apple error:', err)
    res.redirect(`${FRONT_URL()}/app/login?error=oauth_failed`)
  }
})

export default router
