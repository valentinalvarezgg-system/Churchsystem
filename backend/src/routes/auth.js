import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../lib/db.js'
import { registrar } from '../utils/auditoria.js'
import { normalizeCountry, normalizeLanguage, normalizePlan } from '../lib/billing.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()
const SECRET = () => process.env.JWT_SECRET || 'dev'
const failed = new Map()

function userPayload(user) {
  return {
    id:user.id,
    email:user.email,
    rol:user.rol,
    nombre:user.nombre,
    cultoDia:user.cultoDia,
    cultoTurno:user.cultoTurno,
    plan:user.plan || 'GENERAL',
    iglesiaId:user.iglesiaId || null,
    pais:user.pais || 'AR',
    divisa:user.divisa || 'ARS',
    idioma:user.idioma || 'es',
  }
}

function promoDisponible(code = '') {
  if (!code) return null
  const promo = db.get('SELECT * FROM promo_codes WHERE code=?', [String(code).trim().toUpperCase()])
  if (!promo) return null
  if (Number(promo.activo ?? 1) !== 1) return null
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return null
  const maxUsos = Number(promo.max_usos ?? 1)
  const usos = Number(promo.usos || 0)
  if (maxUsos > 0 && usos >= maxUsos) return null
  if (Number(promo.usado || 0) === 1 && maxUsos <= 1) return null
  return promo
}

function marcarPromoUsada(promo) {
  if (!promo?.id) return
  const usos = Number(promo.usos || 0) + 1
  const maxUsos = Number(promo.max_usos ?? 1)
  db.run('UPDATE promo_codes SET usos=?, usado=? WHERE id=?', [usos, maxUsos > 0 && usos >= maxUsos ? 1 : 0, promo.id])
}

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
  const payload = userPayload(user)
  const token = jwt.sign(payload, SECRET(), { expiresIn:'8h' })
  registrar({ userId:user.id, email:user.email, rol:user.rol, accion:'LOGIN', entidad:'USER', entidadId:user.id })
  res.json({ token, user: payload })
})

router.get('/me', (req, res) => {
  const token = (req.headers.authorization||'').replace('Bearer ','')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, SECRET())
    const user = db.get('SELECT * FROM users WHERE id=? AND activo=1', [payload.id])
    if (!user) return res.status(401).json({ error:'Usuario no encontrado' })
    res.json(userPayload(user))
  } catch {
    res.status(401).json({ error:'Token inválido' })
  }
})

router.post('/registro', async (req, res) => {
  try {
    const {
      nombre, apellido = '', email, telefono = '', password,
      iglesia = '', promo = '', plan = 'CONSOLIDACION',
      pais = req.body?.country || 'AR',
      divisa = req.body?.currency || '',
      idioma = req.body?.lang || req.headers['accept-language'] || '',
      iglesiaToken = '',
    } = req.body || {}
    
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos' })
    }

    const userExists = db.get('SELECT id FROM users WHERE email=?', [email.toLowerCase()])
    if (userExists) {
      return res.status(400).json({ error: 'El email ya está registrado' })
    }

    const promoCode = promoDisponible(promo)
    const diasExtra = promoCode ? Number(promoCode.dias_extra || 0) : 0
    const descuento = promoCode ? Number(promoCode.descuento_porcentaje || 0) : 0
    const descuentoMeses = promoCode ? Number(promoCode.duracion_meses || 0) : 0
    const countryInfo = normalizeCountry(pais)
    const selectedDivisa = String(divisa || countryInfo.currency || 'USD').toUpperCase()
    const selectedIdioma = normalizeLanguage(idioma, countryInfo)
    const selectedPlan = normalizePlan(plan)

    const expira = new Date()
    expira.setDate(expira.getDate() + 14 + diasExtra)

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)

    let iglesiaId = null
    if (iglesiaToken) {
      const ig = db.get('SELECT * FROM iglesias WHERE token=?', [String(iglesiaToken).trim().toUpperCase()])
      if (ig) iglesiaId = ig.id
    }

    const result = db.run(`
      INSERT INTO users (
        nombre, apellido, email, telefono, password, iglesia, rol, activo, expira,
        plan, pais, divisa, idioma, iglesiaId, promoCode, promoDescuento, promoMeses, promoUsadoAt
      )
      VALUES (?, ?, ?, ?, ?, ?, 'PASTOR_GENERAL', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nombre, apellido, email.toLowerCase(), telefono, hash, iglesia || 'Mi Iglesia', expira.toISOString(),
      selectedPlan, countryInfo.code, selectedDivisa, selectedIdioma, iglesiaId,
      promoCode?.code || '', descuento, descuentoMeses, promoCode ? new Date().toISOString() : null,
    ])

    const userId = result.lastID
    if (promoCode) marcarPromoUsada(promoCode)

    const createdUser = db.get('SELECT * FROM users WHERE id=?', [userId])
    const payload = userPayload(createdUser)
    const token = jwt.sign(payload, SECRET(), { expiresIn:'8h' })

    registrar({ userId, email:email.toLowerCase(), rol:'PASTOR_GENERAL', accion:'REGISTRO', entidad:'USER', entidadId:userId })

    await sendNotificationEmail({
      to: email.toLowerCase(),
      subject: 'Registro exitoso - Church System',
      title: 'Registro exitoso',
      intro: `Hola ${nombre}, tu cuenta fue creada correctamente.`,
      lines: [
        `Plan: ${selectedPlan}`,
        `Pais y divisa: ${countryInfo.code} / ${selectedDivisa}`,
        promoCode ? `Invitacion aplicada: ${promoCode.code} (${descuento}% OFF por ${descuentoMeses} meses)` : '',
        iglesiaId ? 'Te uniste a una iglesia mediante token.' : '',
      ],
      actionUrl: `${process.env.FRONTEND_URL || process.env.BASE_URL || 'https://churchsystem.com.ar'}/app/login`,
      actionLabel: 'Ingresar',
    }).catch(() => {})

    res.json({ token, user: payload })
  } catch (error) {
    console.error('Error en registro:', error)
    res.status(500).json({ error: 'Error al crear la cuenta' })
  }
})

export default router
