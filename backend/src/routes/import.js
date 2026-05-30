import { Router } from 'express'
import { pgExec, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import XLSX from '../lib/xlsx-safe.js'

const router = Router()
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 5000

function decodeBase64Excel(file) {
  const raw = String(file || '').trim()
  if (!raw) throw new Error('Archivo requerido')
  if (raw.length > 7000000) throw new Error('Archivo muy grande (máx 5MB)')
  if (!/^[A-Za-z0-9+/=]+$/.test(raw)) throw new Error('Formato base64 inválido')
  const buf = Buffer.from(raw, 'base64')
  if (!buf.length || buf.length > MAX_IMPORT_FILE_BYTES) throw new Error('Archivo muy grande (máx 5MB)')
  return buf
}

router.post('/preview', requireAuth, (req, res) => {
  const { file } = req.body || {}
  if (!file) return res.status(400).json({ error: 'Archivo requerido (base64)' })
  try {
    const wb = await XLSX.read(decodeBase64Excel(file), { type: 'buffer', dense: true })
    if (!wb?.SheetNames?.length) return res.status(400).json({ error: 'Excel sin hojas' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    if (rows.length > MAX_IMPORT_ROWS) return res.status(413).json({ error: `Demasiadas filas (máx ${MAX_IMPORT_ROWS})` })
    res.json({ total: rows.length, columns: Object.keys(rows[0] || {}), preview: rows.slice(0, 5) })
  } catch (e) { res.status(400).json({ error: 'Error leyendo archivo: ' + e.message }) }
})

router.post('/personas', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { file, mapeo = {} } = req.body || {}
  if (!file) return res.status(400).json({ error: 'Archivo requerido' })

  const m = {
    nombre: mapeo.nombre || 'nombre',
    apellido: mapeo.apellido || 'apellido',
    email: mapeo.email || 'email',
    telefono: mapeo.telefono || 'telefono',
    fechaNacimiento: mapeo.fechaNacimiento || 'fechaNacimiento',
    cultoDia: mapeo.cultoDia || 'cultoDia',
    estado: mapeo.estado || 'estado',
  }

  try {
    const wb = await XLSX.read(decodeBase64Excel(file), { type: 'buffer', dense: true })
    if (!wb?.SheetNames?.length) return res.status(400).json({ error: 'Excel sin hojas' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    if (rows.length > MAX_IMPORT_ROWS) return res.status(413).json({ error: `Demasiadas filas (máx ${MAX_IMPORT_ROWS})` })
    let importados = 0
    const errores = []

    for (const [i, row] of rows.entries()) {
      const nombre = String(row[m.nombre] || '').trim()
      if (!nombre) { errores.push(`Fila ${i + 2}: sin nombre`); continue }
      try {
        await pgExec(
          `INSERT INTO "Persona"
            ("iglesiaId","nombre","apellido","email","telefono","fechaNacimiento","cultoDia","estado","asignadoAUserId","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          [
            iglesiaId,
            nombre,
            String(row[m.apellido] || '').trim(),
            String(row[m.email] || '').trim(),
            String(row[m.telefono] || '').trim(),
            row[m.fechaNacimiento] || null,
            String(row[m.cultoDia] || '').trim(),
            String(row[m.estado] || 'ACTIVO').trim(),
            Number(req.user.id),
          ]
        )
        importados++
      } catch (e) { errores.push(`Fila ${i + 2}: ${e.message}`) }
    }

    registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'IMPORTAR', entidad: 'PERSONA', entidadId: '', detalle: `${importados} importadas`, iglesiaId })
    res.json({ ok: true, importados, errores, total: rows.length })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

export default router
