import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { ensureCoreTenantDataSynced } from '../lib/core-sync.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()
const FULL = ['PASTOR_GENERAL', 'CONSOLIDACION']

router.get('/', requireAuth, async (req, res) => {
  const { rol, id, cultoDia, cultoTurno, iglesiaId } = req.user
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(iglesiaId)

  const { page = 1, limit = 20, search = '', estado, grupoId } = req.query
  const where = ['p."iglesiaId"=$1', 'p."deletedAt" IS NULL']
  const params = [Number(iglesiaId)]
  let idx = params.length + 1

  if (rol === 'LIDER' || rol === 'STAFF') {
    where.push(`p."asignadoAUserId"=$${idx++}`)
    params.push(Number(id))
  } else if (rol === 'PASTOR_CULTO') {
    where.push(`p."cultoDia"=$${idx++}`)
    params.push(cultoDia || '')
    where.push(`p."cultoTurno"=$${idx++}`)
    params.push(Number(cultoTurno || 0))
  }
  if (search) {
    where.push(`(p."nombre" ILIKE $${idx} OR p."apellido" ILIKE $${idx} OR p."email" ILIKE $${idx} OR p."telefono" ILIKE $${idx})`)
    params.push(`%${search}%`)
    idx += 1
  }
  if (estado) {
    where.push(`p."estado"=$${idx++}`)
    params.push(String(estado))
  }
  if (grupoId) {
    where.push(`p."grupoId"=$${idx++}`)
    params.push(Number(grupoId))
  }

  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const offset = (Number(page) - 1) * Number(limit)
  const totalRow = await pgOne(`SELECT COUNT(*)::int AS c FROM "Persona" p ${w}`, params)
  const data = await pgMany(
    `SELECT p.*,
            u."nombre" AS "liderNombre",
            g."nombre" AS "grupoNombre"
       FROM "Persona" p
       LEFT JOIN "User" u ON p."asignadoAUserId"=u."id"
       LEFT JOIN "Grupo" g ON p."grupoId"=g."id" AND g."deletedAt" IS NULL
       ${w}
      ORDER BY p."id" DESC
      LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, Number(limit), offset]
  )

  res.json({
    data,
    total: Number(totalRow?.c || 0),
    page: Number(page),
    pages: Math.ceil(Number(totalRow?.c || 0) / Number(limit)),
  })
})

router.get('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)
  const p = await pgOne(
    'SELECT * FROM "Persona" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  if (!p) return res.status(404).json({ error: 'No encontrada' })
  res.json(p)
})

router.post('/', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)
  const {
    nombre, apellido = '', email = '', telefono = '', cultoDia = '', cultoTurno = 0,
    grupoId = null, asignadoA = null, estado = 'ACTIVO', notas = '', fechaIngreso = null,
    fechaNacimiento = null, estadoEspiritual = 'NUEVO_CREYENTE', ocupacion = '',
  } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })

  const created = await pgOne(
    `INSERT INTO "Persona"
      ("iglesiaId","nombre","apellido","email","telefono","estado","asignadoAUserId",
       "cultoDia","cultoTurno","grupoId","notas","fechaIngreso","fechaNacimiento","estadoEspiritual","ocupacion",
       "createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING "id"`,
    [
      Number(req.user.iglesiaId),
      nombre.trim(),
      apellido,
      email,
      telefono,
      estado,
      Number(asignadoA || req.user.id),
      cultoDia,
      Number(cultoTurno || 0),
      grupoId ? Number(grupoId) : null,
      notas,
      fechaIngreso || new Date().toISOString().slice(0, 10),
      fechaNacimiento || null,
      estadoEspiritual,
      ocupacion,
    ]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'CREAR',
    entidad: 'PERSONA',
    entidadId: created.id,
    detalle: nombre,
    iglesiaId: req.user.iglesiaId,
  })
  res.status(201).json({ ok: true, id: created.id })
})

router.put('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)
  const p = await pgOne(
    'SELECT * FROM "Persona" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  if (!p) return res.status(404).json({ error: 'No encontrada' })
  if (!FULL.includes(req.user.rol) && Number(p.asignadoAUserId || 0) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Sin permisos' })
  }

  const m = { ...p, ...req.body }
  await pgExec(
    `UPDATE "Persona"
     SET "nombre"=$1, "apellido"=$2, "email"=$3, "telefono"=$4, "cultoDia"=$5, "cultoTurno"=$6,
         "grupoId"=$7, "asignadoAUserId"=$8, "estado"=$9, "notas"=$10, "fechaIngreso"=$11,
         "fechaNacimiento"=$12, "estadoEspiritual"=$13, "bautizadoAgua"=$14, "bautizadoEspiritu"=$15,
         "discipuladoCompletado"=$16, "ocupacion"=$17, "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$18 AND "iglesiaId"=$19`,
    [
      m.nombre,
      m.apellido,
      m.email,
      m.telefono,
      m.cultoDia || '',
      Number(m.cultoTurno || 0),
      m.grupoId ? Number(m.grupoId) : null,
      m.asignadoAUserId != null ? Number(m.asignadoAUserId) : (m.asignadoA != null ? Number(m.asignadoA) : null),
      m.estado,
      m.notas || '',
      m.fechaIngreso || null,
      m.fechaNacimiento || null,
      m.estadoEspiritual || 'NUEVO_CREYENTE',
      !!m.bautizadoAgua,
      !!m.bautizadoEspiritu,
      !!m.discipuladoCompletado,
      m.ocupacion || '',
      Number(req.params.id),
      Number(req.user.iglesiaId),
    ]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'EDITAR',
    entidad: 'PERSONA',
    entidadId: req.params.id,
    detalle: m.nombre,
    iglesiaId: req.user.iglesiaId,
  })
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  if (req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Solo Pastor General puede eliminar' })
  await ensureCoreTenantDataSynced(req.user.iglesiaId)

  const p = await pgOne(
    'SELECT "nombre" FROM "Persona" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )
  if (!p) return res.status(404).json({ error: 'No encontrada' })

  await pgExec(
    'UPDATE "Persona" SET "deletedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), Number(req.user.iglesiaId)]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'ELIMINAR',
    entidad: 'PERSONA',
    entidadId: req.params.id,
    detalle: p.nombre,
    iglesiaId: req.user.iglesiaId,
  })
  res.json({ ok: true })
})

export default router
