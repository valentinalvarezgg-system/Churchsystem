import { Router } from 'express'
import { pgExec, pgOne } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const MODULOS = ['personas', 'grupos', 'asistencia', 'calendario', 'mensajes', 'alertas', 'finanzas', 'reportes', 'discipulado', 'seguimiento', 'historial', 'consolidacion', 'oracion', 'comunicados']
const DEFAULTS = {
  PASTOR_GENERAL: Object.fromEntries(MODULOS.map(m => [m, 3])),
  CONSOLIDACION: { personas: 2, grupos: 1, asistencia: 1, calendario: 1, mensajes: 2, alertas: 2, finanzas: 0, reportes: 2, discipulado: 2, seguimiento: 2, historial: 2, consolidacion: 3, oracion: 2, comunicados: 2 },
  PASTOR_CULTO: { personas: 2, grupos: 2, asistencia: 3, calendario: 2, mensajes: 2, alertas: 1, finanzas: 0, reportes: 1, discipulado: 1, seguimiento: 2, historial: 0, consolidacion: 1, oracion: 1, comunicados: 1 },
  STAFF: { personas: 2, grupos: 1, asistencia: 2, calendario: 1, mensajes: 1, alertas: 0, finanzas: 0, reportes: 0, discipulado: 1, seguimiento: 2, historial: 0, consolidacion: 1, oracion: 1, comunicados: 1 },
  LIDER: { personas: 1, grupos: 1, asistencia: 1, calendario: 1, mensajes: 0, alertas: 0, finanzas: 0, reportes: 0, discipulado: 1, seguimiento: 2, historial: 0, consolidacion: 0, oracion: 1, comunicados: 1 },
}

function toPermisoRow(raw = {}) {
  const out = {}
  for (const modulo of MODULOS) out[modulo] = Number(raw[modulo] ?? 0)
  return out
}

async function getUserBasic(uid, iglesiaId) {
  return pgOne(
    'SELECT "id","rol","iglesiaId" FROM "User" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [uid, iglesiaId]
  )
}

async function getOrCreate(userId, rol, iglesiaId) {
  let permiso = await pgOne(
    'SELECT * FROM "Permiso" WHERE "userId"=$1 AND "iglesiaId"=$2 LIMIT 1',
    [userId, iglesiaId]
  )
  if (!permiso) {
    const d = DEFAULTS[rol] || DEFAULTS.LIDER
    await pgExec(
      `INSERT INTO "Permiso"
        ("iglesiaId","userId","personas","grupos","asistencia","calendario","mensajes","alertas","finanzas","reportes","discipulado","seguimiento","historial","consolidacion","oracion","comunicados","createdAt","updatedAt")
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("userId")
       DO UPDATE SET
        "iglesiaId"=EXCLUDED."iglesiaId",
        "updatedAt"=CURRENT_TIMESTAMP`,
      [
        iglesiaId,
        userId,
        d.personas ?? 0,
        d.grupos ?? 0,
        d.asistencia ?? 0,
        d.calendario ?? 0,
        d.mensajes ?? 0,
        d.alertas ?? 0,
        d.finanzas ?? 0,
        d.reportes ?? 0,
        d.discipulado ?? 0,
        d.seguimiento ?? 0,
        d.historial ?? 0,
        d.consolidacion ?? 0,
        d.oracion ?? 0,
        d.comunicados ?? 0,
      ]
    )
    permiso = await pgOne('SELECT * FROM "Permiso" WHERE "userId"=$1 AND "iglesiaId"=$2 LIMIT 1', [userId, iglesiaId])
  }
  return permiso
}

router.get('/me/actual', requireAuth, wrap(async (req, res) => {
  const p = await getOrCreate(req.user.id, req.user.rol, req.user.iglesiaId)
  return res.json({ userId: req.user.id, ...toPermisoRow(p), updatedAt: p.updatedAt })
}))

router.get('/:userId', requireAuth, wrap(async (req, res) => {
  const uid = Number(req.params.userId)
  if (uid !== req.user.id && req.user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Sin acceso' })
  const u = await getUserBasic(uid, req.user.iglesiaId)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  const p = await getOrCreate(uid, u.rol, req.user.iglesiaId)
  return res.json({ userId: uid, ...toPermisoRow(p), updatedAt: p.updatedAt })
}))

router.put('/:userId', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const uid = Number(req.params.userId)
  const u = await getUserBasic(uid, req.user.iglesiaId)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  if (u.rol === 'PASTOR_GENERAL') return res.status(400).json({ error: 'No se puede modificar al Pastor General' })

  const base = DEFAULTS[u.rol] || DEFAULTS.LIDER
  const next = { ...base }
  for (const m of MODULOS) {
    if (req.body[m] === undefined) continue
    const v = Number(req.body[m])
    if (v >= 0 && v <= 3) next[m] = v
  }

  await pgExec(
    `INSERT INTO "Permiso"
      ("iglesiaId","userId","personas","grupos","asistencia","calendario","mensajes","alertas","finanzas","reportes","discipulado","seguimiento","historial","consolidacion","oracion","comunicados","createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("userId")
     DO UPDATE SET
      "iglesiaId"=EXCLUDED."iglesiaId",
      "personas"=EXCLUDED."personas",
      "grupos"=EXCLUDED."grupos",
      "asistencia"=EXCLUDED."asistencia",
      "calendario"=EXCLUDED."calendario",
      "mensajes"=EXCLUDED."mensajes",
      "alertas"=EXCLUDED."alertas",
      "finanzas"=EXCLUDED."finanzas",
      "reportes"=EXCLUDED."reportes",
      "discipulado"=EXCLUDED."discipulado",
      "seguimiento"=EXCLUDED."seguimiento",
      "historial"=EXCLUDED."historial",
      "consolidacion"=EXCLUDED."consolidacion",
      "oracion"=EXCLUDED."oracion",
      "comunicados"=EXCLUDED."comunicados",
      "updatedAt"=CURRENT_TIMESTAMP`,
    [
      req.user.iglesiaId,
      uid,
      next.personas ?? 0,
      next.grupos ?? 0,
      next.asistencia ?? 0,
      next.calendario ?? 0,
      next.mensajes ?? 0,
      next.alertas ?? 0,
      next.finanzas ?? 0,
      next.reportes ?? 0,
      next.discipulado ?? 0,
      next.seguimiento ?? 0,
      next.historial ?? 0,
      next.consolidacion ?? 0,
      next.oracion ?? 0,
      next.comunicados ?? 0,
    ]
  )
  return res.json({ ok: true })
}))

router.post('/:userId/reset', requireAuth, requireRol('PASTOR_GENERAL'), wrap(async (req, res) => {
  const uid = Number(req.params.userId)
  const u = await getUserBasic(uid, req.user.iglesiaId)
  if (!u) return res.status(404).json({ error: 'No encontrado' })
  const d = DEFAULTS[u.rol] || DEFAULTS.LIDER

  await pgExec(
    `INSERT INTO "Permiso"
      ("iglesiaId","userId","personas","grupos","asistencia","calendario","mensajes","alertas","finanzas","reportes","discipulado","seguimiento","historial","consolidacion","oracion","comunicados","createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("userId")
     DO UPDATE SET
      "iglesiaId"=EXCLUDED."iglesiaId",
      "personas"=EXCLUDED."personas",
      "grupos"=EXCLUDED."grupos",
      "asistencia"=EXCLUDED."asistencia",
      "calendario"=EXCLUDED."calendario",
      "mensajes"=EXCLUDED."mensajes",
      "alertas"=EXCLUDED."alertas",
      "finanzas"=EXCLUDED."finanzas",
      "reportes"=EXCLUDED."reportes",
      "discipulado"=EXCLUDED."discipulado",
      "seguimiento"=EXCLUDED."seguimiento",
      "historial"=EXCLUDED."historial",
      "consolidacion"=EXCLUDED."consolidacion",
      "oracion"=EXCLUDED."oracion",
      "comunicados"=EXCLUDED."comunicados",
      "updatedAt"=CURRENT_TIMESTAMP`,
    [
      req.user.iglesiaId,
      uid,
      d.personas ?? 0,
      d.grupos ?? 0,
      d.asistencia ?? 0,
      d.calendario ?? 0,
      d.mensajes ?? 0,
      d.alertas ?? 0,
      d.finanzas ?? 0,
      d.reportes ?? 0,
      d.discipulado ?? 0,
      d.seguimiento ?? 0,
      d.historial ?? 0,
      d.consolidacion ?? 0,
      d.oracion ?? 0,
      d.comunicados ?? 0,
    ]
  )
  return res.json({ ok: true, permisos: d })
}))

export default router
