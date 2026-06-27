#!/usr/bin/env node
/**
 * Validador local liviano para el render.yaml de Church System.
 *
 * No reemplaza `render blueprints validate`, pero detecta errores peligrosos
 * antes de abrir el Dashboard: campos deprecados, env vars duplicadas,
 * secretos en claro y variables mínimas faltantes.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RENDER_YAML = path.join(ROOT, 'render.yaml')

const REQUIRED_SERVICE_FIELDS = [
  ['type', 'web'],
  ['name', 'church-system'],
  ['runtime', 'node'],
  ['region', 'ohio'],
  ['plan', 'starter'],
  ['rootDir', 'backend'],
  ['startCommand', 'node src/server.js'],
  ['healthCheckPath', '/health'],
  ['autoDeployTrigger', 'commit'],
]

const REQUIRED_ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'QR_SECRET',
  'BASE_URL',
  'FRONTEND_URL',
  'PUBLIC_URL',
  'ALLOWED_ORIGINS',
]

const REQUIRED_SYNC_FALSE = [
  'DATABASE_URL',
  'JWT_SECRET',
  'QR_SECRET',
  'RESEND_API_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
]

const LEGACY_FORBIDDEN = [
  'GODMODE_USER_EMAIL',
  'GODMODE_USER_PASSWORD',
]

const SENSITIVE_KEY = /(?:SECRET|TOKEN|PASSWORD|DATABASE_URL|PRIVATE|ACCESS_TOKEN|AUTH_TOKEN|CBU|CUIT)$/i

function readRenderYaml() {
  try {
    return fs.readFileSync(RENDER_YAML, 'utf8')
  } catch {
    console.error(`No existe ${RENDER_YAML}`)
    process.exit(1)
  }
}

function parseTopLevelServiceFields(text) {
  const fields = new Map()
  for (const line of text.split('\n')) {
    const listMatch = line.match(/^\s{2}-\s([A-Za-z][A-Za-z0-9]*):\s*(.+?)\s*$/)
    if (listMatch) fields.set(listMatch[1], listMatch[2].replace(/^"|"$/g, ''))

    const match = line.match(/^\s{4}([A-Za-z][A-Za-z0-9]*):\s*(.+?)\s*$/)
    if (match) fields.set(match[1], match[2].replace(/^"|"$/g, ''))
  }
  return fields
}

function parseEnvEntries(text) {
  const entries = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const keyMatch = lines[index].match(/^\s{6}-\skey:\s*([A-Z][A-Z0-9_]*)\s*$/)
    if (!keyMatch) continue

    const entry = { key: keyMatch[1], syncFalse: false, value: null, line: index + 1 }
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^\s{6}-\skey:\s*/.test(lines[cursor])) break
      const syncMatch = lines[cursor].match(/^\s{8}sync:\s*(.+?)\s*$/)
      const valueMatch = lines[cursor].match(/^\s{8}value:\s*(.+?)\s*$/)
      if (syncMatch && syncMatch[1] === 'false') entry.syncFalse = true
      if (valueMatch) entry.value = valueMatch[1].replace(/^"|"$/g, '')
    }
    entries.push(entry)
  }
  return entries
}

function report(kind, message, detail = '') {
  const icon = kind === 'error' ? '❌' : kind === 'warn' ? '⚠️ ' : '✅'
  console.log(`${icon} ${message}`)
  if (detail) console.log(`   ${detail}`)
}

const text = readRenderYaml()
const fields = parseTopLevelServiceFields(text)
const entries = parseEnvEntries(text)
const keys = entries.map(entry => entry.key)
const keySet = new Set(keys)

let errors = 0
let warnings = 0

function error(message, detail) { errors += 1; report('error', message, detail) }
function warn(message, detail) { warnings += 1; report('warn', message, detail) }
function ok(message, detail) { report('ok', message, detail) }

console.log('\nChurch System — validación local render.yaml')

if (/^\s{4}env:\s/m.test(text)) error('Campo deprecado detectado: env', 'Usar runtime: node')
if (/^\s{4}autoDeploy:\s/m.test(text)) error('Campo deprecado detectado: autoDeploy', 'Usar autoDeployTrigger: commit')

for (const [field, expected] of REQUIRED_SERVICE_FIELDS) {
  const actual = fields.get(field)
  if (actual === expected) ok(`${field}=${expected}`)
  else error(`Campo ${field} inválido o faltante`, `esperado=${expected}, actual=${actual || '(faltante)'}`)
}

if (!fields.get('buildCommand')?.includes('pnpm@9.15.5')) {
  error('buildCommand no fija pnpm@9.15.5')
} else if (!fields.get('buildCommand')?.includes('--frozen-lockfile')) {
  error('buildCommand no usa --frozen-lockfile')
} else {
  ok('buildCommand endurecido con pnpm fijo y lockfiles')
}

const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
if (duplicates.length) error('Variables duplicadas en envVars', [...new Set(duplicates)].join(', '))
else ok('envVars sin claves duplicadas')

for (const key of REQUIRED_ENV_KEYS) {
  if (!keySet.has(key)) error(`Falta env var requerida: ${key}`)
}

for (const key of REQUIRED_SYNC_FALSE) {
  const entry = entries.find(item => item.key === key)
  if (!entry?.syncFalse) error(`${key} debe tener sync: false`)
}

for (const key of LEGACY_FORBIDDEN) {
  if (keySet.has(key)) error(`Variable legacy prohibida en Render: ${key}`)
}

for (const entry of entries) {
  if (entry.value && SENSITIVE_KEY.test(entry.key) && !['VAPID_EMAIL', 'OWNER_REPORTS_EMAIL'].includes(entry.key)) {
    warn(`Variable sensible con value: ${entry.key}`, `línea ${entry.line}; usar sync: false salvo que sea pública/intencional`)
  }
}

if (!String(entries.find(entry => entry.key === 'ALLOWED_ORIGINS')?.value || '').includes('https://church-system.onrender.com')) {
  warn('ALLOWED_ORIGINS no incluye candidato onrender.com', 'puede dificultar pruebas pre-DNS')
} else {
  ok('ALLOWED_ORIGINS permite prueba pre-DNS')
}

console.log(`\nResultado: ${errors} error(es), ${warnings} advertencia(s)`)
process.exitCode = errors > 0 ? 1 : 0
