#!/usr/bin/env node
/**
 * seed-demo.mjs — datos mínimos para demo visual local
 * Idempotente: se puede correr varias veces sin duplicar.
 * Uso: node scripts/seed-demo.mjs
 */
import 'dotenv/config'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '') ? false : { rejectUnauthorized: false },
})

const q  = (sql, p = []) => pool.query(sql, p)
const o  = async (sql, p = []) => { const r = await q(sql, p); return r.rows[0] || null }

async function run() {
  console.log('\n  Church System — seed-demo\n')

  // ── Extensiones extra que el server crea lazy ─────────────────────────────
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rol"         TEXT`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plan"        TEXT DEFAULT 'GENERAL'`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pais"        TEXT DEFAULT 'AR'`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "divisa"      TEXT DEFAULT 'ARS'`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "idioma"      TEXT DEFAULT 'es'`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "iglesia"     TEXT`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "expira"      TIMESTAMPTZ`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "es_superadmin" BOOLEAN NOT NULL DEFAULT false`).catch(() => {})
  await q(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "oauth_provider" TEXT`).catch(() => {})

  await q(`ALTER TABLE "Iglesia" ADD COLUMN IF NOT EXISTS "token" TEXT`).catch(() => {})
  await q(`
    DO $$ BEGIN
      BEGIN ALTER TABLE "Iglesia" ADD CONSTRAINT iglesia_token_unique UNIQUE ("token"); EXCEPTION WHEN duplicate_table THEN NULL; END;
    END $$
  `).catch(() => {})

  // ── Tablas que el server crea en runtime ──────────────────────────────────
  await q(`
    CREATE TABLE IF NOT EXISTS "sesiones_auth" (
      "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "usuarioId"   INTEGER NOT NULL,
      "token_hash"  TEXT NOT NULL UNIQUE,
      "dispositivo" TEXT,
      "ip"          TEXT,
      "expira_at"   TIMESTAMPTZ NOT NULL,
      "revocado_at" TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {})
  await q(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "id"           SERIAL PRIMARY KEY,
      "userId"       INTEGER NOT NULL,
      "refreshToken" TEXT NOT NULL UNIQUE,
      "userAgent"    TEXT,
      "ip"           TEXT,
      "expiresAt"    TIMESTAMPTZ NOT NULL,
      "revoked"      SMALLINT NOT NULL DEFAULT 0,
      "createdAt"    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {})
  await q(`
    CREATE TABLE IF NOT EXISTS "godmode_audit" (
      id         SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      accion     TEXT NOT NULL,
      detalle    JSONB NOT NULL DEFAULT '{}',
      ip         TEXT,
      creado_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {})
  await q(`
    CREATE TABLE IF NOT EXISTS "Culto" (
      "id"          SERIAL PRIMARY KEY,
      "iglesiaId"   INTEGER NOT NULL,
      "nombre"      TEXT NOT NULL DEFAULT 'Culto Dominical',
      "fecha"       DATE NOT NULL,
      "tipo"        TEXT DEFAULT 'DOMINGO',
      "descripcion" TEXT,
      "deletedAt"   TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {})
  await q(`
    CREATE TABLE IF NOT EXISTS "Asistencia" (
      "id"        SERIAL PRIMARY KEY,
      "cultoId"   INTEGER NOT NULL,
      "personaId" INTEGER NOT NULL,
      "iglesiaId" INTEGER NOT NULL,
      "presente"  BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("cultoId","personaId")
    )
  `).catch(() => {})
  await q(`
    CREATE TABLE IF NOT EXISTS "Grupo" (
      "id"          SERIAL PRIMARY KEY,
      "iglesiaId"   INTEGER NOT NULL,
      "nombre"      TEXT NOT NULL,
      "descripcion" TEXT,
      "tipo"        TEXT DEFAULT 'CELULA',
      "liderId"     INTEGER,
      "activo"      BOOLEAN NOT NULL DEFAULT true,
      "deletedAt"   TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {})
  await q(`
    CREATE TABLE IF NOT EXISTS "Comunicado" (
      "id"          SERIAL PRIMARY KEY,
      "iglesiaId"   INTEGER NOT NULL,
      "titulo"      TEXT NOT NULL,
      "contenido"   TEXT NOT NULL,
      "tipo"        TEXT DEFAULT 'GENERAL',
      "publicadoEn" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "deletedAt"   TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {})

  // ── Rol PASTOR_GENERAL ────────────────────────────────────────────────────
  const rol = await o(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ('PASTOR_GENERAL','Pastor General',NOW(),NOW())
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=NOW()
     RETURNING id`
  )
  console.log('  ✓ Rol PASTOR_GENERAL')

  // ── Iglesia demo ──────────────────────────────────────────────────────────
  const iglesia = await o(
    `INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt")
     VALUES ('Iglesia Demo','DEMO-IGLESIA',NOW(),NOW())
     ON CONFLICT ("token") DO UPDATE SET "nombre"='Iglesia Demo', "updatedAt"=NOW()
     RETURNING id`
  )
  console.log('  ✓ Iglesia demo')

  // ── Usuario admin ─────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('demo1234', 10)
  const admin = await o(
    `INSERT INTO "User"
      ("email","password","nombre","apellido","activo","emailVerificado",
       "iglesiaId","rolId","rol","plan","pais","divisa","idioma","iglesia","createdAt","updatedAt")
     VALUES
      ('admin@demo.com',$1,'Admin','Demo',true,true,$2,$3,
       'PASTOR_GENERAL','GENERAL','AR','ARS','es','Iglesia Demo',NOW(),NOW())
     ON CONFLICT ("email") DO UPDATE
       SET "password"=$1, "iglesiaId"=$2, "rolId"=$3, "updatedAt"=NOW()
     RETURNING id`,
    [hash, iglesia.id, rol.id]
  )
  console.log('  ✓ Usuario admin@demo.com / demo1234')

  // ── Configuración de iglesia ──────────────────────────────────────────────
  async function setConfig(clave, valor) {
    await q(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=$3,"updatedAt"=NOW()`,
      [iglesia.id, clave, valor]
    )
  }
  await setConfig('nombre_iglesia', 'Iglesia Demo')
  await setConfig('plan', 'GENERAL')
  await setConfig('suscripcion_activa', '1')
  console.log('  ✓ Configuracion iglesia')

  // ── 3 personas ────────────────────────────────────────────────────────────
  const personas = [
    { nombre: 'María', apellido: 'González', email: 'maria@demo.com', telefono: '+54911000001' },
    { nombre: 'Juan',  apellido: 'Pérez',    email: 'juan@demo.com',  telefono: '+54911000002' },
    { nombre: 'Laura', apellido: 'Martínez', email: 'laura@demo.com', telefono: '+54911000003' },
  ]
  const personaIds = []
  for (const p of personas) {
    const row = await o(
      `INSERT INTO "Persona" ("iglesiaId","nombre","apellido","email","telefono","estado","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'ACTIVO',NOW(),NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [iglesia.id, p.nombre, p.apellido, p.email, p.telefono]
    )
    if (row) personaIds.push(row.id)
  }
  // Si ya existían, buscarlas
  if (personaIds.length === 0) {
    const rows = await q(`SELECT id FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL LIMIT 3`, [iglesia.id])
    personaIds.push(...rows.rows.map(r => r.id))
  }
  console.log(`  ✓ ${personas.length} personas demo`)

  // ── 1 grupo ───────────────────────────────────────────────────────────────
  const grupo = await o(
    `INSERT INTO "Grupo" ("iglesiaId","nombre","descripcion","cultoDia","cultoTurno","createdAt","updatedAt")
     VALUES ($1,'Célula Norte','Grupo de la zona norte','DOMINGO',0,NOW(),NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [iglesia.id]
  ) || await o(`SELECT id FROM "Grupo" WHERE "iglesiaId"=$1 LIMIT 1`, [iglesia.id])
  console.log('  ✓ Grupo demo')

  // ── 1 culto con asistencia ────────────────────────────────────────────────
  const hoy = new Date().toISOString().slice(0, 10)
  const culto = await o(
    `INSERT INTO "Culto" ("iglesiaId","nombre","fecha","cultoDia","cultoTurno","createdAt","updatedAt")
     VALUES ($1,'Culto Dominical',$2,'DOMINGO',0,NOW(),NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [iglesia.id, hoy]
  ) || await o(`SELECT id FROM "Culto" WHERE "iglesiaId"=$1 ORDER BY "createdAt" DESC LIMIT 1`, [iglesia.id])

  if (culto && personaIds.length > 0) {
    for (const pid of personaIds) {
      await q(
        `INSERT INTO "Asistencia" ("cultoId","personaId","iglesiaId","presente","createdAt")
         VALUES ($1,$2,$3,true,NOW())
         ON CONFLICT ("cultoId","personaId") DO NOTHING`,
        [culto.id, pid, iglesia.id]
      ).catch(() => {})
    }
    console.log(`  ✓ Culto con ${personaIds.length} asistencias`)
  }

  // ── 1 comunicado ──────────────────────────────────────────────────────────
  await q(
    `INSERT INTO "Comunicado" ("iglesiaId","userId","titulo","contenido","tipo","destinatarios","createdAt","updatedAt")
     VALUES ($1,$2,'Bienvenidos a la Iglesia Demo','Este es un comunicado de prueba para la demo del sistema.',
             'GENERAL','TODOS',NOW(),NOW())
     ON CONFLICT DO NOTHING`,
    [iglesia.id, admin.id]
  ).catch(() => {})
  console.log('  ✓ Comunicado demo')

  console.log('\n  ─────────────────────────────────────────')
  console.log('  Login:    admin@demo.com')
  console.log('  Password: demo1234')
  console.log('  URL:      http://localhost:5173/app/login')
  console.log('  ─────────────────────────────────────────\n')

  await pool.end()
}

run().catch(err => {
  console.error('\n  ✗ Error:', err.message)
  process.exit(1)
})
