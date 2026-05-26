/**
 * tenant.js — Middleware multi-tenant para Church System
 *
 * Detecta la iglesia por subdominio:
 *   iglesia1.churchsystem.com.ar → DB: iglesia1.db
 *   iglesia2.churchsystem.com.ar → DB: iglesia2.db
 *   churchsystem.com.ar          → DB: church.db (instancia principal)
 *
 * Cada request tiene req.tenantId y req.db
 */
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import initSqlJs from 'sql.js'

const __dir    = path.dirname(fileURLToPath(import.meta.url))
const DB_DIR   = path.resolve(__dir, '../../dbs')
const MAIN_DB  = path.resolve(__dir, '../../church.db')
const dbCache  = new Map()

// Inicializar SQL.js una sola vez
let SQL = null
async function getSql() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => path.resolve(__dir, '../../node_modules/sql.js/dist/sql-wasm.wasm')
    })
  }
  return SQL
}

// Obtener o crear la DB de un tenant
export async function getTenantDb(tenantId) {
  if (dbCache.has(tenantId)) return dbCache.get(tenantId)

  const Sql     = await getSql()
  const dbPath  = tenantId === 'main'
    ? MAIN_DB
    : path.join(DB_DIR, `${tenantId}.db`)

  // Leer o crear
  let buffer
  if (fs.existsSync(dbPath)) {
    buffer = fs.readFileSync(dbPath)
  } else {
    // Clonar la DB principal como base para el nuevo tenant
    if (fs.existsSync(MAIN_DB)) {
      const mainBuf = fs.readFileSync(MAIN_DB)
      const mainDb  = new Sql.Database(mainBuf)
      // Limpiar datos de prueba del nuevo tenant
      mainDb.run('DELETE FROM personas')
      mainDb.run('DELETE FROM cultos')
      mainDb.run('DELETE FROM asistencias')
      mainDb.run('DELETE FROM seguimientos')
      mainDb.run('DELETE FROM finanzas')
      mainDb.run('DELETE FROM mensajes')
      mainDb.run('DELETE FROM grupos')
      mainDb.run('DELETE FROM users WHERE email != ?', ['admin@iglesia.com'])
      // Reset configuración básica
      mainDb.run("UPDATE configuracion SET valor='' WHERE clave='nombre_iglesia'")
      mainDb.run("DELETE FROM configuracion WHERE clave='setup_completado'")
      buffer = Buffer.from(mainDb.export())
      mainDb.close()
    } else {
      buffer = Buffer.alloc(0)
    }
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
    fs.writeFileSync(dbPath, buffer)
    console.log(`🏢  Tenant nuevo: ${tenantId} → ${dbPath}`)
  }

  const db   = new Sql.Database(buffer)
  const wrap = {
    run: (sql, params=[]) => { db.run(sql, params); return wrap },
    get: (sql, params=[]) => {
      const res = db.exec(sql, params)
      if (!res[0]) return undefined
      const {columns, values} = res[0]
      return Object.fromEntries(columns.map((c,i) => [c, values[0][i]]))
    },
    all: (sql, params=[]) => {
      const res = db.exec(sql, params)
      if (!res[0]) return []
      const {columns, values} = res[0]
      return values.map(row => Object.fromEntries(columns.map((c,i) => [c, row[i]])))
    },
    exec: (sql, params=[]) => db.exec(sql, params),
    save: () => {
      fs.writeFileSync(dbPath, Buffer.from(db.export()))
    },
    close: () => { db.close(); dbCache.delete(tenantId) },
    _raw: db,
    _path: dbPath,
    tenantId,
  }

  dbCache.set(tenantId, wrap)
  return wrap
}

// Guardar todas las DBs en caché
export function saveAllDbs() {
  for (const [, db] of dbCache) {
    try { db.save() } catch {}
  }
}

// Extraer tenantId del hostname
export function getTenantId(hostname = '') {
  // Quitar puerto si existe
  const host = hostname.split(':')[0].toLowerCase()

  // Dominios que son la instancia principal
  const MAIN_HOSTS = [
    'churchsystem.com.ar',
    'www.churchsystem.com.ar',
    'localhost',
    '127.0.0.1',
    '192.168.1.2',
  ]
  if (MAIN_HOSTS.includes(host)) return 'main'

  // Subdominio → tenantId
  // app.iglesia1.churchsystem.com.ar → iglesia1
  // iglesia1.churchsystem.com.ar     → iglesia1
  const match = host.match(/^(?:app\.)?([^.]+)\.churchsystem\.com\.ar$/)
  if (match) return match[1]

  // Fallback: main
  return 'main'
}

// Middleware Express
export async function tenantMiddleware(req, _res, next) {
  const tenantId = getTenantId(req.hostname || req.headers.host)
  try {
    req.tenantId = tenantId
    req.tenantDb = await getTenantDb(tenantId)
    next()
  } catch (err) {
    console.error('Tenant error:', err.message)
    next(err)
  }
}

// Listar todos los tenants activos
export function listTenants() {
  const tenants = ['main']
  if (fs.existsSync(DB_DIR)) {
    fs.readdirSync(DB_DIR)
      .filter(f => f.endsWith('.db'))
      .forEach(f => tenants.push(f.replace('.db', '')))
  }
  return tenants
}
