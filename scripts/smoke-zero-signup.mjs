#!/usr/bin/env node
import http from 'node:http'
import https from 'node:https'

const DEFAULT_BASE_URL = 'https://churchsystem.com.ar'
const TEST_PASSWORD = 'ChurchSmoke2026!'
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

function parseArgs(argv) {
  const cleanArgv = argv.filter(arg => arg !== '--')
  const valueAfter = name => {
    const i = cleanArgv.indexOf(name)
    return i >= 0 ? cleanArgv[i + 1] : ''
  }
  return {
    baseUrl: valueAfter('--base-url') || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
    dryRun: cleanArgv.includes('--dry-run'),
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
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const baseUrl = opts.baseUrl

  console.log(`Base URL: ${baseUrl}`)
  const health = await fetchJson(buildUrl(baseUrl, '/health'))
  assert(health?.status === 'ok', 'Healthcheck no devolvió status=ok')
  console.log('OK health')

  const plans = await fetchJson(buildUrl(baseUrl, '/plan/lista?country=AR&lang=es'))
  assert(Array.isArray(plans), 'El catálogo de planes no es un array')
  for (const planId of ['FREE', 'PRO', 'MAX']) {
    assert(plans.some(plan => plan.id === planId), `Falta plan ${planId}`)
  }
  assert(plans.some(plan => plan.audience === 'church'), 'Faltan tarjetas de planes para iglesias')
  console.log(`OK catálogo: ${plans.length} tarjetas`)

  if (opts.dryRun) {
    console.log('Dry-run: no se creó cuenta de prueba.')
    process.exit(0)
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const email = `reset-smoke+${stamp}@churchsystem.test`
  const payload = {
    nombreIglesia: `Smoke Church ${stamp}`,
    nombre: 'Smoke Test',
    apellido: 'Signup',
    email,
    password: TEST_PASSWORD,
    telefono: '+5491100000000',
    plan: 'FREE',
    country: 'AR',
    currency: 'ARS',
    lang: 'es',
  }

  const signup = await fetchJson(buildUrl(baseUrl, '/registro/crear'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  assert(signup?.ok === true, 'Signup no devolvió ok=true')
  assert(signup?.token, 'Signup no devolvió access token')
  assert(signup?.refreshToken, 'Signup no devolvió refresh token')
  assert(signup?.user?.iglesiaId, 'Signup no devolvió iglesiaId')
  assert(signup?.user?.apellido === payload.apellido, 'Signup no devolvió el apellido cargado')
  assert(Number(signup?.trial?.dias || 0) === 30, 'Trial inicial no es de 30 días')
  console.log(`OK signup: ${email}`)

  const me = await fetchJson(buildUrl(baseUrl, '/auth/me'), { headers: { Authorization: `Bearer ${signup.token}` } })
  assert(me?.apellido === payload.apellido, 'auth/me no preservó el apellido del signup')
  console.log(`OK perfil auth: ${me.nombre} ${me.apellido}`)

  const authHeaders = { Authorization: `Bearer ${signup.token}` }
  const billing = await fetchJson(buildUrl(baseUrl, '/subscriptions/billing-estado'), { headers: authHeaders })
  assert(billing?.ok === true, 'Billing no devolvió ok=true')
  assert(billing?.enTrial === true, 'La cuenta nueva no quedó en trial')
  assert(billing?.montoPRO && billing?.montoMAX, 'Billing no devolvió tarjetas PRO/MAX')
  console.log(`OK billing: trial ${billing.diasTrial} días, plan efectivo ${billing.efectivePlan}`)

  const onboarding = await fetchJson(buildUrl(baseUrl, '/subscriptions/onboarding-progreso'), { headers: authHeaders })
  assert(onboarding?.ok === true, 'Onboarding no devolvió ok=true')
  assert(Number(onboarding.users || 0) >= 1, 'Onboarding no cuenta el usuario inicial')
  console.log('OK onboarding inicial')

  console.log('\nCuenta de prueba creada para inspección:')
  console.log(`  email: ${email}`)
  console.log(`  password: ${TEST_PASSWORD}`)
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
