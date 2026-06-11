#!/usr/bin/env node
/**
 * verify-auth.mjs — Verificación de refresh tokens revocables
 *
 * Requiere: backend corriendo en localhost:4000
 * Uso: node scripts/verify-auth.mjs
 *      VERIFY_EMAIL=test@test.com VERIFY_PASS=test1234 node scripts/verify-auth.mjs
 */
import http from 'node:http'

const BASE = process.env.VERIFY_BASE || 'http://localhost:4000'
const EMAIL = process.env.VERIFY_EMAIL || null
const PASS  = process.env.VERIFY_PASS  || null

const PASS_ICON = '✅'
const FAIL_ICON = '❌'

let passed = 0
let failed = 0

function log(ok, msg) {
  console.log(`  ${ok ? PASS_ICON : FAIL_ICON} ${msg}`)
  if (ok) passed++; else failed++
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE)
    const bodyStr = body ? JSON.stringify(body) : null
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 8000,
    }
    const req = http.request(opts, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', e => resolve({ status: 0, body: null, error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: null, error: 'timeout' }) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function main() {
  console.log('\n  Church System — verify:auth\n')

  // ── CHECK 0: servidor activo ──────────────────────────────────────────────
  const health = await request('GET', '/health')
  if (health.status !== 200 || health.body?.status !== 'ok') {
    console.log(`  ${FAIL_ICON} Backend no disponible en ${BASE} — abortando`)
    process.exit(2)
  }
  log(true, `Backend activo en ${BASE}`)

  if (!EMAIL || !PASS) {
    console.log('\n  Definí VERIFY_EMAIL y VERIFY_PASS para ejecutar los tests de sesión.')
    console.log('  Ejemplo: VERIFY_EMAIL=admin@test.com VERIFY_PASS=mipass node scripts/verify-auth.mjs\n')
    process.exit(0)
  }

  // ── CHECK 1: login → recibir access + refresh ─────────────────────────────
  const login = await request('POST', '/auth/login', { email: EMAIL, password: PASS })
  if (login.status !== 200 || !login.body?.token || !login.body?.refreshToken) {
    log(false, `Login fallido (HTTP ${login.status}): ${JSON.stringify(login.body)}`)
    process.exit(1)
  }
  const { token: accessToken1, refreshToken: refreshToken1 } = login.body
  log(true, 'Login OK — access + refresh recibidos')

  // ── CHECK 2: refresh → nuevo refresh (rotación) ──────────────────────────
  const refresh1 = await request('POST', '/auth/refresh', { refreshToken: refreshToken1 })
  if (refresh1.status !== 200 || !refresh1.body?.token || !refresh1.body?.refreshToken) {
    log(false, `Refresh falló (HTTP ${refresh1.status}): ${JSON.stringify(refresh1.body)}`)
    process.exit(1)
  }
  const { token: accessToken2, refreshToken: refreshToken2 } = refresh1.body
  log(true, 'Refresh OK — nuevo access + nuevo refresh recibidos')
  log(refreshToken2 !== refreshToken1, 'Rotación: nuevo refreshToken es distinto al anterior')

  // ── CHECK 3: usar refreshToken viejo post-rotación → debe fallar ──────────
  const refresh2 = await request('POST', '/auth/refresh', { refreshToken: refreshToken1 })
  log(refresh2.status === 401, `Token revocado post-rotación rechazado correctamente (HTTP ${refresh2.status})`)

  // ── CHECK 4: listar sesiones ──────────────────────────────────────────────
  const sesiones = await request('GET', '/auth/sesiones', null, { Authorization: `Bearer ${accessToken2}` })
  log(sesiones.status === 200 && Array.isArray(sesiones.body), `GET /auth/sesiones OK (${Array.isArray(sesiones.body) ? sesiones.body.length : '?'} sesiones activas)`)

  // ── CHECK 5: revocar todas ────────────────────────────────────────────────
  const revocar = await request('POST', '/auth/sesiones/revocar-todas', {}, { Authorization: `Bearer ${accessToken2}` })
  log(revocar.status === 200 && revocar.body?.ok === true, `POST /auth/sesiones/revocar-todas OK (HTTP ${revocar.status})`)

  // ── CHECK 6: refresh después de revocar todas → debe fallar ───────────────
  const refresh3 = await request('POST', '/auth/refresh', { refreshToken: refreshToken2 })
  log(refresh3.status === 401, `Refresh post-revocación total rechazado correctamente (HTTP ${refresh3.status})`)

  // ── CHECK 7: /auth/registro tiene header Deprecation ─────────────────────
  const deprecated = await request('POST', '/auth/registro', { email: 'noemail@x.com' })
  // No importa el status del registro (puede fallar por email inválido),
  // lo que importa es que el header Deprecation llegue
  // Nota: http.IncomingMessage headers son lowercase
  const regHealth = await new Promise(resolve => {
    const req = http.request({
      hostname: new URL(BASE).hostname,
      port: new URL(BASE).port || 80,
      path: '/auth/registro',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
      timeout: 4000,
    }, res => {
      res.resume()
      resolve(res.headers)
    })
    req.on('error', () => resolve({}))
    req.on('timeout', () => { req.destroy(); resolve({}) })
    req.write('{}')
    req.end()
  })
  log(!!regHealth['deprecation'], `POST /auth/registro tiene header Deprecation: ${regHealth['deprecation'] || 'ausente'}`)

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log(`\n  ${passed + failed} checks: ${passed} OK, ${failed} falló(aron)\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Error fatal:', e.message)
  process.exit(2)
})
