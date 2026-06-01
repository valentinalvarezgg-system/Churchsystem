import { Pool } from 'pg'
import pino from 'pino'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
const __dir = dirname(fileURLToPath(import.meta.url))

// Neon usa Let's Encrypt / DigiCert. En macOS, /etc/ssl/cert.pem tiene todos los CAs
// necesarios. En VPS Linux, usar /etc/ssl/certs/ca-certificates.crt.
// Esto elimina la necesidad de NODE_TLS_REJECT_UNAUTHORIZED=0.
const SYSTEM_CA_PATHS = [
  '/etc/ssl/cert.pem',                    // macOS
  '/etc/ssl/certs/ca-certificates.crt',   // Ubuntu/Debian
  '/etc/pki/tls/certs/ca-bundle.crt',     // RHEL/CentOS
  resolve(__dir, '../../ssl/neon-bundle.pem'),  // bundle descargado (fallback)
]

let sslConfig = { rejectUnauthorized: false }  // último fallback seguro para PaaS
for (const caPath of SYSTEM_CA_PATHS) {
  if (existsSync(caPath)) {
    try {
      sslConfig = { rejectUnauthorized: true, ca: readFileSync(caPath, 'utf8') }
      logger.info({ ca: caPath }, 'DB SSL: verificación activada con CA del sistema OK')
      break
    } catch { /* intentar siguiente */ }
  }
}
if (!sslConfig.rejectUnauthorized) {
  logger.warn('DB SSL: sin CA local, usando encriptado sin verificar CN (seguro para Neon/PaaS)')
}

function cleanConnectionString(raw) {
  if (!raw) return ''
  try {
    const url = new URL(raw)
    url.searchParams.delete('sslmode')
    return url.toString()
  } catch {
    return raw
  }
}

const DATABASE_URL = process.env.DATABASE_URL || ''
if (!DATABASE_URL) throw new Error('DATABASE_URL no configurado')

const pool = new Pool({
  connectionString: cleanConnectionString(DATABASE_URL),
  ssl: sslConfig,
  max: Number(process.env.PG_POOL_MAX || 12),
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', err => {
  logger.error({ err: err?.message }, 'PostgreSQL pool error')
})

export async function pgOne(text, params = []) {
  const result = await pool.query(text, params)
  return result.rows[0] || null
}

export async function pgMany(text, params = []) {
  const result = await pool.query(text, params)
  return result.rows
}

export async function pgExec(text, params = []) {
  const result = await pool.query(text, params)
  return { rowCount: result.rowCount }
}


