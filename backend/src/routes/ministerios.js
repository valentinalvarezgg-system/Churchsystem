import { Router } from 'express'
import { pgExec, pgOne, pgMany } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import logger from '../lib/logger.js'
import { readTenantConfig } from '../lib/tenant-config.js'
import { extractGoogleDriveFolderId, listGoogleDriveFolderFiles } from '../lib/google-drive.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// ── helpers ──────────────────────────────────────────────────
const iglesiaId = req => Number(req.user.iglesiaId)
const userId    = req => Number(req.user.id)

async function checkAcceso(ministerioId, igId) {
  const m = await pgOne(
    'SELECT id FROM "Ministerio" WHERE id=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL',
    [ministerioId, igId]
  )
  return !!m
}

async function checkRol(ministerioId, uId, rolesPermitidos = ['COORDINADOR','LIDER','SERVIDOR','LECTURA']) {
  const m = await pgOne(
    'SELECT rol FROM "MinisterioMiembro" WHERE "ministerioId"=$1 AND "userId"=$2 AND activo=true',
    [ministerioId, uId]
  )
  if (!m) return false
  return rolesPermitidos.includes(m.rol)
}

async function readMinisterioConfig(ministerioId) {
  const row = await pgOne('SELECT datos FROM "MinisterioConfig" WHERE "ministerioId"=$1', [ministerioId])
  return row?.datos || {}
}

async function saveMinisterioConfig(ministerioId, datos) {
  const row = await pgOne(`
    INSERT INTO "MinisterioConfig" ("ministerioId","datos")
    VALUES ($1,$2::jsonb)
    ON CONFLICT ("ministerioId")
    DO UPDATE SET "datos"=EXCLUDED."datos","updatedAt"=CURRENT_TIMESTAMP
    RETURNING *
  `, [ministerioId, JSON.stringify(datos || {})])
  return row?.datos || datos || {}
}

// ── MINISTERIOS ───────────────────────────────────────────────

// GET /ministerios — listar ministerios de la iglesia
router.get('/', requireAuth, wrap(async (req, res) => {
  const minis = await pgMany(`
    SELECT m.*,
      (SELECT COUNT(*)::int FROM "MinisterioMiembro" mm WHERE mm."ministerioId"=m.id AND mm.activo=true) AS "totalMiembros",
      (SELECT COUNT(*)::int FROM "MinisterioTarea" t WHERE t."ministerioId"=m.id AND t.estado='PENDIENTE' AND t."deletedAt" IS NULL) AS "tareasPendientes"
    FROM "Ministerio" m
    WHERE m."iglesiaId"=$1 AND m."deletedAt" IS NULL
    ORDER BY m."orden" ASC, m."nombre" ASC
  `, [iglesiaId(req)])
  return res.json(minis)
}))

// POST /ministerios — crear ministerio
router.post('/', requireAuth, wrap(async (req, res) => {
  const { tipo='PERSONALIZADO', nombre, descripcion, icono, color } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })
  const m = await pgOne(`
    INSERT INTO "Ministerio" ("iglesiaId","tipo","nombre","descripcion","icono","color")
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [iglesiaId(req), tipo, nombre.trim(), descripcion||null, icono||null, color||null])
  // Creador como coordinador automáticamente
  await pgExec(`
    INSERT INTO "MinisterioMiembro" ("ministerioId","userId","rol")
    VALUES ($1,$2,'COORDINADOR')
  `, [m.id, userId(req)])
  return res.status(201).json(m)
}))

// GET /ministerios/:id — detalle de un ministerio
router.get('/:id', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'Ministerio no encontrado' })
  const m = await pgOne(`
    SELECT m.*,
      (SELECT COUNT(*)::int FROM "MinisterioMiembro" mm WHERE mm."ministerioId"=m.id AND mm.activo=true) AS "totalMiembros",
      (SELECT COUNT(*)::int FROM "MinisterioTarea" t WHERE t."ministerioId"=m.id AND t.estado='PENDIENTE' AND t."deletedAt" IS NULL) AS "tareasPendientes"
    FROM "Ministerio" m WHERE m.id=$1
  `, [req.params.id])
  const config = await readMinisterioConfig(req.params.id)
  return res.json({ ...m, config: config || {} })
}))

// PUT /ministerios/:id — actualizar ministerio
router.put('/:id', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'Ministerio no encontrado' })
  const { nombre, descripcion, icono, color, activo, orden } = req.body || {}
  const m = await pgOne(`
    UPDATE "Ministerio" SET
      "nombre"=COALESCE($1,"nombre"), "descripcion"=COALESCE($2,"descripcion"),
      "icono"=COALESCE($3,"icono"), "color"=COALESCE($4,"color"),
      "activo"=COALESCE($5,"activo"), "orden"=COALESCE($6,"orden"),
      "updatedAt"=CURRENT_TIMESTAMP
    WHERE id=$7 RETURNING *
  `, [nombre||null, descripcion||null, icono||null, color||null, activo??null, orden??null, req.params.id])
  return res.json(m)
}))

// DELETE /ministerios/:id
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  await pgExec('UPDATE "Ministerio" SET "deletedAt"=CURRENT_TIMESTAMP WHERE id=$1', [req.params.id])
  return res.json({ ok: true })
}))

// ── GOOGLE DRIVE ─────────────────────────────────────────────

router.get('/:id/drive', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })

  const ministerioConfig = await readMinisterioConfig(req.params.id)
  const driveConfig = ministerioConfig.drive || {}
  const churchConfig = await readTenantConfig(iglesiaId(req))
  const refreshToken = churchConfig.google_drive_refresh_token || ''
  const connected = !!refreshToken
  const folderId = extractGoogleDriveFolderId(driveConfig.folderId || driveConfig.folderUrl || '')
  const folderLabel = driveConfig.folderLabel || driveConfig.label || ''
  const folderUrl = driveConfig.folderUrl || driveConfig.folderId || ''

  if (!connected) {
    return res.json({
      connected: false,
      folderId,
      folderUrl,
      folderLabel,
      files: [],
      lastSyncAt: driveConfig.lastSyncAt || null,
      message: 'Conectá Google Drive desde Configuración para leer archivos.',
    })
  }

  if (!folderId) {
    return res.json({
      connected: true,
      folderId: '',
      folderUrl,
      folderLabel,
      files: [],
      lastSyncAt: driveConfig.lastSyncAt || null,
      message: 'Definí la carpeta de Drive de este ministerio.',
    })
  }

  try {
    const files = await listGoogleDriveFolderFiles({
      refreshToken,
      folderId,
      pageSize: Number(req.query.limit || 100),
    })
    const syncedAt = new Date().toISOString()
    await saveMinisterioConfig(req.params.id, {
      ...ministerioConfig,
      drive: {
        ...driveConfig,
        folderId,
        folderUrl,
        folderLabel,
        enabled: driveConfig.enabled !== false,
        lastSyncAt: syncedAt,
        lastFilesCount: files.length,
      },
    })
    return res.json({
      connected: true,
      folderId,
      folderUrl,
      folderLabel,
      files,
      lastSyncAt: syncedAt,
      message: files.length ? `Se encontraron ${files.length} archivos.` : 'La carpeta no tiene archivos visibles.',
    })
  } catch (err) {
    logger.warn({ err: err?.message, ministerioId: req.params.id }, 'Google Drive sync failed')
    return res.status(200).json({
      connected: true,
      folderId,
      folderUrl,
      folderLabel,
      files: [],
      lastSyncAt: driveConfig.lastSyncAt || null,
      message: err.message || 'No se pudo sincronizar la carpeta de Drive.',
    })
  }
}))

router.put('/:id/drive', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  if (!await checkRol(req.params.id, userId(req), ['COORDINADOR', 'LIDER'])) {
    return res.status(403).json({ error: 'No tenés permisos para configurar Drive' })
  }
  const { folderId, folderUrl, folderLabel, enabled = true, categories = [] } = req.body || {}
  const ministerioConfig = await readMinisterioConfig(req.params.id)
  const drive = {
    ...(ministerioConfig.drive || {}),
    enabled: enabled !== false,
    folderId: extractGoogleDriveFolderId(folderId || folderUrl || ''),
    folderUrl: folderUrl || '',
    folderLabel: folderLabel || '',
    categories: Array.isArray(categories) ? categories : String(categories || '').split(',').map(v => v.trim()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  }
  const nextConfig = await saveMinisterioConfig(req.params.id, { ...ministerioConfig, drive })
  return res.json({ ok: true, drive: nextConfig.drive || drive })
}))

// ── MIEMBROS ──────────────────────────────────────────────────

router.get('/:id/miembros', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const miembros = await pgMany(`
    SELECT mm.*, u.nombre AS userName, u.email, u.rol AS userRol
    FROM "MinisterioMiembro" mm
    JOIN "User" u ON u.id=mm."userId"
    WHERE mm."ministerioId"=$1 AND mm.activo=true
    ORDER BY mm.rol, u.nombre
  `, [req.params.id])
  return res.json(miembros)
}))

router.post('/:id/miembros', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { userId: targetUserId, rol='SERVIDOR', notas } = req.body || {}
  if (!targetUserId) return res.status(400).json({ error: 'userId requerido' })
  const existing = await pgOne(
    'SELECT id FROM "MinisterioMiembro" WHERE "ministerioId"=$1 AND "userId"=$2',
    [req.params.id, targetUserId]
  )
  let mm
  if (existing) {
    mm = await pgOne(
      'UPDATE "MinisterioMiembro" SET rol=$1,activo=true,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *',
      [rol, existing.id]
    )
  } else {
    mm = await pgOne(
      'INSERT INTO "MinisterioMiembro" ("ministerioId","userId","rol","notas") VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, targetUserId, rol, notas||null]
    )
  }
  return res.status(201).json(mm)
}))

router.delete('/:id/miembros/:miembroId', requireAuth, wrap(async (req, res) => {
  await pgExec(
    'UPDATE "MinisterioMiembro" SET activo=false,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1',
    [req.params.miembroId]
  )
  return res.json({ ok: true })
}))

// ── TAREAS ────────────────────────────────────────────────────

router.get('/:id/tareas', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { estado, asignadoA } = req.query
  let sql = `
    SELECT t.*, u.nombre AS asignadoNombre
    FROM "MinisterioTarea" t
    LEFT JOIN "User" u ON u.id=t."asignadoA"
    WHERE t."ministerioId"=$1 AND t."deletedAt" IS NULL
  `
  const params = [req.params.id]
  if (estado) { params.push(estado); sql += ` AND t.estado=$${params.length}` }
  if (asignadoA) { params.push(asignadoA); sql += ` AND t."asignadoA"=$${params.length}` }
  sql += ' ORDER BY t.prioridad DESC, t."fechaVence" ASC NULLS LAST'
  const tareas = await pgMany(sql, params)
  return res.json(tareas)
}))

router.post('/:id/tareas', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { titulo, descripcion, prioridad='MEDIA', asignadoA, fechaVence, eventoId } = req.body || {}
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' })
  const t = await pgOne(`
    INSERT INTO "MinisterioTarea"
      ("ministerioId","iglesiaId","titulo","descripcion","prioridad","asignadoA","creadoPor","eventoId","fechaVence")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [req.params.id, iglesiaId(req), titulo.trim(), descripcion||null, prioridad,
      asignadoA||null, userId(req), eventoId||null, fechaVence||null])
  return res.status(201).json(t)
}))

router.put('/:id/tareas/:tareaId', requireAuth, wrap(async (req, res) => {
  const { titulo, estado, prioridad, asignadoA, fechaVence, descripcion } = req.body || {}
  const updates = []
  const params = []
  if (titulo)       { params.push(titulo);       updates.push(`"titulo"=$${params.length}`) }
  if (estado)       { params.push(estado);       updates.push(`"estado"=$${params.length}`)
    if (estado==='COMPLETADA') { updates.push(`"fechaCompletada"=CURRENT_TIMESTAMP`) }
  }
  if (prioridad)    { params.push(prioridad);    updates.push(`"prioridad"=$${params.length}`) }
  if (asignadoA !== undefined) { params.push(asignadoA); updates.push(`"asignadoA"=$${params.length}`) }
  if (fechaVence !== undefined) { params.push(fechaVence); updates.push(`"fechaVence"=$${params.length}`) }
  if (descripcion !== undefined) { params.push(descripcion); updates.push(`"descripcion"=$${params.length}`) }
  if (!updates.length) return res.status(400).json({ error: 'Nada para actualizar' })
  params.push(req.params.tareaId)
  const t = await pgOne(
    `UPDATE "MinisterioTarea" SET ${updates.join(',')}, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$${params.length} RETURNING *`,
    params
  )
  return res.json(t)
}))

router.delete('/:id/tareas/:tareaId', requireAuth, wrap(async (req, res) => {
  await pgExec('UPDATE "MinisterioTarea" SET "deletedAt"=CURRENT_TIMESTAMP WHERE id=$1', [req.params.tareaId])
  return res.json({ ok: true })
}))

// ── CHECKLISTS ────────────────────────────────────────────────

router.get('/:id/checklists', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const lists = await pgMany(`
    SELECT cl.*, 
      (SELECT json_agg(i ORDER BY i.orden) FROM "MinisterioChecklistItem" i WHERE i."checklistId"=cl.id) AS items
    FROM "MinisterioChecklist" cl
    WHERE cl."ministerioId"=$1 AND cl."deletedAt" IS NULL
    ORDER BY cl."createdAt" DESC
  `, [req.params.id])
  return res.json(lists)
}))

router.post('/:id/checklists', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { nombre, tipo='CULTO', eventoId, items=[] } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })
  const cl = await pgOne(
    'INSERT INTO "MinisterioChecklist" ("ministerioId","nombre","tipo","eventoId") VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, nombre.trim(), tipo, eventoId||null]
  )
  for (let i=0; i<items.length; i++) {
    await pgExec(
      'INSERT INTO "MinisterioChecklistItem" ("checklistId","texto","orden") VALUES ($1,$2,$3)',
      [cl.id, items[i], i]
    )
  }
  return res.status(201).json(cl)
}))

router.put('/:id/checklists/:clId/items/:itemId', requireAuth, wrap(async (req, res) => {
  const { completado } = req.body || {}
  await pgExec(
    'UPDATE "MinisterioChecklistItem" SET completado=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$2',
    [!!completado, req.params.itemId]
  )
  // Si todos los items están completos, marcar el checklist como completado
  const cl = await pgOne('SELECT id FROM "MinisterioChecklist" WHERE id=$1', [req.params.clId])
  if (cl) {
    const total = await pgOne('SELECT COUNT(*) AS c FROM "MinisterioChecklistItem" WHERE "checklistId"=$1', [req.params.clId])
    const done  = await pgOne('SELECT COUNT(*) AS c FROM "MinisterioChecklistItem" WHERE "checklistId"=$1 AND completado=true', [req.params.clId])
    if (total.c > 0 && total.c === done.c) {
      await pgExec(
        'UPDATE "MinisterioChecklist" SET completado=true,"completadoAt"=CURRENT_TIMESTAMP,"completadoPor"=$1 WHERE id=$2',
        [userId(req), req.params.clId]
      )
    }
  }
  return res.json({ ok: true })
}))

// ── CANCIONES (Alabanza) ──────────────────────────────────────

router.get('/:id/canciones', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const canciones = await pgMany(
    'SELECT * FROM "MinisterioCancion" WHERE "ministerioId"=$1 AND "deletedAt" IS NULL ORDER BY titulo',
    [req.params.id]
  )
  return res.json(canciones)
}))

router.post('/:id/canciones', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { titulo, artista, tonalidad, bpm, duracionSeg, letra, notas, archivoUrl } = req.body || {}
  if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' })
  const c = await pgOne(`
    INSERT INTO "MinisterioCancion" ("ministerioId","titulo","artista","tonalidad","bpm","duracionSeg","letra","notas","archivoUrl")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [req.params.id, titulo.trim(), artista||null, tonalidad||null, bpm||null, duracionSeg||null, letra||null, notas||null, archivoUrl||null])
  return res.status(201).json(c)
}))

router.put('/:id/canciones/:cancionId', requireAuth, wrap(async (req, res) => {
  const { titulo, artista, tonalidad, bpm, duracionSeg, letra, notas } = req.body || {}
  const c = await pgOne(`
    UPDATE "MinisterioCancion" SET
      "titulo"=COALESCE($1,"titulo"), "artista"=COALESCE($2,"artista"),
      "tonalidad"=COALESCE($3,"tonalidad"), "bpm"=COALESCE($4,"bpm"),
      "duracionSeg"=COALESCE($5,"duracionSeg"), "letra"=COALESCE($6,"letra"),
      "notas"=COALESCE($7,"notas"), "updatedAt"=CURRENT_TIMESTAMP
    WHERE id=$8 RETURNING *
  `, [titulo||null, artista||null, tonalidad||null, bpm||null, duracionSeg||null, letra||null, notas||null, req.params.cancionId])
  return res.json(c)
}))

// ── SETLISTS (Alabanza) ───────────────────────────────────────

router.get('/:id/setlists', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const setlists = await pgMany(`
    SELECT s.*,
      (SELECT json_agg(json_build_object('id',sc.id,'orden',sc.orden,'tonalidad',sc.tonalidad,'cancion',c) ORDER BY sc.orden)
       FROM "MinisterioSetlistCancion" sc JOIN "MinisterioCancion" c ON c.id=sc."cancionId"
       WHERE sc."setlistId"=s.id) AS canciones
    FROM "MinisterioSetlist" s
    WHERE s."ministerioId"=$1
    ORDER BY s."fecha" DESC NULLS LAST
  `, [req.params.id])
  return res.json(setlists)
}))

router.post('/:id/setlists', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { nombre, fecha, eventoId, notas, canciones=[] } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })
  const s = await pgOne(
    'INSERT INTO "MinisterioSetlist" ("ministerioId","nombre","fecha","eventoId","notas") VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.params.id, nombre.trim(), fecha||null, eventoId||null, notas||null]
  )
  for (let i=0; i<canciones.length; i++) {
    await pgExec(
      'INSERT INTO "MinisterioSetlistCancion" ("setlistId","cancionId","orden","tonalidad") VALUES ($1,$2,$3,$4)',
      [s.id, canciones[i].cancionId, i, canciones[i].tonalidad||null]
    )
  }
  return res.status(201).json(s)
}))

// ── EQUIPOS (Sonido / Multimedia) ────────────────────────────

router.get('/:id/equipos', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const equipos = await pgMany(
    'SELECT * FROM "MinisterioEquipo" WHERE "ministerioId"=$1 AND "deletedAt" IS NULL ORDER BY tipo, nombre',
    [req.params.id]
  )
  return res.json(equipos)
}))

router.post('/:id/equipos', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { nombre, tipo, marca, modelo, serial, ubicacion, notas } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' })
  const e = await pgOne(`
    INSERT INTO "MinisterioEquipo" ("ministerioId","nombre","tipo","marca","modelo","serial","ubicacion","notas")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [req.params.id, nombre.trim(), tipo||null, marca||null, modelo||null, serial||null, ubicacion||null, notas||null])
  return res.status(201).json(e)
}))

router.put('/:id/equipos/:equipoId', requireAuth, wrap(async (req, res) => {
  const { nombre, tipo, marca, modelo, serial, estado, ubicacion, notas } = req.body || {}
  const e = await pgOne(`
    UPDATE "MinisterioEquipo" SET
      "nombre"=COALESCE($1,"nombre"), "tipo"=COALESCE($2,"tipo"),
      "marca"=COALESCE($3,"marca"), "estado"=COALESCE($4,"estado"),
      "ubicacion"=COALESCE($5,"ubicacion"), "notas"=COALESCE($6,"notas"),
      "updatedAt"=CURRENT_TIMESTAMP
    WHERE id=$7 RETURNING *
  `, [nombre||null, tipo||null, marca||null, estado||null, ubicacion||null, notas||null, req.params.equipoId])
  return res.json(e)
}))

// ── CHECK-IN NIÑOS ────────────────────────────────────────────

router.get('/:id/salas', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  return res.json(await pgMany(
    'SELECT * FROM "MinisterioSala" WHERE "ministerioId"=$1 AND activa=true ORDER BY "rangoEdadMin"',
    [req.params.id]
  ))
}))

router.post('/:id/checkin-ninos', requireAuth, wrap(async (req, res) => {
  if (!await checkAcceso(req.params.id, iglesiaId(req)))
    return res.status(404).json({ error: 'No encontrado' })
  const { personaId, salaId, eventoId, notas, codigoRetiro, responsableEntregaId } = req.body || {}
  if (!personaId) return res.status(400).json({ error: 'personaId requerido' })
  const codigo = codigoRetiro || Math.random().toString(36).slice(2,6).toUpperCase()
  const c = await pgOne(`
    INSERT INTO "MinisterioCheckInNino" ("ministerioId","salaId","personaId","eventoId","notas","codigoRetiro","responsableEntregaId")
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [req.params.id, salaId||null, personaId, eventoId||null, notas||null, codigo, responsableEntregaId||null])
  return res.status(201).json(c)
}))

router.put('/:id/checkin-ninos/:checkinId/salida', requireAuth, wrap(async (req, res) => {
  const c = await pgOne(
    'UPDATE "MinisterioCheckInNino" SET "horaSalida"=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *',
    [req.params.checkinId]
  )
  return res.json(c)
}))

export default router
