/**
 * PERFIL COMPLETO — datos, familia, contactos extra, origen, stats
 */
import { Router } from 'express'
import fs   from 'fs'
import path from 'path'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()

// ── GET /perfil/:id — perfil completo ─────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const persona = db.get(`
    SELECT p.*, u.nombre as liderNombre, g.nombre as grupoNombre
    FROM personas p
    LEFT JOIN users u ON p.asignadoA = u.id
    LEFT JOIN grupos g ON p.grupoId = g.id
    WHERE p.id = ?`, [req.params.id])
  if (!persona) return res.status(404).json({ error: 'No encontrada' })

  const seguimientos = db.all(`
    SELECT s.*, u.nombre as autorNombre
    FROM seguimientos s
    LEFT JOIN users u ON s.userId = u.id
    WHERE s.personaId = ? ORDER BY s.id DESC LIMIT 20`, [req.params.id])

  const asistencias = db.all(`
    SELECT c.nombre, c.fecha, c.cultoDia, a.presente
    FROM asistencias a
    JOIN cultos c ON a.cultoId = c.id
    WHERE a.personaId = ? ORDER BY c.fecha DESC LIMIT 12`, [req.params.id])

  const mensajes = db.all(`
    SELECT m.tipo, m.destino, m.mensaje, m.enviado, m.createdAt, u.nombre as autorNombre
    FROM mensajes m
    LEFT JOIN users u ON m.userId = u.id
    WHERE m.personaId = ? ORDER BY m.id DESC LIMIT 10`, [req.params.id])

  // Familiares con sus datos
  const familiares = db.all(`
    SELECT f.id, f.relacion, f.familiarId,
           p.nombre, p.apellido, p.telefono, p.estado, p.fotoUrl
    FROM familiares f
    JOIN personas p ON f.familiarId = p.id
    WHERE f.personaId = ?
    ORDER BY f.relacion, p.apellido`, [req.params.id])

  // También traer familiares donde esta persona ES el familiar (relación inversa)
  const familiaresInversos = db.all(`
    SELECT f.id, f.relacion, f.personaId as familiarId,
           p.nombre, p.apellido, p.telefono, p.estado, p.fotoUrl
    FROM familiares f
    JOIN personas p ON f.personaId = p.id
    WHERE f.familiarId = ?
    ORDER BY f.relacion, p.apellido`, [req.params.id])

  // Contactos extra (WhatsApp alt, Instagram, Telegram, etc.)
  const contactosExtra = db.all(
    `SELECT * FROM contactos_extra WHERE personaId = ? ORDER BY principal DESC, id ASC`,
    [req.params.id])

  // Origen / primera visita
  const origen = db.get(`
    SELECT v.*, p.nombre as traidoPorNombre2, p.apellido as traidoPorApellido
    FROM visita_origen v
    LEFT JOIN personas p ON v.traidoPorId = p.id
    WHERE v.personaId = ?`, [req.params.id])

  const stats = {
    totalSeguimientos: seguimientos.length,
    totalCultos:       asistencias.length,
    presencias:        asistencias.filter(a => a.presente).length,
    ultimoSeguimiento: seguimientos[0]?.createdAt || null,
    proximoContacto:   seguimientos.find(s => s.proximoContacto)?.proximoContacto || null,
    totalFamiliares:   familiares.length + familiaresInversos.length,
  }

  res.json({
    persona,
    seguimientos,
    asistencias,
    mensajes,
    familiares: [...familiares, ...familiaresInversos],
    contactosExtra,
    origen,
    stats,
  })
})

// ── POST /perfil/:id/familiar — agregar familiar ──────────────────────────────
router.post('/:id/familiar', requireAuth, (req, res) => {
  const { familiarId, relacion = 'otro' } = req.body || {}
  if (!familiarId) return res.status(400).json({ error: 'familiarId requerido' })
  if (Number(familiarId) === Number(req.params.id)) return res.status(400).json({ error: 'Una persona no puede ser familiar de sí misma' })

  const RELACIONES = ['conyuge','pareja','hijo','hija','padre','madre','hermano','hermana','abuelo','abuela','nieto','nieta','tio','tia','sobrino','sobrina','primo','prima','suegro','suegra','yerno','nuera','cuñado','cuñada','otro']
  if (!RELACIONES.includes(relacion)) return res.status(400).json({ error: 'Relación inválida' })

  try {
    const { lastID } = db.run(
      'INSERT INTO familiares (personaId, familiarId, relacion) VALUES (?,?,?)',
      [req.params.id, familiarId, relacion]
    )
    registrar({ userId:req.user.id, email:req.user.email, rol:req.user.rol, accion:'FAMILIAR', entidad:'PERSONA', entidadId:req.params.id, detalle:`${relacion} → ${familiarId}` })
    res.status(201).json({ ok: true, id: lastID })
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya es familiar' })
    res.status(500).json({ error: e.message })
  }
})

// ── DELETE /perfil/:id/familiar/:fid ─────────────────────────────────────────
router.delete('/:id/familiar/:fid', requireAuth, (req, res) => {
  db.run('DELETE FROM familiares WHERE id = ?', [req.params.fid])
  res.json({ ok: true })
})

// ── POST /perfil/:id/contacto — agregar contacto extra ────────────────────────
router.post('/:id/contacto', requireAuth, (req, res) => {
  const { tipo, valor, descripcion = '', principal = 0 } = req.body || {}
  if (!tipo?.trim() || !valor?.trim()) return res.status(400).json({ error: 'tipo y valor requeridos' })
  const { lastID } = db.run(
    'INSERT INTO contactos_extra (personaId, tipo, valor, descripcion, principal) VALUES (?,?,?,?,?)',
    [req.params.id, tipo.trim(), valor.trim(), descripcion, principal ? 1 : 0]
  )
  res.status(201).json({ ok: true, id: lastID })
})

// ── DELETE /perfil/:id/contacto/:cid ─────────────────────────────────────────
router.delete('/:id/contacto/:cid', requireAuth, (req, res) => {
  db.run('DELETE FROM contactos_extra WHERE id = ? AND personaId = ?', [req.params.cid, req.params.id])
  res.json({ ok: true })
})

// ── POST /perfil/:id/origen — registrar origen de llegada ────────────────────
router.post('/:id/origen', requireAuth, (req, res) => {
  const { traidoPorId, traidoPorNombre, cultoId, cultoNombre, fecha, notas } = req.body || {}
  // Upsert
  const existe = db.get('SELECT id FROM visita_origen WHERE personaId = ?', [req.params.id])
  if (existe) {
    db.run(
      'UPDATE visita_origen SET traidoPorId=?, traidoPorNombre=?, cultoId=?, cultoNombre=?, fecha=?, notas=? WHERE personaId=?',
      [traidoPorId||null, traidoPorNombre||'', cultoId||null, cultoNombre||'', fecha||'', notas||'', req.params.id]
    )
  } else {
    db.run(
      'INSERT INTO visita_origen (personaId, traidoPorId, traidoPorNombre, cultoId, cultoNombre, fecha, notas) VALUES (?,?,?,?,?,?,?)',
      [req.params.id, traidoPorId||null, traidoPorNombre||'', cultoId||null, cultoNombre||'', fecha||'', notas||'']
    )
  }
  res.json({ ok: true })
})

export default router

// ── POST /perfil/:id/foto  — sube foto como base64 → JPG en disco ─────────────
// ── GET  /perfil/:id/foto  — sirve la foto guardada ──────────────────────────
router.post('/:id/foto', requireAuth, (req, res) => {
  const { id }     = req.params
  const { base64 } = req.body || {}
  if (!base64) return res.status(400).json({ error: 'base64 requerido' })

  const persona = db.get('SELECT id,nombre FROM personas WHERE id=?', [id])
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' })

  try {
    const dir     = path.join(process.cwd(), 'uploads', 'fotos')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const fotoPath = path.join(dir, `${id}.jpg`)
    const data     = base64.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(fotoPath, Buffer.from(data, 'base64'))

    // Guardar fotoUrl relativa en DB
    const fotoUrl = `/fotos/${id}.jpg`
    db.run('UPDATE personas SET fotoUrl=?, updatedAt=datetime("now") WHERE id=?', [fotoUrl, id])

    res.json({ ok: true, fotoUrl })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id/foto', requireAuth, (req, res) => {
  const { id } = req.params
  try {
    const fotoPath = path.join(process.cwd(), 'uploads', 'fotos', `${id}.jpg`)
    if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath)
    db.run('UPDATE personas SET fotoUrl="" WHERE id=?', [id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
