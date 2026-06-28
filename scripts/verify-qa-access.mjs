#!/usr/bin/env node
import http from 'node:http'
import https from 'node:https'

const DEFAULT_BASE_URL = 'http://127.0.0.1:4000'
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

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

const FRIENDLY_EMAILS = [
  'godmode@test.com',
  'pastor@test.com',
  'culto@test.com',
  'consolidacion@test.com',
  'staff@test.com',
  'lider@test.com',
  'free@test.com',
  'pro@test.com',
  'max@test.com',
  'church100@test.com',
  'church500@test.com',
  'church1000@test.com',
]

function parseArgs(argv) {
  const clean = argv.filter(arg => arg !== '--')
  const valueAfter = name => {
    const index = clean.indexOf(name)
    return index >= 0 ? clean[index + 1] : ''
  }
  return {
    baseUrl: valueAfter('--base-url') || process.env.QA_VERIFY_BASE_URL || DEFAULT_BASE_URL,
    password: valueAfter('--password') || process.env.QA_TEST_PASSWORD || '',
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
        Accept: 'application/json',
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

async function fetchJson(url, options = {}) {
  let response
  try {
    response = await requestText(url, options)
  } catch (error) {
    if (!/certificate|issuer|self-signed|unable to verify/i.test(error.message || '')) throw error
    response = await requestText(url, { ...options, agent: insecureAgent })
    console.warn(`WARN TLS Node: ${error.message}`)
  }
  let json = null
  try { json = response.text ? JSON.parse(response.text) : null } catch {}
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${response.status} ${response.statusText} en ${url}: ${json?.error || response.text.slice(0, 160)}`)
  }
  return json
}

async function login(baseUrl, email, password) {
  return fetchJson(buildUrl(baseUrl, '/auth/login'), {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.password) {
    console.error('Falta QA_TEST_PASSWORD o --password para verificar accesos QA.')
    process.exit(1)
  }

  console.log(`Base URL: ${opts.baseUrl}`)
  const health = await fetchJson(buildUrl(opts.baseUrl, '/health'))
  if (health?.status !== 'ok') throw new Error('Healthcheck no devolvió status=ok')
  console.log('OK health')

  const qaLogins = []
  for (const email of QA_EMAILS) {
    const result = await login(opts.baseUrl, email, opts.password)
    if (!result?.token || !result?.user?.email) throw new Error(`Login QA inválido para ${email}`)
    qaLogins.push({ email, rol: result.user.rol, plan: result.user.plan })
  }
  console.log(`OK QA formales: ${qaLogins.length} cuentas`)

  const aliasLogins = []
  for (const email of FRIENDLY_EMAILS) {
    const result = await login(opts.baseUrl, email, opts.password)
    if (!result?.token || !result?.user?.email) throw new Error(`Login alias inválido para ${email}`)
    aliasLogins.push({ email, rol: result.user.rol, plan: result.user.plan })
  }
  console.log(`OK aliases amigables: ${aliasLogins.length} cuentas`)

  const godmode = await login(opts.baseUrl, 'godmode@test.com', opts.password)
  if (!godmode?.user?.es_superadmin || godmode?.user?.rol !== 'GODMODE') {
    throw new Error('godmode@test.com no devolvió rol GODMODE + es_superadmin=true')
  }
  const overview = await fetchJson(buildUrl(opts.baseUrl, '/godmode/overview'), {
    headers: { Authorization: `Bearer ${godmode.token}` },
  })
  if (!overview?.kpis) throw new Error('GodMode overview no devolvió KPIs')
  console.log(`OK GodMode overview: users=${overview.kpis.totalUsers} churches=${overview.kpis.totalChurches}`)

  console.log('\nResumen QA')
  for (const item of qaLogins) console.log(`  formal  ${item.email} → ${item.rol} / ${item.plan}`)
  for (const item of aliasLogins) console.log(`  alias   ${item.email} → ${item.rol} / ${item.plan}`)
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
