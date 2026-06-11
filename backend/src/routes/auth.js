import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import logger from '../lib/logger.js'
import { pgExec, pgOne } from '../lib/pg.js'
import { registrar } from '../utils/auditoria.js'
import { normalizeCountry, normalizeLanguage, normalizePlan } from '../lib/billing.js'
import { sendNotificationEmail, sendSystemEmail, buildSystemEmail } from '../lib/email.js'
import {
  issueSession, refreshSession, revocarSesion, revocarTodas,
  revocarPorToken, listarSesiones, getCookieOptions, userPayload, hash,
} from '../lib/sessions.js'
import { crearCuentaHandler } from './registro.js'

const router = Router()
const failed = new Map()

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado')
  return process.env.JWT_SECRET
}

const toBool = v => v === true || v === 1 || v === '1'

function extractRefreshToken(req) {
  const cookie = req.headers.cookie || ''
  const match = cookie.match(/(?:^|;\s*)church_refresh=([^;]+)/)
  if (match?.[1]) return decodeURIComponent(match[1])
  const fromBody = req.body?.refreshToken
  return fromBody ? String(fromBody) : null
}

function randomIglesiaToken() {
  return `IGL-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
}

async function ensureRoleId(codigo = 'LIDER') {
  const normalized = String(codigo || 'LIDER').toUpperCase()
  let role = await pgOne('SELECT id FROM "Rol" WHERE "codigo"=$1 LIMIT 1', [normalized])
  if (role) return role.id
  role = await pgOne(
    'INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',
    [normalized, normalized.replace(/_/g, ' ')]
  )
  return role.id
}

async function ensureIglesiaByName(nombre = 'Mi Iglesia') {
  const trimmed = String(nombre || 'Mi Iglesia').trim() || 'Mi Iglesia'
  const existing = await pgOne('SELECT id FROM "Iglesia" WHERE lower("nombre")=lower($1) LIMIT 1', [trimmed])
  if (existing) return existing.id
  const created = await pgOne(
    'INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',
    [trimmed, randomIglesiaToken()]
  )
  return created.id
}

async function findIglesiaByToken(token = '') {
  if (!token) return null
  return pgOne('SELECT id, nombre, token FROM "Iglesia" WHERE "token"=$1 LIMIT 1', [String(token).trim().toUpperCase()])
}

async function promoDisponible(code = '') {
  if (!code) return null
  const promo = await pgOne('SELECT * FROM "promo_codes" WHERE "code"=$1 LIMIT 1', [String(code).trim().toUpperCase()])
  if (!promo) return null
  if (Number(promo.activo ?? 1) !== 1) return null
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return null
  const maxUsos = Number(promo.max_usos ?? 1)
  const usos = Number(promo.usos || 0)
  if (maxUsos > 0 && usos >= maxUsos) return null
  if (Number(promo.usado || 0) === 1 && maxUsos <= 1) return null
  return promo
}

async function marcarPromoUsada(promo) {
  if (!promo?.id) return
  const usos = Number(promo.usos || 0) + 1
  const maxUsos = Number(promo.max_usos ?? 1)
  await pgExec(
    'UPDATE "promo_codes" SET "usos"=$1,"usado"=$2 WHERE "id"=$3',
    [usos, maxUsos > 0 && usos >= maxUsos ? 1 : 0, promo.id]
  )
}

async function issueVerificationCode(userId, email, nombre = '') {
  const codigo = Math.floor(100000 + Math.random() * 900000).toString()
  const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await pgExec(
    'UPDATE "User" SET "codigoVerif"=$1, "codigoExpira"=$2, "codigoContexto"=$3, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4',
    [codigo, expira, 'EMAIL_VERIFY', userId]
  )
  const envio = await sendSystemEmail({
    to: email,
    subject: 'Verificá tu cuenta - Church System',
    html: buildSystemEmail({
      title: 'Código de verificación',
      intro: `Hola ${nombre || 'Pastor'}, este es tu código de verificación:`,
      lines: [`Código: ${codigo}`, 'Expira en 15 minutos.'],
    }),
    text: `Tu código de verificación es ${codigo}. Expira en 15 minutos.`,
  })
  return { envio, codigo }
}

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {}
  const cleanEmail = String(email || '').trim().toLowerCase()
  const cleanPassword = String(password || '')
  if (!cleanEmail || !cleanPassword) return res.status(400).json({ error: 'Email y contraseña requeridos' })
  const key = cleanEmail
  const entry = failed.get(key) || { n: 0, t: 0 }
  if (entry.n >= 10 && Date.now() - entry.t < 900000) {
    return res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos.' })
  }

  await new Promise(r => setTimeout(r, 50 + Math.random() * 100))

  try {
    let user = await pgOne(
      'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "activo"=true AND "deletedAt" IS NULL LIMIT 1',
      [key]
    )
    if (!user || !(await bcrypt.compare(cleanPassword, user.password))) {
      failed.set(key, { n: (entry.n || 0) + 1, t: Date.now() })
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    failed.delete(key)
    const session = await issueSession(user, req, res)
    registrar({ userId: user.id, email: user.email, rol: user.rol, accion: 'LOGIN', entidad: 'USER', entidadId: user.id, iglesiaId: user.iglesiaId })
    return res.json({ token: session.accessToken, refreshToken: session.refreshToken, expiresIn: session.expiresIn, user: session.user })
  } catch (error) {
    logger.error({ err: error?.message }, 'Error en login')
    return res.status(500).json({ error: 'Error de autenticación' })
  }
})

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, SECRET())
    const user = await pgOne(
      'SELECT * FROM "User" WHERE "id"=$1 AND "activo"=true AND "deletedAt" IS NULL LIMIT 1',
      [payload.id]
    )
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' })
    return res.json(userPayload(user))
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
})

// ── POST /auth/registro — DEPRECADO, alias de /registro/crear ─────────────────
router.post('/registro', async (req, res, next) => {
  res.set('Deprecation', 'version="v2"')
  res.set('Link', '</registro/crear>; rel="successor-version"')
  // Normalizar campos viejos al schema canónico de /registro/crear
  req.body.nombreIglesia = req.body.nombreIglesia || req.body.iglesia || 'Mi Iglesia'
  req.body.country  = req.body.country  || req.body.pais   || 'AR'
  req.body.currency = req.body.currency || req.body.divisa  || ''
  req.body.lang     = req.body.lang     || req.body.idioma  || ''
  return crearCuentaHandler(req, res, next)
})

// ── POST /auth/refresh ────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const refreshToken = extractRefreshToken(req)
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido' })

  try {
    const { sesion, refreshToken: nuevoRefresh } = await refreshSession(refreshToken)

    const user = await pgOne(
      'SELECT * FROM "User" WHERE "id"=$1 AND "activo"=true AND "deletedAt" IS NULL LIMIT 1',
      [sesion.usuario_id]
    )
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' })

    const payload = userPayload(user)
    const accessToken = jwt.sign(payload, SECRET(), { expiresIn: '15m' })

    res.cookie?.('church_refresh', nuevoRefresh, getCookieOptions())
    return res.json({ token: accessToken, refreshToken: nuevoRefresh, expiresIn: '15m', user: payload })
  } catch (err) {
    if (err.code === 'SESION_INVALIDA') return res.status(401).json({ error: 'Refresh token inválido o expirado' })
    logger.error({ err: err?.message }, 'Error en refresh')
    return res.status(500).json({ error: 'Error al renovar sesión' })
  }
})

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const refreshToken = extractRefreshToken(req)
  await revocarPorToken(refreshToken).catch(() => {})
  res.clearCookie?.('church_refresh', { path: '/auth' })
  return res.json({ ok: true })
})

// ── POST /auth/logout-all ─────────────────────────────────────────────────────
router.post('/logout-all', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, SECRET())
    await revocarTodas(payload.id)
    res.clearCookie?.('church_refresh', { path: '/auth' })
    return res.json({ ok: true })
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
})

// ── GET /auth/sesiones — listar sesiones activas ──────────────────────────────
router.get('/sesiones', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, SECRET())
    const refreshToken = extractRefreshToken(req)
    const sesionActualHash = refreshToken ? hash(refreshToken) : null
    const sesiones = await listarSesiones(payload.id, sesionActualHash)
    return res.json(sesiones)
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
})

// ── POST /auth/sesiones/:id/revocar ──────────────────────────────────────────
router.post('/sesiones/:id/revocar', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, SECRET())
    await revocarSesion(req.params.id, payload.id)
    return res.json({ ok: true })
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido' })
    }
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /auth/sesiones/revocar-todas ────────────────────────────────────────
router.post('/sesiones/revocar-todas', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, SECRET())
    await revocarTodas(payload.id)
    res.clearCookie?.('church_refresh', { path: '/auth' })
    return res.json({ ok: true })
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
})

// ── POST /auth/forgot-password ────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'Email requerido' })

    const user = await pgOne(
      'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "deletedAt" IS NULL LIMIT 1',
      [email]
    )

    const respuestaNeutra = { ok: true, mensaje: 'Si el email está registrado, vas a recibir un código.' }
    if (!user) return res.json(respuestaNeutra)

    const codigo = Math.floor(100000 + Math.random() * 900000).toString()
    const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    await pgExec(
      'UPDATE "User" SET "codigoVerif"=$1, "codigoExpira"=$2, "codigoContexto"=$3, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4',
      [codigo, expira, 'PASSWORD_RESET', user.id]
    )

    const envio = await sendSystemEmail({
      to: email,
      subject: 'Recuperá tu contraseña - Church System',
      html: buildSystemEmail({
        title: 'Recuperación de contraseña',
        intro: `Hola ${user.nombre || ''}, recibimos un pedido para restablecer tu contraseña. Usá este código:`,
        lines: [`Código: ${codigo}`, 'Expira en 15 minutos.', 'Si no fuiste vos, ignorá este email.'],
      }),
      text: `Tu código para recuperar la contraseña: ${codigo} (expira en 15 minutos)`,
    })
    if (envio?.error) {
      logger.error({ err: envio.message }, 'Error enviando email de recupero')
      if (process.env.NODE_ENV !== 'production') return res.json({ ...respuestaNeutra, codigoDev: codigo })
      return res.status(500).json({ error: 'No se pudo enviar el email' })
    }
    return res.json(respuestaNeutra)
  } catch (err) {
    logger.error({ err: err.message }, 'forgot-password falló')
    return res.status(500).json({ error: 'Error procesando la solicitud' })
  }
})

// ── POST /auth/reset-password ─────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const codigo = String(req.body?.codigo || '').trim()
    const password = String(req.body?.password || '')

    if (!email || !codigo || !password) {
      return res.status(400).json({ error: 'Email, código y nueva contraseña son requeridos' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
    }

    const user = await pgOne(
      'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "deletedAt" IS NULL LIMIT 1',
      [email]
    )
    if (!user) return res.status(400).json({ error: 'Código inválido o expirado' })
    if (user.codigoContexto !== 'PASSWORD_RESET') {
      return res.status(400).json({ error: 'Código inválido o expirado' })
    }
    if (!user.codigoExpira || new Date(user.codigoExpira) < new Date()) {
      return res.status(400).json({ error: 'El código expiró. Pedí uno nuevo.' })
    }
    if (String(user.codigoVerif || '') !== codigo) {
      return res.status(400).json({ error: 'Código incorrecto' })
    }

    const hashPwd = await bcrypt.hash(password, 10)
    await pgExec(
      'UPDATE "User" SET "password"=$1, "codigoVerif"=NULL, "codigoExpira"=NULL, "codigoContexto"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2',
      [hashPwd, user.id]
    )

    sendNotificationEmail({
      to: email,
      subject: 'Tu contraseña fue cambiada - Church System',
      title: 'Contraseña actualizada',
      intro: 'Tu contraseña se cambió correctamente. Si no fuiste vos, contactá a soporte de inmediato.',
      lines: ['Fecha: ' + new Date().toLocaleString('es-AR')],
    }).catch(() => {})

    return res.json({ ok: true, mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' })
  } catch (err) {
    logger.error({ err: err.message }, 'reset-password falló')
    return res.status(500).json({ error: 'Error procesando la solicitud' })
  }
})

export default router
