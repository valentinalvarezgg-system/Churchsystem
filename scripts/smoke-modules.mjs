#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://127.0.0.1:4000'
const DEFAULT_EMAIL = 'qa.pastor.general@churchsystem.test'

const MODULE_TESTS = [
  ['health', 'GET', '/health', [200], false],
  ['auth me', 'GET', '/auth/me', [200], true],
  ['stats overview', 'GET', '/stats/overview', [200], true],
  ['stats premium', 'GET', '/stats/premium', [200], true],
  ['personas listado', 'GET', '/personas?limit=5', [200], true],
  ['grupos listado', 'GET', '/grupos', [200], true],
  ['cultos listado', 'GET', '/cultos', [200], true],
  ['cultos stats', 'GET', '/cultos/stats', [200], true],
  ['alertas', 'GET', '/alertas', [200], true],
  ['mensajes', 'GET', '/mensajes', [200], true],
  ['mensajes plantillas', 'GET', '/mensajes/plantillas', [200], true],
  ['config', 'GET', '/config', [200], true],
  ['config diagnostics', 'GET', '/config/launch-readiness', [200], true],
  ['eventos', 'GET', '/eventos', [200], true],
  ['eventos proximos', 'GET', '/eventos/proximos', [200], true],
  ['reportes semanal', 'GET', '/reportes/semanal', [200], true],
  ['reportes mensual', 'GET', '/reportes/mensual', [200], true],
  ['reportes general', 'GET', '/reportes/general?periodo=mes', [200], true],
  ['discipulado', 'GET', '/discipulado', [200], true],
  ['discipulado stats', 'GET', '/discipulado/stats', [200], true],
  ['discipulado arbol', 'GET', '/discipulado/arbol', [200], true],
  ['ministerios', 'GET', '/ministerios', [200], true],
  ['analytics resumen', 'GET', '/analytics/resumen', [200], true],
  ['documentos', 'GET', '/documentos', [200], true],
  ['comunicados', 'GET', '/comunicados', [200], true],
  ['comunicados programados', 'GET', '/comunicados/programados', [200], true],
  ['consolidacion', 'GET', '/consolidacion', [200], true],
  ['consolidacion stats', 'GET', '/consolidacion/stats', [200], true],
  ['plan me', 'GET', '/plan/me', [200], true],
  ['plan lista', 'GET', '/plan/lista?country=AR&lang=es', [200], false],
  ['billing estado', 'GET', '/subscriptions/billing-estado', [200], true],
  ['onboarding progreso', 'GET', '/subscriptions/onboarding-progreso', [200], true],
  ['subscriptions plans', 'GET', '/subscriptions/plans', [200], true],
  ['notificaciones vapid', 'GET', '/notificaciones/vapid-key', [200], true],
  ['permisos actual', 'GET', '/permisos/me/actual', [200], true],
  ['mi perfil', 'GET', '/mi-perfil', [200], true],
  ['users admin', 'GET', '/users', [200], true],
  ['invitaciones', 'GET', '/invitaciones', [200], true],
  ['culto asignaciones', 'GET', '/culto-asignaciones', [200], true],
  ['backup info', 'GET', '/backup/info', [200], true],
  ['mercadopago estado', 'GET', '/mp/estado', [200], true],
  ['mercadopago qa', 'GET', '/mp/qa', [200], true],
  ['finanzas bloqueado legal', 'GET', '/finanzas', [404], true],
  ['oracion bloqueado legal', 'GET', '/oracion', [404], true],
]

function parseArgs(argv) {
  const clean = argv.filter(arg => arg !== '--')
  const valueAfter = name => {
    const index = clean.indexOf(name)
    return index >= 0 ? clean[index + 1] : ''
  }
  return {
    baseUrl: (valueAfter('--base-url') || process.env.MODULE_SMOKE_BASE_URL || process.env.PROD_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    email: valueAfter('--email') || process.env.MODULE_SMOKE_EMAIL || DEFAULT_EMAIL,
    password: valueAfter('--password') || process.env.QA_TEST_PASSWORD || '',
    timeoutMs: Number(valueAfter('--timeout-ms') || process.env.MODULE_SMOKE_TIMEOUT_MS || 20000),
  }
}

function summarizeBody(text) {
  return (text || '').replace(/\s+/g, ' ').slice(0, 140)
}

function percentile(values, ratio) {
  if (!values.length) return 0
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))]
}

async function request(baseUrl, path, { method = 'GET', token = '', body, auth = true, timeoutMs } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && token) headers.Authorization = `Bearer ${token}`

  const start = performance.now()
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch {}
    return { status: res.status, elapsed: Math.round(performance.now() - start), text, json }
  } catch (err) {
    return { status: 0, elapsed: Math.round(performance.now() - start), text: err.message, json: null }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.password) {
    console.error('Falta QA_TEST_PASSWORD o --password para ejecutar smoke:modules.')
    process.exit(1)
  }

  console.log(`Base URL: ${opts.baseUrl}`)
  const login = await request(opts.baseUrl, '/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: opts.email, password: opts.password },
    timeoutMs: opts.timeoutMs,
  })
  if (login.status !== 200) {
    throw new Error(`Login falló status=${login.status} ${login.elapsed}ms: ${summarizeBody(login.text)}`)
  }

  const token = login.json?.token || login.json?.accessToken || login.json?.access_token
  const user = login.json?.user || login.json?.usuario || login.json?.data?.user
  if (!token) throw new Error(`Login no devolvió token: ${summarizeBody(login.text)}`)
  console.log(`LOGIN OK ${opts.email} role=${user?.rol || user?.role || 'n/a'} plan=${user?.plan || user?.planCodigo || 'n/a'} ${login.elapsed}ms`)

  const results = []
  for (const [name, method, path, expectedStatuses, needsAuth] of MODULE_TESTS) {
    const result = await request(opts.baseUrl, path, {
      method,
      token,
      auth: needsAuth,
      timeoutMs: opts.timeoutMs,
    })
    const pass = expectedStatuses.includes(result.status)
    results.push({ name, method, path, expectedStatuses, pass, ...result })
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${String(result.status).padStart(3)} ${String(result.elapsed).padStart(5)}ms ${name} ${path}${pass ? '' : ` :: ${summarizeBody(result.text)}`}`)
  }

  const elapsed = results.map(result => result.elapsed).sort((a, b) => a - b)
  const failures = results.filter(result => !result.pass)
  const summary = {
    base: opts.baseUrl,
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    p50ms: percentile(elapsed, 0.5),
    p95ms: percentile(elapsed, 0.95),
    maxms: elapsed.at(-1) || 0,
    slow: results
      .filter(result => result.pass && result.elapsed > 1500)
      .sort((a, b) => b.elapsed - a.elapsed)
      .map(result => ({ name: result.name, status: result.status, ms: result.elapsed, path: result.path })),
    failures: failures.map(result => ({
      name: result.name,
      status: result.status,
      expected: result.expectedStatuses,
      path: result.path,
      body: summarizeBody(result.text),
    })),
  }

  console.log(`\nSUMMARY ${JSON.stringify(summary, null, 2)}`)
  process.exit(failures.length ? 1 : 0)
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
