#!/usr/bin/env node
/**
 * Preflight antes de cortar DNS hacia Render.
 *
 * Uso:
 *   pnpm cutover:preflight
 *   RENDER_EXTERNAL_URL=https://church-system.onrender.com pnpm cutover:preflight
 *
 * No usa ni imprime secretos. Valida:
 *   - producción actual sigue viva
 *   - candidato Render responde /health y HTML
 *   - CORS permite el origen candidato
 *   - verify:prod:render todavía falla hasta que DNS deje el túnel local
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PROD_URL = (process.env.PROD_URL || 'https://churchsystem.com.ar').replace(/\/$/, '')
const RENDER_URL = (process.env.RENDER_EXTERNAL_URL || 'https://church-system.onrender.com').replace(/\/$/, '')
const DIST_INDEX = path.join(ROOT, 'frontend/dist/index.html')
const RENDER_YAML = path.join(ROOT, 'render.yaml')
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

let errors = 0
let warnings = 0

function log(icon, message, detail = '') {
  console.log(`${icon} ${message}`)
  if (detail) console.log(`   ${detail}`)
}

function ok(message, detail = '') { log('✅', message, detail) }
function warn(message, detail = '') { warnings += 1; log('⚠️ ', message, detail) }
function error(message, detail = '') { errors += 1; log('❌', message, detail) }

function requestOnce(url, { origin = null, timeoutMs = 12000, agent = undefined } = {}) {
  return new Promise((resolve) => {
    const headers = origin ? { Origin: origin } : {}
    const req = https.get(url, { timeout: timeoutMs, headers, agent }, (res) => {
      let body = ''
      res.on('data', chunk => {
        if (body.length < 8192) body += chunk
      })
      res.on('end', () => resolve({
        ok: true,
        status: res.statusCode,
        headers: res.headers,
        body,
      }))
    })
    req.on('error', err => resolve({ ok: false, error: err.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
  })
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function request(url, options = {}) {
  const strict = await requestOnce(url, options)
  if (strict.ok || !/certificate|issuer|self-signed|unable to verify/i.test(strict.error || '')) {
    return strict
  }
  const relaxed = await requestOnce(url, { ...options, agent: insecureAgent })
  return { ...relaxed, tlsWarning: strict.error }
}

async function checkCurrentProduction() {
  const res = await request(`${PROD_URL}/health`)
  if (res.tlsWarning) warn('Validación TLS local de Node falló; se reintentó con CA relajada', res.tlsWarning)
  if (res.ok && res.status === 200 && res.body.includes('"status":"ok"')) {
    ok('Producción actual sigue viva', `${PROD_URL}/health`)
  } else {
    error('Producción actual no respondió health OK', res.error || `HTTP ${res.status}`)
  }
}

async function checkRenderCandidate() {
  const health = await request(`${RENDER_URL}/health`, { origin: RENDER_URL })
  if (!health.ok) {
    error('Render candidato no responde /health', `${RENDER_URL}/health → ${health.error}`)
    return
  }
  if (health.status === 404 || health.status === 502 || health.status === 503) {
    error('Render candidato todavía no está listo', `${RENDER_URL}/health → HTTP ${health.status}`)
    return
  }
  if (health.status === 200 && health.body.includes('"status":"ok"')) {
    ok('Render candidato responde /health', `${RENDER_URL}/health`)
  } else {
    error('Render candidato /health inesperado', `HTTP ${health.status}: ${health.body.slice(0, 120)}`)
  }

  const allowOrigin = String(health.headers['access-control-allow-origin'] || '')
  if (allowOrigin === RENDER_URL || allowOrigin === '*') {
    ok('CORS permite el origen Render candidato', allowOrigin)
  } else {
    warn('CORS no confirmó el origen Render candidato', `access-control-allow-origin=${allowOrigin || '(vacío)'}`)
  }

  const root = await request(RENDER_URL)
  if (root.ok && root.status === 200 && /<html|<div id="root"|Church System/i.test(root.body)) {
    ok('Render candidato sirve HTML público', RENDER_URL)
  } else {
    error('Render candidato no sirvió HTML público', root.error || `HTTP ${root.status}`)
  }
}

function checkLocalArtifacts() {
  if (fs.existsSync(DIST_INDEX)) {
    ok('frontend/dist/index.html existe para deploy')
  } else {
    error('frontend/dist/index.html no existe; ejecutar cd frontend && pnpm build')
  }

  const renderYaml = fs.readFileSync(RENDER_YAML, 'utf8')
  if (renderYaml.includes('runtime: node') && renderYaml.includes('autoDeployTrigger: commit')) {
    ok('render.yaml usa campos Blueprint actuales')
  } else {
    warn('render.yaml no parece usar runtime/autoDeployTrigger actuales')
  }

  if (renderYaml.includes('pnpm@9.15.5') && renderYaml.includes('pnpm install --force --frozen-lockfile')) {
    ok('render.yaml fuerza pnpm estable y lockfiles')
  } else {
    warn('render.yaml no parece tener build hardening completo')
  }

  if (renderYaml.includes('https://church-system.onrender.com') || renderYaml.includes('RENDER_EXTERNAL_URL')) {
    ok('render.yaml contempla origen Render candidato/pre-DNS')
  } else {
    warn('render.yaml no lista origen Render candidato en ALLOWED_ORIGINS')
  }
}

function checkMigrationInventory() {
  const result = run('node', ['scripts/check-migration-env.mjs'])
  if (result.status === 0) {
    ok('Inventario de env para migración pasa sin errores')
  } else {
    error('Inventario de env para migración falló', result.stdout || result.stderr)
  }
}

function checkStrictProdExpectedState() {
  const result = run('node', ['scripts/verify-prod.mjs', '--require-render'])
  if (result.status === 0) {
    ok('DNS/origen público ya cortó a Render')
  } else {
    warn('DNS/origen público todavía no cortó a Render', 'Esperado antes del cambio DNS; debe pasar después del corte.')
  }
}

console.log('\nChurch System — preflight corte Render')
console.log(`Producción actual: ${PROD_URL}`)
console.log(`Render candidato: ${RENDER_URL}`)

checkLocalArtifacts()
checkMigrationInventory()
await checkCurrentProduction()
await checkRenderCandidate()
checkStrictProdExpectedState()

console.log(`\nResultado: ${errors} error(es), ${warnings} advertencia(s)`)
process.exitCode = errors > 0 ? 1 : 0
