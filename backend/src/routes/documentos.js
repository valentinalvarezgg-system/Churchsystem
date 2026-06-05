import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Directorio de uploads — usa /tmp en producción (ephemeral) o ./uploads en dev
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'documentos')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now()
    const ext = path.extname(file.originalname)
    cb(null, `${ts}-${Math.random().toString(36).slice(2,8)}${ext}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }) // 20MB

// Auto-crear tabla
const initTabla = async () => {
  await pgExec(`
    CREATE TABLE IF NOT EXISTS "Documento" (
      "id"           SERIAL PRIMARY KEY,
      "iglesiaId"    INT NOT NULL,
      "nombre"       TEXT NOT NULL,
      "tipo"         TEXT NOT NULL DEFAULT 'OTRO',
      "descripcion"  TEXT,
      "archivo"      TEXT,           -- ruta o URL
      "mimeType"     TEXT,
      "tamanio"      INT,            -- bytes
      "fechaVencimiento" DATE,
      "alerta"       BOOLEAN NOT NULL DEFAULT false,
      "uploadedBy"   INT,
      "deletedAt"    TIMESTAMPTZ,
      "createdAt"    TIMESTAMPTZ DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pgExec(`CREATE INDEX IF NOT EXISTS "Doc_iglesia_idx" ON "Documento"("iglesiaId")`)
}

// GET /documentos
router.get('/', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  await initTabla()
  const { tipo, search } = req.query
  const params = [iglesiaId]
  const filters = [`d."iglesiaId"=$1`, `d."deletedAt" IS NULL`]
  if (tipo)   { filters.push(`d."tipo"=$${params.push(tipo)}`); }
  if (search) { filters.push(`(d."nombre" ILIKE $${params.push('%'+search+'%')} OR d."descripcion" ILIKE $${params.length})`); }

  const rows = await pgMany(
    `SELECT d.*, u."nombre" AS "subioPor"
     FROM "Documento" d
     LEFT JOIN "User" u ON d."uploadedBy"=u."id"
     WHERE ${filters.join(' AND ')}
     ORDER BY d."createdAt" DESC`,
    params
  )

  // Alertas: documentos con vencimiento próximo (≤30 días)
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const proximos = rows.filter(r => {
    if (!r.fechaVencimiento) return false
    const d = new Date(r.fechaVencimiento+'T12:00:00')
    const diff = (d - hoy) / 86400000
    return diff >= 0 && diff <= 30
  })

  res.json({ documentos: rows, alertasVencimiento: proximos.length })
}))

// POST /documentos — crear con o sin archivo adjunto
router.post('/', requireAuth, upload.single('archivo'), wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  await initTabla()
  const { nombre, tipo = 'OTRO', descripcion = '', fechaVencimiento = null, alerta = false } = req.body || {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre requerido' })

  let archivoPath = null, mimeType = null, tamanio = null
  if (req.file) {
    archivoPath = `/uploads/documentos/${req.file.filename}`
    mimeType    = req.file.mimetype
    tamanio     = req.file.size
  }

  const row = await pgOne(
    `INSERT INTO "Documento"("iglesiaId","nombre","tipo","descripcion","archivo","mimeType","tamanio","fechaVencimiento","alerta","uploadedBy")
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [iglesiaId, nombre.trim(), tipo, descripcion, archivoPath, mimeType, tamanio,
     fechaVencimiento || null, alerta === 'true' || alerta === true, req.user.id]
  )
  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'CREAR', entidad: 'DOCUMENTO', entidadId: String(row.id), detalle: nombre, iglesiaId })
  res.status(201).json(row)
}))

// PUT /documentos/:id
router.put('/:id', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const doc = await pgOne('SELECT * FROM "Documento" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [Number(req.params.id), iglesiaId])
  if (!doc) return res.status(404).json({ error: 'No encontrado' })
  const m = { ...doc, ...req.body }
  await pgExec(
    `UPDATE "Documento" SET "nombre"=$1,"tipo"=$2,"descripcion"=$3,"fechaVencimiento"=$4,"alerta"=$5,"updatedAt"=NOW()
     WHERE "id"=$6 AND "iglesiaId"=$7`,
    [m.nombre, m.tipo, m.descripcion||'', m.fechaVencimiento||null, !!m.alerta, Number(req.params.id), iglesiaId]
  )
  res.json({ ok: true })
}))

// DELETE /documentos/:id — soft delete
router.delete('/:id', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  await pgExec('UPDATE "Documento" SET "deletedAt"=NOW() WHERE "id"=$1 AND "iglesiaId"=$2', [Number(req.params.id), iglesiaId])
  res.json({ ok: true })
}))

// GET /documentos/:id/descargar — servir archivo
router.get('/:id/descargar', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const doc = await pgOne('SELECT * FROM "Documento" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL', [Number(req.params.id), iglesiaId])
  if (!doc || !doc.archivo) return res.status(404).json({ error: 'Archivo no encontrado' })
  const fullPath = path.join(__dirname, '../../../../', doc.archivo)
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Archivo no existe en disco' })
  res.download(fullPath, doc.nombre + path.extname(doc.archivo))
}))

export default router
