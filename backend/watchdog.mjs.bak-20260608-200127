#!/usr/bin/env node
/**
 * Watchdog de Church System.
 * Monitorea el health del backend cada 60s.
 * Si falla 3 veces seguidas: manda email de alerta + reinicia el servicio vía launchctl.
 * Se ejecuta como servicio launchd independiente del backend.
 */
import { execSync, exec } from 'child_process'
import { readFileSync } from 'fs'

// ── Configuración ──────────────────────────────────────────────────────
const HEALTH_URL    = 'http://localhost:4000/health'
const CHECK_INTERVAL_MS = 60_000          // cada 60 segundos
const MAX_FAILURES  = 3                   // reiniciar después de 3 fallos consecutivos
const LAUNCHD_LABEL = 'com.churchsystem.backend'
const PLIST_PATH    = '/Users/Valentin/Library/LaunchAgents/com.churchsystem.backend.plist'
const RESEND_KEY    = (() => {
  try {
    const env = readFileSync('/Users/Valentin/Desktop/church-system-alpha/backend/.env', 'utf8')
    const m = env.match(/RESEND_API_KEY=(.+)/)
    return m ? m[1].trim() : null
  } catch { return null }
})()
const ALERT_EMAIL   = 'valentin.alvarez.gg@gmail.com'
// ──────────────────────────────────────────────────────────────────────

let fallosConsecutivos = 0
let ultimaAlertaTs = 0
let pid = process.pid

function ts() { return new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
function log(...args) { console.log(`[${ts()}] [watchdog]`, ...args) }

async function checkHealth() {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(HEALTH_URL, { signal: ctrl.signal })
    clearTimeout(timer)
    if (res.ok) {
      if (fallosConsecutivos > 0) log(`Backend recuperado después de ${fallosConsecutivos} fallo(s).`)
      fallosConsecutivos = 0
      return true
    }
    throw new Error(`HTTP ${res.status}`)
  } catch (e) {
    fallosConsecutivos++
    log(`⚠️  Fallo ${fallosConsecutivos}/${MAX_FAILURES}: ${e.message}`)
    return false
  }
}

async function sendAlert(asunto, cuerpo) {
  if (!RESEND_KEY) { log('Sin RESEND_KEY, no se puede alertar.'); return }
  const ahora = Date.now()
  if (ahora - ultimaAlertaTs < 10 * 60_000) { log('Alerta suprimida (se mandó hace <10min)'); return }
  ultimaAlertaTs = ahora
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Church System Watchdog <no-reply@churchsystem.com.ar>',
        to: ALERT_EMAIL,
        subject: asunto,
        text: cuerpo,
      }),
    })
    log('📧 Alerta enviada a', ALERT_EMAIL)
  } catch (e) { log('Error enviando alerta:', e.message) }
}

async function reiniciarServicio() {
  log('🔄 Reiniciando servicio via launchctl...')
  try {
    execSync(`launchctl unload "${PLIST_PATH}"`, { timeout: 10000 })
    await new Promise(r => setTimeout(r, 2000))
    execSync(`launchctl load "${PLIST_PATH}"`, { timeout: 10000 })
    log('✅ Servicio reiniciado.')
    fallosConsecutivos = 0
  } catch (e) {
    log('❌ Error reiniciando:', e.message)
  }
}

async function tick() {
  const ok = await checkHealth()
  if (!ok && fallosConsecutivos >= MAX_FAILURES) {
    const msg = `Church System backend caído (${fallosConsecutivos} fallos consecutivos). Reiniciando...`
    log('🚨', msg)
    await sendAlert('🚨 Church System CAÍDO — reiniciando', msg + `\nHora: ${ts()}\nHost: ${process.env.HOSTNAME || 'Mac local'}`)
    await reiniciarServicio()
    // Esperamos 15s extra para que Node arranque antes del próximo check
    await new Promise(r => setTimeout(r, 15000))
  }
}

log(`Watchdog iniciado (PID ${pid}). Monitoreando ${HEALTH_URL} cada ${CHECK_INTERVAL_MS/1000}s`)
log(`Resend key: ${RESEND_KEY ? 'configurada ✓' : 'NO disponible — alertas email desactivadas'}`)

// Primer check inmediato
tick()
setInterval(tick, CHECK_INTERVAL_MS)
