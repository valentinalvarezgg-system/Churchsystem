import pino from 'pino'
import { pgExec, pgMany, pgOne } from './pg.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
const syncedCore = new Set()
const syncedOps = new Set()

let legacyDb = null
let _legacyDbLoaded = false
async function getLegacyDb() {
  if (_legacyDbLoaded) return legacyDb
  _legacyDbLoaded = true
  try { const mod = await import('./db.js'); legacyDb = mod.default } catch { legacyDb = null }
  return legacyDb
}

function clean(v = '') {
  return String(v || '').trim().toLowerCase()
}

function cleanPhone(v = '') {
  return String(v || '').replace(/\D/g, '')
}

function dateKey(v = '') {
  return String(v || '').slice(0, 16)
}

function safeAll(sql, params = [], fallbackSql = null, fallbackParams = [], allowFallback = true) {
  try {
    return legacyDb.all(sql, params) || []
  } catch {
    if (!fallbackSql || !allowFallback) return []
    try {
      return legacyDb.all(fallbackSql, fallbackParams) || []
    } catch {
      return []
    }
  }
}

function safeGet(sql, params = [], fallbackSql = null, fallbackParams = [], allowFallback = true) {
  try {
    return legacyDb.get(sql, params) || null
  } catch {
    if (!fallbackSql || !allowFallback) return null
    try {
      return legacyDb.get(fallbackSql, fallbackParams) || null
    } catch {
      return null
    }
  }
}

async function userMapByLegacyId(iglesiaId) {
  const map = new Map()
  const legacyUsers = safeAll(
    'SELECT id,email FROM users WHERE iglesiaId=?',
    [iglesiaId],
    'SELECT id,email FROM users',
    [],
    Number(iglesiaId) === 1
  )
  for (const lu of legacyUsers) {
    if (!lu.email) continue
    const user = await pgOne('SELECT "id" FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [lu.email])
    if (user?.id) map.set(Number(lu.id), Number(user.id))
  }
  return map
}

function personaFingerprint(row) {
  return `${clean(row.nombre)}|${clean(row.apellido)}|${cleanPhone(row.telefono)}|${dateKey(row.createdAt)}`
}

function personaFallbackFingerprint(row) {
  return `${clean(row.nombre)}|${clean(row.apellido)}|${cleanPhone(row.telefono)}`
}

function grupoFingerprint(row) {
  return `${clean(row.nombre)}|${clean(row.cultoDia)}|${Number(row.cultoTurno || 0)}|${dateKey(row.createdAt)}`
}

function grupoFallbackFingerprint(row) {
  return `${clean(row.nombre)}|${clean(row.cultoDia)}|${Number(row.cultoTurno || 0)}`
}

function cultoFingerprint(row) {
  return `${clean(row.nombre)}|${row.fecha || ''}|${clean(row.cultoDia)}|${Number(row.cultoTurno || 0)}|${dateKey(row.createdAt)}`
}

function cultoFallbackFingerprint(row) {
  return `${clean(row.nombre)}|${row.fecha || ''}|${clean(row.cultoDia)}|${Number(row.cultoTurno || 0)}`
}

function buildFirstMap(rows, keyFn, keyFallbackFn) {
  const strict = new Map()
  const loose = new Map()
  for (const r of rows) {
    const k1 = keyFn(r)
    if (!strict.has(k1)) strict.set(k1, r)
    const k2 = keyFallbackFn(r)
    if (!loose.has(k2)) loose.set(k2, r)
  }
  return { strict, loose }
}

async function mapLegacyPersonasToPg(iglesiaId, legacyPersonas) {
  const map = new Map()
  const pgPersonas = await pgMany(
    'SELECT "id","nombre","apellido","telefono","createdAt" FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL',
    [iglesiaId]
  )
  const idx = buildFirstMap(pgPersonas, personaFingerprint, personaFallbackFingerprint)
  for (const lp of legacyPersonas) {
    const hit = idx.strict.get(personaFingerprint(lp)) || idx.loose.get(personaFallbackFingerprint(lp))
    if (hit?.id) map.set(Number(lp.id), Number(hit.id))
  }
  return map
}

async function mapLegacyGruposToPg(iglesiaId, legacyGrupos) {
  const map = new Map()
  const pgGrupos = await pgMany(
    'SELECT "id","nombre","cultoDia","cultoTurno","createdAt" FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL',
    [iglesiaId]
  )
  const idx = buildFirstMap(pgGrupos, grupoFingerprint, grupoFallbackFingerprint)
  for (const lg of legacyGrupos) {
    const hit = idx.strict.get(grupoFingerprint(lg)) || idx.loose.get(grupoFallbackFingerprint(lg))
    if (hit?.id) map.set(Number(lg.id), Number(hit.id))
  }
  return map
}

async function mapLegacyCultosToPg(iglesiaId, legacyCultos) {
  const map = new Map()
  const pgCultos = await pgMany(
    'SELECT "id","nombre","fecha","cultoDia","cultoTurno","createdAt" FROM "Culto" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL',
    [iglesiaId]
  )
  const idx = buildFirstMap(pgCultos, cultoFingerprint, cultoFallbackFingerprint)
  for (const lc of legacyCultos) {
    const hit = idx.strict.get(cultoFingerprint(lc)) || idx.loose.get(cultoFallbackFingerprint(lc))
    if (hit?.id) map.set(Number(lc.id), Number(hit.id))
  }
  return map
}

async function syncCore(iglesiaId) {
  if (syncedCore.has(iglesiaId)) return

  const pgPersonas = await pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])
  const pgGrupos = await pgOne('SELECT COUNT(*)::int AS c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])
  if (Number(pgPersonas?.c || 0) > 0 || Number(pgGrupos?.c || 0) > 0) {
    syncedCore.add(iglesiaId)
    return
  }

  await getLegacyDb()

  const legacyGrupos = safeAll(
    'SELECT * FROM grupos WHERE iglesiaId=? ORDER BY id ASC',
    [iglesiaId],
    'SELECT * FROM grupos ORDER BY id ASC',
    [],
    iglesiaId === 1
  )
  const legacyPersonas = safeAll(
    'SELECT * FROM personas WHERE iglesiaId=? ORDER BY id ASC',
    [iglesiaId],
    'SELECT * FROM personas ORDER BY id ASC',
    [],
    iglesiaId === 1
  )

  if (!legacyGrupos.length && !legacyPersonas.length) {
    syncedCore.add(iglesiaId)
    return
  }

  const userMap = await userMapByLegacyId(iglesiaId)
  const groupMap = new Map()

  for (const g of legacyGrupos) {
    const createdAt = g.createdAt || new Date().toISOString()
    const liderId = g.liderId != null ? (userMap.get(Number(g.liderId)) || null) : null
    const row = await pgOne(
      `INSERT INTO "Grupo"
        ("iglesiaId","nombre","cultoDia","cultoTurno","liderId","descripcion","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
       RETURNING "id"`,
      [iglesiaId, g.nombre || 'Grupo', g.cultoDia || '', Number(g.cultoTurno || 0), liderId, g.descripcion || '', createdAt]
    )
    groupMap.set(Number(g.id), Number(row.id))
  }

  for (const p of legacyPersonas) {
    const createdAt = p.createdAt || new Date().toISOString()
    const updatedAt = p.updatedAt || createdAt
    const asignadoAUserId = p.asignadoA != null ? (userMap.get(Number(p.asignadoA)) || null) : null
    const grupoId = p.grupoId != null ? (groupMap.get(Number(p.grupoId)) || null) : null
    await pgExec(
      `INSERT INTO "Persona"
        ("iglesiaId","nombre","apellido","email","telefono","estado","asignadoAUserId",
         "cultoDia","cultoTurno","grupoId","notas","fechaIngreso","fechaNacimiento",
         "estadoEspiritual","bautizadoAgua","bautizadoEspiritu","discipuladoCompletado","ocupacion",
         "createdAt","updatedAt")
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        iglesiaId,
        p.nombre || 'Sin nombre',
        p.apellido || '',
        p.email || '',
        p.telefono || '',
        p.estado || 'ACTIVO',
        asignadoAUserId,
        p.cultoDia || '',
        Number(p.cultoTurno || 0),
        grupoId,
        p.notas || '',
        p.fechaIngreso || null,
        p.fechaNacimiento || null,
        p.estadoEspiritual || 'NUEVO_CREYENTE',
        !!p.bautizadoAgua,
        !!p.bautizadoEspiritu,
        !!p.discipuladoCompletado,
        p.ocupacion || '',
        createdAt,
        updatedAt,
      ]
    )
  }

  syncedCore.add(iglesiaId)
  logger.info({ iglesiaId, legacyGrupos: legacyGrupos.length, legacyPersonas: legacyPersonas.length }, 'Sync core tenant data completed')
}

async function syncOps(iglesiaId) {
  if (syncedOps.has(iglesiaId)) return
  await syncCore(iglesiaId)

  const cultoCount = await pgOne('SELECT COUNT(*)::int AS c FROM "Culto" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])
  const segCount = await pgOne('SELECT COUNT(*)::int AS c FROM "Seguimiento" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])
  const finCount = await pgOne('SELECT COUNT(*)::int AS c FROM "Finanza" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId])
  const asisCount = await pgOne('SELECT COUNT(*)::int AS c FROM "Asistencia" WHERE "iglesiaId"=$1', [iglesiaId])
  if ((Number(cultoCount?.c || 0) + Number(segCount?.c || 0) + Number(finCount?.c || 0) + Number(asisCount?.c || 0)) > 0) {
    syncedOps.add(iglesiaId)
    return
  }

  await getLegacyDb()

  const legacyCultos = safeAll(
    'SELECT * FROM cultos WHERE iglesiaId=? ORDER BY id ASC',
    [iglesiaId],
    'SELECT * FROM cultos ORDER BY id ASC',
    [],
    iglesiaId === 1
  )
  const legacyPersonas = safeAll(
    'SELECT * FROM personas WHERE iglesiaId=? ORDER BY id ASC',
    [iglesiaId],
    'SELECT * FROM personas ORDER BY id ASC',
    [],
    iglesiaId === 1
  )
  const legacySeguimientos = safeAll(
    'SELECT * FROM seguimientos WHERE iglesiaId=? ORDER BY id ASC',
    [iglesiaId],
    'SELECT * FROM seguimientos ORDER BY id ASC',
    [],
    iglesiaId === 1
  )
  const legacyFinanzas = safeAll(
    'SELECT * FROM finanzas WHERE iglesiaId=? ORDER BY id ASC',
    [iglesiaId],
    'SELECT * FROM finanzas ORDER BY id ASC',
    [],
    iglesiaId === 1
  )
  const legacyAsistencias = safeAll(
    'SELECT * FROM asistencias ORDER BY id ASC',
    [],
    null,
    [],
    false
  )

  if (!legacyCultos.length && !legacySeguimientos.length && !legacyFinanzas.length && !legacyAsistencias.length) {
    syncedOps.add(iglesiaId)
    return
  }

  const userMap = await userMapByLegacyId(iglesiaId)
  const personaMap = await mapLegacyPersonasToPg(iglesiaId, legacyPersonas)

  for (const c of legacyCultos) {
    const createdAt = c.createdAt || new Date().toISOString()
    const updatedAt = c.updatedAt || createdAt
    await pgExec(
      `INSERT INTO "Culto" ("iglesiaId","nombre","fecha","cultoDia","cultoTurno","observaciones","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [iglesiaId, c.nombre || 'Culto', c.fecha || new Date().toISOString().slice(0, 10), c.cultoDia || '', Number(c.cultoTurno || 0), c.observaciones || '', createdAt, updatedAt]
    )
  }

  const cultoMap = await mapLegacyCultosToPg(iglesiaId, legacyCultos)

  for (const a of legacyAsistencias) {
    const cultoId = cultoMap.get(Number(a.cultoId))
    const personaId = personaMap.get(Number(a.personaId))
    if (!cultoId || !personaId) continue
    await pgExec(
      `INSERT INTO "Asistencia" ("iglesiaId","cultoId","personaId","presente","createdAt")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("cultoId","personaId") DO UPDATE SET "presente"=EXCLUDED."presente"`,
      [iglesiaId, cultoId, personaId, !!a.presente, a.createdAt || new Date().toISOString()]
    )
  }

  for (const s of legacySeguimientos) {
    const personaId = personaMap.get(Number(s.personaId))
    if (!personaId) continue
    const createdAt = s.createdAt || new Date().toISOString()
    const updatedAt = s.updatedAt || createdAt
    const userId = s.userId != null ? (userMap.get(Number(s.userId)) || null) : null
    await pgExec(
      `INSERT INTO "Seguimiento"
        ("iglesiaId","personaId","userId","tipo","nota","proximoContacto","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [iglesiaId, personaId, userId, s.tipo || 'CONTACTO', s.nota || '', s.proximoContacto || null, createdAt, updatedAt]
    )
  }

  for (const f of legacyFinanzas) {
    const createdAt = f.createdAt || new Date().toISOString()
    const updatedAt = f.updatedAt || createdAt
    const cultoId = f.cultoId != null ? (cultoMap.get(Number(f.cultoId)) || null) : null
    const userId = f.userId != null ? (userMap.get(Number(f.userId)) || null) : null
    await pgExec(
      `INSERT INTO "Finanza"
        ("iglesiaId","monto","tipo","fecha","cultoId","descripcion","anonimo","userId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [iglesiaId, Number(f.monto || 0), f.tipo || 'OFRENDA', f.fecha || new Date().toISOString().slice(0, 10), cultoId, f.descripcion || '', !!(f.anonimo ?? 1), userId, createdAt, updatedAt]
    )
  }

  syncedOps.add(iglesiaId)
  logger.info({
    iglesiaId,
    legacyCultos: legacyCultos.length,
    legacyAsistencias: legacyAsistencias.length,
    legacySeguimientos: legacySeguimientos.length,
    legacyFinanzas: legacyFinanzas.length,
  }, 'Sync operational tenant data completed')
}

export async function ensureCoreTenantDataSynced(iglesiaId) {
  const tenantId = Number(iglesiaId || 0)
  if (!tenantId) return
  await syncCore(tenantId)
}

export async function ensureOperationalTenantDataSynced(iglesiaId) {
  const tenantId = Number(iglesiaId || 0)
  if (!tenantId) return
  await syncOps(tenantId)
}

