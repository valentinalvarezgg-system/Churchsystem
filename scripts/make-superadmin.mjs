#!/usr/bin/env node
/**
 * make-superadmin.mjs — Activa el acceso GodMode (superadmin) para un email.
 *
 * Uso:
 *   node scripts/make-superadmin.mjs <email>
 *
 * Qué hace:
 *   1. Busca el usuario por email en la DB.
 *   2. Setea es_superadmin = true y rol = 'GODMODE'.
 *   3. El usuario puede ingresar desde /vault-login con sus credenciales.
 *
 * Prerrequisitos:
 *   - DATABASE_URL en backend/.env (o en el entorno actual).
 *   - El email debe pertenecer a un usuario existente en "User".
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Cargar .env del backend manualmente ─────────────────────────────────────
function loadEnv(envPath) {
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

loadEnv(path.join(ROOT, 'backend', '.env'))
loadEnv(path.join(ROOT, '.env'))

const email = (process.argv[2] || '').trim().toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Uso: node scripts/make-superadmin.mjs <email>')
  process.exit(1)
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL no está configurado.')
  console.error('Agregalo en backend/.env o pasalo como variable de entorno.')
  process.exit(1)
}

// ── SSL ──────────────────────────────────────────────────────────────────────
const CA_PATHS = [
  '/etc/ssl/cert.pem',
  '/etc/ssl/certs/ca-certificates.crt',
  '/etc/pki/tls/certs/ca-bundle.crt',
]
let sslConfig = { rejectUnauthorized: false }
for (const p of CA_PATHS) {
  if (existsSync(p)) {
    try { sslConfig = { rejectUnauthorized: true, ca: readFileSync(p, 'utf8') }; break }
    catch { /* siguiente */ }
  }
}

function cleanUrl(raw) {
  try { const u = new URL(raw); u.searchParams.delete('sslmode'); return u.toString() }
  catch { return raw }
}

const pool = new Pool({ connectionString: cleanUrl(DATABASE_URL), ssl: sslConfig })

async function run() {
  const client = await pool.connect()
  try {
    // Asegurarse de que la columna existe
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "es_superadmin" BOOLEAN NOT NULL DEFAULT false`)

    // Buscar usuario
    const { rows } = await client.query(
      'SELECT id, email, nombre, rol, "activo", "deletedAt" FROM "User" WHERE lower(email) = $1 LIMIT 1',
      [email]
    )
    const user = rows[0]

    if (!user) {
      console.error(`\n✗ No se encontró ningún usuario con email: ${email}`)
      console.error('  Verificá que el email esté registrado en la aplicación.')
      process.exit(1)
    }

    if (user.deletedAt) {
      console.error(`\n✗ El usuario ${email} está eliminado (deletedAt=${user.deletedAt}).`)
      process.exit(1)
    }

    if (!user.activo) {
      console.warn(`\n⚠ El usuario ${email} está inactivo. Activándolo también...`)
    }

    // Crear/asegurar rol GODMODE
    await client.query(
      `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
       VALUES ('GODMODE','GodMode',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP`
    )
    const { rows: roleRows } = await client.query(
      'SELECT id FROM "Rol" WHERE "codigo"=\'GODMODE\' LIMIT 1'
    )
    const roleId = roleRows[0]?.id

    // Crear/asegurar iglesia GODMODE-ROOT
    await client.query(
      `INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt")
       VALUES ('GodMode','GODMODE-ROOT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("token") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP`
    )
    const { rows: igRows } = await client.query(
      'SELECT id FROM "Iglesia" WHERE "token"=\'GODMODE-ROOT\' LIMIT 1'
    )
    const iglesiaId = igRows[0]?.id

    // Aplicar cambios
    await client.query(
      `UPDATE "User"
          SET "es_superadmin"=true,
              "rol"='GODMODE',
              "plan"='GODMODE',
              "activo"=true,
              "rolId"=$1,
              "iglesiaId"=$2,
              "updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=$3`,
      [roleId, iglesiaId, user.id]
    )

    console.log(`\n✓ Superadmin activado correctamente`)
    console.log(`  Email:  ${user.email}`)
    console.log(`  Nombre: ${user.nombre}`)
    console.log(`  Rol anterior: ${user.rol} → GODMODE`)
    console.log(`  es_superadmin: false → true`)
    console.log(`\n  Podés ingresar ahora desde: /vault-login (con tu contraseña normal)`)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('\n✗ Error:', err.message)
  process.exit(1)
})
