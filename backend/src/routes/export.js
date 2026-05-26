/**
 * EXPORT — Excel y PDF con formato exacto de la planilla Culto 8:45
 * N° | APELLIDO (✓ si asistió) | NOMBRE | Contacto | | | LIDER | ÁREA | COMENTARIO
 */
import { Router } from 'express'
import db         from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import * as XLSX from 'xlsx'

const router = Router()

function cleanTel(v) { return String(v || '').replace(/\.0$/, '').trim() }
function getConfig() {
  const c = {}
  try { db.all('SELECT clave,valor FROM configuracion').forEach(r => { c[r.clave] = r.valor }) } catch {}
  return c
}

// ── Formato exacto de la planilla ─────────────────────────────────────────────
function buildPlanilla(personas, cfg, cultoNombre = '', fecha = '', asistenciaMap = null) {
  const nombreIglesia = cfg.nombre_iglesia || 'CULTO'
  const fechaStr      = fecha || new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' })

  const rows = [
    [cultoNombre || nombreIglesia, '', '', '', `Fecha: ${fechaStr}`, '', '', '', ''],
    ['AVISO: SIEMPRE QUE LLEGUE ALGUIEN QUE NO ESTÉ EN LA LISTA, PEDIR NOMBRE, APELLIDO Y TELÉFONO.', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['N°', 'APELLIDO', 'NOMBRE', 'Contacto', 'P', '', 'LIDER', 'ÁREA', 'COMENTARIO'],
  ]

  personas.forEach((p, i) => {
    const presente = asistenciaMap ? (asistenciaMap[p.id] ? 1 : 0) : null
    const apellido = presente === 1 ? `✓${p.apellido || ''}` : (p.apellido || '')
    rows.push([
      i + 1,
      apellido,
      p.nombre || '',
      cleanTel(p.telefono),
      presente === 1 ? 'True' : presente === 0 ? 'False' : '',
      '',
      p.liderNombre || '',
      p.grupoNombre || p.area || '',
      p.notas || '',
    ])
  })
  return rows
}

const COLS = [
  { wch: 4 },   // N°
  { wch: 22 },  // APELLIDO
  { wch: 16 },  // NOMBRE
  { wch: 14 },  // Contacto
  { wch: 5 },   // P (presente)
  { wch: 3 },   // vacía
  { wch: 22 },  // LIDER
  { wch: 10 },  // ÁREA
  { wch: 28 },  // COMENTARIO
]

// ── GET /export/personas ───────────────────────────────────────────────────────
router.get('/personas', requireAuth, (req, res) => {
  const { estado, grupoId, cultoDia } = req.query
  const where = []; const params = []
  if (estado)   { where.push('p.estado=?');   params.push(estado) }
  if (grupoId)  { where.push('p.grupoId=?');  params.push(grupoId) }
  if (cultoDia) { where.push('p.cultoDia=?'); params.push(cultoDia) }
  const wStr = where.length ? 'WHERE ' + where.join(' AND ') : ''

  const cfg      = getConfig()
  const personas = db.all(
    `SELECT p.*, g.nombre as grupoNombre, u.nombre as liderNombre
     FROM personas p
     LEFT JOIN grupos g ON p.grupoId=g.id
     LEFT JOIN users u ON p.asignadoA=u.id
     ${wStr} ORDER BY p.apellido, p.nombre`, params
  )

  const wb  = XLSX.utils.book_new()
  const ws  = XLSX.utils.aoa_to_sheet(buildPlanilla(personas, cfg))
  ws['!cols'] = COLS
  XLSX.utils.book_append_sheet(wb, ws, 'MEMBRESÍA')

  // Hoja resumen
  const stats = db.all('SELECT estado, COUNT(*) as total FROM personas GROUP BY estado')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['RESUMEN', ''], ['Generado:', new Date().toLocaleString('es-AR')],
    ['Total:', personas.length], [''],
    ['Estado', 'Cantidad'], ...stats.map(s => [s.estado, Number(s.total)])
  ]), 'Resumen')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="membresia-${Date.now()}.xlsx"`)
  res.send(buf)
})

// ── GET /export/asistencia/:cultoId ───────────────────────────────────────────
router.get('/asistencia/:cultoId', requireAuth, (req, res) => {
  const culto = db.get('SELECT * FROM cultos WHERE id=?', [req.params.cultoId])
  if (!culto) return res.status(404).json({ error: 'Culto no encontrado' })

  const cfg      = getConfig()
  const personas = db.all(
    `SELECT p.*, g.nombre as grupoNombre, u.nombre as liderNombre
     FROM personas p
     LEFT JOIN grupos g ON p.grupoId=g.id
     LEFT JOIN users u ON p.asignadoA=u.id
     ORDER BY p.apellido, p.nombre`
  )

  // Mapa de asistencia
  const asistMap = {}
  db.all('SELECT personaId, presente FROM asistencias WHERE cultoId=?', [culto.id])
    .forEach(a => { asistMap[a.personaId] = a.presente })

  const presentes = Object.values(asistMap).filter(Boolean).length
  const pct       = personas.length > 0 ? Math.round(presentes / personas.length * 100) : 0

  const wb = XLSX.utils.book_new()
  const data = buildPlanilla(personas, cfg, culto.nombre, culto.fecha, asistMap)
  // Agregar stat de asistencia en la fila 1
  data[0][6] = `Presentes: ${presentes}/${personas.length} (${pct}%)`
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = COLS
  XLSX.utils.book_append_sheet(wb, ws, culto.nombre.slice(0, 31))

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="asistencia-${culto.fecha}.xlsx"`)
  res.send(buf)
})

// ── GET /export/pdf/:tipo ─────────────────────────────────────────────────────
// HTML imprimible con mismo estilo que la planilla
router.get('/pdf/:tipo', requireAuth, (req, res) => {
  const { tipo }   = req.params
  const { cultoId, estado } = req.query
  const cfg        = getConfig()
  const iglesia    = cfg.nombre_iglesia || 'CULTO'
  const color      = cfg.color_primario || '#2563EB'
  const fechaHoy   = new Date().toLocaleDateString('es-AR')

  let titulo = '', personas = [], asistMap = null

  if (tipo === 'membresia') {
    titulo   = 'Membresía'
    const where = estado ? 'WHERE p.estado=?' : ''
    personas = db.all(
      `SELECT p.*, g.nombre as grupoNombre, u.nombre as liderNombre
       FROM personas p LEFT JOIN grupos g ON p.grupoId=g.id LEFT JOIN users u ON p.asignadoA=u.id
       ${where} ORDER BY p.apellido, p.nombre`, estado ? [estado] : []
    )
  } else if (tipo === 'asistencia' && cultoId) {
    const culto = db.get('SELECT * FROM cultos WHERE id=?', [cultoId])
    if (!culto) return res.status(404).send('Culto no encontrado')
    titulo   = culto.nombre
    personas = db.all(
      `SELECT p.*, g.nombre as grupoNombre, u.nombre as liderNombre
       FROM personas p LEFT JOIN grupos g ON p.grupoId=g.id LEFT JOIN users u ON p.asignadoA=u.id
       ORDER BY p.apellido, p.nombre`
    )
    asistMap = {}
    db.all('SELECT personaId, presente FROM asistencias WHERE cultoId=?', [cultoId])
      .forEach(a => { asistMap[a.personaId] = a.presente })
  }

  const presentes = asistMap ? Object.values(asistMap).filter(Boolean).length : 0
  const pct       = personas.length > 0 ? Math.round(presentes / personas.length * 100) : 0

  const filas = personas.map((p, i) => {
    const presente = asistMap ? (asistMap[p.id] ? 1 : 0) : null
    const apellido = presente === 1
      ? `<strong style="color:#16A34A">✓${p.apellido || ''}</strong>`
      : (p.apellido || '')
    return `<tr>
      <td class="num">${i + 1}</td>
      <td>${apellido}</td>
      <td>${p.nombre || ''}</td>
      <td class="tel">${cleanTel(p.telefono)}</td>
      <td class="area">${p.grupoNombre || ''}</td>
      <td>${p.liderNombre || ''}</td>
      <td class="comment">${p.notas || ''}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${iglesia} — ${titulo}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#1E293B}
  .header{padding:10px 16px 8px;border-bottom:2px solid ${color};display:flex;justify-content:space-between;align-items:flex-end}
  .header h1{font-size:16px;font-weight:800;color:${color}}
  .header h2{font-size:12px;font-weight:600;color:#374151;margin-top:2px}
  .header-r{text-align:right;font-size:11px;color:#64748B}
  .stats{display:flex;gap:16px;padding:6px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0}
  .stat{display:flex;align-items:center;gap:6px}
  .sv{font-size:18px;font-weight:800;color:${color}}
  .sl{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
  table{width:100%;border-collapse:collapse}
  th{padding:5px 8px;background:#F1F5F9;border-bottom:1px solid #CBD5E1;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748B;text-align:left}
  td{padding:4px 8px;border-bottom:1px solid #F1F5F9;vertical-align:middle}
  tr:nth-child(even) td{background:#FAFAFA}
  .num{width:28px;color:#94A3B8;font-size:10px}
  .tel{color:#475569;font-size:10px}
  .area{font-weight:700;color:${color};width:60px}
  .comment{color:#94A3B8;font-style:italic;font-size:10px}
  .footer{padding:6px 16px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;font-size:9px;color:#94A3B8;margin-top:4px}
  .print-btn{position:fixed;top:12px;right:12px;padding:8px 16px;background:${color};color:white;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  @media print{.print-btn{display:none}td,th{padding:3px 6px}@page{margin:8mm;size:A4}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Imprimir / PDF</button>
<div class="header">
  <div><h1>${iglesia}</h1><h2>${titulo}</h2></div>
  <div class="header-r">${fechaHoy}<br>${personas.length} miembros${tipo==='asistencia'?`<br><strong>${presentes} presentes (${pct}%)</strong>`:''}
  </div>
</div>
${tipo==='asistencia'?`<div class="stats">
  <div class="stat"><span class="sv" style="color:#16A34A">${presentes}</span><span class="sl">Presentes</span></div>
  <div class="stat"><span class="sv" style="color:#DC2626">${personas.length-presentes}</span><span class="sl">Ausentes</span></div>
  <div class="stat"><span class="sv">${pct}%</span><span class="sl">Asistencia</span></div>
</div>`:''}
<table>
  <thead><tr><th>N°</th><th>Apellido</th><th>Nombre</th><th>Contacto</th><th>Área</th><th>Líder</th><th>Comentario</th></tr></thead>
  <tbody>${filas}</tbody>
</table>
<div class="footer"><span>Church System 2.4</span><span>Generado: ${new Date().toLocaleString('es-AR')}</span></div>
<script>if(new URLSearchParams(location.search).get('print')==='1')window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

// ── GET /export/seguimientos ──────────────────────────────────────────────────
router.get('/seguimientos', requireAuth, (_req, res) => {
  const rows = db.all(
    `SELECT p.apellido, p.nombre, s.tipo, s.nota, s.proximoContacto, s.createdAt, u.nombre as autor
     FROM seguimientos s
     JOIN personas p ON s.personaId = p.id
     LEFT JOIN users u ON s.userId = u.id
     ORDER BY s.createdAt DESC`
  )
  const wb  = XLSX.utils.book_new()
  const ws  = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{wch:16},{wch:14},{wch:12},{wch:50},{wch:14},{wch:18},{wch:20}]
  XLSX.utils.book_append_sheet(wb, ws, 'Seguimientos')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="seguimientos.xlsx"')
  res.send(buf)
})

// ── GET /export/excel/personas ─────────────────────────────────────────────────
router.get('/excel/personas', requireAuth, (_req, res) => {
  const cfg     = getConfig()
  const nombre  = cfg.nombre_iglesia || 'Iglesia'
  const personas = db.all(
    `SELECT p.*, g.nombre as grupoNombre, u.nombre as liderNombre
     FROM personas p
     LEFT JOIN grupos g ON p.grupoId = g.id
     LEFT JOIN users u ON p.asignadoA = u.id
     ORDER BY p.apellido, p.nombre`
  )
  const wb    = XLSX.utils.book_new()
  const sheetData = [
    [nombre, '', '', '', `Fecha: ${new Date().toLocaleDateString('es-AR')}`, '', '', '', ''],
    ['AVISO: SIEMPRE QUE LLEGUE ALGUIEN QUE NO ESTÉ EN LA LISTA, PEDIR NOMBRE, APELLIDO Y TELÉFONO.', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['N°', 'APELLIDO', 'NOMBRE', 'Contacto', 'P', '', 'LIDER', 'ÁREA', 'COMENTARIO'],
    ...personas.map((p, i) => [
      i + 1, p.apellido || '', p.nombre || '', cleanTel(p.telefono),
      '', '', p.liderNombre || '', p.grupoNombre || '', p.notas || ''
    ])
  ]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = [{wch:4},{wch:22},{wch:16},{wch:14},{wch:5},{wch:3},{wch:22},{wch:10},{wch:28}]
  XLSX.utils.book_append_sheet(wb, ws, 'MEMBRESÍA')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="membresia-${new Date().toISOString().slice(0,10)}.xlsx"`)
  res.send(buf)
})

export default router

// ── GET /export/reporte/semanal  y  /export/reporte/mensual?mes=YYYY-MM ──────
router.get('/reporte/:tipo', requireAuth, (req, res) => {
  const { tipo }  = req.params
  const { mes }   = req.query
  const cfg       = getConfig()
  const iglesia   = cfg.nombre_iglesia || 'Church System'
  const color     = cfg.color_primario || '#2563EB'
  const fechaHoy  = new Date().toLocaleDateString('es-AR')

  let desde, hasta, titulo

  if (tipo === 'semanal') {
    const hoy   = new Date()
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - hoy.getDay() + 1)
    const dom   = new Date(lunes); dom.setDate(lunes.getDate() + 6)
    desde  = lunes.toISOString().slice(0, 10)
    hasta  = dom.toISOString().slice(0, 10)
    titulo = `Reporte semanal — ${desde} al ${hasta}`
  } else {
    const m  = mes || new Date().toISOString().slice(0, 7)
    const [y, mo] = m.split('-').map(Number)
    desde  = `${m}-01`
    hasta  = new Date(y, mo, 0).toISOString().slice(0, 10)
    titulo = `Reporte mensual — ${m}`
  }

  const nuevasPersonas = db.all(
    `SELECT nombre, apellido, estado, telefono, createdAt FROM personas WHERE DATE(createdAt) BETWEEN ? AND ? ORDER BY createdAt DESC`,
    [desde, hasta]
  )

  const cultos = db.all(
    `SELECT c.nombre, c.fecha,
       COUNT(CASE WHEN a.presente=1 THEN 1 END) as presentes,
       COUNT(a.id) as total
     FROM cultos c LEFT JOIN asistencias a ON a.cultoId=c.id
     WHERE c.fecha BETWEEN ? AND ?
     GROUP BY c.id ORDER BY c.fecha`, [desde, hasta]
  )

  const seguimientos = db.all(
    `SELECT tipo, COUNT(*) as qty FROM seguimientos WHERE DATE(createdAt) BETWEEN ? AND ? GROUP BY tipo`,
    [desde, hasta]
  )

  const finanzas = db.all(
    `SELECT tipo, SUM(monto) as total, COUNT(*) as qty FROM finanzas WHERE fecha BETWEEN ? AND ? GROUP BY tipo`,
    [desde, hasta]
  )

  const totalOfrendas = finanzas.reduce((a, b) => a + Number(b.total || 0), 0)
  const totalPersonas = Number(db.get('SELECT COUNT(*) as c FROM personas')?.c ?? 0)

  const totalPresentes = cultos.reduce((a, c) => a + Number(c.presentes), 0)
  const totalCultoAsist= cultos.reduce((a, c) => a + Number(c.total), 0)
  const pctAsist       = totalCultoAsist > 0 ? Math.round(totalPresentes / totalCultoAsist * 100) : 0

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${titulo}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#0F172A;background:#F8FAFC}
.wrap{max-width:860px;margin:0 auto;padding:24px}
.header{background:${color};color:white;padding:20px 28px;border-radius:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
.header h1{font-size:22px;font-weight:800;margin-bottom:4px}
.header h2{font-size:14px;opacity:.75}
.header-r{text-align:right;font-size:12px;opacity:.8}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.card{background:white;border-radius:10px;padding:16px;border:1px solid #E2E8F0}
.card .v{font-size:28px;font-weight:800;color:${color};line-height:1}
.card .l{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#64748B;margin-top:4px}
.sect{background:white;border-radius:10px;padding:18px 20px;margin-bottom:16px;border:1px solid #E2E8F0}
.sect h3{font-size:14px;font-weight:700;margin-bottom:14px;color:${color}}
table{width:100%;border-collapse:collapse;font-size:12px}
th{padding:7px 10px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#64748B}
td{padding:7px 10px;border-bottom:1px solid #F8FAFC;color:#334155}
.bar{height:5px;background:#E2E8F0;border-radius:3px;overflow:hidden;margin-top:5px}
.fill{height:100%;border-radius:3px;background:${color}}
.empty{text-align:center;color:#94A3B8;padding:20px;font-size:12px}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.badge-ACTIVO{background:#DCFCE7;color:#15803D}
.badge-VISITANTE{background:#FEF3C7;color:#92400E}
.badge-NUEVO{background:#DBEAFE;color:#1D4ED8}
.badge-INACTIVO{background:#FEE2E2;color:#DC2626}
.footer{text-align:center;font-size:10px;color:#94A3B8;margin-top:20px;padding-top:16px;border-top:1px solid #E2E8F0}
.print-btn{position:fixed;top:16px;right:16px;padding:8px 18px;background:${color};color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
@media print{.print-btn{display:none}body{background:white}.wrap{padding:12px}@page{margin:10mm;size:A4}}
</style></head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
<div class="wrap">
  <div class="header">
    <div><h1>⛪ ${iglesia}</h1><h2>${titulo}</h2></div>
    <div class="header-r">Generado: ${fechaHoy}<br>${totalPersonas} miembros en total</div>
  </div>

  <div class="cards">
    <div class="card"><div class="v">${nuevasPersonas.length}</div><div class="l">Nuevas personas</div></div>
    <div class="card"><div class="v">${cultos.length}</div><div class="l">Cultos realizados</div></div>
    <div class="card"><div class="v" style="color:${pctAsist>=70?'#16A34A':pctAsist>=45?'#D97706':'#DC2626'}">${pctAsist}%</div><div class="l">Asistencia prom.</div></div>
    <div class="card"><div class="v">${totalOfrendas > 0 ? '$'+totalOfrendas.toLocaleString('es-AR') : '—'}</div><div class="l">Ofrendas</div></div>
  </div>

  ${nuevasPersonas.length > 0 ? `
  <div class="sect">
    <h3>👥 Nuevas personas (${nuevasPersonas.length})</h3>
    <table>
      <thead><tr><th>Nombre</th><th>Estado</th><th>Teléfono</th><th>Fecha ingreso</th></tr></thead>
      <tbody>${nuevasPersonas.map(p => `
        <tr>
          <td><strong>${p.apellido || ''} ${p.nombre || ''}</strong></td>
          <td><span class="badge badge-${p.estado}">${p.estado}</span></td>
          <td>${p.telefono || '—'}</td>
          <td>${new Date(p.createdAt).toLocaleDateString('es-AR')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : '<div class="sect"><h3>👥 Nuevas personas</h3><p class="empty">Sin nuevas personas en este período</p></div>'}

  ${cultos.length > 0 ? `
  <div class="sect">
    <h3>📅 Asistencia por culto</h3>
    <table>
      <thead><tr><th>Culto</th><th>Fecha</th><th>Presentes</th><th>Total</th><th>%</th></tr></thead>
      <tbody>${cultos.map(c => {
        const p = c.total > 0 ? Math.round(c.presentes / c.total * 100) : 0
        const col = p>=70?'#16A34A':p>=45?'#D97706':'#DC2626'
        return `<tr>
          <td><strong>${c.nombre}</strong></td>
          <td>${c.fecha}</td>
          <td style="color:${col};font-weight:700">${c.presentes}</td>
          <td>${c.total}</td>
          <td><div style="min-width:60px">${p}%<div class="bar"><div class="fill" style="width:${p}%;background:${col}"></div></div></div></td>
        </tr>`}).join('')}
      </tbody>
    </table>
  </div>` : '<div class="sect"><h3>📅 Cultos</h3><p class="empty">Sin cultos en este período</p></div>'}

  ${seguimientos.length > 0 ? `
  <div class="sect">
    <h3>📋 Seguimientos realizados</h3>
    <table>
      <thead><tr><th>Tipo</th><th>Cantidad</th></tr></thead>
      <tbody>${seguimientos.map(s => `<tr><td>${s.tipo}</td><td><strong>${s.qty}</strong></td></tr>`).join('')}</tbody>
    </table>
  </div>` : ''}

  ${finanzas.length > 0 ? `
  <div class="sect">
    <h3>💰 Finanzas del período</h3>
    <table>
      <thead><tr><th>Tipo</th><th>Cantidad</th><th>Total</th></tr></thead>
      <tbody>
        ${finanzas.map(f => `<tr><td>${f.tipo}</td><td>${f.qty}</td><td><strong>$${Number(f.total||0).toLocaleString('es-AR')}</strong></td></tr>`).join('')}
        <tr style="border-top:2px solid #E2E8F0"><td colspan="2"><strong>TOTAL</strong></td><td><strong style="color:${color}">$${totalOfrendas.toLocaleString('es-AR')}</strong></td></tr>
      </tbody>
    </table>
  </div>` : ''}

  <div class="footer">Church System Beta 2.4.1 — Generado el ${new Date().toLocaleString('es-AR')}</div>
</div>
<script>if(new URLSearchParams(location.search).get('print')==='1')window.onload=()=>setTimeout(()=>window.print(),500)</script>
</body></html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})
