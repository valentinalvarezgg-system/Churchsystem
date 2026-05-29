import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()

router.get('/:id', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const persona = await pgOne(
    `SELECT p.*, u."nombre" as "liderNombre", g."nombre" as "grupoNombre"
     FROM "Persona" p
     LEFT JOIN "User" u ON p."asignadoAUserId"=u."id"
     LEFT JOIN "Grupo" g ON p."grupoId"=g."id" AND g."deletedAt" IS NULL
     WHERE p."id"=$1 AND p."iglesiaId"=$2 AND p."deletedAt" IS NULL`,
    [Number(req.params.id), iglesiaId]
  )
  if (!persona) return res.status(404).json({ error: 'No encontrada' })

  const [seguimientos, asistencias, mensajes, familiares, familiaresInversos, contactosExtra, origen] = await Promise.all([
    pgMany(
      `SELECT s.*, u."nombre" as "autorNombre"
       FROM "Seguimiento" s
       LEFT JOIN "User" u ON s."userId"=u."id"
       WHERE s."personaId"=$1 AND s."iglesiaId"=$2 AND s."deletedAt" IS NULL
       ORDER BY s."id" DESC LIMIT 20`,
      [persona.id, iglesiaId]
    ),
    pgMany(
      `SELECT c."nombre", c."fecha", c."cultoDia", a."presente"
       FROM "Asistencia" a
       JOIN "Culto" c ON a."cultoId"=c."id" AND c."deletedAt" IS NULL
       WHERE a."personaId"=$1 AND a."iglesiaId"=$2
       ORDER BY c."fecha" DESC LIMIT 12`,
      [persona.id, iglesiaId]
    ),
    pgMany(
      `SELECT m."tipo", m."destino", m."mensaje", m."enviado", m."createdAt", u."nombre" as "autorNombre"
       FROM "Mensaje" m
       LEFT JOIN "User" u ON m."userId"=u."id"
       WHERE m."personaId"=$1 AND m."iglesiaId"=$2
       ORDER BY m."id" DESC LIMIT 10`,
      [persona.id, iglesiaId]
    ).catch(() => []),
    pgMany(
      `SELECT f."id", f."relacion", f."familiarId",
              p."nombre", p."apellido", p."telefono", p."estado", p."fotoUrl"
       FROM "Familiar" f
       JOIN "Persona" p ON f."familiarId"=p."id" AND p."deletedAt" IS NULL
       WHERE f."personaId"=$1 AND f."iglesiaId"=$2
       ORDER BY f."relacion", p."apellido"`,
      [persona.id, iglesiaId]
    ),
    pgMany(
      `SELECT f."id", f."relacion", f."personaId" as "familiarId",
              p."nombre", p."apellido", p."telefono", p."estado", p."fotoUrl"
       FROM "Familiar" f
       JOIN "Persona" p ON f."personaId"=p."id" AND p."deletedAt" IS NULL
       WHERE f."familiarId"=$1 AND f."iglesiaId"=$2
       ORDER BY f."relacion", p."apellido"`,
      [persona.id, iglesiaId]
    ),
    pgMany(
      `SELECT * FROM "ContactoExtra" WHERE "personaId"=$1 AND "iglesiaId"=$2 ORDER BY "principal" DESC, "id" ASC`,
      [persona.id, iglesiaId]
    ),
    pgOne(
      `SELECT v.*, p."nombre" as "traidoPorNombre2", p."apellido" as "traidoPorApellido"
       FROM "VisitaOrigen" v
       LEFT JOIN "Persona" p ON v."traidoPorId"=p."id" AND p."deletedAt" IS NULL
       WHERE v."personaId"=$1 AND v."iglesiaId"=$2`,
      [persona.id, iglesiaId]
    ),
  ])

  const stats = {
    totalSeguimientos: seguimientos.length,
    totalCultos: asistencias.length,
    presencias: asistencias.filter(a => a.presente).length,
    ultimoSeguimiento: seguimientos[0]?.createdAt || null,
    proximoContacto: seguimientos.find(s => s.proximoContacto)?.proximoContacto || null,
    totalFamiliares: familiares.length + familiaresInversos.length,
  }

  res.json({ persona, seguimientos, asistencias, mensajes, familiares: [...familiares, ...familiaresInversos], contactosExtra, origen, stats })
})

router.post('/:id/familiar', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { familiarId, relacion = 'otro' } = req.body || {}
  if (!familiarId) return res.status(400).json({ error: 'familiarId requerido' })
  if (Number(familiarId) === Number(req.params.id)) return res.status(400).json({ error: 'Una persona no puede ser familiar de sí misma' })

  const RELACIONES = ['conyuge','pareja','hijo','hija','padre','madre','hermano','hermana','abuelo','abuela','nieto','nieta','tio','tia','sobrino','sobrina','primo','prima','suegro','suegra','yerno','nuera','cuñado','cuñada','otro']
  if (!RELACIONES.includes(relacion)) return res.status(400).json({ error: 'Relación inválida' })

  try {
    const row = await pgOne(
      'INSERT INTO "Familiar" ("iglesiaId","personaId","familiarId","relacion") VALUES ($1,$2,$3,$4) RETURNING "id"',
      [iglesiaId, Number(req.params.id), Number(familiarId), relacion]
    )
    registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'FAMILIAR', entidad: 'PERSONA', entidadId: req.params.id, detalle: `${relacion} → ${familiarId}`, iglesiaId })
    res.status(201).json({ ok: true, id: row.id })
  } catch (e) {
    if (e.message?.includes('unique') || e.code === '23505') return res.status(409).json({ error: 'Ya es familiar' })
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id/familiar/:fid', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  await pgExec('DELETE FROM "Familiar" WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.fid), iglesiaId])
  res.json({ ok: true })
})

router.post('/:id/contacto', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { tipo, valor, descripcion = '', principal = false } = req.body || {}
  if (!tipo?.trim() || !valor?.trim()) return res.status(400).json({ error: 'tipo y valor requeridos' })

  const row = await pgOne(
    'INSERT INTO "ContactoExtra" ("iglesiaId","personaId","tipo","valor","descripcion","principal") VALUES ($1,$2,$3,$4,$5,$6) RETURNING "id"',
    [iglesiaId, Number(req.params.id), tipo.trim(), valor.trim(), descripcion, !!principal]
  )
  res.status(201).json({ ok: true, id: row.id })
})

router.delete('/:id/contacto/:cid', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  await pgExec(
    'DELETE FROM "ContactoExtra" WHERE "id"=$1 AND "personaId"=$2 AND "iglesiaId"=$3',
    [Number(req.params.cid), Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
})

router.post('/:id/origen', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { traidoPorId, traidoPorNombre, cultoId, cultoNombre, fecha, notas } = req.body || {}
  await pgExec(
    `INSERT INTO "VisitaOrigen" ("iglesiaId","personaId","traidoPorId","traidoPorNombre","cultoId","cultoNombre","fecha","notas")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT ("personaId") DO UPDATE SET
       "traidoPorId"=EXCLUDED."traidoPorId",
       "traidoPorNombre"=EXCLUDED."traidoPorNombre",
       "cultoId"=EXCLUDED."cultoId",
       "cultoNombre"=EXCLUDED."cultoNombre",
       "fecha"=EXCLUDED."fecha",
       "notas"=EXCLUDED."notas"`,
    [iglesiaId, Number(req.params.id), traidoPorId || null, traidoPorNombre || '', cultoId || null, cultoNombre || '', fecha || '', notas || '']
  )
  res.json({ ok: true })
})

router.post('/:id/foto', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { id } = req.params
  const { base64 } = req.body || {}
  if (!base64) return res.status(400).json({ error: 'base64 requerido' })

  const persona = await pgOne('SELECT "id","nombre" FROM "Persona" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [Number(id), iglesiaId])
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' })

  try {
    const dir = path.join(process.cwd(), 'uploads', 'fotos')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const fotoPath = path.join(dir, `${id}.jpg`)
    const data = base64.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(fotoPath, Buffer.from(data, 'base64'))
    const fotoUrl = `/fotos/${id}.jpg`
    await pgExec('UPDATE "Persona" SET "fotoUrl"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "iglesiaId"=$3', [fotoUrl, Number(id), iglesiaId])
    res.json({ ok: true, fotoUrl })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id/foto', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { id } = req.params
  try {
    const fotoPath = path.join(process.cwd(), 'uploads', 'fotos', `${id}.jpg`)
    if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath)
    await pgExec('UPDATE "Persona" SET "fotoUrl"=\'\',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2', [Number(id), iglesiaId])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
