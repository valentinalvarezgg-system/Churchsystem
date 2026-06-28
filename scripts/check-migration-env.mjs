#!/usr/bin/env node
/**
 * Inventario seguro de variables para migrar Church System a Render/Cloudflare.
 *
 * No imprime valores. Cruza:
 *   - variables usadas por backend/src
 *   - variables declaradas en render.yaml
 *   - presencia local en backend/.env y launchd plist
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BACKEND_SRC = path.join(ROOT, 'backend/src')
const RENDER_YAML = path.join(ROOT, 'render.yaml')
const ENV_FILE = path.join(ROOT, 'backend/.env')
const PLIST = path.join(os.homedir(), 'Library/LaunchAgents/com.churchsystem.backend.plist')

const RUNTIME_IGNORE = new Set([
  'HOSTNAME',
  'PORT',
  'NODE_TLS_REJECT_UNAUTHORIZED',
  'ALLOW_LEGACY_SQLJS',
  'FRONTEND_PORT',
  'PG_POOL_MAX',
  'CORS_ORIGINS',
  'UPLOAD_DIR',
])

const LEGACY_DO_NOT_MIGRATE = new Set([
  'GODMODE_USER_EMAIL',
  'GODMODE_USER_PASSWORD',
])

const REQUIRED_FOR_BOOT = new Set([
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'QR_SECRET',
  'BASE_URL',
  'FRONTEND_URL',
  'PUBLIC_URL',
  'ALLOWED_ORIGINS',
])

const SHOULD_BE_SECRET = /(?:SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL|PRIVATE|SID|CBU|CUIT|CLIENT_ID)$/i

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') } catch { return '' }
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(js|mjs|ts)$/.test(entry.name)) out.push(full)
  }
  return out
}

function extractCodeEnvVars() {
  const vars = new Set()
  for (const file of walk(BACKEND_SRC)) {
    const text = readText(file)
    for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) vars.add(match[1])
    for (const match of text.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)) vars.add(match[1])
  }
  return vars
}

function parseRenderEnv() {
  const text = readText(RENDER_YAML)
  const vars = new Map()
  const lines = text.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const keyMatch = lines[index].match(/^\s*-\s*key:\s*([A-Z][A-Z0-9_]*)\s*$/)
    if (!keyMatch) continue

    const key = keyMatch[1]
    const entry = { key, syncFalse: false, hasValue: false }
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^\s*-\s*key:\s*/.test(lines[cursor])) break
      if (/^\s*sync:\s*false\s*$/.test(lines[cursor])) entry.syncFalse = true
      if (/^\s*value:\s*/.test(lines[cursor])) entry.hasValue = true
    }
    vars.set(key, entry)
  }

  return vars
}

function parseDotenvKeys() {
  const keys = new Set()
  for (const line of readText(ENV_FILE).split('\n')) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/)
    if (match) keys.add(match[1])
  }
  return keys
}

function parsePlistKeys() {
  const text = readText(PLIST)
  return new Set([...text.matchAll(/<key>([A-Z][A-Z0-9_]*)<\/key>/g)].map(match => match[1]))
}

function formatList(items) {
  return items.length ? items.map(item => `  - ${item}`).join('\n') : '  - ninguno'
}

const codeVars = extractCodeEnvVars()
const renderVars = parseRenderEnv()
const dotenvKeys = parseDotenvKeys()
const plistKeys = parsePlistKeys()
const localKeys = new Set([...dotenvKeys, ...plistKeys])

const usedRuntimeVars = [...codeVars]
  .filter(key => !RUNTIME_IGNORE.has(key))
  .sort()

const missingInRender = usedRuntimeVars
  .filter(key => !renderVars.has(key))
  .filter(key => !LEGACY_DO_NOT_MIGRATE.has(key))

const missingBootInRender = [...REQUIRED_FOR_BOOT].filter(key => !renderVars.has(key))

const syncFalseEntries = [...renderVars.values()]
  .filter(entry => entry.syncFalse)
  .map(entry => entry.key)
  .sort()

const syncFalseNotLocal = syncFalseEntries.filter(key => !localKeys.has(key))
const localLegacyPresent = [...LEGACY_DO_NOT_MIGRATE].filter(key => localKeys.has(key))
const suspiciousPlainValues = [...renderVars.values()]
  .filter(entry => entry.hasValue && SHOULD_BE_SECRET.test(entry.key))
  .map(entry => entry.key)
  .sort()

let errors = 0
let warnings = 0

function section(title) {
  console.log(`\n${title}`)
}

function ok(message) {
  console.log(`✅ ${message}`)
}

function warn(message) {
  warnings += 1
  console.log(`⚠️  ${message}`)
}

function error(message) {
  errors += 1
  console.log(`❌ ${message}`)
}

console.log('\nChurch System — inventario migración env')
console.log(`render.yaml vars: ${renderVars.size}`)
console.log(`backend/src env vars usadas: ${usedRuntimeVars.length}`)

section('Boot mínimo')
if (missingBootInRender.length) {
  error('Faltan variables de arranque en render.yaml:')
  console.log(formatList(missingBootInRender))
} else {
  ok('render.yaml declara todas las variables mínimas de arranque')
}

section('Variables usadas por código no declaradas en render.yaml')
if (missingInRender.length) {
  warn('Revisar si estas variables deben cargarse en la cuenta Business:')
  console.log(formatList(missingInRender))
} else {
  ok('Todas las variables runtime usadas por backend/src están declaradas o ignoradas')
}

section('Secretos sync:false')
if (syncFalseNotLocal.length) {
  warn('No se encontró fuente local para algunos sync:false; cargar manualmente en Render si aplican:')
  console.log(formatList(syncFalseNotLocal))
} else {
  ok('Todas las variables sync:false tienen presencia local detectable')
}

section('Legacy que NO debe migrarse')
if (localLegacyPresent.length) {
  warn('Eliminar/rotar estas variables del entorno local/Render legacy; GodMode usa flag DB + script offline:')
  console.log(formatList(localLegacyPresent))
} else {
  ok('No se detectaron variables legacy GodMode en fuentes locales')
}

section('Valores sensibles en claro dentro de render.yaml')
if (suspiciousPlainValues.length) {
  error('Estas variables parecen sensibles y no deberían tener value: en render.yaml:')
  console.log(formatList(suspiciousPlainValues))
} else {
  ok('No se detectaron secretos con value: en render.yaml')
}

console.log(`\nResultado: ${errors} error(es), ${warnings} advertencia(s)`)
process.exitCode = errors > 0 ? 1 : 0
