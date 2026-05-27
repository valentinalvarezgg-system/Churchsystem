import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../lib/db.js'

const router = Router()
const SECRET = () => process.env.JWT_SECRET || 'fallback_secret_change_in_production'

// OAuth Google
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(500).json({ error: 'Google OAuth no configurado' })
  
  const redirectUri = `${process.env.BASE_URL || 'http://localhost:4000'}/oauth/google/callback`
  const scope = 'openid email profile'
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`
  
  res.redirect(authUrl)
})

router.get('/google/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.redirect('/login?error=no_code')
  
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = `${process.env.BASE_URL || 'http://localhost:4000'}/oauth/google/callback`
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })
    
    const tokens = await tokenResponse.json()
    if (!tokens.access_token) return res.redirect('/login?error=no_token')
    
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    
    const userData = await userResponse.json()
    
    // Buscar o crear usuario
    let user = db.get('SELECT * FROM users WHERE email = ?', [userData.email])
    
    if (!user) {
      const expira = new Date()
      expira.setDate(expira.getDate() + 14)
      
      const result = db.run(`
        INSERT INTO users (nombre, email, password, iglesia, rol, activo, expira, oauth_provider, oauth_id)
        VALUES (?, ?, '', '', 'PASTOR_GENERAL', 1, ?, 'google', ?)
      `, [userData.name, userData.email, expira.toISOString(), userData.id])
      
      user = db.get('SELECT * FROM users WHERE id = ?', [result.lastID])
    }
    
    const payload = { 
      id: user.id, 
      email: user.email, 
      rol: user.rol, 
      nombre: user.nombre,
      cultoDia: user.cultoDia,
      plan: user.plan || 'GENERAL',
      iglesiaId: user.iglesiaId || null,
      cultoTurno: user.cultoTurno
    }
    const token = jwt.sign(payload, SECRET(), { expiresIn: '8h' })
    
    res.redirect(`/app/login?token=${token}`)
  } catch (error) {
    console.error('Error OAuth Google:', error)
    res.redirect('/app/login?error=oauth_failed')
  }
})

// OAuth Apple
router.post('/apple', async (req, res) => {
  const { id_token, code } = req.body
  if (!id_token) return res.status(400).json({ error: 'Token no recibido' })
  
  try {
    // TODO: Validar id_token con clave pública de Apple
    // Apple Sign In requiere validación del JWT
    res.json({ ok: false, message: 'OAuth Apple pendiente de configuración completa' })
  } catch (error) {
    console.error('Error OAuth Apple:', error)
    res.status(500).json({ error: 'Error en autenticación' })
  }
})

export default router
