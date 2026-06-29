#!/usr/bin/env node
/**
 * Verificador de producción para Church System.
 *
 * Uso:
 *   node scripts/verify-prod.mjs
 *   node scripts/verify-prod.mjs --require-render
 *
 * Este script no imprime secretos. Solo confirma salud pública y detecta si el
 * dominio sigue dependiendo del túnel local de Cloudflare.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import dns from 'node:dns/promises'
import https from 'node:https'
import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const requireRender = args.has('--require-render')
const prodUrl = (process.env.PROD_URL || 'https://churchsystem.com.ar').replace(/\/$/, '')
const prodHostname = new URL(prodUrl).hostname
const renderUrl = (process.env.RENDER_EXTERNAL_URL || 'https://church-system.onrender.com').replace(/\/$/, '')
const cloudflaredConfig = path.join(os.homedir(), '.cloudflared/config.yml')
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

const checks = []

function record(level, name, message, detail = null) {
  checks.push({ level, name, message, detail })
}

function getOnce(url, timeoutMs = 10000, options = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs, ...options }, (res) => {
      let body = ''
      res.on('data', chunk => {
        if (body.length < 4096) body += chunk
      })
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body }))
    })
    req.on('error', error => resolve({ ok: false, error: error.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
  })
}

async function get(url, timeoutMs = 10000) {
  const strict = await getOnce(url, timeoutMs)
  if (strict.ok || !/certificate|issuer|self-signed|unable to verify/i.test(strict.error || '')) {
    return strict
  }

  const relaxed = await getOnce(url, timeoutMs, { agent: insecureAgent })
  return { ...relaxed, tlsWarning: strict.error }
}

function shellOk(command, args = []) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || result.error?.message || '').trim()
  }
}

function readCloudflaredIngress() {
  if (!fs.existsSync(cloudflaredConfig)) return null
  const text = fs.readFileSync(cloudflaredConfig, 'utf8')
  const entries = []
  const lines = text.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const hostnameMatch = lines[index].match(/^\s*-\s*hostname:\s*(.+?)\s*$/)
    if (!hostnameMatch) continue

    let service = null
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 6); cursor += 1) {
      const serviceMatch = lines[cursor].match(/^\s*service:\s*(.+?)\s*$/)
      if (serviceMatch) {
        service = serviceMatch[1]
        break
      }
    }
    entries.push({ hostname: hostnameMatch[1], service })
  }

  return entries
}

async function checkHealth() {
  const res = await get(`${prodUrl}/health`)
  if (!res.ok) {
    record('error', 'health', `${prodUrl}/health no responde`, res.error)
    return
  }
  if (res.tlsWarning) {
    record('warn', 'tls', 'Validación TLS de Node falló; se reintentó con CA relajada', res.tlsWarning)
  }
  if (res.status === 200 && res.body.includes('"status":"ok"')) {
    record('ok', 'health', `${prodUrl}/health responde OK`)
    return
  }
  record('error', 'health', `${prodUrl}/health HTTP ${res.status}`, res.body.slice(0, 200))
}

async function checkRoot() {
  const res = await get(prodUrl)
  if (!res.ok) {
    record('error', 'web', `${prodUrl} no responde`, res.error)
    return
  }
  if (res.status === 200 && /<html|<div id="root"|Church System/i.test(res.body)) {
    record('ok', 'web', `${prodUrl} responde HTML público`)
    return
  }
  record('error', 'web', `${prodUrl} HTTP ${res.status}`, res.body.slice(0, 200))
}

async function checkRenderCandidate() {
  const health = await get(`${renderUrl}/health`)
  if (!health.ok) {
    record('warn', 'render-candidate', `${renderUrl}/health no responde`, health.error)
    return { healthy: false }
  }

  if (health.tlsWarning) {
    record('warn', 'tls', 'Validación TLS de Node falló contra Render candidato; se reintentó con CA relajada', health.tlsWarning)
  }

  if (health.status === 200 && health.body.includes('"status":"ok"')) {
    record('ok', 'render-candidate', `${renderUrl}/health responde OK`)
    const root = await get(renderUrl)
    if (root.ok && root.status === 200 && /<html|<div id="root"|Church System/i.test(root.body)) {
      record('ok', 'render-candidate', `${renderUrl} responde HTML público`)
    } else {
      record('warn', 'render-candidate', `${renderUrl} no confirmó HTML público`, root.error || `HTTP ${root.status}`)
    }
    return { healthy: true }
  }

  record('warn', 'render-candidate', `${renderUrl}/health respondió inesperado`, `HTTP ${health.status}: ${health.body.slice(0, 160)}`)
  return { healthy: false }
}

async function checkDns() {
  for (const host of [prodHostname, `www.${prodHostname}`]) {
    try {
      const cnames = await dns.resolveCname(host)
      const joined = cnames.join(', ')
      if (joined.includes('onrender.com')) {
        record('ok', 'dns', `${host} apunta a Render`, joined)
      } else if (joined.includes('cfargotunnel.com')) {
        record('warn', 'dns', `${host} apunta a Cloudflare Tunnel`, joined)
      } else {
        record('warn', 'dns', `${host} usa CNAME no esperado`, joined)
      }
    } catch {
      try {
        const addresses = await dns.resolve4(host)
        record('info', 'dns', `${host} resuelve A/flattened`, addresses.join(', '))
      } catch (error) {
        record('warn', 'dns', `${host} no resolvió DNS`, error.message)
      }
    }
  }
}

function checkLocalTunnel(renderHealthy = false) {
  const ingress = readCloudflaredIngress()
  const prodIngress = ingress?.find(entry => entry.hostname === prodHostname || entry.hostname === `www.${prodHostname}`)
  const cloudflared = shellOk('pgrep', ['-x', 'cloudflared'])
  const isLocalService = Boolean(prodIngress?.service?.includes('localhost:4000') || prodIngress?.service?.includes('127.0.0.1:4000'))

  if (isLocalService && cloudflared.ok) {
    record('warn', 'origen', `${prodHostname} depende de Cloudflare Tunnel local`, prodIngress.service)
    if (renderHealthy) {
      record('warn', 'cutover', 'Render candidato ya responde; falta cortar DNS/origen desde el túnel local', `Próximo paso: apuntar Cloudflare DNS a ${new URL(renderUrl).hostname} y luego apagar el túnel local.`)
    }
  } else if (isLocalService) {
    record('error', 'origen', `${prodHostname} está configurado al túnel local pero cloudflared no corre`, prodIngress.service)
  } else if (prodIngress) {
    record('info', 'origen', `${prodHostname} tiene ingress Cloudflare no-local`, prodIngress.service)
  } else {
    record('ok', 'origen', `No hay ingress local para ${prodHostname}`)
  }

  if (requireRender && isLocalService) {
    if (renderHealthy) {
      record('error', 'migracion', '--require-render exige cortar dependencia de localhost:4000')
    } else {
      record('error', 'migracion', '--require-render exige Render operativo y cortar dependencia de localhost:4000')
    }
  }
}

function checkRenderAccess() {
  const renderCli = shellOk('render', ['--version'])
  if (renderCli.ok || process.env.RENDER_API_KEY) {
    record('ok', 'render', 'Hay acceso local para verificar Render')
  } else {
    record('warn', 'render', 'Sin render CLI ni RENDER_API_KEY; validar dashboard manualmente')
  }
}

function renderText() {
  const icon = { ok: '✅', warn: '⚠️ ', error: '❌', info: 'ℹ️ ' }
  console.log('\nChurch System — verificación producción')
  console.log(`URL: ${prodUrl}`)
  for (const check of checks) {
    console.log(`${icon[check.level]} [${check.name}] ${check.message}`)
    if (check.detail) console.log(`   ${check.detail}`)
  }

  const errors = checks.filter(check => check.level === 'error').length
  const warnings = checks.filter(check => check.level === 'warn').length
  console.log(`\nResultado: ${errors} error(es), ${warnings} advertencia(s)`)
  process.exitCode = errors > 0 ? 1 : 0
}

await checkHealth()
await checkRoot()
const renderCandidate = await checkRenderCandidate()
await checkDns()
checkLocalTunnel(renderCandidate.healthy)
checkRenderAccess()
renderText()
