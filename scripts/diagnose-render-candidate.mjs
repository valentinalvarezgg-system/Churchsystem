#!/usr/bin/env node
/**
 * Diagnóstico puntual del candidato Render antes del cutover.
 *
 * Uso:
 *   pnpm render:diagnose
 *   RENDER_EXTERNAL_URL=https://church-system.onrender.com pnpm render:diagnose
 *
 * No imprime secretos. Intenta distinguir entre:
 *   - servicio inexistente / dormido / sin deploy
 *   - healthcheck caído
 *   - HTML público ausente
 *   - falta de acceso local al dashboard/CLI para seguir depurando
 */

import dns from 'node:dns/promises'
import https from 'node:https'
import { spawnSync } from 'node:child_process'

const renderUrl = (process.env.RENDER_EXTERNAL_URL || 'https://church-system.onrender.com').replace(/\/$/, '')
const hostname = new URL(renderUrl).hostname
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

const checks = []

function record(level, name, message, detail = null) {
  checks.push({ level, name, message, detail })
}

function getOnce(url, timeoutMs = 12000, options = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs, ...options }, (res) => {
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
    req.on('error', error => resolve({ ok: false, error: error.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
  })
}

async function get(url, timeoutMs = 12000) {
  const strict = await getOnce(url, timeoutMs)
  if (strict.ok || !/certificate|issuer|self-signed|unable to verify/i.test(strict.error || '')) {
    return strict
  }
  const relaxed = await getOnce(url, timeoutMs, { agent: insecureAgent })
  return { ...relaxed, tlsWarning: strict.error }
}

function shell(command, args = []) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || result.error?.message || '').trim(),
  }
}

async function checkDns() {
  try {
    const cnames = await dns.resolveCname(hostname)
    record('info', 'dns', `${hostname} CNAME`, cnames.join(', '))
  } catch {
    try {
      const addresses = await dns.resolve4(hostname)
      record('info', 'dns', `${hostname} A/flattened`, addresses.join(', '))
    } catch (error) {
      record('error', 'dns', `${hostname} no resolvió DNS`, error.message)
    }
  }
}

async function checkHealthAndRoot() {
  const health = await get(`${renderUrl}/health`)
  if (health.tlsWarning) {
    record('warn', 'tls', 'Validación TLS de Node falló; se reintentó con CA relajada', health.tlsWarning)
  }

  if (!health.ok) {
    record('error', 'health', `${renderUrl}/health no responde`, health.error)
    if (health.error === 'timeout') {
      record('warn', 'likely-cause', 'Timeout total del candidato Render', 'Probables causas: servicio no desplegado, deploy colgado, instancia caída o healthcheck bloqueado antes de servir tráfico.')
    }
    return
  }

  if (health.status === 200 && health.body.includes('"status":"ok"')) {
    record('ok', 'health', `${renderUrl}/health responde OK`)
  } else if ([404, 502, 503].includes(health.status)) {
    record('error', 'health', `${renderUrl}/health devolvió HTTP ${health.status}`, health.body.slice(0, 160))
    record('warn', 'likely-cause', `Healthcheck HTTP ${health.status}`, 'Probables causas: startCommand fallando, servicio sin bind a PORT, variables mínimas faltantes o deploy aún no healthy.')
  } else {
    record('error', 'health', `${renderUrl}/health devolvió HTTP ${health.status}`, health.body.slice(0, 160))
  }

  const root = await get(renderUrl)
  if (!root.ok) {
    record('error', 'web', `${renderUrl} no responde raíz pública`, root.error)
    return
  }

  if (root.status === 200 && /<html|<div id="root"|Church System/i.test(root.body)) {
    record('ok', 'web', `${renderUrl} responde HTML público`)
  } else {
    record('warn', 'web', `${renderUrl} no confirmó HTML público`, `HTTP ${root.status}: ${root.body.slice(0, 160)}`)
  }
}

function checkRenderAccess() {
  const cli = shell('render', ['--version'])
  if (cli.ok || process.env.RENDER_API_KEY) {
    record('ok', 'access', 'Hay acceso local para depurar Render (CLI o API key)')
  } else {
    record('warn', 'access', 'Sin render CLI ni RENDER_API_KEY', 'No puedo inspeccionar logs/deploys del servicio remoto desde esta sesión.')
  }
}

function suggestNextStep() {
  const hasHealthOk = checks.some(check => check.name === 'health' && check.level === 'ok')
  const healthTimeout = checks.some(check => check.name === 'health' && check.detail === 'timeout')
  const hasAccess = checks.some(check => check.name === 'access' && check.level === 'ok')

  if (hasHealthOk) {
    record('ok', 'next-step', 'El candidato Render está sano', 'Ya podés correr pnpm cutover:preflight y luego preparar el corte DNS/origen.')
    return
  }

  if (healthTimeout && hasAccess) {
    record('warn', 'next-step', 'Entrar a logs/deploys de Render', 'Revisar último deploy, env vars mínimas y si el proceso llega a escuchar PORT antes del timeout.')
    return
  }

  if (healthTimeout) {
    record('warn', 'next-step', 'Bloqueo externo confirmado', 'Hace falta entrar al dashboard Render, confirmar que el servicio exista, tenga secretos cargados y muestre un deploy healthy.')
    return
  }

  record('warn', 'next-step', 'Seguir debug de Render', 'Correlacionar status HTTP, logs del deploy y health checks en Render antes de tocar DNS.')
}

function renderSummary() {
  const icon = { ok: '✅', warn: '⚠️ ', error: '❌', info: 'ℹ️ ' }
  console.log('\nChurch System — diagnóstico candidato Render')
  console.log(`URL: ${renderUrl}`)
  for (const check of checks) {
    console.log(`${icon[check.level]} [${check.name}] ${check.message}`)
    if (check.detail) console.log(`   ${check.detail}`)
  }

  const errors = checks.filter(check => check.level === 'error').length
  const warnings = checks.filter(check => check.level === 'warn').length
  console.log(`\nResultado: ${errors} error(es), ${warnings} advertencia(s)`)
  process.exitCode = errors > 0 ? 1 : 0
}

await checkDns()
await checkHealthAndRoot()
checkRenderAccess()
suggestNextStep()
renderSummary()
