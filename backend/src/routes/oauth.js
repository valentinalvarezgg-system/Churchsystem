import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

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
  if (!code) return res.status(400).json({ error: 'Código no recibido' })
  
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
    if (!tokens.access_token) return res.status(400).json({ error: 'Token no recibido' })
    
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    
    const userData = await userResponse.json()
    
    // TODO: Crear/actualizar usuario en DB y generar JWT
    res.json({ ok: true, user: userData, message: 'OAuth Google pendiente de implementación completa' })
  } catch (error) {
    console.error('Error OAuth Google:', error)
    res.status(500).json({ error: 'Error en autenticación' })
  }
})

// OAuth Apple (Sign in with Apple)
router.post('/apple', async (req, res) => {
  const { id_token, code } = req.body
  if (!id_token) return res.status(400).json({ error: 'Token no recibido' })
  
  try {
    // TODO: Validar id_token con clave pública de Apple
    // TODO: Crear/actualizar usuario en DB y generar JWT
    res.json({ ok: true, message: 'OAuth Apple pendiente de implementación completa' })
  } catch (error) {
    console.error('Error OAuth Apple:', error)
    res.status(500).json({ error: 'Error en autenticación' })
  }
})

export default router
