#!/usr/bin/env node
/**
 * Watchdog local de producción.
 *
 * MODO_CLOUDFLARE_LOCAL depende de dos piezas:
 *   1) backend local en :4000
 *   2) cloudflared exponiendo churchsystem.com.ar
 *
 * Este proceso monitorea ambas capas y usa launchctl kickstart para reiniciar
 * solo lo necesario. No imprime secretos ni lee tokens del túnel.
 */
import { execFile } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const LOCAL_HEALTH_URL = process.env.WATCHDOG_LOCAL_HEALTH_URL || 'http://127.0.0.1:4000/health'
const PUBLIC_HEALTH_URL = process.env.WATCHDOG_PUBLIC_HEALTH_URL || 'https://churchsystem.com.ar/health'
const CHECK_INTERVAL_MS = Number(process.env.WATCHDOG_INTERVAL_MS || 60_000)
const MAX_FAILURES = Number(process.env.WATCHDOG_MAX_FAILURES || 3)
const BACKEND_LABEL = process.env.WATCHDOG_BACKEND_LABEL || 'com.churchsystem.backend'
const CLOUDFLARED_LABEL = process.env.WATCHDOG_CLOUDFLARED_LABEL || 'com.churchsystem.cloudflared'
const ALERT_EMAIL = process.env.WATCHDOG_ALERT_EMAIL || process.env.EMAIL_SOPORTE || ''
const RESEND_KEY = process.env.RESEND_API_KEY || ''
const ALERT_COOLDOWN_MS = Number(process.env.WATCHDOG_ALERT_COOLDOWN_MS || 10 * 60_000)
const STARTUP_GRACE_MS = Number(process.env.WATCHDOG_STARTUP_GRACE_MS || 15_000)
const LAUNCHD_DOMAIN = `gui/${process.getuid?.() || ''}`
const insecureAgent = new https.Agent({ rejectUnauthorized: false })

let localFailures = 0
let publicFailures = 0
let lastAlertAt = 0
let restartInProgress = false

function ts() {
  return new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function log(...args) {
  console.log(`[${ts()}] [watchdog]`, ...args)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function requestText(url, options = {}) {
  return new Promise(resolve => {
    const parsed = new URL(url)
    const transport = parsed.protocol === 'http:' ? http : https
    const req = transport.request(parsed, {
      method: 'GET',
      timeout: 8000,
      agent: options.agent,
      headers: { Accept: 'application/json' },
    }, response => {
      let text = ''
      response.on('data', chunk => {
        if (text.length < 4096) text += chunk
      })
      response.on('end', () => resolve({ ok: true, status: response.statusCode || 0, text }))
    })
    req.on('error', error => resolve({ ok: false, status: 0, error: error.message || 'request_failed' }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, status: 0, error: 'timeout' })
    })
    req.end()
  })
}

async function fetchHealth(url) {
  let response = await requestText(url)
  if (!response.ok && /^https:/i.test(url) && /certificate|issuer|self-signed|unable to verify/i.test(response.error || '')) {
    response = await requestText(url, { agent: insecureAgent })
    if (response.ok) response.tlsWarning = true
  }
  if (!response.ok) return { ok: false, status: 0, error: response.error || 'request_failed' }
  if (response.status === 200 && response.text.includes('"status":"ok"')) {
    return { ok: true, status: response.status }
  }
  return { ok: false, status: response.status, error: response.text.slice(0, 140) || `HTTP ${response.status}` }
}

async function launchctlKick(label) {
  const target = LAUNCHD_DOMAIN.endsWith('/') ? label : `${LAUNCHD_DOMAIN}/${label}`
  await execFileAsync('launchctl', ['kickstart', '-k', target], { timeout: 15_000 })
}

async function processRunning(name) {
  try {
    await execFileAsync('pgrep', ['-x', name], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function sendAlert(subject, body) {
  if (!RESEND_KEY || !ALERT_EMAIL) {
    log('alerta omitida: email no configurado')
    return
  }
  const now = Date.now()
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) {
    log('alerta omitida por cooldown')
    return
  }
  lastAlertAt = now
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Church System Watchdog <no-reply@churchsystem.com.ar>',
        to: ALERT_EMAIL,
        subject,
        text: body,
      }),
    })
    if (!response.ok) log('alerta email falló:', response.status)
    else log('alerta email enviada')
  } catch (error) {
    log('alerta email falló:', error.message)
  }
}

async function restart(label, reason) {
  if (restartInProgress) {
    log('reinicio omitido: ya hay uno en curso')
    return
  }
  restartInProgress = true
  try {
    log(`reiniciando ${label}: ${reason}`)
    await launchctlKick(label)
    await sendAlert(
      `Church System: reinicio ${label}`,
      `Motivo: ${reason}\nHora: ${ts()}\nLocal: ${LOCAL_HEALTH_URL}\nPublic: ${PUBLIC_HEALTH_URL}`
    )
    await sleep(STARTUP_GRACE_MS)
  } catch (error) {
    log(`error reiniciando ${label}:`, error.message)
  } finally {
    restartInProgress = false
  }
}

async function tick() {
  const local = await fetchHealth(LOCAL_HEALTH_URL)
  if (local.ok) {
    if (localFailures > 0) log(`backend local recuperado tras ${localFailures} fallo(s)`)
    localFailures = 0
  } else {
    localFailures += 1
    log(`fallo local ${localFailures}/${MAX_FAILURES}: ${local.error}`)
  }

  const publicHealth = await fetchHealth(PUBLIC_HEALTH_URL)
  if (publicHealth.ok) {
    if (publicFailures > 0) log(`salud pública recuperada tras ${publicFailures} fallo(s)`)
    publicFailures = 0
  } else {
    publicFailures += 1
    log(`fallo público ${publicFailures}/${MAX_FAILURES}: ${publicHealth.error}`)
  }

  const cloudflaredUp = await processRunning('cloudflared')
  if (!cloudflaredUp) log('cloudflared no está corriendo')

  if (localFailures >= MAX_FAILURES) {
    if (local.status === 0) {
      await restart(BACKEND_LABEL, `${LOCAL_HEALTH_URL} no acepta conexiones tras ${localFailures} intentos`)
    } else {
      log(`backend responde HTTP ${local.status}; no se reinicia porque la falla es de una dependencia`)
      await sendAlert(
        'Church System: backend degradado',
        `El backend responde HTTP ${local.status}, pero una dependencia impide el healthcheck. No se reinicia para evitar un ciclo.\nHora: ${ts()}\nDetalle: ${local.error}`
      )
    }
    localFailures = 0
    return
  }

  if ((!cloudflaredUp || publicFailures >= MAX_FAILURES) && local.ok) {
    await restart(CLOUDFLARED_LABEL, `${PUBLIC_HEALTH_URL} falló ${publicFailures} veces; backend local OK`)
    publicFailures = 0
    return
  }

  if (publicFailures >= MAX_FAILURES) {
    if (local.status === 0) {
      await restart(BACKEND_LABEL, `${PUBLIC_HEALTH_URL} falló ${publicFailures} veces y el backend local no acepta conexiones`)
    } else {
      log(`salud pública degradada con backend HTTP ${local.status}; reinicio omitido`)
    }
    publicFailures = 0
  }
}

log(`Watchdog iniciado. Local=${LOCAL_HEALTH_URL} Public=${PUBLIC_HEALTH_URL} Interval=${CHECK_INTERVAL_MS / 1000}s`)
tick().catch(error => log('tick inicial falló:', error.message))
setInterval(() => tick().catch(error => log('tick falló:', error.message)), CHECK_INTERVAL_MS)
