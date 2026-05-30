import { Pool } from 'pg'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

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

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL no configurado')
}

const pool = new Pool({
  connectionString: cleanConnectionString(DATABASE_URL),
  ssl: { rejectUnauthorized: false },
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


