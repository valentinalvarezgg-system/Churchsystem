#!/usr/bin/env node
/**
 * QA exhaustivo de Church System — prueba cada endpoint con cada plan.
 * Registra resultados, detecta crashes/500s, valida gating de planes.
 */
import 'dotenv/config'

const BASE = 'http://localhost:4000'
const PASSWORD = 'Test1234!'
const CUENTAS = [
  { email: 'starter@test.com', plan: 'STARTER' },
  { email: 'pro@test.com', plan: 'PRO' },
  { email: 'max@test.com', plan: 'MAX' },
]

const resultados = []
function log(plan, metodo, ruta, status, nota = '', nivel = 'ok') {
  resultados.push({ plan, metodo, ruta, status, nota, nivel })
}

async function req(method, path, token, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    let json = null
    const text = await res.text()
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text: text.slice(0, 200) }
  } catch (e) {
    return { status: 0, error: e.message }
  }
}

async function login(email) {
  const r = await req('POST', '/auth/login', null, { email, password: PASSWORD })
  return r.json?.token || null
}

// Endpoints GET de solo lectura — seguros de probar con todos
const GET_ENDPOINTS = [
  '/plan/me', '/plan/lista',
  '/personas', '/grupos', '/cultos', '/stats', '/stats/dashboard',
  '/seguimiento', '/eventos', '/reportes', '/discipulado',
  '/mensajes', '/alertas', '/comunicados', '/consolidacion',
  '/analytics/resumen', '/config', '/mi-perfil', '/permisos',
  '/users', '/historial', '/finanzas', '/oracion',
  '/culto-asignaciones', '/notificaciones', '/iglesia',
  '/promo-codes', '/subscriptions/plans',
  '/excel-ia', '/backup',
]

async function main() {
  console.log('Iniciando QA exhaustivo...\n')

  for (const cuenta of CUENTAS) {
    const token = await login(cuenta.email)
    if (!token) {
      log(cuenta.plan, 'POST', '/auth/login', 'FAIL', 'No se pudo loguear', 'error')
      continue
    }
    log(cuenta.plan, 'POST', '/auth/login', 200, 'Login OK')

    for (const ep of GET_ENDPOINTS) {
      const r = await req('GET', ep, token)
      let nivel = 'ok'
      let nota = ''
      if (r.status === 0) { nivel = 'error'; nota = 'Sin respuesta: ' + r.error }
      else if (r.status >= 500) { nivel = 'error'; nota = '500 CRASH: ' + (r.text || '') }
      else if (r.status === 403) { nivel = 'gate'; nota = 'Bloqueado por plan (puede ser correcto)' }
      else if (r.status === 404) { nivel = 'warn'; nota = 'Ruta no encontrada' }
      else if (r.status >= 400) { nivel = 'warn'; nota = r.text || '' }
      log(cuenta.plan, 'GET', ep, r.status, nota, nivel)
    }
  }

  // ── Reporte ──
  console.log('\n' + '═'.repeat(70))
  console.log('  RESULTADOS QA POR ENDPOINT')
  console.log('═'.repeat(70))

  const errores = resultados.filter(r => r.nivel === 'error')
  const warns = resultados.filter(r => r.nivel === 'warn')
  const gates = resultados.filter(r => r.nivel === 'gate')
  const oks = resultados.filter(r => r.nivel === 'ok')

  console.log(`\n  ✅ ${oks.length} OK   ❌ ${errores.length} Errores/Crashes   ⚠️  ${warns.length} Warnings   🔒 ${gates.length} Gated\n`)

  if (errores.length) {
    console.log('  ❌ ERRORES Y CRASHES (prioridad máxima):')
    errores.forEach(r => console.log(`     [${r.plan}] ${r.metodo} ${r.ruta} → ${r.status}: ${r.nota}`))
    console.log('')
  }
  if (warns.length) {
    console.log('  ⚠️  WARNINGS (revisar):')
    warns.forEach(r => console.log(`     [${r.plan}] ${r.metodo} ${r.ruta} → ${r.status}: ${r.nota}`))
    console.log('')
  }
  if (gates.length) {
    console.log('  🔒 GATED POR PLAN (verificar que sea intencional):')
    gates.forEach(r => console.log(`     [${r.plan}] ${r.metodo} ${r.ruta} → 403`))
    console.log('')
  }

  // Guardar JSON
  const fs = await import('fs')
  fs.writeFileSync('qa-results.json', JSON.stringify(resultados, null, 2))
  console.log('  Detalle completo en backend/qa-results.json')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
