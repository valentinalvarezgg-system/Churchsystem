import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'

const router = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCfg() {
  const rows = db.all('SELECT clave, valor FROM configuracion')
  const c = {}
  rows.forEach(r => { c[r.clave] = r.valor })
  return c
}

async function enviarWhatsApp(cfg, destino, texto) {
  const SID = cfg.twilio_sid || process.env.TWILIO_ACCOUNT_SID
  const TOK = cfg.twilio_token || process.env.TWILIO_AUTH_TOKEN
  const FROM = cfg.twilio_from || process.env.TWILIO_WHATSAPP_FROM
  if (!SID || !TOK || !FROM) throw new Error('Twilio no configurado')
  const auth = Buffer.from(`${SID}:${TOK}`).toString('base64')
  const body = new URLSearchParams({
    From: `whatsapp:${FROM}`,
    To: `whatsapp:+${destino.replace(/\D/g, '')}`,
    Body: texto
  })
  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  )
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || `Twilio error ${r.status}`)
  return true
}

async function enviarEmail(cfg, destinatario, asunto, html, texto) {
  const KEY  = cfg.resend_key || process.env.RESEND_API_KEY
  const FROM = cfg.email_from || process.env.EMAIL_FROM || 'no-reply@churchsystem.com.ar'
  const iglesia = cfg.nombre_iglesia || 'Church System'

  if (!KEY) {
    // Modo demo: guardar como enviado para testear el flujo
    return { demo: true }
  }

  // Usar Resend API (HTTP puro, sin librerías)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${iglesia} <${FROM}>`,
      to: [destinatario],
      subject: asunto,
      html: html || `<p>${texto}</p>`,
      text: texto
    })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.message || `Email error ${r.status}`)
  return { id: d.id }
}

function buildEmailHTML(cfg, nombre, mensaje) {
  const iglesia = cfg.nombre_iglesia || 'Church System'
  const color   = cfg.color_primario || '#2563EB'
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
    <div style="background:${color};padding:24px 32px">
      <h1 style="color:white;margin:0;font-size:20px;font-weight:700">⛪ ${iglesia}</h1>
    </div>
    <div style="padding:32px">
      <p style="font-size:16px;color:#334155;margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
      <div style="font-size:15px;color:#475569;line-height:1.7;white-space:pre-wrap">${mensaje}</div>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="font-size:12px;color:#94a3b8;margin:0">${iglesia} — Enviado con Church System</p>
    </div>
  </div>
</body></html>`
}

// ── GET /mensajes ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const { page = 1, limit = 30, tipo, personaId } = req.query
  const offset = (Number(page) - 1) * Number(limit)
  const where = []; const params = []
  if (tipo)     { where.push('m.tipo=?');      params.push(tipo) }
  if (personaId){ where.push('m.personaId=?'); params.push(personaId) }
  const wStr = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const total = Number(db.get(`SELECT COUNT(*) as c FROM mensajes m ${wStr}`, params)?.c ?? 0)
  const data  = db.all(
    `SELECT m.*, u.nombre as autorNombre, p.nombre as personaNombre, p.apellido as personaApellido
     FROM mensajes m
     LEFT JOIN users u ON m.userId = u.id
     LEFT JOIN personas p ON m.personaId = p.id
     ${wStr} ORDER BY m.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  )
  res.json({ data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
})

// ── POST /mensajes/enviar ─────────────────────────────────────────────────────
router.post('/enviar', requireAuth, async (req, res) => {
  const { personaId, tipo = 'WHATSAPP', mensaje, asunto = 'Mensaje pastoral' } = req.body || {}
  if (!personaId || !mensaje) return res.status(400).json({ error: 'personaId y mensaje requeridos' })

  const persona = db.get('SELECT * FROM personas WHERE id=?', [personaId])
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' })

  const destino = tipo === 'WHATSAPP' ? persona.telefono : persona.email
  if (!destino) return res.status(400).json({ error: `La persona no tiene ${tipo.toLowerCase()} registrado` })

  const cfg = getCfg()
  let enviado = false; let error = null; let demo = false

  try {
    if (tipo === 'WHATSAPP') {
      const texto = mensaje.replace('{nombre}', persona.nombre).replace('{apellido}', persona.apellido)
      await enviarWhatsApp(cfg, destino, texto)
      enviado = true
    } else if (tipo === 'EMAIL') {
      const texto = mensaje.replace('{nombre}', persona.nombre).replace('{apellido}', persona.apellido)
      const html  = buildEmailHTML(cfg, persona.nombre, texto)
      const result = await enviarEmail(cfg, destino, asunto, html, texto)
      enviado = true
      demo = !!result.demo
    }
  } catch (e) {
    error = e.message; enviado = false
  }

  const { lastID } = db.run(
    'INSERT INTO mensajes (personaId,userId,tipo,destino,mensaje,enviado,error) VALUES (?,?,?,?,?,?,?)',
    [personaId, req.user.id, tipo, destino, mensaje, enviado ? 1 : 0, error || null]
  )

  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol,
    accion: 'MENSAJE', entidad: 'PERSONA', entidadId: personaId,
    detalle: `${tipo} → ${persona.nombre} ${persona.apellido}` })

  res.json({ ok: true, enviado, demo, error, id: lastID, destino })
})

// ── POST /mensajes/masivo ─────────────────────────────────────────────────────
router.post('/masivo', requireAuth, async (req, res) => {
  const { grupoId, tipo = 'WHATSAPP', mensaje, estado, asunto = 'Mensaje de la iglesia' } = req.body || {}
  if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' })

  const cfg = getCfg()

  // Obtener destinatarios
  let personas
  if (grupoId) {
    personas = db.all('SELECT * FROM personas WHERE grupoId=?', [grupoId])
  } else if (estado) {
    personas = db.all('SELECT * FROM personas WHERE estado=?', [estado])
  } else {
    personas = db.all('SELECT * FROM personas')
  }

  let enviados = 0; let errores = 0; const detalles = []

  for (const p of personas) {
    const destino = tipo === 'WHATSAPP' ? p.telefono : p.email
    if (!destino) { errores++; continue }

    const texto = mensaje
      .replace(/{nombre}/g,   p.nombre   || '')
      .replace(/{apellido}/g, p.apellido || '')
      .replace(/{grupo}/g,    p.grupoNombre || '')

    let enviado = false; let error = null

    try {
      if (tipo === 'WHATSAPP') {
        await enviarWhatsApp(cfg, destino, texto)
        enviado = true
      } else if (tipo === 'EMAIL') {
        const html   = buildEmailHTML(cfg, p.nombre, texto)
        const result = await enviarEmail(cfg, destino, asunto, html, texto)
        enviado = true
      }
    } catch (e) {
      error = e.message; errores++
    }

    db.run(
      'INSERT INTO mensajes (personaId,userId,tipo,destino,mensaje,enviado,error) VALUES (?,?,?,?,?,?,?)',
      [p.id, req.user.id, tipo, destino, texto, enviado ? 1 : 0, error || null]
    )
    if (enviado) enviados++
    detalles.push({ nombre: `${p.nombre} ${p.apellido}`, enviado, error })
  }

  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol,
    accion: 'MASIVO', entidad: 'GRUPO', entidadId: grupoId || '',
    detalle: `${tipo} · ${enviados}/${personas.length} enviados` })

  res.json({ ok: true, enviados, errores, total: personas.length, detalles: detalles.slice(0, 10) })
})

// ── Plantillas ────────────────────────────────────────────────────────────────
router.get('/plantillas', requireAuth, (_req, res) => {
  res.json(db.all('SELECT * FROM plantillas_mensaje ORDER BY tipo, nombre'))
})

router.post('/plantillas', requireAuth, (req, res) => {
  const { nombre, tipo = 'WHATSAPP', contenido } = req.body || {}
  if (!nombre || !contenido) return res.status(400).json({ error: 'nombre y contenido requeridos' })
  const { lastID } = db.run(
    'INSERT INTO plantillas_mensaje (nombre,tipo,contenido,userId) VALUES (?,?,?,?)',
    [nombre, tipo, contenido, req.user.id]
  )
  res.status(201).json({ ok: true, id: lastID, nombre, tipo, contenido })
})

router.put('/plantillas/:id', requireAuth, (req, res) => {
  const { nombre, contenido } = req.body || {}
  db.run('UPDATE plantillas_mensaje SET nombre=?,contenido=? WHERE id=?', [nombre, contenido, req.params.id])
  res.json({ ok: true })
})

router.delete('/plantillas/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM plantillas_mensaje WHERE id=?', [req.params.id])
  res.json({ ok: true })
})

export default router
