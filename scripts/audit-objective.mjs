#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const requireFromBackend = createRequire(new URL('../backend/package.json', import.meta.url))
const bcrypt = requireFromBackend('bcryptjs')

const DEFAULT_BASE_URL = 'https://churchsystem.com.ar'
const QA_EMAILS = [
  'qa.godmode@churchsystem.test',
  'qa.pastor.general@churchsystem.test',
  'qa.pastor.culto@churchsystem.test',
  'qa.consolidacion@churchsystem.test',
  'qa.staff@churchsystem.test',
  'qa.lider@churchsystem.test',
  'qa.plan.free@churchsystem.test',
  'qa.plan.pro@churchsystem.test',
  'qa.plan.max@churchsystem.test',
  'qa.plan.church100@churchsystem.test',
  'qa.plan.church500@churchsystem.test',
  'qa.plan.church1000@churchsystem.test',
]
const REQUIRED_ROLES = ['GODMODE', 'PASTOR_GENERAL', 'PASTOR_CULTO', 'CONSOLIDACION', 'STAFF', 'LIDER']
const REQUIRED_PLANS = ['GODMODE', 'FREE', 'PRO', 'MAX', 'CHURCH_100', 'CHURCH_500', 'CHURCH_1000']
const RESET_TABLES = [
  'Persona',
  'Grupo',
  'Culto',
  'Mensaje',
  'Comunicado',
  'Permiso',
  'AuditLog',
]
const RESET_PUBLIC_TABLES = ['payments', 'suscripciones']
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

function parseArgs(argv) {
  const clean = argv.filter(arg => arg !== '--')
  const valueAfter = name => {
    const i = clean.indexOf(name)
    return i >= 0 ? clean[i + 1] : ''
  }
  return {
    baseUrl: valueAfter('--base-url') || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
    qaPassword: process.env.QA_TEST_PASSWORD || '',
    strictQaPassword: clean.includes('--strict-qa-password'),
  }
}

function loadEnvFile(path = 'backend/.env') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

function buildUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function requestText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const transport = parsed.protocol === 'http:' ? http : https
    const body = options.body || ''
    const req = transport.request(parsed, {
      method: options.method || 'GET',
      timeout: 15000,
      agent: options.agent,
      headers: {
        Accept: 'application/json,text/html',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
    }, res => {
      let text = ''
      res.on('data', chunk => { text += chunk })
      res.on('end', () => resolve({ status: res.statusCode || 0, statusText: res.statusMessage || '', text }))
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    if (body) req.write(body)
    req.end()
  })
}

async function fetchText(url, options = {}) {
  try {
    return await requestText(url, options)
  } catch (error) {
    if (!/certificate|issuer|self-signed|unable to verify/i.test(error.message || '')) throw error
    warning('tls', `Node TLS no validó CA local; reintento seguro para auditoría: ${error.message}`)
    return requestText(url, { ...options, agent: insecureAgent })
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetchText(url, options)
  let json = null
  try { json = response.text ? JSON.parse(response.text) : null } catch {}
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${response.status} ${response.statusText} en ${url}: ${json?.error || response.text.slice(0, 160)}`)
  }
  return json
}

const results = { ok: 0, warnings: 0, errors: 0 }

function ok(scope, message) {
  results.ok += 1
  console.log(`✅ [${scope}] ${message}`)
}

function warning(scope, message) {
  results.warnings += 1
  console.warn(`⚠️  [${scope}] ${message}`)
}

function error(scope, message) {
  results.errors += 1
  console.error(`❌ [${scope}] ${message}`)
}

function assertCheck(scope, condition, message, detail = '') {
  if (condition) ok(scope, message)
  else error(scope, detail || message)
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function rg(pattern, paths) {
  try {
    const out = execFileSync('rg', ['-n', pattern, ...paths], { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean)
  } catch (err) {
    if (err.status === 1) return []
    throw err
  }
}

async function auditProduction(baseUrl) {
  const health = await fetchJson(buildUrl(baseUrl, '/health'))
  assertCheck('prod', health?.status === 'ok', 'health público responde status=ok')

  const root = await fetchText(buildUrl(baseUrl, '/'))
  assertCheck('prod', root.status >= 200 && root.status < 300 && /<html/i.test(root.text), 'home pública responde HTML')

  const plans = await fetchJson(buildUrl(baseUrl, '/plan/lista?country=AR&lang=es'))
  assertCheck('planes', Array.isArray(plans) && plans.length >= 7, 'catálogo público expone al menos 7 tarjetas')
  for (const planId of ['FREE', 'PRO', 'MAX']) {
    assertCheck('planes', plans.some(plan => plan.id === planId), `plan ${planId} disponible`)
  }
}

function auditStaticCode() {
  const packageRoot = JSON.parse(read('package.json'))
  const packageBack = JSON.parse(read('backend/package.json'))
  const packageFront = JSON.parse(read('frontend/package.json'))
  const readme = read('README.md')
  const versions = new Set([packageRoot.version, packageBack.version, packageFront.version])
  assertCheck('versiones', versions.size === 1 && readme.includes(`v${packageRoot.version}`), `versiones sincronizadas en v${packageRoot.version}`)

  assertCheck('frontend', rg('alert\\(|confirm\\(', ['frontend/src', 'backend/src']).length === 0, 'sin alert()/confirm() nativos en runtime')
  assertCheck('frontend', !fs.existsSync('frontend/src/hooks/useToast.js'), 'sin hooks/useToast.js legacy')

  const hardcodedLocalhost = rg('localhost:4000|127\\.0\\.0\\.1:4000', ['frontend/src'])
    .filter(line => !line.startsWith('frontend/src/services/api.js:'))
  assertCheck('frontend', hardcodedLocalhost.length === 0, 'sin localhost:4000 hardcodeado fuera de api.js', hardcodedLocalhost.join('\n'))

  const authMiddleware = read('backend/src/middlewares/auth.js')
  const requireAuthBlock = authMiddleware.split('export async function requireMiembro')[0]
  assertCheck('auth', !requireAuthBlock.includes('req.query.token'), 'requireAuth no acepta JWT por query string')

  const oauth = read('backend/src/routes/oauth.js')
  assertCheck('oauth', !/token=/.test(oauth), 'OAuth no redirige con JWT en URL')
  assertCheck('oauth', /signedOAuthState/.test(oauth) && /readOAuthState/.test(oauth), 'OAuth preserva contexto comercial con state firmado')

  const registro = read('frontend/src/pages/Registro.jsx')
  const login = read('frontend/src/pages/Login.jsx')
  assertCheck('signup', registro.includes('/registro/crear'), 'signup usa endpoint unificado /registro/crear')
  assertCheck('signup', registro.includes("searchParams.get('oauth')") && registro.includes('/auth/refresh'), 'signup OAuth usa refresh cookie sin JWT en URL')
  assertCheck('login', login.includes("searchParams.get('oauth')") && login.includes('/auth/refresh'), 'login OAuth usa refresh cookie sin JWT en URL')
  assertCheck('auth', !registro.includes("searchParams.get('token')") && !login.includes("searchParams.get('token')"), 'frontend no consume JWT desde query string')

  const wizard = read('frontend/src/pages/SetupWizard.jsx')
  assertCheck('onboarding', wizard.includes('onboarding_billing_confirmed') && wizard.includes('onboarding_plan'), 'SetupWizard guarda etapa de facturación')
  assertCheck('onboarding', /Facturaci[oó]n/.test(wizard), 'SetupWizard muestra etapa intermedia de facturación')

  const configRoute = read('backend/src/routes/config.js')
  assertCheck('onboarding', configRoute.includes('onboarding_billing_confirmed') && configRoute.includes('onboarding_plan'), 'backend permite guardar configuración de onboarding/facturación')

  assertCheck('backend', rg("from ['\\\"].*sql\\.js|from ['\\\"].*lib/db\\.js|require\\(['\\\"].*sql\\.js|require\\(['\\\"].*lib/db\\.js", ['backend/src']).length === 0, 'sin sql.js/lib/db.js en runtime backend')

  const backendPlist = `${process.env.HOME || ''}/Library/LaunchAgents/com.churchsystem.backend.plist`
  if (fs.existsSync(backendPlist)) {
    const plist = read(backendPlist)
    assertCheck('ops', !plist.includes('<key>EnvironmentVariables</key>'), 'backend launchd no guarda EnvironmentVariables sensibles')
    assertCheck('ops', plist.includes('scripts/run-backend-launchd.sh'), 'backend launchd usa wrapper con backend/.env')
  } else {
    warning('ops', 'backend launchd plist no encontrado; se omite chequeo local de secretos')
  }
}

async function auditDatabase(qaPassword, strictQaPassword) {
  if (!process.env.DATABASE_URL) {
    error('db', 'DATABASE_URL no configurado; no se puede auditar reset/QA')
    return
  }
  const { pgMany, pgOne } = await import('../backend/src/lib/pg.js')

  for (const table of RESET_TABLES) {
    const hasDeletedAt = await pgOne(
      `SELECT EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'deletedAt'
       ) AS ok`,
      [table]
    )
    const deletedFilter = hasDeletedAt?.ok ? 'WHERE "deletedAt" IS NULL' : ''
    const row = await pgOne(`SELECT COUNT(*)::int AS total FROM "${table}" ${deletedFilter}`)
    assertCheck('reset', Number(row?.total || 0) === 0, `"${table}" sin datos tenant activos`, `"${table}" tiene ${row?.total || 0} fila(s)`)
  }
  for (const table of RESET_PUBLIC_TABLES) {
    const row = await pgOne(`SELECT COUNT(*)::int AS total FROM ${table}`)
    assertCheck('reset', Number(row?.total || 0) === 0, `${table} sin datos de billing previos`, `${table} tiene ${row?.total || 0} fila(s)`)
  }

  const roles = await pgMany('SELECT "codigo" FROM "Rol" WHERE "codigo" = ANY($1) ORDER BY "codigo"', [REQUIRED_ROLES])
  const roleCodes = new Set(roles.map(row => row.codigo))
  for (const role of REQUIRED_ROLES) {
    assertCheck('qa', roleCodes.has(role), `rol ${role} disponible`)
  }

  const users = await pgMany(
    `SELECT id, email, rol, plan, activo, "emailVerificado", "es_superadmin", password
       FROM "User"
      WHERE lower(email) = ANY($1)
        AND "deletedAt" IS NULL
      ORDER BY email`,
    [QA_EMAILS]
  )
  const usersByEmail = new Map(users.map(user => [String(user.email).toLowerCase(), user]))
  for (const email of QA_EMAILS) {
    const user = usersByEmail.get(email)
    assertCheck('qa', Boolean(user?.activo && user?.emailVerificado), `${email} activo y verificado`)
  }

  const god = usersByEmail.get('qa.godmode@churchsystem.test')
  assertCheck('godmode', Boolean(god?.es_superadmin && god?.rol === 'GODMODE'), 'qa.godmode tiene rol GODMODE y es_superadmin=true')

  const userPlans = new Set(users.map(user => user.plan))
  for (const plan of REQUIRED_PLANS) {
    assertCheck('qa', userPlans.has(plan), `cuenta QA para plan ${plan}`)
  }

  if (!qaPassword) {
    const message = 'QA_TEST_PASSWORD ausente; se verificó existencia de cuentas pero no login por contraseña'
    if (strictQaPassword) error('qa-login', message)
    else warning('qa-login', message)
    return
  }

  let passwordOk = true
  for (const email of QA_EMAILS) {
    const user = usersByEmail.get(email)
    const matches = user?.password ? await bcrypt.compare(qaPassword, user.password) : false
    if (!matches) {
      passwordOk = false
      error('qa-login', `${email} no matchea QA_TEST_PASSWORD`)
    }
  }
  if (passwordOk) ok('qa-login', 'todas las cuentas QA matchean QA_TEST_PASSWORD')
}

async function auditAuthRuntime(baseUrl, qaPassword, strictQaPassword) {
  if (!qaPassword) return
  const login = await fetchJson(buildUrl(baseUrl, '/auth/login'), {
    method: 'POST',
    body: JSON.stringify({ email: 'qa.godmode@churchsystem.test', password: qaPassword }),
  })
  assertCheck('godmode', Boolean(login?.token && login?.user?.es_superadmin), 'login GodMode devuelve token y es_superadmin')
  const overview = await fetchJson(buildUrl(baseUrl, '/godmode/overview'), {
    headers: { Authorization: `Bearer ${login.token}` },
  })
  assertCheck('godmode', Boolean(overview?.totals), 'GodMode overview responde con token QA')

  const queryToken = await fetchText(buildUrl(baseUrl, `/personas?token=${encodeURIComponent(login.token)}`))
  assertCheck('auth', queryToken.status === 401, 'JWT admin por query string queda bloqueado')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  loadEnvFile()
  console.log(`Church System — auditoría objetivo`)
  console.log(`URL: ${opts.baseUrl}`)

  await auditProduction(opts.baseUrl)
  auditStaticCode()
  await auditDatabase(opts.qaPassword, opts.strictQaPassword)
  await auditAuthRuntime(opts.baseUrl, opts.qaPassword, opts.strictQaPassword)

  console.log(`\nResultado: ${results.errors} error(es), ${results.warnings} advertencia(s), ${results.ok} check(s) OK`)
  if (results.errors > 0) process.exit(1)
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
