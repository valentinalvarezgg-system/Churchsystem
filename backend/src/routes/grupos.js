import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { ensureCoreTenantDataSynced } from '../lib/core-sync.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const rows = await pgMany(
    `SELECT g.*,
            u."nombre" AS "liderNombre",
            (SELECT COUNT(*)::int FROM "Persona" p WHERE p."grupoId"=g."id" AND p."iglesiaId"=g."iglesiaId" AND p."deletedAt" IS NULL) AS "totalPersonas"
       FROM "Grupo" g
       LEFT JOIN "User" u ON g."liderId"=u."id"
      WHERE g."iglesiaId"=$1 AND g."deletedAt" IS NULL
      ORDER BY g."id" DESC`,
    [Number(req.user.iglesiaId)]
  )
  res.json(rows)
})

router.get('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const g = await pgOne(
    'SELECT * FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  if (!g) return res.status(404).json({ error: 'No encontrado' })

  const miembros = await pgMany(
    'SELECT "id","nombre","apellido","telefono","estado" FROM "Persona" WHERE "grupoId"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  res.json({ ...g, miembros })
})

router.post('/', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const { nombre, cultoDia = '', cultoTurno = 0, liderId = null, descripcion = '' } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })

  const created = await pgOne(
    `INSERT INTO "Grupo" ("iglesiaId","nombre","cultoDia","cultoTurno","liderId","descripcion","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING "id"`,
    [Number(req.user.iglesiaId), nombre.trim(), cultoDia, Number(cultoTurno || 0), liderId ? Number(liderId) : null, descripcion]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'CREAR',
    entidad: 'GRUPO',
    entidadId: created.id,
    detalle: nombre,
    iglesiaId: req.user.iglesiaId,
  })
  res.status(201).json({ ok: true, id: created.id })
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const g = await pgOne(
    'SELECT * FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  if (!g) return res.status(404).json({ error: 'No encontrado' })

  const m = { ...g, ...req.body }
  await pgExec(
    `UPDATE "Grupo"
     SET "nombre"=$1, "cultoDia"=$2, "cultoTurno"=$3, "liderId"=$4, "descripcion"=$5, "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$6 AND "iglesiaId"=$7`,
    [m.nombre, m.cultoDia || '', Number(m.cultoTurno || 0), m.liderId ? Number(m.liderId) : null, m.descripcion || '', Number(req.params.id), Number(req.user.iglesiaId)]
  )
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  if (req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'No autorizado' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  await pgExec(
    'UPDATE "Persona" SET "grupoId"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "grupoId"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  await pgExec(
    'UPDATE "Grupo" SET "deletedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  res.json({ ok: true })
})

// ── Estadísticas de crecimiento del grupo ───────────────────
router.get('/:id/stats', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const grupoId   = Number(req.params.id)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const g = await pgOne(
    'SELECT "id","nombre" FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL',
    [grupoId, iglesiaId]
  )
  if (!g) return res.status(404).json({ error: 'Grupo no encontrado' })

  // Crecimiento mensual: cuántas personas se unieron al grupo cada mes (últimos 12 meses)
  const crecimiento = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    const mes = d.toISOString().slice(0, 7)
    const row = await pgOne(
      `SELECT COUNT(*)::int AS c FROM "Persona"
       WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
         AND to_char("createdAt",'YYYY-MM')=$3`,
      [iglesiaId, grupoId, mes]
    )
    crecimiento.push({ mes, nuevos: Number(row?.c || 0) })
  }

  // Distribución por etapa espiritual
  const porEtapa = await pgMany(
    `SELECT "estadoEspiritual", COUNT(*)::int AS total
     FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
     GROUP BY "estadoEspiritual"`,
    [iglesiaId, grupoId]
  )

  // Distribución por estado (ACTIVO / VISITANTE / INACTIVO)
  const porEstado = await pgMany(
    `SELECT "estado", COUNT(*)::int AS total
     FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
     GROUP BY "estado"`,
    [iglesiaId, grupoId]
  )

  // Total actual y bautizados
  const resumen = await pgOne(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN "bautizadoAgua" THEN 1 ELSE 0 END)::int AS bautizados,
            SUM(CASE WHEN "discipuladoCompletado" THEN 1 ELSE 0 END)::int AS discipulados
     FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL`,
    [iglesiaId, grupoId]
  )

  // Miembro más reciente
  const ultimo = await pgOne(
    `SELECT "nombre","apellido","createdAt" FROM "Persona"
     WHERE "iglesiaId"=$1 AND "grupoId"=$2 AND "deletedAt" IS NULL
     ORDER BY "createdAt" DESC LIMIT 1`,
    [iglesiaId, grupoId]
  )

  res.json({ grupo: g, crecimiento, porEtapa, porEstado, resumen: resumen || {}, ultimo })
})

// ── Grupos temáticos / estacionales (#9) ────────────────────

// Tabla de inscripciones (auto-creada)
const initInscripciones = async () => {
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "GrupoInscripcion" (
      "id"         SERIAL PRIMARY KEY,
      "iglesiaId"  INT NOT NULL,
      "grupoId"    INT NOT NULL,
      "personaId"  INT NOT NULL,
      "estado"     TEXT NOT NULL DEFAULT 'INSCRIPTO',  -- INSCRIPTO | COMPLETADO | BAJA
      "createdAt"  TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE("grupoId","personaId")
    )
  `)
  await pgExec(`CREATE INDEX IF NOT EXISTS "GI_grupo_idx" ON "GrupoInscripcion"("grupoId")`)
  // Agregar columnas de grupo temporal si no existen
  await pgExec(`ALTER TABLE "Grupo" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'REGULAR'`).catch(()=>{})
  await pgExec(`ALTER TABLE "Grupo" ADD COLUMN IF NOT EXISTS "fechaFin" DATE`).catch(()=>{})
  await pgExec(`ALTER TABLE "Grupo" ADD COLUMN IF NOT EXISTS "cupo" INT`).catch(()=>{})
}

// GET /grupos/:id/inscripciones
router.get('/:id/inscripciones', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const grupoId   = Number(req.params.id)
  await initInscripciones()
  const rows = await pgMany(
    `SELECT i.*, p."nombre", p."apellido", p."telefono", p."email"
     FROM "GrupoInscripcion" i
     LEFT JOIN "Persona" p ON i."personaId"=p."id"
     WHERE i."grupoId"=$1 AND i."iglesiaId"=$2
     ORDER BY i."createdAt" ASC`,
    [grupoId, iglesiaId]
  )
  res.json(rows)
})

// POST /grupos/:id/inscripciones
router.post('/:id/inscripciones', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const grupoId   = Number(req.params.id)
  await initInscripciones()

  const g = await pgOne('SELECT * FROM "Grupo" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [grupoId, iglesiaId])
  if (!g) return res.status(404).json({ error: 'Grupo no encontrado' })

  // Verificar cupo
  if (g.cupo) {
    const count = await pgOne('SELECT COUNT(*)::int AS c FROM "GrupoInscripcion" WHERE "grupoId"=$1 AND "estado"!=\'BAJA\'', [grupoId])
    if (count?.c >= g.cupo) return res.status(400).json({ error: 'Cupo completo' })
  }

  const { personaId } = req.body || {}
  if (!personaId) return res.status(400).json({ error: 'personaId requerido' })

  const row = await pgOne(
    `INSERT INTO "GrupoInscripcion"("iglesiaId","grupoId","personaId")
     VALUES($1,$2,$3)
     ON CONFLICT("grupoId","personaId") DO UPDATE SET "estado"='INSCRIPTO',"updatedAt"=NOW()
     RETURNING *`,
    [iglesiaId, grupoId, Number(personaId)]
  )
  res.status(201).json(row)
})

// PUT /grupos/:id/inscripciones/:inscId — cambiar estado
router.put('/:id/inscripciones/:inscId', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const { estado } = req.body || {}
  await pgExec(
    `UPDATE "GrupoInscripcion" SET "estado"=$1,"updatedAt"=NOW() WHERE "id"=$2 AND "iglesiaId"=$3`,
    [estado, Number(req.params.inscId), iglesiaId]
  )
  res.json({ ok: true })
})

// DELETE /grupos/:id/inscripciones/:inscId
router.delete('/:id/inscripciones/:inscId', requireAuth, async (req, res) => {
  await pgExec('DELETE FROM "GrupoInscripcion" WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.inscId), Number(req.user.iglesiaId)])
  res.json({ ok: true })
})

// ── Rotación de liderazgo (#7) ───────────────────────────────

const initLiderazgo = async () => {
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "LiderazgoPipeline" (
      "id"           SERIAL PRIMARY KEY,
      "iglesiaId"    INT NOT NULL,
      "personaId"    INT NOT NULL,
      "mentorId"     INT,
      "grupoId"      INT,
      "etapa"        TEXT NOT NULL DEFAULT 'IDENTIFICADO',
      "progreso"     INT NOT NULL DEFAULT 0 CHECK("progreso" BETWEEN 0 AND 100),
      "notas"        TEXT,
      "fechaInicio"  DATE,
      "createdAt"    TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE("iglesiaId","personaId")
    )
  `)
  await pgExec(`CREATE INDEX IF NOT EXISTS "LP_iglesia_idx" ON "LiderazgoPipeline"("iglesiaId")`)
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "LiderazgoChecklist" (
      "id"           SERIAL PRIMARY KEY,
      "pipelineId"   INT NOT NULL REFERENCES "LiderazgoPipeline"("id") ON DELETE CASCADE,
      "iglesiaId"    INT NOT NULL,
      "item"         TEXT NOT NULL,
      "completado"   BOOLEAN NOT NULL DEFAULT false,
      "createdAt"    TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
}

const ETAPAS_LIDERAZGO = ['IDENTIFICADO', 'EN_FORMACION', 'APRENDIZ', 'ASISTENTE', 'LIDER']
const CHECKLIST_DEFAULT = [
  'Bautizado en agua', 'Discipulado completado', 'Frutos en su vida',
  'Entrevista con pastor', 'Conoce la visión de la iglesia',
  'Ha liderado reunión de célula', 'Recomendado por líder actual'
]

// GET /grupos/liderazgo — pipeline completo de la iglesia
router.get('/liderazgo', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  await initLiderazgo()
  const rows = await pgMany(
    `SELECT lp.*, p."nombre", p."apellido", p."estadoEspiritual", p."telefono",
            m."nombre" AS "mentorNombre", m."apellido" AS "mentorApellido",
            g."nombre" AS "grupoNombre"
     FROM "LiderazgoPipeline" lp
     LEFT JOIN "Persona" p  ON lp."personaId"=p."id"
     LEFT JOIN "Persona" m  ON lp."mentorId"=m."id"
     LEFT JOIN "Grupo" g    ON lp."grupoId"=g."id"
     WHERE lp."iglesiaId"=$1
     ORDER BY lp."etapa" ASC, lp."progreso" DESC`,
    [iglesiaId]
  )
  // Checklist por pipeline
  const ids = rows.map(r => r.id)
  let checks = []
  if (ids.length) {
    checks = await pgMany(
      `SELECT * FROM "LiderazgoChecklist" WHERE "pipelineId" = ANY($1::int[])`,
      [ids]
    )
  }
  const checksMap = checks.reduce((acc, c) => {
    ;(acc[c.pipelineId] = acc[c.pipelineId] || []).push(c)
    return acc
  }, {})
  res.json({ rows: rows.map(r => ({ ...r, checklist: checksMap[r.id] || [] })), etapas: ETAPAS_LIDERAZGO })
})

// POST /grupos/liderazgo — agregar al pipeline
router.post('/liderazgo', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  await initLiderazgo()
  const { personaId, mentorId, grupoId, etapa = 'IDENTIFICADO', notas = '', fechaInicio = null } = req.body || {}
  if (!personaId) return res.status(400).json({ error: 'personaId requerido' })
  const row = await pgOne(
    `INSERT INTO "LiderazgoPipeline"("iglesiaId","personaId","mentorId","grupoId","etapa","notas","fechaInicio")
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT("iglesiaId","personaId") DO UPDATE
       SET "etapa"=EXCLUDED."etapa","mentorId"=EXCLUDED."mentorId","notas"=EXCLUDED."notas","updatedAt"=NOW()
     RETURNING *`,
    [iglesiaId, Number(personaId), mentorId ? Number(mentorId) : null,
     grupoId ? Number(grupoId) : null, etapa, notas, fechaInicio || null]
  )
  // Crear checklist default si es nuevo
  const existing = await pgMany('SELECT id FROM "LiderazgoChecklist" WHERE "pipelineId"=$1', [row.id])
  if (!existing.length) {
    for (const item of CHECKLIST_DEFAULT) {
      await pgExec('INSERT INTO "LiderazgoChecklist"("pipelineId","iglesiaId","item") VALUES($1,$2,$3)', [row.id, iglesiaId, item])
    }
  }
  res.status(201).json(row)
})

// PUT /grupos/liderazgo/:id — actualizar etapa/progreso
router.put('/liderazgo/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const { etapa, progreso, notas, mentorId } = req.body || {}
  await pgExec(
    `UPDATE "LiderazgoPipeline"
     SET "etapa"=COALESCE($1,"etapa"), "progreso"=COALESCE($2,"progreso"),
         "notas"=COALESCE($3,"notas"), "mentorId"=COALESCE($4,"mentorId"), "updatedAt"=NOW()
     WHERE "id"=$5 AND "iglesiaId"=$6`,
    [etapa||null, progreso!=null?Number(progreso):null, notas||null,
     mentorId!=null?Number(mentorId):null, Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

// PUT /grupos/liderazgo/:id/check/:checkId — toggle checklist
router.put('/liderazgo/:id/check/:checkId', requireAuth, async (req, res) => {
  await pgExec(
    'UPDATE "LiderazgoChecklist" SET "completado"=NOT "completado" WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.checkId), Number(req.user.iglesiaId)]
  )
  // Recalcular progreso automáticamente
  const { total, done } = await pgOne(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN "completado" THEN 1 ELSE 0 END)::int AS done
     FROM "LiderazgoChecklist" WHERE "pipelineId"=$1`,
    [Number(req.params.id)]
  ) || {}
  const progreso = total ? Math.round((done / total) * 100) : 0
  await pgExec('UPDATE "LiderazgoPipeline" SET "progreso"=$1,"updatedAt"=NOW() WHERE "id"=$2', [progreso, Number(req.params.id)])
  res.json({ ok: true, progreso })
})

// DELETE /grupos/liderazgo/:id
router.delete('/liderazgo/:id', requireAuth, async (req, res) => {
  await pgExec('DELETE FROM "LiderazgoPipeline" WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), Number(req.user.iglesiaId)])
  res.json({ ok: true })
})

// ── Mapa de grupos (#6) ──────────────────────────────────────
// GET /grupos/mapa — personas con coords para mapa + grupos con sede
router.get('/mapa', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)

  // Agregar columnas lat/lng a Persona si no existen
  await pgExec(`ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "lat" NUMERIC(10,7)`).catch(() => {})
  await pgExec(`ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "lng" NUMERIC(10,7)`).catch(() => {})
  await pgExec(`ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "direccion" TEXT`).catch(() => {})
  await pgExec(`ALTER TABLE "Grupo" ADD COLUMN IF NOT EXISTS "lat" NUMERIC(10,7)`).catch(() => {})
  await pgExec(`ALTER TABLE "Grupo" ADD COLUMN IF NOT EXISTS "lng" NUMERIC(10,7)`).catch(() => {})
  await pgExec(`ALTER TABLE "Grupo" ADD COLUMN IF NOT EXISTS "direccionSede" TEXT`).catch(() => {})

  const personas = await pgMany(
    `SELECT p."id", p."nombre", p."apellido", p."estado", p."estadoEspiritual",
            p."grupoId", p."lat", p."lng", p."direccion", g."nombre" AS "grupoNombre"
     FROM "Persona" p
     LEFT JOIN "Grupo" g ON p."grupoId"=g."id"
     WHERE p."iglesiaId"=$1 AND p."deletedAt" IS NULL
       AND p."lat" IS NOT NULL AND p."lng" IS NOT NULL`,
    [iglesiaId]
  )
  const grupos = await pgMany(
    `SELECT g."id", g."nombre", g."cultoDia", g."lat", g."lng", g."direccionSede",
            COUNT(p."id")::int AS miembros
     FROM "Grupo" g
     LEFT JOIN "Persona" p ON p."grupoId"=g."id" AND p."deletedAt" IS NULL
     WHERE g."iglesiaId"=$1 AND g."deletedAt" IS NULL
     GROUP BY g."id"`,
    [iglesiaId]
  )
  res.json({ personas, grupos })
})

// PUT /grupos/mapa/persona/:id — guardar coords de una persona
router.put('/mapa/persona/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const { lat, lng, direccion } = req.body || {}
  await pgExec(
    `UPDATE "Persona" SET "lat"=$1,"lng"=$2,"direccion"=$3,"updatedAt"=NOW()
     WHERE "id"=$4 AND "iglesiaId"=$5`,
    [lat ? Number(lat) : null, lng ? Number(lng) : null, direccion || null,
     Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

// PUT /grupos/mapa/grupo/:id — guardar coords de sede del grupo
router.put('/mapa/grupo/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const { lat, lng, direccionSede } = req.body || {}
  await pgExec(
    `UPDATE "Grupo" SET "lat"=$1,"lng"=$2,"direccionSede"=$3,"updatedAt"=NOW()
     WHERE "id"=$4 AND "iglesiaId"=$5`,
    [lat ? Number(lat) : null, lng ? Number(lng) : null, direccionSede || null,
     Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

export default router


