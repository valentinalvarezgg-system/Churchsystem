import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import logger from '../lib/logger.js'
import { pgExec, pgOne } from '../lib/pg.js'
import { registrar } from '../utils/auditoria.js'
import { normalizeCountry, normalizeLanguage, normalizePlan } from '../lib/billing.js'
import { sendNotificationEmail, sendSystemEmail, buildSystemEmail } from '../lib/email.js'

const router = Router()
const failed = new Map()
const ACCESS_TTL = '15m'
const REFRESH_DAYS = 30

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado')
  return process.env.JWT_SECRET
}

const toBool = v => v === true || v === 1 || v === '1'

function signAccessToken(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: ACCESS_TTL })
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('hex')
}

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/auth',
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  }
}

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

function userPayload(user) {
  return {
    id: user.id,
    email: user.email,
    rol: user.rol || 'LIDER',
    nombre: user.nombre,
    cultoDia: user.cultoDia || '',
    cultoTurno: Number(user.cultoTurno || 0),
    plan: user.plan || 'GENERAL',
    iglesiaId: user.iglesiaId || null,
    pais: user.pais || 'AR',
    divisa: user.divisa || 'ARS',
    idioma: user.idioma || 'es',
  }
}

async function issueSession(req, res, user) {
  const payload = userPayload(user)
  const accessToken = signAccessToken(payload)
  const refreshToken = createRefreshToken()
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await pgExec(
    'INSERT INTO "user_sessions" ("userId","refreshToken","userAgent","ip","expiresAt","revoked","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
    [user.id, refreshToken, String(req.headers['user-agent'] || ''), String(req.ip || ''), expiresAt]
  )
  res.cookie?.('church_refresh', refreshToken, getCookieOptions())
  return { accessToken, refreshToken, user: payload, expiresIn: ACCESS_TTL }
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
    const session = await issueSession(req, res, user)
    registrar({ userId: user.id, email: user.email, rol: user.rol, accion: 'LOGIN', entidad: 'USER', entidadId: user.id, iglesiaId: user.iglesiaId })
    return res.json({ token: session.accessToken, refreshToken: session.refreshToken, expiresIn: session.expiresIn, user: session.user })
  } catch (error) {
    logger.error({ err: error?.message }, 'Error en login')
    return res.status(500).json({ error: 'Error de autenticación' })
  }
})

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

    const exists = await pgOne('SELECT id FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [email.toLowerCase()])
    if (exists) return res.status(400).json({ error: 'El email ya está registrado' })

    const promoCode = await promoDisponible(promo)
    const diasExtra = promoCode ? Number(promoCode.dias_extra || 0) : 0
    const descuento = promoCode ? Number(promoCode.descuento_porcentaje || 0) : 0
    const descuentoMeses = promoCode ? Number(promoCode.duracion_meses || 0) : 0
    const countryInfo = normalizeCountry(pais)
    const selectedDivisa = String(divisa || countryInfo.currency || 'USD').toUpperCase()
    const selectedIdioma = normalizeLanguage(idioma, countryInfo)
    const selectedPlan = normalizePlan(plan)
    const expira = new Date(Date.now() + (14 + diasExtra) * 24 * 60 * 60 * 1000).toISOString()
    const hash = await bcrypt.hash(password, 10)

    const roleId = await ensureRoleId('PASTOR_GENERAL')
    let iglesiaId = null
    if (iglesiaToken) {
      const linked = await findIglesiaByToken(iglesiaToken)
      if (linked) iglesiaId = linked.id
    }
    if (!iglesiaId) iglesiaId = await ensureIglesiaByName(iglesia || 'Mi Iglesia')

    const created = await pgOne(
      `INSERT INTO "User"
        ("email","password","nombre","apellido","activo","emailVerificado","iglesiaId","rolId","createdAt","updatedAt",
         "rol","cultoDia","cultoTurno","plan","pais","divisa","idioma","iglesia","telefono","expira",
         "promoCode","promoDescuento","promoMeses","promoUsadoAt")
       VALUES
        ($1,$2,$3,$4,true,false,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
         'PASTOR_GENERAL','',0,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        email.toLowerCase(),
        hash,
        nombre,
        apellido,
        iglesiaId,
        roleId,
        selectedPlan,
        countryInfo.code,
        selectedDivisa,
        selectedIdioma,
        iglesia || 'Mi Iglesia',
        telefono,
        expira,
        promoCode?.code || '',
        descuento,
        descuentoMeses,
        promoCode ? new Date().toISOString() : null,
      ]
    )

    if (promoCode) await marcarPromoUsada(promoCode)
    const session = await issueSession(req, res, created)
    registrar({ userId: created.id, email: created.email, rol: 'PASTOR_GENERAL', accion: 'REGISTRO', entidad: 'USER', entidadId: created.id, iglesiaId })

    await sendNotificationEmail({
      to: email.toLowerCase(),
      subject: 'Registro exitoso - Church System',
      title: 'Registro exitoso',
      intro: `Hola ${nombre}, tu cuenta fue creada correctamente.`,
      lines: [
        `Plan: ${selectedPlan}`,
        `Pais y divisa: ${countryInfo.code} / ${selectedDivisa}`,
        promoCode ? `Invitacion aplicada: ${promoCode.code} (${descuento}% OFF por ${descuentoMeses} meses)` : '',
        iglesiaToken ? 'Te uniste mediante token de iglesia.' : '',
      ],
      actionUrl: `${process.env.FRONTEND_URL || process.env.BASE_URL || 'https://churchsystem.com.ar'}/app/login`,
      actionLabel: 'Ingresar',
    }).catch(() => {})

    return res.json({ token: session.accessToken, refreshToken: session.refreshToken, expiresIn: session.expiresIn, user: session.user })
  } catch (error) {
    logger.error({ err: error?.message }, 'Error en registro')
    return res.status(500).json({ error: 'Error al crear la cuenta' })
  }
})

router.post('/refresh', async (req, res) => {
  const refreshToken = extractRefreshToken(req)
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token requerido' })
  const session = await pgOne(
    'SELECT * FROM "user_sessions" WHERE "refreshToken"=$1 AND "revoked"=0 AND ("expiresAt")::timestamptz > NOW() LIMIT 1',
    [refreshToken]
  )
  if (!session) return res.status(401).json({ error: 'Refresh token inválido o expirado' })
  const user = await pgOne(
    'SELECT * FROM "User" WHERE "id"=$1 AND "activo"=true AND "deletedAt" IS NULL LIMIT 1',
    [session.userId]
  )
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado' })

  await pgExec('UPDATE "user_sessions" SET "revoked"=1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', [session.id])
  const next = await issueSession(req, res, user)
  return res.json({ token: next.accessToken, refreshToken: next.refreshToken, expiresIn: next.expiresIn, user: next.user })
})

router.post('/logout', async (req, res) => {
  const refreshToken = extractRefreshToken(req)
  if (refreshToken) {
    await pgExec('UPDATE "user_sessions" SET "revoked"=1,"updatedAt"=CURRENT_TIMESTAMP WHERE "refreshToken"=$1', [refreshToken])
  }
  res.clearCookie?.('church_refresh', { path: '/auth' })
  return res.json({ ok: true })
})

router.post('/logout-all', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, SECRET())
    await pgExec('UPDATE "user_sessions" SET "revoked"=1,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=$1', [payload.id])
    res.clearCookie?.('church_refresh', { path: '/auth' })
    return res.json({ ok: true })
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
})

// ── Recupero de contraseña (público, sin login) ──────────────────────
// POST /auth/forgot-password → genera código de 6 dígitos y lo manda por email
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'Email requerido' })

    const user = await pgOne(
      'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "deletedAt" IS NULL LIMIT 1',
      [email]
    )

    // Respuesta neutra: no revelar si el email existe o no (anti-enumeración)
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

// POST /auth/reset-password → valida código y setea nueva contraseña
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

    const hash = await bcrypt.hash(password, 10)
    await pgExec(
      'UPDATE "User" SET "password"=$1, "codigoVerif"=NULL, "codigoExpira"=NULL, "codigoContexto"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2',
      [hash, user.id]
    )

    // Email de aviso de seguridad (no bloquea la respuesta si falla)
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
