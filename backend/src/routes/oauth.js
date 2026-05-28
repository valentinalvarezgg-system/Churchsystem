import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../lib/db.js'

const router = Router()
const SECRET     = () => process.env.JWT_SECRET || 'fallback_secret'
const BASE_URL   = () => process.env.BASE_URL || 'http://localhost:4000'
const FRONT_URL  = () => process.env.FRONTEND_URL || BASE_URL()

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

    // Buscar o crear usuario
    let user = db.get('SELECT * FROM users WHERE email = ?', [info.email.toLowerCase()])

    if (!user) {
      const expira = new Date(Date.now() + 14 * 86400000).toISOString()
      const res = db.run(
        `INSERT INTO users (nombre, apellido, email, password, rol, activo, emailVerificado, plan, expira, oauth_provider, oauth_id)
         VALUES (?,?,?,?,?,1,1,'GENERAL',?,?,?)`,
        [info.given_name||info.name, info.family_name||'', info.email.toLowerCase(),
         '', 'PASTOR_GENERAL', expira, 'google', info.id]
      )
      user = db.get('SELECT * FROM users WHERE id = ?', [res.lastID])
    } else if (!user.emailVerificado) {
      // Auto-verificar si viene de Google
      db.run('UPDATE users SET emailVerificado = 1, oauth_provider = ?, oauth_id = ? WHERE id = ?',
        ['google', info.id, user.id])
      user = db.get('SELECT * FROM users WHERE id = ?', [user.id])
    }

    if (!user.activo) return res.redirect(`${FRONT_URL()}/app/login?error=account_disabled`)

    const payload = {
      id: user.id, email: user.email, rol: user.rol, nombre: user.nombre,
      cultoDia: user.cultoDia, cultoTurno: user.cultoTurno,
      plan: user.plan || 'GENERAL', iglesiaId: user.iglesiaId || null,
    }
    const token = jwt.sign(payload, SECRET(), { expiresIn: '8h' })
    res.redirect(`${FRONT_URL()}/app/login?token=${token}`)

  } catch(err) {
    console.error('OAuth Google error:', err)
    res.redirect(`${FRONT_URL()}/app/login?error=oauth_failed`)
  }
})

// ── Apple OAuth (skeleton — requiere Apple Developer) ────────────────────────
router.post('/apple/callback', async (req, res) => {
  res.redirect(`${FRONT_URL()}/app/login?error=apple_not_configured`)
})

export default router
