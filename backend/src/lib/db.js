import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const require    = createRequire(import.meta.url)
const DB_FILE    = path.resolve(__dirname, '../../church.db')
const WASM_DIR   = path.dirname(require.resolve('sql.js'))

const SQL = await initSqlJs({ locateFile: f => path.join(WASM_DIR, f) })
const _db = fs.existsSync(DB_FILE)
  ? new SQL.Database(fs.readFileSync(DB_FILE))
  : new SQL.Database()

function persist() { fs.writeFileSync(DB_FILE, Buffer.from(_db.export())) }

const tablas = [
`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nombre TEXT DEFAULT '',
  rol TEXT NOT NULL DEFAULT 'LIDER',
  cultoDia TEXT DEFAULT '',
  cultoTurno INTEGER DEFAULT 0,
  grupoId INTEGER,
  activo INTEGER DEFAULT 1,
  oauth_provider TEXT DEFAULT NULL,
  oauth_id TEXT DEFAULT NULL,
  iglesia TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  expira TEXT DEFAULT NULL,
  plan TEXT DEFAULT 'GENERAL',
  iglesiaId INTEGER DEFAULT NULL,
  emailVerificado INTEGER DEFAULT 0,
  codigoVerif TEXT DEFAULT NULL,
  codigoExpira TEXT DEFAULT NULL,
  createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  fechaNacimiento TEXT DEFAULT NULL,
  cultoDia TEXT DEFAULT '',
  cultoTurno INTEGER DEFAULT 0,
  grupoId INTEGER,
  asignadoA INTEGER,
  estado TEXT DEFAULT 'ACTIVO',
  estadoEspiritual TEXT DEFAULT 'NUEVO_CREYENTE',
  bautizadoAgua INTEGER DEFAULT 0,
  bautizadoEspiritu INTEGER DEFAULT 0,
  discipuladoCompletado INTEGER DEFAULT 0,
  ocupacion TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  fechaIngreso TEXT DEFAULT (date('now')),
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  cultoDia TEXT DEFAULT '',
  cultoTurno INTEGER DEFAULT 0,
  liderId INTEGER,
  descripcion TEXT DEFAULT '',
  createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER, email TEXT DEFAULT '', rol TEXT DEFAULT '',
  accion TEXT NOT NULL, entidad TEXT DEFAULT '', entidadId TEXT DEFAULT '',
  detalle TEXT DEFAULT '', fecha TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS seguimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaId INTEGER NOT NULL, userId INTEGER NOT NULL,
  tipo TEXT DEFAULT 'CONTACTO', nota TEXT DEFAULT '',
  proximoContacto TEXT, createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS cultos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL, fecha TEXT NOT NULL,
  cultoDia TEXT DEFAULT '', cultoTurno INTEGER DEFAULT 0,
  observaciones TEXT DEFAULT '', createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS asistencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cultoId INTEGER NOT NULL, personaId INTEGER NOT NULL,
  presente INTEGER DEFAULT 1, createdAt TEXT DEFAULT (datetime('now')),
  UNIQUE(cultoId, personaId)
)`,
`CREATE TABLE IF NOT EXISTS mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaId INTEGER NOT NULL, userId INTEGER NOT NULL,
  tipo TEXT DEFAULT 'WHATSAPP', destino TEXT DEFAULT '',
  mensaje TEXT NOT NULL, enviado INTEGER DEFAULT 0,
  error TEXT, plantillaId INTEGER, createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS plantillas_mensaje (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL, tipo TEXT DEFAULT 'WHATSAPP',
  contenido TEXT NOT NULL, userId INTEGER,
  createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY, valor TEXT NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS finanzas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monto REAL NOT NULL, tipo TEXT DEFAULT 'OFRENDA',
  fecha TEXT NOT NULL, cultoId INTEGER,
  descripcion TEXT DEFAULT '', anonimo INTEGER DEFAULT 1,
  userId INTEGER, createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL, tipo TEXT DEFAULT 'EVENTO',
  fecha TEXT NOT NULL, hora TEXT DEFAULT '',
  lugar TEXT DEFAULT '', descripcion TEXT DEFAULT '',
  todoElDia INTEGER DEFAULT 0, userId INTEGER,
  createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS discipulado_prog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaId INTEGER NOT NULL, material TEXT NOT NULL,
  completado INTEGER DEFAULT 0, fecha TEXT,
  UNIQUE(personaId, material)
)`,
`CREATE TABLE IF NOT EXISTS permisos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  personas INTEGER DEFAULT 0, grupos INTEGER DEFAULT 0,
  asistencia INTEGER DEFAULT 0, calendario INTEGER DEFAULT 0,
  mensajes INTEGER DEFAULT 0, alertas INTEGER DEFAULT 0,
  finanzas INTEGER DEFAULT 0, reportes INTEGER DEFAULT 0,
  discipulado INTEGER DEFAULT 0, seguimiento INTEGER DEFAULT 0,
  historial INTEGER DEFAULT 0, consolidacion INTEGER DEFAULT 0,
  oracion INTEGER DEFAULT 0, comunicados INTEGER DEFAULT 0,
  updatedAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS oracion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL, descripcion TEXT DEFAULT '',
  privado INTEGER DEFAULT 0, estado TEXT DEFAULT 'ACTIVA',
  userId INTEGER, createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS oracion_apoyo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oracionId INTEGER NOT NULL, userId INTEGER NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')),
  UNIQUE(oracionId, userId)
)`,
`CREATE TABLE IF NOT EXISTS comunicados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL, contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'GENERAL', destinatarios TEXT DEFAULT 'TODOS',
  fijado INTEGER DEFAULT 0, archivado INTEGER DEFAULT 0,
  userId INTEGER, createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS consolidaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaId INTEGER NOT NULL, consolidadorId INTEGER,
  estado TEXT DEFAULT 'PRIMER_CONTACTO', pasos TEXT DEFAULT '{}',
  notas TEXT DEFAULT '', createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
)`
,
`CREATE TABLE IF NOT EXISTS familiares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaId INTEGER NOT NULL,
  familiarId INTEGER NOT NULL,
  relacion TEXT NOT NULL DEFAULT 'otro',
  createdAt TEXT DEFAULT (datetime('now')),
  UNIQUE(personaId, familiarId)
)`,
`CREATE TABLE IF NOT EXISTS contactos_extra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaId INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  valor TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  principal INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS visita_origen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personaId INTEGER NOT NULL UNIQUE,
  traidoPorId INTEGER,
  traidoPorNombre TEXT DEFAULT '',
  cultoId INTEGER,
  cultoNombre TEXT DEFAULT '',
  fecha TEXT DEFAULT (date('now')),
  notas TEXT DEFAULT '',
  createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  dias_extra INTEGER NOT NULL DEFAULT 0,
  usado INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
)`,
`CREATE TABLE IF NOT EXISTS iglesias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL DEFAULT 'Mi Iglesia',
  token TEXT NOT NULL UNIQUE,
  adminId INTEGER NOT NULL,
  plan TEXT NOT NULL DEFAULT 'GENERAL',
  createdAt TEXT DEFAULT (datetime('now'))
)`
]

for (const t of tablas) _db.run(t)

// Migraciones seguras para bases existentes
const migraciones = [
  "ALTER TABLE personas ADD COLUMN fechaNacimiento TEXT DEFAULT NULL",
  "ALTER TABLE personas ADD COLUMN estadoEspiritual TEXT DEFAULT 'NUEVO_CREYENTE'",
  "ALTER TABLE personas ADD COLUMN bautizadoAgua INTEGER DEFAULT 0",
  "ALTER TABLE personas ADD COLUMN bautizadoEspiritu INTEGER DEFAULT 0",
  "ALTER TABLE personas ADD COLUMN discipuladoCompletado INTEGER DEFAULT 0",
  "ALTER TABLE personas ADD COLUMN ocupacion TEXT DEFAULT ''",
  "ALTER TABLE personas ADD COLUMN direccion TEXT DEFAULT ''",
  "ALTER TABLE personas ADD COLUMN localidad TEXT DEFAULT ''",
  "ALTER TABLE personas ADD COLUMN fotoUrl TEXT DEFAULT ''",
  "ALTER TABLE personas ADD COLUMN comoLlego TEXT DEFAULT ''",
]
for (const m of migraciones) { try { _db.run(m) } catch (_) {} }

persist()

function run(sql, params = []) {
  const stmt = _db.prepare(sql)
  stmt.bind(params); stmt.step(); stmt.free()
  const res = _db.exec('SELECT last_insert_rowid()')
  const lastID = res.length ? Number(res[0].values[0][0]) : null
  persist()
  return { lastID }
}
function get(sql, params = []) {
  const stmt = _db.prepare(sql); stmt.bind(params)
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free(); return row
}
function all(sql, params = []) {
  const stmt = _db.prepare(sql); stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free(); return rows
}

export default { run, get, all }
