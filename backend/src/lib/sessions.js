import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import logger from './logger.js'
import { pgExec, pgOne, pgMany } from './pg.js'

const ACCESS_TTL = '15m'
const REFRESH_DAYS = 30
const OLD_TOKEN_RE = /^[0-9a-f]{96}$/i   // tokens legacy (hex 96 chars, texto plano)

// ── Crear tabla al boot ───────────────────────────────────────────────────────
pgExec(`
  CREATE TABLE IF NOT EXISTS sesiones_auth (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
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
`).catch(err => logger.error({ err: err.message }, 'sesiones_auth: fallo al crear tabla'))

pgExec(`
  CREATE INDEX IF NOT EXISTS idx_sesiones_usuario
  ON sesiones_auth(usuario_id) WHERE revocado_at IS NULL
`).catch(() => {})

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
    cultoDia: user.cultoDia || '',
    cultoTurno: Number(user.cultoTurno || 0),
    plan: user.plan || 'STARTER',
    iglesiaId: user.iglesiaId || null,
    pais: user.pais || 'AR',
    divisa: user.divisa || 'ARS',
    idioma: user.idioma || 'es',
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
  const refreshToken = crypto.randomBytes(48).toString('base64url')
  const tokenHash = hash(refreshToken)
  const scope = usuario.scope || 'ADMIN'
  const expiraAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000)
  const dispositivo = String(req?.headers?.['user-agent'] || '').slice(0, 120)
  const ip = String(req?.ip || '')

  await pgExec(
    `INSERT INTO sesiones_auth
      (usuario_id, iglesia_id, scope, token_hash, dispositivo, ip, expira_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [usuario.id, usuario.iglesiaId || null, scope, tokenHash, dispositivo, ip, expiraAt.toISOString()]
  )

  const payload = userPayload(usuario)
  const accessToken = signAccessToken(payload)

  res?.cookie?.('church_refresh', refreshToken, getCookieOptions())

  return { accessToken, refreshToken, user: payload, expiresIn: ACCESS_TTL }
}

// ── refreshSession ────────────────────────────────────────────────────────────
// Devuelve { sesion, refreshToken } donde sesion tiene usuario_id e iglesia_id.
// Maneja backward-compat: tokens legacy hex-96 se migran automáticamente.
export async function refreshSession(refreshToken) {
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

    await pgExec(
      `INSERT INTO sesiones_auth
        (usuario_id, iglesia_id, scope, token_hash, dispositivo, ip, expira_at)
       VALUES ($1, $2, 'ADMIN', $3, $4, $5, $6)`,
      [
        oldRow.userId, null, newHash,
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
  const newRefresh = crypto.randomBytes(48).toString('base64url')
  const newHash = hash(newRefresh)

  await pgExec(
    'UPDATE sesiones_auth SET token_hash=$1, ultimo_uso_at=NOW() WHERE id=$2',
    [newHash, sesion.id]
  )

  return { sesion, refreshToken: newRefresh }
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
