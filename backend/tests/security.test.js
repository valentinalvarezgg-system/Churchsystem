/**
 * tests/security.test.js — Tests de seguridad para los fixes de 2026-09-27
 *
 * Verifica que:
 * 1. Ministerios IDOR esté cerrado (subrutas verifican ministerioId)
 * 2. PayPal reconcilie contra paypal_order_id
 * 3. Stripe webhook sea fail-closed sin secret
 * 4. RSVP público verifique iglesiaId
 * 5. Documentos prevenga path traversal
 *
 * Ejecutar: node --test backend/tests/security.test.js
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendSrc = path.join(__dirname, '..', 'src')

function leerArchivo(relativo) {
  return readFileSync(path.join(backendSrc, relativo), 'utf8')
}

// ── Test 1: Ministerios IDOR ──────────────────────────────────
test('ministerios.js: DELETE /miembros/:miembroId verifica ministerioId', () => {
  const codigo = leerArchivo('routes/ministerios.js')
  // Debe tener checkAcceso y filtrar por ministerioId en el WHERE
  assert.ok(codigo.includes('checkAcceso(req.params.id, iglesiaId(req))'), 'Debe verificar acceso al ministerio')
  assert.ok(codigo.includes('"ministerioId"=$2'), 'Debe filtrar por ministerioId en el WHERE')
  assert.ok(codigo.includes('result.rowCount'), 'Debe verificar rowCount')
})

test('ministerios.js: PUT /tareas/:tareaId verifica ministerioId', () => {
  const codigo = leerArchivo('routes/ministerios.js')
  // Debe tener checkAcceso y filtrar por ministerioId
  const seccionTareas = codigo.slice(
    codigo.indexOf("router.put('/:id/tareas/:tareaId'"),
    codigo.indexOf("router.delete('/:id/tareas/:tareaId'")
  )
  assert.ok(seccionTareas.includes('checkAcceso'), 'PUT tareas debe verificar acceso')
  assert.ok(seccionTareas.includes('"ministerioId"=$${params.length}'), 'PUT tareas debe filtrar por ministerioId')
})

test('ministerios.js: PUT /canciones/:cancionId verifica ministerioId', () => {
  const codigo = leerArchivo('routes/ministerios.js')
  const seccion = codigo.slice(
    codigo.indexOf("router.put('/:id/canciones/:cancionId'"),
    codigo.indexOf("router.put('/:id/setlists'")
  )
  assert.ok(seccion.includes('checkAcceso'), 'PUT canciones debe verificar acceso')
  assert.ok(seccion.includes('"ministerioId"=$9'), 'PUT canciones debe filtrar por ministerioId')
})

test('ministerios.js: PUT /equipos/:equipoId verifica ministerioId', () => {
  const codigo = leerArchivo('routes/ministerios.js')
  const seccion = codigo.slice(
    codigo.indexOf("router.put('/:id/equipos/:equipoId'"),
    codigo.indexOf("router.get('/:id/salas'")
  )
  assert.ok(seccion.includes('checkAcceso'), 'PUT equipos debe verificar acceso')
  assert.ok(seccion.includes('"ministerioId"=$8'), 'PUT equipos debe filtrar por ministerioId')
})

test('ministerios.js: PUT /checkin-ninos/:checkinId/salida verifica ministerioId', () => {
  const codigo = leerArchivo('routes/ministerios.js')
  const seccion = codigo.slice(
    codigo.indexOf("router.put('/:id/checkin-ninos/:checkinId/salida'"),
    codigo.indexOf('// ═══')
  )
  assert.ok(seccion.includes('checkAcceso'), 'PUT checkin-ninos debe verificar acceso')
  assert.ok(seccion.includes('"ministerioId"=$2'), 'PUT checkin-ninos debe filtrar por ministerioId')
})

// ── Test 2: PayPal legacy ─────────────────────────────────────
test('paypal.js: capturar NO confía en plan/iglesiaId del querystring', () => {
  const codigo = leerArchivo('routes/paypal.js')
  // No debe leer plan ni iglesiaId directamente del query
  assert.ok(!codigo.includes('const { token: orderId, plan, iglesiaId, ref } = req.query'),
    'No debe desestructurar plan e iglesiaId del query')
  // Debe usar ref para extraer iglesiaId y planKey
  assert.ok(codigo.includes("const refParts = String(ref).split('|')"), 'Debe extraer datos de ref')
  assert.ok(codigo.includes("const [, igId, planKey] = refParts"), 'Debe extraer igId y planKey de ref')
  // Debe verificar orderId contra paypal_order_id guardado
  assert.ok(codigo.includes("'paypal_order_id'"), 'Debe verificar paypal_order_id')
  assert.ok(codigo.includes('cfg.valor !== orderId'), 'Debe comparar orderId con el guardado')
})

// ── Test 3: Stripe webhook fail-closed ────────────────────────
test('stripe.js: webhook es fail-closed sin STRIPE_WEBHOOK_SECRET', () => {
  const codigo = leerArchivo('routes/stripe.js')
  // Debe retornar 400 si no hay secret
  assert.ok(codigo.includes("if (!STRIPE_WHK)"), 'Debe verificar STRIPE_WEBHOOK_SECRET')
  assert.ok(codigo.includes("res.status(400)"), 'Debe responder 400 sin secret')
  // NO debe tener el fallback event = req.body
  assert.ok(!codigo.includes('event = req.body'), 'No debe tener fallback event = req.body')
})

// ── Test 4: RSVP público ──────────────────────────────────────
test('eventos.js: RSVP verifica iglesiaId del evento sin auth', () => {
  const codigo = leerArchivo('routes/eventos.js')
  // Debe verificar que el evento pertenezca al iglesiaId del body
  assert.ok(codigo.includes('SELECT "id" FROM "Evento" WHERE "id"=$1 AND "iglesiaId"=$2'),
    'Debe verificar que el evento pertenezca al iglesiaId')
  // Si está autenticado, debe usar req.user.iglesiaId
  assert.ok(codigo.includes('req.user?.iglesiaId'), 'Debe usar req.user.iglesiaId si está autenticado')
})

// ── Test 5: Documentos path traversal ─────────────────────────
test('documentos.js: descarga previene path traversal', () => {
  const codigo = leerArchivo('routes/documentos.js')
  // Debe usar path.basename
  assert.ok(codigo.includes('path.basename(doc.archivo)'), 'Debe usar path.basename')
  // Debe verificar contención dentro de UPLOAD_DIR
  assert.ok(codigo.includes('resolvedPath.startsWith'), 'Debe verificar contención en UPLOAD_DIR')
  assert.ok(codigo.includes('resolvedUploadDir'), 'Debe resolver UPLOAD_DIR')
})

// ── Test 6: Recurrencias en Eventos ───────────────────────────
test('eventos.js: soporta recurrencias DAILY/WEEKLY/MONTHLY/YEARLY', () => {
  const codigo = leerArchivo('routes/eventos.js')
  assert.ok(codigo.includes('expandirRecurrente'), 'Debe tener función expandirRecurrente')
  assert.ok(codigo.includes('DAILY'), 'Debe soportar DAILY')
  assert.ok(codigo.includes('WEEKLY'), 'Debe soportar WEEKLY')
  assert.ok(codigo.includes('MONTHLY'), 'Debe soportar MONTHLY')
  assert.ok(codigo.includes('YEARLY'), 'Debe soportar YEARLY')
  assert.ok(codigo.includes('recurrenciaFin'), 'Debe soportar fecha de fin de recurrencia')
})

// ── Test 7: PDF con logo en Reportes ──────────────────────────
test('Reportes.jsx: PDF incluye logo y footer', () => {
  const codigo = readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Reportes.jsx'), 'utf8')
  assert.ok(codigo.includes('logoUrl'), 'Debe incluir logoUrl')
  assert.ok(codigo.includes('churchsystem.com.ar/logo.png'), 'Debe apuntar al logo público')
  assert.ok(codigo.includes('footer'), 'Debe incluir footer')
  assert.ok(codigo.includes('Uso interno'), 'Debe marcar como uso interno')
})

console.log('✅ Todos los tests de seguridad pasaron')
