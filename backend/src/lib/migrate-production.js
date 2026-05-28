// migrate-production.js — correr UNA vez en el servidor de producción
// node backend/src/lib/migrate-production.js

import db from './db.js'

const COLS = [
  ["apellido",         "TEXT DEFAULT ''"],
  ["oauth_provider",   "TEXT DEFAULT NULL"],
  ["oauth_id",         "TEXT DEFAULT NULL"],
  ["iglesia",          "TEXT DEFAULT ''"],
  ["telefono",         "TEXT DEFAULT ''"],
  ["expira",           "TEXT DEFAULT NULL"],
  ["plan",             "TEXT DEFAULT 'GENERAL'"],
  ["iglesiaId",        "INTEGER DEFAULT NULL"],
  ["pais",             "TEXT DEFAULT 'AR'"],
  ["divisa",           "TEXT DEFAULT 'ARS'"],
  ["idioma",           "TEXT DEFAULT 'es'"],
  ["promoCode",        "TEXT DEFAULT ''"],
  ["promoDescuento",   "INTEGER DEFAULT 0"],
  ["promoMeses",       "INTEGER DEFAULT 0"],
  ["promoUsadoAt",     "TEXT DEFAULT NULL"],
  ["emailVerificado",  "INTEGER DEFAULT 0"],
  ["codigoVerif",      "TEXT DEFAULT NULL"],
  ["codigoExpira",     "TEXT DEFAULT NULL"],
  ["codigoContexto",   "TEXT DEFAULT NULL"],
  ["pendingPassword",  "TEXT DEFAULT NULL"],
]

console.log('\n🔧 Migrando DB de producción...\n')

for (const [col, def] of COLS) {
  try {
    db.run(`ALTER TABLE users ADD COLUMN ${col} ${def}`)
    console.log(`  ✓ ${col}`)
  } catch(e) {
    if (e.message?.includes('duplicate column')) {
      console.log(`  · ${col} (ya existe)`)
    } else {
      console.error(`  ✗ ${col}: ${e.message}`)
    }
  }
}

// Tabla iglesias
try {
  db.run(`CREATE TABLE IF NOT EXISTS iglesias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL DEFAULT 'Mi Iglesia',
    token TEXT UNIQUE NOT NULL,
    adminId INTEGER NOT NULL,
    plan TEXT DEFAULT 'GENERAL',
    activa INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now'))
  )`)
  console.log('  ✓ tabla iglesias')
} catch(e) { console.log('  · iglesias: ' + e.message) }

// Marcar usuarios existentes como verificados
db.run("UPDATE users SET emailVerificado=1 WHERE emailVerificado IS NULL OR emailVerificado=0")
db.run("UPDATE users SET plan='GENERAL' WHERE plan IS NULL OR plan=''")
console.log('  ✓ usuarios migrados')

console.log('\n✅ Migración completa\n')
