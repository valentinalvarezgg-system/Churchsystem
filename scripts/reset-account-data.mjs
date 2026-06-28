#!/usr/bin/env node
import fs from 'node:fs'

const CONFIRM_TEXT = 'RESET_ACCOUNT_DATA'
const PRESERVED_TABLES = new Set([
  '_prisma_migrations',
  'Rol',
  'promo_codes',
  'subscription_plans',
])

function parseArgs(argv) {
  const args = new Set(argv)
  const valueAfter = name => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : ''
  }
  return {
    execute: args.has('--execute'),
    confirm: valueAfter('--confirm'),
    allowProduction: args.has('--allow-production') || process.env.ALLOW_ACCOUNT_RESET === '1',
    json: args.has('--json'),
    includeCatalogs: args.has('--include-catalogs'),
  }
}

function loadEnvFile(path = 'backend/.env') {
  if (!fs.existsSync(path)) return
  const content = fs.readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

function dbInfo(raw = '') {
  try {
    const url = new URL(raw)
    return {
      host: url.hostname,
      database: url.pathname.replace(/^\//, ''),
      isLocal: ['localhost', '127.0.0.1', '::1'].includes(url.hostname),
    }
  } catch {
    return { host: 'unknown', database: 'unknown', isLocal: false }
  }
}

function quoteIdent(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  loadEnvFile()

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no configurado. Definilo en el entorno o en backend/.env.')
  }

  const info = dbInfo(process.env.DATABASE_URL)
  const { pgMany, pgExec } = await import('../backend/src/lib/pg.js')

  const tables = await pgMany(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema='public'
       AND table_type='BASE TABLE'
     ORDER BY table_name
  `)

  const preserved = new Set(PRESERVED_TABLES)
  if (opts.includeCatalogs) {
    preserved.delete('promo_codes')
    preserved.delete('subscription_plans')
  }

  const rows = []
  for (const { table_name: tableName } of tables) {
    const [{ count }] = await pgMany(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(tableName)}`)
    rows.push({
      table: tableName,
      count: Number(count || 0),
      action: preserved.has(tableName) ? 'preserve' : 'truncate',
    })
  }

  const targetTables = rows.filter(row => row.action === 'truncate').map(row => row.table)
  const summary = {
    mode: opts.execute ? 'execute' : 'dry-run',
    host: info.host,
    database: info.database,
    preserved: rows.filter(row => row.action === 'preserve'),
    truncate: rows.filter(row => row.action === 'truncate'),
  }

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`Modo: ${summary.mode}`)
    console.log(`DB: ${summary.host}/${summary.database}`)
    console.log('\nSe preserva:')
    for (const row of summary.preserved) console.log(`  - ${row.table}: ${row.count}`)
    console.log('\nSe resetearía:')
    for (const row of summary.truncate) console.log(`  - ${row.table}: ${row.count}`)
  }

  if (!opts.execute) {
    console.log('\nDry-run solamente. Para ejecutar:')
    console.log(`  pnpm reset:accounts -- --execute --confirm ${CONFIRM_TEXT} --allow-production`)
    process.exit(0)
  }

  if (opts.confirm !== CONFIRM_TEXT) {
    throw new Error(`Falta confirmación explícita: --confirm ${CONFIRM_TEXT}`)
  }
  if (!info.isLocal && !opts.allowProduction) {
    throw new Error('La DB no parece local. Agregá --allow-production si realmente querés resetearla.')
  }
  if (!targetTables.length) {
    console.log('No hay tablas para truncar.')
    process.exit(0)
  }

  await pgExec(`TRUNCATE TABLE ${targetTables.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE`)
  console.log(`\nReset completo: ${targetTables.length} tablas truncadas.`)
  process.exit(0)
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
