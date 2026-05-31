#!/usr/bin/env node
/**
 * QA de operaciones de ESCRITURA (CRUD completo).
 * Crea, edita y elimina datos reales con cada plan. Detecta crashes en mutaciones.
 */
const BASE = 'http://localhost:4000'
const PASSWORD = 'Test1234!'

const resultados = []
function log(plan, op, status, nivel, nota = '') {
  resultados.push({ plan, op, status, nivel, nota })
  const icon = nivel === 'error' ? '❌' : nivel === 'warn' ? '⚠️ ' : '✅'
  console.log(`  ${icon} [${plan}] ${op} → ${status} ${nota}`)
}

async function api(method, path, token, body) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text: text.slice(0, 250) }
  } catch (e) {
    return { status: 0, error: e.message }
  }
}

async function login(email) {
  const r = await api('POST', '/auth/login', null, { email, password: PASSWORD })
  return r.json?.token
}

function check(plan, op, r, okStatuses = [200, 201]) {
  if (r.status === 0) return log(plan, op, 0, 'error', 'Sin respuesta: ' + r.error)
  if (r.status >= 500) return log(plan, op, r.status, 'error', 'CRASH/500: ' + r.text)
  if (okStatuses.includes(r.status)) return log(plan, op, r.status, 'ok')
  return log(plan, op, r.status, 'warn', r.text)
}

async function flujoCRUD(plan, email) {
  console.log(`\n━━━ CRUD ${plan} (${email}) ━━━`)
  const token = await login(email)
  if (!token) return log(plan, 'login', 'FAIL', 'error')

  // ── PERSONAS ──
  let r = await api('POST', '/personas', token, {
    nombre: 'QA', apellido: 'TestPersona', email: `qatest_${Date.now()}@x.com`,
    telefono: '1122334455', estado: 'ACTIVO',
  })
  check(plan, 'POST /personas', r, [200, 201])
  const personaId = r.json?.id || r.json?.persona?.id

  if (personaId) {
    r = await api('GET', `/personas/${personaId}`, token)
    check(plan, 'GET /personas/:id', r)

    r = await api('PUT', `/personas/${personaId}`, token, { nombre: 'QA-Editado', estado: 'ACTIVO' })
    check(plan, 'PUT /personas/:id', r)
  }

  // ── GRUPOS ──
  r = await api('POST', '/grupos', token, { nombre: `Grupo QA ${Date.now()}`, descripcion: 'Test' })
  check(plan, 'POST /grupos', r, [200, 201])
  const grupoId = r.json?.id || r.json?.grupo?.id

  if (grupoId) {
    r = await api('PUT', `/grupos/${grupoId}`, token, { nombre: 'Grupo QA editado' })
    check(plan, 'PUT /grupos/:id', r)
  }

  // ── CULTOS ── (PRO/MAX)
  r = await api('POST', '/cultos', token, {
    nombre: `Culto QA ${Date.now()}`, fecha: '2026-06-01', cultoDia: 'DOMINGO', cultoTurno: 1,
  })
  check(plan, 'POST /cultos', r, [200, 201, 403])
  const cultoId = r.json?.id || r.json?.culto?.id

  // ── COMUNICADOS ──
  r = await api('POST', '/comunicados', token, { titulo: 'QA Comunicado', mensaje: 'Test', tipo: 'GENERAL' })
  check(plan, 'POST /comunicados', r, [200, 201, 403])
  const comunicadoId = r.json?.id

  // ── EVENTOS ──
  r = await api('POST', '/eventos', token, {
    titulo: 'Evento QA', fecha: '2026-06-15', descripcion: 'Test event',
  })
  check(plan, 'POST /eventos', r, [200, 201, 403])
  const eventoId = r.json?.id

  // ── SEGUIMIENTO ── (si hay persona)
  if (personaId) {
    r = await api('POST', '/seguimiento', token, {
      personaId, tipo: 'LLAMADA', nota: 'QA seguimiento test',
    })
    check(plan, 'POST /seguimiento', r, [200, 201, 403])
  }

  // ── LIMPIEZA: eliminar lo creado ──
  if (eventoId) check(plan, 'DELETE /eventos/:id', await api('DELETE', `/eventos/${eventoId}`, token), [200, 204, 403])
  if (comunicadoId) check(plan, 'DELETE /comunicados/:id', await api('DELETE', `/comunicados/${comunicadoId}`, token), [200, 204, 403])
  if (cultoId) check(plan, 'DELETE /cultos/:id', await api('DELETE', `/cultos/${cultoId}`, token), [200, 204, 403])
  if (grupoId) check(plan, 'DELETE /grupos/:id', await api('DELETE', `/grupos/${grupoId}`, token), [200, 204])
  if (personaId) check(plan, 'DELETE /personas/:id', await api('DELETE', `/personas/${personaId}`, token), [200, 204])
}

async function main() {
  console.log('QA de operaciones de ESCRITURA (CRUD)\n' + '═'.repeat(60))
  await flujoCRUD('STARTER', 'starter@test.com')
  await flujoCRUD('PRO', 'pro@test.com')
  await flujoCRUD('MAX', 'max@test.com')

  console.log('\n' + '═'.repeat(60))
  const errores = resultados.filter(r => r.nivel === 'error')
  const warns = resultados.filter(r => r.nivel === 'warn')
  const oks = resultados.filter(r => r.nivel === 'ok')
  console.log(`\n  RESUMEN: ✅ ${oks.length} OK   ❌ ${errores.length} Errores   ⚠️  ${warns.length} Warnings`)

  if (errores.length) {
    console.log('\n  ❌ ERRORES CRÍTICOS:')
    errores.forEach(r => console.log(`     [${r.plan}] ${r.op} → ${r.status}: ${r.nota}`))
  }
  if (warns.length) {
    console.log('\n  ⚠️  WARNINGS (revisar si es gating correcto o bug):')
    warns.forEach(r => console.log(`     [${r.plan}] ${r.op} → ${r.status}: ${r.nota}`))
  }

  const fs = await import('fs')
  fs.writeFileSync('qa-crud-results.json', JSON.stringify(resultados, null, 2))
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
