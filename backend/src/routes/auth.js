import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../lib/db.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()
const SECRET = () => process.env.JWT_SECRET || 'dev'
const failed = new Map()

router.post('/login', async (req, res) => {
  const { email='', password='' } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })
  const key = email.toLowerCase()
  const entry = failed.get(key) || { n:0, t:0 }
  if (entry.n >= 10 && Date.now()-entry.t < 900000) return res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos.' })
  await new Promise(r => setTimeout(r, 50 + Math.random()*100))
  const user = db.get('SELECT * FROM users WHERE email=? AND activo=1', [key])
  if (!user || !(await bcrypt.compare(password, user.password))) {
    failed.set(key, { n:(entry.n||0)+1, t:Date.now() })
    return res.status(401).json({ error: 'Credenciales inválidas' })
  }
  failed.delete(key)
  const payload = { id:user.id, email:user.email, rol:user.rol, nombre:user.nombre, cultoDia:user.cultoDia, cultoTurno:user.cultoTurno }
  const token = jwt.sign(payload, SECRET(), { expiresIn:'8h' })
  registrar({ userId:user.id, email:user.email, rol:user.rol, accion:'LOGIN', entidad:'USER', entidadId:user.id })
  res.json({ token, user: payload })
})

router.get('/me', (req, res) => {
  const token = (req.headers.authorization||'').replace('Bearer ','')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try { res.json(jwt.verify(token, SECRET())) } catch { res.status(401).json({ error:'Token inválido' }) }
})

export default router

router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, telefono, password, iglesia, promo } = req.body
    
    if (!nombre || !email || !password || !iglesia) {
      return res.status(400).json({ error: 'Faltan campos requeridos' })
    }

    const userExists = db.get('SELECT id FROM users WHERE email=?', [email.toLowerCase()])
    if (userExists) {
      return res.status(400).json({ error: 'El email ya está registrado' })
    }

    let diasExtra = 0
    if (promo) {
      const promoCode = db.get('SELECT * FROM promo_codes WHERE code=? AND usado=0', [promo.toUpperCase()])
      if (promoCode) {
        diasExtra = promoCode.dias_extra
        db.run('UPDATE promo_codes SET usado=1 WHERE id=?', [promoCode.id])
      }
    }

    const expira = new Date()
    expira.setDate(expira.getDate() + 14 + diasExtra)

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)

    const result = db.run(`
      INSERT INTO users (nombre, email, telefono, password, iglesia, rol, activo, expira)
      VALUES (?, ?, ?, ?, ?, 'PASTOR_GENERAL', 1, ?)
    `, [nombre, email.toLowerCase(), telefono, hash, iglesia, expira.toISOString()])

    const userId = result.lastID
    const payload = { id:userId, email:email.toLowerCase(), rol:'PASTOR_GENERAL', nombre, cultoDia:null, cultoTurno:null }
    const token = jwt.sign(payload, SECRET(), { expiresIn:'8h' })

    registrar({ userId, email:email.toLowerCase(), rol:'PASTOR_GENERAL', accion:'REGISTRO', entidad:'USER', entidadId:userId })

    res.json({ token, user: payload })
  } catch (error) {
    console.error('Error en registro:', error)
    res.status(500).json({ error: 'Error al crear la cuenta' })
  }
})
