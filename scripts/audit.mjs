#!/usr/bin/env node
/**
 * Church System — Script de Auditoría Integral
 * Uso: node scripts/audit.mjs [--json] [--out <archivo>]
 *
 * Comprueba:
 *   1. Versiones sincronizadas (package.json backend/frontend, README, BITACORA)
 *   2. Variables de entorno críticas
 *   3. Servidor local activo (puerto 4000)
 *   4. Endpoints smoke: /health, /godmode/login-status, /auth/login
 *   5. Conectividad a DB (via /health)
 *   6. Dominio público: churchsystem.com.ar
 *   7. Rutas sin requireAuth (seguridad)
 *   8. Imports legacy (lib/db.js)
 *   9. Dependencias: paquetes obsoletos o vulnerables
 *  10. Build del frontend: dist/ sincronizado con src/
 *  11. Cloudflare Tunnel activo
 *  12. launchd plist vs .env sincronizados
 *  13. Git: commits sin pushear, archivos sin commitear
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import http from 'node:http'

// ─── Paths ────────────────────────────────────────────────────────────────────
const __dirname   = path.dirname(fileURLToPath(import.meta.url))
const ROOT        = path.resolve(__dirname, '..')
const BACKEND     = path.join(ROOT, 'backend')
const FRONTEND    = path.join(ROOT, 'frontend')
const README      = path.join(ROOT, 'README.md')
const BITACORA    = path.join(ROOT, 'BITACORA.md')
const PLIST       = path.join(process.env.HOME, 'Library/LaunchAgents/com.churchsystem.backend.plist')
const ENV_FILE    = path.join(BACKEND, '.env')
const BACKEND_SRC = path.join(BACKEND, 'src')

// ─── Args ─────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2)
const AS_JSON  = args.includes('--json')
const outIdx   = args.indexOf('--out')
const OUT_FILE = outIdx !== -1 ? args[outIdx + 1] : null

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PASS = '✅'
const FAIL = '❌'
const WARN = '⚠️ '
const INFO = 'ℹ️ '

let results = []

function log(level, category, message, detail = null) {
  results.push({ level, category, message, detail, ts: new Date().toISOString() })
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  catch { return null }
}

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') }
  catch { return '' }
}

// Agente HTTPS que ignora errores de certificado (igual que NODE_TLS_REJECT_UNAUTHORIZED=0)
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https')
    const mod     = isHttps ? https : http
    const opts    = isHttps ? { timeout: timeoutMs, agent: httpsAgent } : { timeout: timeoutMs }
    const req = mod.get(url, opts, (res) => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try { resolve({ ok: true, status: res.statusCode, body, json: JSON.parse(body) }) }
        catch { resolve({ ok: true, status: res.statusCode, body, json: null }) }
      })
    })
    req.on('error', e => resolve({ ok: false, error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
  })
}

function walk(dir) {
  const out = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', '.claude', 'dist'].includes(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...walk(full))
      else if (/\.(js|mjs|ts|jsx|tsx)$/.test(entry.name)) out.push(full)
    }
  } catch {}
  return out
}

function shell(cmd, cwd = ROOT) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    return e.stdout?.trim() || ''
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1 — Versiones sincronizadas
// ─────────────────────────────────────────────────────────────────────────────
function checkVersionSync() {
  const backPkg  = readJSON(path.join(BACKEND, 'package.json'))
  const frontPkg = readJSON(path.join(FRONTEND, 'package.json'))
  const readme   = readText(README)
  const bitacora = readText(BITACORA)

  const backV  = backPkg?.version  || 'N/A'
  const frontV = frontPkg?.version || 'N/A'

  const readmeMatch   = readme.match(/v(\d+\.\d+(?:\.\d+)?(?:\s*beta)?)/i)
  const bitacoraMatch = bitacora.match(/v(\d+\.\d+(?:\.\d+)?)/g)?.slice(-1)?.[0]?.replace('v', '')

  const readmeV   = readmeMatch?.[1]  || 'N/A'
  const bitacoraV = bitacoraMatch     || 'N/A'

  if (backV !== frontV) {
    log('error', 'versiones', `backend (${backV}) y frontend (${frontV}) tienen versiones distintas`,
      'Actualizá ambos package.json a la misma versión')
  } else {
    log('ok', 'versiones', `backend y frontend coinciden en v${backV}`)
  }

  const majorMinorBack = backV.replace(/\.\d+$/, '')
  if (!readmeV.replace(/\s*beta/i, '').startsWith(majorMinorBack)) {
    log('warn', 'versiones', `README dice v${readmeV} pero package.json dice v${backV}`,
      'Actualizá el título del README')
  } else {
    log('ok', 'versiones', `README está en v${readmeV}`)
  }

  if (bitacoraV && !bitacoraV.startsWith(majorMinorBack)) {
    log('warn', 'versiones', `Última versión en BITACORA es v${bitacoraV}, package.json dice v${backV}`,
      'Agregá una entrada a BITACORA con la versión actual')
  } else {
    log('ok', 'versiones', `BITACORA registra v${bitacoraV}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2 — Variables de entorno críticas
// ─────────────────────────────────────────────────────────────────────────────
function checkEnvVars() {
  const env = {}
  const raw = readText(ENV_FILE)
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }

  const required = [
    ['JWT_SECRET',           v => v && v.length >= 32 && !v.includes('tu-secret'), 'Debe tener ≥32 chars y no ser placeholder'],
    ['DATABASE_URL',         v => v?.startsWith('postgresql://'),                  'Debe ser URL PostgreSQL'],
    ['BASE_URL',             v => v?.startsWith('https://'),                       'Debe ser HTTPS'],
    ['FRONTEND_URL',         v => v?.startsWith('https://'),                       'Debe ser HTTPS'],
    ['RESEND_API_KEY',       v => v?.startsWith('re_'),                            'Debe empezar con re_'],
    ['GODMODE_USER_EMAIL',   v => v?.includes('@'),                                'Debe ser un email'],
    ['GODMODE_USER_PASSWORD',v => v && v.length >= 8,                              'Debe tener ≥8 chars'],
    ['VAPID_PUBLIC_KEY',     v => !!v,                                             'Requerida para push notifications'],
    ['VAPID_PRIVATE_KEY',    v => !!v,                                             'Requerida para push notifications'],
  ]

  const optional = [
    ['MP_ACCESS_TOKEN',      v => v && !v.includes('TEST'), 'Está en modo TEST — pagos reales desactivados'],
    ['GOOGLE_CLIENT_ID',     v => !!v,                      'Login con Google no disponible'],
    ['GOOGLE_CLIENT_SECRET', v => !!v,                      'Login con Google no disponible'],
    ['STRIPE_SECRET_KEY',    v => v?.startsWith('sk_'),     'Stripe no configurado — pagos USD desactivados'],
    ['ANTHROPIC_API_KEY',    v => v?.startsWith('sk-ant-'), 'Asistente IA no disponible'],
  ]

  for (const [key, validate, hint] of required) {
    if (!env[key]) {
      log('error', 'env', `${key} no definida`, hint)
    } else if (!validate(env[key])) {
      log('error', 'env', `${key} tiene valor inválido`, hint)
    } else {
      log('ok', 'env', `${key} configurada`)
    }
  }

  for (const [key, validate, hint] of optional) {
    if (!env[key] || !validate(env[key])) {
      log('warn', 'env', `${key}: ${hint}`)
    } else {
      log('ok', 'env', `${key} configurada`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3 — Servidor local
// ─────────────────────────────────────────────────────────────────────────────
async function checkLocalServer() {
  const res = await httpGet('http://localhost:4000/health', 4000)
  if (!res.ok) {
    log('error', 'servidor', 'Backend NO responde en localhost:4000', res.error)
    return false
  }
  if (res.json?.status === 'ok') {
    log('ok', 'servidor', 'Backend activo en localhost:4000 — DB conectada')
  } else {
    log('error', 'servidor', `Backend responde pero DB falla: ${res.body}`)
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4 — Smoke tests de endpoints
// ─────────────────────────────────────────────────────────────────────────────
async function checkEndpoints() {
  const tests = [
    {
      url: 'http://localhost:4000/godmode/login-status',
      name: 'GodMode status',
      validate: j => j?.ok === true,
    },
    {
      url: 'http://localhost:4000/auth/login',
      method: 'POST',
      body: JSON.stringify({ email: 'noexiste@test.com', password: 'x' }),
      name: 'Auth login rechaza credencial inválida',
      validate: (_j, s) => s === 401,
    },
    {
      url: 'http://localhost:4000/personas',
      name: 'Personas requiere auth',
      validate: (_j, s) => s === 401 || s === 403,
    },
  ]

  for (const t of tests) {
    try {
      let res
      if (t.method === 'POST') {
        res = await new Promise((resolve) => {
          const opts = {
            hostname: 'localhost', port: 4000,
            path: new URL(t.url).pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(t.body) },
            timeout: 5000,
          }
          const req = http.request(opts, (r) => {
            let body = ''
            r.on('data', d => body += d)
            r.on('end', () => {
              try { resolve({ ok: true, status: r.statusCode, json: JSON.parse(body) }) }
              catch { resolve({ ok: true, status: r.statusCode, json: null }) }
            })
          })
          req.on('error', e => resolve({ ok: false, error: e.message }))
          req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
          req.write(t.body)
          req.end()
        })
      } else {
        res = await httpGet(t.url, 5000)
      }

      if (!res.ok) {
        log('error', 'endpoints', `${t.name}: sin respuesta`, res.error)
      } else if (t.validate(res.json, res.status)) {
        log('ok', 'endpoints', `${t.name} — HTTP ${res.status}`)
      } else {
        log('error', 'endpoints', `${t.name} — respuesta inesperada HTTP ${res.status}`, res.body?.slice(0, 120))
      }
    } catch (e) {
      log('error', 'endpoints', `${t.name}: excepción`, e.message)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 5 — Dominio público
// ─────────────────────────────────────────────────────────────────────────────
async function checkPublicDomain() {
  const res = await httpGet('https://churchsystem.com.ar/health', 8000)
  if (!res.ok) {
    log('error', 'dominio', 'churchsystem.com.ar no responde', res.error)
  } else if (res.json?.status === 'ok') {
    log('ok', 'dominio', 'churchsystem.com.ar/health → OK')
  } else {
    log('warn', 'dominio', `churchsystem.com.ar HTTP ${res.status} pero body inesperado`, res.body?.slice(0, 80))
  }

  const gm = await httpGet('https://churchsystem.com.ar/godmode/login-status', 8000)
  if (gm.ok && gm.json?.ok === true) {
    log('ok', 'dominio', `churchsystem.com.ar/godmode/login-status — envConfigured: ${gm.json.envConfigured}`)
  } else {
    log('error', 'dominio', 'churchsystem.com.ar/godmode/login-status falló', gm.error || gm.body?.slice(0, 80))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 6 — Rutas sin requireAuth
// ─────────────────────────────────────────────────────────────────────────────
function checkUnprotectedRoutes() {
  const routeFiles = walk(BACKEND_SRC).filter(f => f.includes(`${path.sep}routes${path.sep}`))
  const PUBLIC_PATTERNS = [
    /\/login/, /\/refresh/, /\/logout/, /\/google/, /\/apple/, /\/callback/,
    /\/registro/, /\/crear/, /\/verificar/, /\/planes/, /\/catalogo/,
    /\/webhook/, /\/enviar/, /\/reenviar/, /\/health/, /\/status/,
    /\/token/, /\/qr/, /\/checkin/, /\/inbound/,
  ]

  const findings = []
  for (const file of routeFiles) {
    const text = fs.readFileSync(file, 'utf8')
    const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*(['"`][^'"`]+['"`])([\s\S]*?)\n\)/g
    let match
    while ((match = routeRegex.exec(text))) {
      const full     = match[0]
      const route    = match[2]
      const isPublic = PUBLIC_PATTERNS.some(p => p.test(route))
      const hasAuth  = /requireAuth/.test(full)
      if (!hasAuth && !isPublic) {
        findings.push(`${path.relative(ROOT, file)} → ${route.replace(/['"`]/g, '')}`)
      }
    }
  }

  if (findings.length === 0) {
    log('ok', 'seguridad', 'Todas las rutas tienen requireAuth o están en whitelist pública')
  } else {
    log('warn', 'seguridad', `${findings.length} rutas posiblemente sin requireAuth`, findings.join('\n'))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 7 — Imports legacy
// ─────────────────────────────────────────────────────────────────────────────
function checkLegacyImports() {
  const files  = walk(BACKEND_SRC)
  const legacy = files.filter(f => {
    const t = readText(f)
    return /from ['"].*\/lib\/db\.js['"]/.test(t) || /require\(.*lib\/db/.test(t)
  })

  if (legacy.length === 0) {
    log('ok', 'codigo', 'Sin imports legacy de lib/db.js')
  } else {
    log('error', 'codigo', `${legacy.length} archivos usan lib/db.js legacy`,
      legacy.map(f => path.relative(ROOT, f)).join('\n'))
  }

  const pkg = readJSON(path.join(BACKEND, 'package.json'))
  if (pkg?.dependencies?.['sql.js'] || pkg?.devDependencies?.['sql.js']) {
    log('error', 'codigo', 'sql.js todavía está en package.json — debe removerse')
  } else {
    log('ok', 'codigo', 'Sin dependencia residual de sql.js')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 8 — Dependencias
// ─────────────────────────────────────────────────────────────────────────────
function checkDependencies() {
  for (const [label, cwd] of [['Backend', BACKEND], ['Frontend', FRONTEND]]) {
    const audit = spawnSync('pnpm', ['audit', '--json'], { cwd, encoding: 'utf8' })
    try {
      const data  = JSON.parse(audit.stdout || '{}')
      const vulns = data?.metadata?.vulnerabilities
      if (!vulns) { log('warn', 'dependencias', `${label}: no se pudo leer resultado de audit`); continue }
      const { critical = 0, high = 0, moderate = 0, low = 0 } = vulns
      const total = critical + high + moderate + low
      if (critical > 0 || high > 0) {
        log('error', 'dependencias', `${label}: ${critical} críticas, ${high} altas, ${moderate} moderadas`,
          'Correr: pnpm audit --fix')
      } else if (total > 0) {
        log('warn', 'dependencias', `${label}: ${moderate} moderadas, ${low} bajas`)
      } else {
        log('ok', 'dependencias', `${label}: sin vulnerabilidades conocidas`)
      }
    } catch {
      log('warn', 'dependencias', `${label}: no se pudo parsear pnpm audit`)
    }
  }

  // Paquetes con major update disponible en backend
  const outdated = spawnSync('pnpm', ['outdated', '--format', 'json'], { cwd: BACKEND, encoding: 'utf8' })
  try {
    const data = JSON.parse(outdated.stdout || '{}')
    const keys = Object.keys(data)
    if (keys.length === 0) {
      log('ok', 'dependencias', 'Backend: todas las dependencias al día')
    } else {
      const majors = keys.filter(k => {
        const d = data[k]
        return d?.current && d?.latest &&
               parseInt(d.latest.split('.')[0]) > parseInt(d.current.split('.')[0])
      })
      if (majors.length > 0) {
        log('warn', 'dependencias', `Backend: ${majors.length} paquete(s) con major update disponible`,
          majors.map(k => `${k}: ${data[k].current} → ${data[k].latest}`).join('\n'))
      } else {
        log('ok', 'dependencias', `Backend: ${keys.length} paquete(s) con minor/patch update (sin majors)`)
      }
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 9 — Build del frontend
// ─────────────────────────────────────────────────────────────────────────────
function checkFrontendBuild() {
  const distIndex = path.join(FRONTEND, 'dist', 'index.html')
  if (!fs.existsSync(distIndex)) {
    log('error', 'frontend', 'frontend/dist/index.html no existe — correr pnpm build')
    return
  }

  const distMtime = fs.statSync(distIndex).mtimeMs
  const srcFiles  = walk(path.join(FRONTEND, 'src'))
  const newer     = srcFiles.filter(f => {
    try { return fs.statSync(f).mtimeMs > distMtime } catch { return false }
  })

  if (newer.length > 0) {
    log('warn', 'frontend', `${newer.length} archivo(s) en src/ más nuevos que el último build`,
      'Correr: cd frontend && pnpm build && git add frontend/dist/ && git commit')
  } else {
    log('ok', 'frontend', 'dist/ está actualizado respecto a src/')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 10 — Cloudflare Tunnel
// ─────────────────────────────────────────────────────────────────────────────
function checkCloudflare() {
  const r = spawnSync('pgrep', ['-x', 'cloudflared'], { encoding: 'utf8' })
  if (r.stdout.trim()) {
    log('ok', 'infraestructura', `Cloudflare Tunnel activo (PID ${r.stdout.trim().split('\n').join(', ')})`)
  } else {
    log('error', 'infraestructura', 'cloudflared NO está corriendo — sitio inaccesible desde internet',
      'Iniciarlo: cloudflared tunnel run church-system')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 11 — launchd plist
// ─────────────────────────────────────────────────────────────────────────────
function checkLaunchdSync() {
  if (!fs.existsSync(PLIST)) {
    log('error', 'infraestructura', 'Plist de launchd no encontrado en ~/Library/LaunchAgents/')
    return
  }

  const plistText = readText(PLIST)
  const mustSync  = ['JWT_SECRET', 'DATABASE_URL', 'GODMODE_USER_EMAIL', 'GODMODE_USER_PASSWORD',
                     'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'RESEND_API_KEY']
  const plistKeys = [...plistText.matchAll(/<key>([A-Z_][A-Z0-9_]*)<\/key>/g)].map(m => m[1])
  const missing   = mustSync.filter(k => !plistKeys.includes(k))

  if (missing.length > 0) {
    log('error', 'infraestructura', `Plist le faltan variables: ${missing.join(', ')}`,
      'Editar ~/Library/LaunchAgents/com.churchsystem.backend.plist y recargar')
  } else {
    log('ok', 'infraestructura', 'Plist tiene todas las variables críticas')
  }

  const launchctl = spawnSync('launchctl', ['list', 'com.churchsystem.backend'], { encoding: 'utf8' })
  if (launchctl.stdout.includes('"PID"')) {
    log('ok', 'infraestructura', 'launchd gestiona el backend activamente')
  } else {
    log('warn', 'infraestructura', 'launchd no reporta PID activo para com.churchsystem.backend',
      'Correr: launchctl load ~/Library/LaunchAgents/com.churchsystem.backend.plist')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 12 — sesiones_auth
// ─────────────────────────────────────────────────────────────────────────────
function checkSesionesAuth() {
  const sessionsFile = path.join(BACKEND, 'src/lib/sessions.js')
  if (!fs.existsSync(sessionsFile)) {
    log('error', 'sesiones_auth', 'src/lib/sessions.js no existe — tabla sesiones_auth no se crea al boot')
    return
  }
  const text = readText(sessionsFile)
  if (!text.includes('sesiones_auth')) {
    log('error', 'sesiones_auth', 'sessions.js no referencia la tabla sesiones_auth')
    return
  }
  log('ok', 'sesiones_auth', 'sessions.js define la tabla sesiones_auth al boot')

  if (/token_hash\s+TEXT\s+NOT NULL/.test(text)) {
    log('ok', 'sesiones_auth', 'token_hash definido como NOT NULL (sin hashes nulos posibles)')
  } else {
    log('warn', 'sesiones_auth', 'No se pudo verificar que token_hash sea NOT NULL en la definición')
  }

  // Verificar que auth.js importa de sessions.js
  const authFile = path.join(BACKEND, 'src/routes/auth.js')
  const authText = readText(authFile)
  if (authText.includes('from \'../lib/sessions.js\'') || authText.includes('from "../lib/sessions.js"')) {
    log('ok', 'sesiones_auth', 'auth.js importa correctamente desde sessions.js')
  } else {
    log('warn', 'sesiones_auth', 'auth.js no importa desde sessions.js — refresh tokens pueden no usar hashing')
  }

  // Verificar que /auth/registro es alias (tiene Deprecation header)
  if (authText.includes('Deprecation')) {
    log('ok', 'sesiones_auth', '/auth/registro marcado como deprecado con header Deprecation')
  } else {
    log('warn', 'sesiones_auth', '/auth/registro no tiene header Deprecation — endpoint duplicado activo')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 13 — Git
// ─────────────────────────────────────────────────────────────────────────────
function checkGit() {
  // NOTE: was CHECK 12 before sesiones_auth check was added
  const unpushed = shell('git log origin/master..HEAD --oneline')
  if (unpushed) {
    log('warn', 'git', `${unpushed.split('\n').length} commit(s) sin pushear`, unpushed)
  } else {
    log('ok', 'git', 'Todo pusheado a origin/master')
  }

  const uncommitted = shell('git status --short')
  if (uncommitted) {
    const lines = uncommitted.split('\n').filter(Boolean)
    log('warn', 'git', `${lines.length} archivo(s) con cambios sin commitear`, uncommitted)
  } else {
    log('ok', 'git', 'Working tree limpio')
  }

  const lastCommit = shell('git log --oneline -1')
  log('info', 'git', `Último commit: ${lastCommit}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Render texto
// ─────────────────────────────────────────────────────────────────────────────
function renderText(results) {
  const W    = 72
  const line = '─'.repeat(W)
  const now  = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

  const errors   = results.filter(r => r.level === 'error')
  const warnings = results.filter(r => r.level === 'warn')
  const oks      = results.filter(r => r.level === 'ok')
  const icon     = { error: FAIL, warn: WARN, ok: PASS, info: INFO }

  const status = errors.length > 0   ? '🔴 HAY ERRORES CRÍTICOS' :
                 warnings.length > 0 ? '🟡 HAY ADVERTENCIAS'     : '🟢 TODO OK'

  let out = []
  out.push('')
  out.push('╔' + '═'.repeat(W) + '╗')
  out.push('║' + '  CHURCH SYSTEM — AUDITORÍA INTEGRAL'.padEnd(W) + '║')
  out.push('║' + `  ${now}`.padEnd(W) + '║')
  out.push('╚' + '═'.repeat(W) + '╝')
  out.push('')
  out.push(`  Estado general : ${status}`)
  out.push(`  ${PASS} ${oks.length} OK   ${FAIL} ${errors.length} Errores   ${WARN} ${warnings.length} Advertencias`)
  out.push('')
  out.push(line)

  const cats = [...new Set(results.map(r => r.category))]
  for (const cat of cats) {
    const catResults = results.filter(r => r.category === cat)
    out.push('')
    out.push(`  【 ${cat.toUpperCase()} 】`)
    for (const r of catResults) {
      out.push(`  ${icon[r.level]} ${r.message}`)
      if (r.detail) {
        for (const dl of r.detail.split('\n').slice(0, 10)) {
          out.push(`       ${dl}`)
        }
      }
    }
  }

  out.push('')
  out.push(line)

  if (errors.length > 0) {
    out.push('')
    out.push('  ERRORES A RESOLVER:')
    for (const r of errors) {
      out.push(`  ${FAIL} [${r.category}] ${r.message}`)
      if (r.detail) out.push(`       → ${r.detail.split('\n')[0]}`)
    }
    out.push('')
  }

  return out.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('  Auditando Church System...\n')

  checkVersionSync()
  checkEnvVars()
  const serverUp = await checkLocalServer()
  if (serverUp) {
    await checkEndpoints()
    await checkPublicDomain()
  } else {
    log('warn', 'endpoints', 'Smoke tests omitidos — servidor no disponible')
    log('warn', 'dominio',   'Check de dominio omitido — servidor no disponible')
  }
  checkUnprotectedRoutes()
  checkLegacyImports()
  checkDependencies()
  checkFrontendBuild()
  checkCloudflare()
  checkLaunchdSync()
  checkSesionesAuth()
  checkGit()

  const output = AS_JSON ? JSON.stringify(results, null, 2) : renderText(results)
  console.log(output)

  if (OUT_FILE) {
    fs.writeFileSync(OUT_FILE, output, 'utf8')
    console.log(`\n  Log guardado en: ${OUT_FILE}`)
  }

  process.exit(results.some(r => r.level === 'error') ? 1 : 0)
}

main().catch(e => {
  console.error('Error fatal en auditoría:', e.message)
  process.exit(2)
})
