import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import logger from './logger.js'
import { pgExec, pgOne, pgMany } from './pg.js'

const ACCESS_TTL = '15m'
const REFRESH_DAYS = 30
const OLD_TOKEN_RE = /^[0-9a-f]{96}$/i   // tokens legacy (hex 96 chars, texto plano)
const OAUTH_BRIDGE_TTL_MS = 5 * 60 * 1000

const SESSIONS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sesiones_auth (
    id            UUID        PRIMARY KEY,
    usuario_id    INTEGER     NOT NULL,
    iglesia_id    INTEGER,
    scope         TEXT        NOT NULL DEFAULT 'ADMIN',
    token_hash    TEXT        NOT NULL UNIQUE,
    dispositivo   TEXT,
    ip            TEXT,
    creado_at     TIMESTAMPTZ DEFAULT now(),
    ultimo_uso_at TIMESTAMPTZ DEFAULT now(),
    expira_at     TIMESTAMPTZ NOT NULL,
    revocado_at   TIMESTAMPTZ
  )
`

const SESSIONS_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_sesiones_usuario
  ON sesiones_auth(usuario_id) WHERE revocado_at IS NULL
`

const OAUTH_BRIDGE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS oauth_bridge_tokens (
    id         UUID        PRIMARY KEY,
    token_hash TEXT        NOT NULL UNIQUE,
    session_id UUID        NOT NULL,
    user_id    INTEGER     NOT NULL,
    creado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_at  TIMESTAMPTZ NOT NULL,
    usado_at   TIMESTAMPTZ
  )
`

const OAUTH_BRIDGE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_oauth_bridge_tokens_session
  ON oauth_bridge_tokens(session_id)
  WHERE usado_at IS NULL
`

let sessionsSchemaPromise = null
let oauthBridgeSchemaPromise = null

export function ensureSessionsSchema() {
  if (!sessionsSchemaPromise) {
    sessionsSchemaPromise = (async () => {
      await pgExec(SESSIONS_SCHEMA_SQL)
      await pgExec(SESSIONS_INDEX_SQL).catch(() => {})
    })().catch(err => {
      sessionsSchemaPromise = null
      throw err
    })
  }
  return sessionsSchemaPromise
}

export function ensureOAuthBridgeSchema() {
  if (!oauthBridgeSchemaPromise) {
    oauthBridgeSchemaPromise = (async () => {
      await ensureSessionsSchema()
      await pgExec(OAUTH_BRIDGE_SCHEMA_SQL)
      await pgExec(OAUTH_BRIDGE_INDEX_SQL).catch(() => {})
    })().catch(err => {
      oauthBridgeSchemaPromise = null
      throw err
    })
  }
  return oauthBridgeSchemaPromise
}

// ── Crear tablas al boot y repetir bajo demanda si el primer intento falla ────
ensureSessionsSchema().catch(err => logger.error({ err: err.message }, 'sesiones_auth: fallo al crear tabla'))
ensureOAuthBridgeSchema().catch(err => logger.error({ err: err.message }, 'oauth_bridge_tokens: fallo al crear tabla'))

// ── Helpers exportados ────────────────────────────────────────────────────────

export function hash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

export function userPayload(user) {
  return {
    id: user.id,
    email: user.email,
    rol: user.rol || 'LIDER',
    nombre: user.nombre,
    apellido: user.apellido || '',
    cultoDia: user.cultoDia || '',
    cultoTurno: Number(user.cultoTurno || 0),
    plan: user.plan || 'STARTER',
    iglesiaId: user.iglesiaId || null,
    pais: user.pais || 'AR',
    divisa: user.divisa || 'ARS',
    idioma: user.idioma || 'es',
    es_superadmin: user.es_superadmin === true || user.es_superadmin === 1 || user.es_superadmin === '1',
  }
}

export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/auth',
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  }
}

function signAccessToken(payload) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no configurado')
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TTL })
}

// ── issueSession ──────────────────────────────────────────────────────────────
// usuario: fila de User (debe tener id, iglesiaId, scope opcional)
// req: Express request (para user-agent e ip)
// res: Express response opcional (para setear cookie httpOnly)
export async function issueSession(usuario, req, res = null) {
  await ensureSessionsSchema()
  const sessionId = crypto.randomUUID()
  const refreshToken = crypto.randomBytes(48).toString('base64url')
  const tokenHash = hash(refreshToken)
  const scope = usuario.scope || 'ADMIN'
  const expiraAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000)
  const dispositivo = String(req?.headers?.['user-agent'] || '').slice(0, 120)
  const ip = String(req?.ip || '')

  await pgExec(
    `INSERT INTO sesiones_auth
      (id, usuario_id, iglesia_id, scope, token_hash, dispositivo, ip, expira_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sessionId, usuario.id, usuario.iglesiaId || null, scope, tokenHash, dispositivo, ip, expiraAt.toISOString()]
  )

  const payload = userPayload(usuario)
  const accessToken = signAccessToken(payload)

  res?.cookie?.('church_refresh', refreshToken, getCookieOptions())

  return { sessionId, accessToken, refreshToken, user: payload, expiresIn: ACCESS_TTL }
}

async function rotateSessionById(sessionId) {
  await ensureSessionsSchema()
  const sesion = await pgOne(
    `SELECT * FROM sesiones_auth
     WHERE id=$1 AND revocado_at IS NULL AND expira_at > NOW()
     LIMIT 1`,
    [sessionId]
  )
  if (!sesion) {
    throw Object.assign(new Error('Sesión inválida'), { code: 'SESION_INVALIDA' })
  }

  const newRefresh = crypto.randomBytes(48).toString('base64url')
  const newHash = hash(newRefresh)
  await pgExec(
    'UPDATE sesiones_auth SET token_hash=$1, ultimo_uso_at=NOW() WHERE id=$2',
    [newHash, sesion.id]
  )
  return { sesion, refreshToken: newRefresh }
}

// ── refreshSession ────────────────────────────────────────────────────────────
// Devuelve { sesion, refreshToken } donde sesion tiene usuario_id e iglesia_id.
// Maneja backward-compat: tokens legacy hex-96 se migran automáticamente.
export async function refreshSession(refreshToken) {
  await ensureSessionsSchema()
  // ── Compat: token legacy hex 96 chars (formato anterior) ──
  if (OLD_TOKEN_RE.test(refreshToken)) {
    const oldRow = await pgOne(
      `SELECT * FROM "user_sessions"
       WHERE "refreshToken"=$1 AND "revoked"=0
         AND ("expiresAt")::timestamptz > NOW()
       LIMIT 1`,
      [refreshToken]
    )
    if (!oldRow) throw Object.assign(new Error('Sesión inválida'), { code: 'SESION_INVALIDA' })

    const newRefresh = crypto.randomBytes(48).toString('base64url')
    const newHash = hash(newRefresh)
    const sessionId = crypto.randomUUID()

    await pgExec(
      `INSERT INTO sesiones_auth
        (id, usuario_id, iglesia_id, scope, token_hash, dispositivo, ip, expira_at)
       VALUES ($1, $2, $3, 'ADMIN', $4, $5, $6, $7)`,
      [
        sessionId, oldRow.userId, null, newHash,
        String(oldRow.userAgent || '').slice(0, 120),
        String(oldRow.ip || ''),
        new Date(oldRow.expiresAt).toISOString(),
      ]
    )
    await pgExec(
      'UPDATE "user_sessions" SET "revoked"=1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      [oldRow.id]
    )

    const sesion = await pgOne('SELECT * FROM sesiones_auth WHERE token_hash=$1 LIMIT 1', [newHash])
    logger.info({ userId: oldRow.userId }, 'Token legacy migrado a sesiones_auth')
    return { sesion, refreshToken: newRefresh }
  }

  // ── Formato nuevo: buscar por hash ──
  const tokenHash = hash(refreshToken)
  const sesion = await pgOne(
    `SELECT * FROM sesiones_auth
     WHERE token_hash=$1 AND revocado_at IS NULL AND expira_at > NOW()
     LIMIT 1`,
    [tokenHash]
  )

  if (!sesion) {
    logger.warn({ tokenHashPrefix: tokenHash.slice(0, 16) }, 'Refresh hash no encontrado — posible reuso de token')
    throw Object.assign(new Error('Sesión inválida'), { code: 'SESION_INVALIDA' })
  }

  // Rotación: nuevo token, actualizar hash
  return rotateSessionById(sesion.id)
}

// ── Revocación ────────────────────────────────────────────────────────────────

export async function revocarSesion(id, usuarioId) {
  await pgExec(
    'UPDATE sesiones_auth SET revocado_at=NOW() WHERE id=$1 AND usuario_id=$2',
    [id, Number(usuarioId)]
  )
}

export async function revocarTodas(usuarioId) {
  await pgExec(
    'UPDATE sesiones_auth SET revocado_at=NOW() WHERE usuario_id=$1 AND revocado_at IS NULL',
    [Number(usuarioId)]
  )
  // Revocar también sesiones legacy en user_sessions
  await pgExec(
    'UPDATE "user_sessions" SET "revoked"=1,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=$1 AND "revoked"=0',
    [Number(usuarioId)]
  ).catch(() => {})
}

export async function revocarPorToken(refreshToken) {
  if (!refreshToken) return
  if (OLD_TOKEN_RE.test(refreshToken)) {
    await pgExec(
      'UPDATE "user_sessions" SET "revoked"=1,"updatedAt"=CURRENT_TIMESTAMP WHERE "refreshToken"=$1',
      [refreshToken]
    ).catch(() => {})
    return
  }
  const tokenHash = hash(refreshToken)
  await pgExec(
    'UPDATE sesiones_auth SET revocado_at=NOW() WHERE token_hash=$1',
    [tokenHash]
  )
}

// ── Listar sesiones activas ───────────────────────────────────────────────────
export async function listarSesiones(usuarioId, sesionActualHash = null) {
  await ensureSessionsSchema()
  const rows = await pgMany(
    `SELECT id, dispositivo, ip, scope, creado_at, ultimo_uso_at, expira_at,
            CASE WHEN token_hash=$2 THEN true ELSE false END AS es_actual
     FROM sesiones_auth
     WHERE usuario_id=$1 AND revocado_at IS NULL AND expira_at > NOW()
     ORDER BY ultimo_uso_at DESC
     LIMIT 20`,
    [Number(usuarioId), sesionActualHash || '']
  )
  return rows
}

export async function issueOAuthBridge(sessionId, userId, ttlMs = OAUTH_BRIDGE_TTL_MS) {
  await ensureOAuthBridgeSchema()
  const bridgeToken = crypto.randomBytes(32).toString('base64url')
  const bridgeId = crypto.randomUUID()
  const expiraAt = new Date(Date.now() + ttlMs).toISOString()
  await pgExec(
    `INSERT INTO oauth_bridge_tokens
      (id, token_hash, session_id, user_id, expira_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [bridgeId, hash(bridgeToken), sessionId, Number(userId), expiraAt]
  )
  return bridgeToken
}

export async function consumeOAuthBridge(bridgeToken, req, res = null) {
  await ensureOAuthBridgeSchema()
  const tokenHash = hash(bridgeToken)
  const bridge = await pgOne(
    `SELECT * FROM oauth_bridge_tokens
     WHERE token_hash=$1 AND usado_at IS NULL AND expira_at > NOW()
     LIMIT 1`,
    [tokenHash]
  )
  if (!bridge) {
    throw Object.assign(new Error('Bridge OAuth inválido o expirado'), { code: 'OAUTH_BRIDGE_INVALID' })
  }

  await pgExec(
    'UPDATE oauth_bridge_tokens SET usado_at=NOW() WHERE id=$1 AND usado_at IS NULL',
    [bridge.id]
  )

  const { sesion, refreshToken } = await rotateSessionById(bridge.session_id)
  const user = await pgOne(
    `SELECT * FROM "User"
     WHERE "id"=$1 AND "activo"=true AND "deletedAt" IS NULL
     LIMIT 1`,
    [bridge.user_id]
  )
  if (!user) {
    throw Object.assign(new Error('Usuario no encontrado'), { code: 'SESION_INVALIDA' })
  }

  const payload = userPayload(user)
  const accessToken = signAccessToken(payload)
  res?.cookie?.('church_refresh', refreshToken, getCookieOptions())

  await pgExec(
    'UPDATE sesiones_auth SET ultimo_uso_at=NOW() WHERE id=$1',
    [sesion.id]
  ).catch(() => {})

  return { accessToken, refreshToken, user: payload, expiresIn: ACCESS_TTL }
}
