import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import { resolveWhatsAppConnection, sendWhatsAppText } from '../services/whatsapp.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

async function getCfg(iglesiaId) {
  const rows = await pgMany(
    'SELECT "clave","valor" FROM "Configuracion" WHERE "iglesiaId"=$1 OR "iglesiaId" IS NULL ORDER BY "iglesiaId" NULLS FIRST',
    [iglesiaId]
  )
  const cfg = {}
  for (const r of rows) cfg[r.clave] = r.valor
  cfg.__iglesiaId = iglesiaId
  return cfg
}

async function enviarWhatsApp(cfg, destino, texto) {
  const metaConnection = await resolveWhatsAppConnection(cfg.__iglesiaId || null).catch(() => null)
  if (metaConnection?.phoneNumberId && metaConnection?.accessToken) {
    await sendWhatsAppText({ iglesiaId: cfg.__iglesiaId, to: destino, text: texto })
    return { provider: 'meta_cloud' }
  }
  const SID = cfg.twilio_sid || process.env.TWILIO_ACCOUNT_SID
  const TOK = cfg.twilio_token || process.env.TWILIO_AUTH_TOKEN
  const FROM = cfg.twilio_from || process.env.TWILIO_WHATSAPP_FROM
  if (!SID || !TOK || !FROM) throw new Error('Twilio no configurado')
  const auth = Buffer.from(`${SID}:${TOK}`).toString('base64')
  const body = new URLSearchParams({
    From: `whatsapp:${FROM}`,
    To: `whatsapp:+${String(destino || '').replace(/\D/g, '')}`,
    Body: texto,
  })
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || `Twilio error ${response.status}`)
  return true
}

async function enviarEmail(cfg, destinatario, asunto, html, texto) {
  const key = cfg.resend_key || process.env.RESEND_API_KEY
  const from = cfg.email_from || process.env.EMAIL_FROM || 'no-reply@churchsystem.com.ar'
  const iglesia = cfg.nombre_iglesia || 'Church System'

  if (!key) return { demo: true }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${iglesia} <${from}>`,
      to: [destinatario],
      subject: asunto,
      html: html || `<p>${texto}</p>`,
      text: texto,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || `Email error ${response.status}`)
  return { id: data.id }
}

function buildEmailHTML(cfg, nombre, mensaje) {
  const iglesia = cfg.nombre_iglesia || 'Church System'
  const color = cfg.color_primario || '#2563EB'
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
    <div style="background:${color};padding:24px 32px">
      <h1 style="color:white;margin:0;font-size:20px;font-weight:700">Church System</h1>
    </div>
    <div style="padding:32px">
      <p style="font-size:16px;color:#334155;margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
      <div style="font-size:15px;color:#475569;line-height:1.7;white-space:pre-wrap">${mensaje}</div>
    </div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="font-size:12px;color:#94a3b8;margin:0">${iglesia} - Enviado con Church System</p>
    </div>
  </div>
</body></html>`
}

router.get('/', requireAuth, wrap(async (req, res) => {
  const { page = 1, limit = 30, tipo, personaId } = req.query
  const pageNumber = Math.max(1, Number(page) || 1)
  const pageSize = Math.max(1, Math.min(100, Number(limit) || 30))
  const offset = (pageNumber - 1) * pageSize

  const filters = ['m."iglesiaId"=$1']
  const params = [req.user.iglesiaId]
  if (tipo) {
    params.push(String(tipo))
    filters.push(`m."tipo"=$${params.length}`)
  }
  if (personaId) {
    params.push(Number(personaId))
    filters.push(`m."personaId"=$${params.length}`)
  }
  const where = `WHERE ${filters.join(' AND ')}`

  const totalRow = await pgOne(`SELECT COUNT(*)::int as c FROM "Mensaje" m ${where}`, params)
  const total = Number(totalRow?.c || 0)

  params.push(pageSize)
  params.push(offset)
  const data = await pgMany(
    `SELECT
       m.*,
       u."nombre" as "autorNombre",
       p."nombre" as "personaNombre",
       p."apellido" as "personaApellido"
     FROM "Mensaje" m
     LEFT JOIN "User" u ON u."id" = m."userId"
     LEFT JOIN "Persona" p ON p."id" = m."personaId"
     ${where}
     ORDER BY m."id" DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return res.json({ data, total, page: pageNumber, pages: Math.ceil(total / pageSize) })
}))

router.post('/enviar', requireAuth, wrap(async (req, res) => {
  const { personaId, tipo = 'WHATSAPP', mensaje, asunto = 'Mensaje pastoral' } = req.body || {}
  if (!personaId || !mensaje) return res.status(400).json({ error: 'personaId y mensaje requeridos' })

  const persona = await pgOne(
    'SELECT * FROM "Persona" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(personaId), req.user.iglesiaId]
  )
  if (!persona) return res.status(404).json({ error: 'Persona no encontrada' })

  const destino = tipo === 'WHATSAPP' ? persona.telefono : persona.email
  if (!destino) return res.status(400).json({ error: `La persona no tiene ${String(tipo).toLowerCase()} registrado` })

  const cfg = await getCfg(req.user.iglesiaId)
  let enviado = false
  let error = null
  let demo = false

  try {
    if (tipo === 'WHATSAPP') {
      const texto = String(mensaje).replace('{nombre}', persona.nombre || '').replace('{apellido}', persona.apellido || '')
      await enviarWhatsApp(cfg, destino, texto)
      enviado = true
    } else if (tipo === 'EMAIL') {
      const texto = String(mensaje).replace('{nombre}', persona.nombre || '').replace('{apellido}', persona.apellido || '')
      const html = buildEmailHTML(cfg, persona.nombre || 'Miembro', texto)
      const result = await enviarEmail(cfg, destino, asunto, html, texto)
      enviado = true
      demo = !!result.demo
    }
  } catch (e) {
    error = e.message
    enviado = false
  }

  const created = await pgOne(
    `INSERT INTO "Mensaje"
      ("iglesiaId","personaId","userId","tipo","destino","mensaje","enviado","error","createdAt")
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)
     RETURNING "id"`,
    [req.user.iglesiaId, Number(personaId), req.user.id, String(tipo), String(destino), String(mensaje), !!enviado, error || null]
  )

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'MENSAJE',
    entidad: 'PERSONA',
    entidadId: Number(personaId),
    detalle: `${tipo} -> ${persona.nombre || ''} ${persona.apellido || ''}`.trim(),
    iglesiaId: req.user.iglesiaId,
  })

  if (!enviado && !demo) {
    return res.status(502).json({ ok: false, enviado, demo, error: error || 'No se pudo enviar', id: created?.id || null, destino })
  }
  return res.json({ ok: true, enviado, demo, error, id: created?.id || null, destino })
}))

router.post('/masivo', requireAuth, wrap(async (req, res) => {
  const { grupoId, tipo = 'WHATSAPP', mensaje, estado, asunto = 'Mensaje de la iglesia' } = req.body || {}
  if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' })

  const cfg = await getCfg(req.user.iglesiaId)
  const filters = ['"iglesiaId"=$1', '"deletedAt" IS NULL']
  const params = [req.user.iglesiaId]
  if (grupoId) {
    params.push(Number(grupoId))
    filters.push(`"grupoId"=$${params.length}`)
  } else if (estado) {
    params.push(String(estado))
    filters.push(`"estado"=$${params.length}`)
  }

  const personas = await pgMany(
    `SELECT "id","nombre","apellido","telefono","email"
     FROM "Persona"
     WHERE ${filters.join(' AND ')}`,
    params
  )

  let enviados = 0
  let errores = 0
  const detalles = []

  for (const p of personas) {
    const destino = tipo === 'WHATSAPP' ? p.telefono : p.email
    if (!destino) {
      errores++
      continue
    }

    const texto = String(mensaje)
      .replace(/{nombre}/g, p.nombre || '')
      .replace(/{apellido}/g, p.apellido || '')

    let enviado = false
    let error = null
    try {
      if (tipo === 'WHATSAPP') {
        await enviarWhatsApp(cfg, destino, texto)
        enviado = true
      } else if (tipo === 'EMAIL') {
        const html = buildEmailHTML(cfg, p.nombre || 'Miembro', texto)
        await enviarEmail(cfg, destino, asunto, html, texto)
        enviado = true
      }
    } catch (e) {
      error = e.message
      errores++
    }

    await pgExec(
      `INSERT INTO "Mensaje"
        ("iglesiaId","personaId","userId","tipo","destino","mensaje","enviado","error","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)`,
      [req.user.iglesiaId, p.id, req.user.id, String(tipo), String(destino), texto, !!enviado, error || null]
    )
    if (enviado) enviados++
    detalles.push({ nombre: `${p.nombre || ''} ${p.apellido || ''}`.trim(), enviado, error })
  }

  registrar({
    userId: req.user.id,
    email: req.user.email,
    rol: req.user.rol,
    accion: 'MASIVO',
    entidad: 'GRUPO',
    entidadId: grupoId || '',
    detalle: `${tipo} · ${enviados}/${personas.length} enviados`,
    iglesiaId: req.user.iglesiaId,
  })

  return res.json({ ok: true, enviados, errores, total: personas.length, detalles: detalles.slice(0, 10) })
}))

router.get('/plantillas', requireAuth, wrap(async (req, res) => {
  const rows = await pgMany(
    'SELECT * FROM "PlantillaMensaje" WHERE "iglesiaId"=$1 ORDER BY "tipo","nombre"',
    [req.user.iglesiaId]
  )
  return res.json(rows)
}))

router.post('/plantillas', requireAuth, wrap(async (req, res) => {
  const { nombre, tipo = 'WHATSAPP', contenido } = req.body || {}
  if (!nombre || !contenido) return res.status(400).json({ error: 'nombre y contenido requeridos' })
  const row = await pgOne(
    `INSERT INTO "PlantillaMensaje"
      ("iglesiaId","nombre","tipo","contenido","userId","createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     RETURNING "id","nombre","tipo","contenido"`,
    [req.user.iglesiaId, String(nombre), String(tipo), String(contenido), req.user.id]
  )
  return res.status(201).json({ ok: true, ...row })
}))

router.put('/plantillas/:id', requireAuth, wrap(async (req, res) => {
  const { nombre, contenido } = req.body || {}
  await pgExec(
    'UPDATE "PlantillaMensaje" SET "nombre"=$1,"contenido"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$3 AND "iglesiaId"=$4',
    [String(nombre || ''), String(contenido || ''), Number(req.params.id), req.user.iglesiaId]
  )
  return res.json({ ok: true })
}))

router.delete('/plantillas/:id', requireAuth, wrap(async (req, res) => {
  await pgExec(
    'DELETE FROM "PlantillaMensaje" WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), req.user.iglesiaId]
  )
  return res.json({ ok: true })
}))

// ── Segmentación avanzada (#16) ──────────────────────────────
// POST /mensajes/segmentar — previsualizar destinatarios con filtros combinados
router.post('/segmentar', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const {
    estados = [],          // ['ACTIVO','VISITANTE','INACTIVO']
    grupos = [],           // [grupoId, ...]
    etapas = [],           // estadoEspiritual
    genero,                // 'M' | 'F' | null
    bautizadoAgua,         // true | false | null
    bautizadoEspiritu,
    discipuladoCompletado,
    inactivoDesde,         // número de semanas sin asistir (null = sin filtro)
    soloConTelefono,       // boolean
    soloConEmail,
  } = req.body || {}

  const filters = [`p."iglesiaId"=$1`, `p."deletedAt" IS NULL`]
  const params  = [iglesiaId]
  let idx = 2

  if (estados.length)  { filters.push(`p."estado" = ANY($${idx++}::text[])`);  params.push(estados) }
  if (grupos.length)   { filters.push(`p."grupoId" = ANY($${idx++}::int[])`);  params.push(grupos.map(Number)) }
  if (etapas.length)   { filters.push(`p."estadoEspiritual" = ANY($${idx++}::text[])`); params.push(etapas) }
  if (genero)          { filters.push(`p."genero"=$${idx++}`);                 params.push(genero) }
  if (bautizadoAgua       != null) { filters.push(`p."bautizadoAgua"=$${idx++}`);      params.push(!!bautizadoAgua) }
  if (bautizadoEspiritu   != null) { filters.push(`p."bautizadoEspiritu"=$${idx++}`);  params.push(!!bautizadoEspiritu) }
  if (discipuladoCompletado != null) { filters.push(`p."discipuladoCompletado"=$${idx++}`); params.push(!!discipuladoCompletado) }
  if (soloConTelefono)   { filters.push(`NULLIF(p."telefono",'') IS NOT NULL`) }
  if (soloConEmail)      { filters.push(`NULLIF(p."email",'') IS NOT NULL`) }

  // Inactividad: personas que no tienen registros de asistencia en los últimos N semanas
  if (inactivoDesde && Number(inactivoDesde) > 0) {
    const semanas = Number(inactivoDesde)
    filters.push(`p."id" NOT IN (
      SELECT DISTINCT a."personaId"
      FROM "Asistencia" a
      WHERE a."iglesiaId"=$${idx++} AND a."createdAt" >= NOW() - INTERVAL '${semanas} weeks'
    )`)
    params.push(iglesiaId)
  }

  const personas = await pgMany(
    `SELECT p."id", p."nombre", p."apellido", p."telefono", p."email",
            p."estado", p."estadoEspiritual", p."grupoId",
            g."nombre" AS "grupoNombre"
     FROM "Persona" p
     LEFT JOIN "Grupo" g ON p."grupoId"=g."id"
     WHERE ${filters.join(' AND ')}
     ORDER BY p."nombre" ASC
     LIMIT 500`,
    params
  )

  res.json({
    total: personas.length,
    conTelefono: personas.filter(p => p.telefono).length,
    conEmail: personas.filter(p => p.email).length,
    muestra: personas.slice(0, 20),  // primeras 20 para preview
    ids: personas.map(p => p.id),
  })
}))

// POST /mensajes/masivo-segmentado — envío con segmentación avanzada
router.post('/masivo-segmentado', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  const {
    ids = [],       // lista de personaIds ya calculada desde /segmentar
    tipo = 'WHATSAPP',
    mensaje,
    asunto = 'Mensaje de la iglesia',
  } = req.body || {}

  if (!mensaje)      return res.status(400).json({ error: 'mensaje requerido' })
  if (!ids.length)   return res.status(400).json({ error: 'No hay destinatarios seleccionados' })

  const cfg = await getCfg(iglesiaId)
  const personas = await pgMany(
    `SELECT "id","nombre","apellido","telefono","email"
     FROM "Persona" WHERE "iglesiaId"=$1 AND "id" = ANY($2::int[]) AND "deletedAt" IS NULL`,
    [iglesiaId, ids.map(Number)]
  )

  let enviados = 0, errores = 0
  const detalles = []

  for (const p of personas) {
    const destino = tipo === 'WHATSAPP' ? p.telefono : p.email
    if (!destino) { errores++; continue }

    const texto = String(mensaje)
      .replace(/{nombre}/g, p.nombre || '')
      .replace(/{apellido}/g, p.apellido || '')

    let enviado = false, error = null
    try {
      if (tipo === 'WHATSAPP') { await enviarWhatsApp(cfg, destino, texto); enviado = true }
      else if (tipo === 'EMAIL') {
        const html = buildEmailHTML(cfg, p.nombre || 'Miembro', texto)
        await enviarEmail(cfg, destino, asunto, html, texto)
        enviado = true
      }
    } catch (e) { error = e.message; errores++ }

    await pgExec(
      `INSERT INTO "Mensaje"("iglesiaId","personaId","userId","tipo","destino","mensaje","enviado","error","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)`,
      [iglesiaId, p.id, req.user.id, String(tipo), String(destino), texto, !!enviado, error || null]
    )
    if (enviado) enviados++
    detalles.push({ nombre: `${p.nombre||''} ${p.apellido||''}`.trim(), enviado, error })
  }

  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'MASIVO_SEGMENTADO', entidad: 'MENSAJE', entidadId: '', detalle: `${tipo} · ${enviados}/${personas.length}`, iglesiaId })
  return res.json({ ok: true, enviados, errores, total: personas.length, detalles: detalles.slice(0, 15) })
}))

export default router

