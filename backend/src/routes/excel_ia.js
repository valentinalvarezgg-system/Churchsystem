/**
 * EXCEL IA — Importación/Exportación con compatibilidad total
 */
import { Router } from 'express'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import * as XLSX from 'xlsx'

const router = Router()

const MARCA_RE = /^[✓✔★☑✅\s]+/
const VACIO_RE = /^(·+|\/+|s\/n|s\/a|s\/l|none|null|false|true|undefined)$/i
const cleanTel = v => String(v ?? '').replace(/\.0$/, '').replace(/[^\d+]/g, '').trim()
const cleanStr = v => String(v ?? '').replace(MARCA_RE, '').trim()
const isEmpty = v => !v || VACIO_RE.test(String(v).trim()) || String(v).trim() === ''
const tienesMarca = v => MARCA_RE.test(String(v ?? ''))

function detectarEncabezado(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i].map(v => String(v ?? '').toLowerCase().trim())
    const score =
      (r.some(c => c === 'n°' || c === 'n' || c === '#') ? 2 : 0) +
      (r.some(c => c.includes('apellido') || c === 'miembro') ? 3 : 0) +
      (r.some(c => c === 'nombre') ? 2 : 0) +
      (r.some(c => c.includes('contacto') || c.includes('tel')) ? 2 : 0) +
      (r.some(c => c === 'área' || c === 'area') ? 1 : 0) +
      (r.some(c => c === 'lider' || c === 'líder') ? 1 : 0)
    if (score >= 4) return i
  }
  return 3
}

function detectarFormato(headers) {
  const hl = headers.map(h => String(h).toLowerCase().trim())
  if (hl.some(h => h === 'miembro')) return 'miembro_fusionado'
  const iNombre = hl.findIndex(h => h === 'nombre')
  const iApellido = hl.findIndex(h => h.includes('apellido'))
  if (iNombre >= 0 && iApellido >= 0 && iNombre < iApellido) return 'nombre_primero'
  return 'estandar'
}

function buildMapeo(headers) {
  const mapeo = {}
  headers.forEach(h => {
    const hl = String(h).toLowerCase().trim()
    if (hl === 'n°' || hl === '#' || hl === 'n')                         { mapeo[h] = '__num';     return }
    if (hl === 'miembro')                                                  { mapeo[h] = '__miembro'; return }
    if (hl.includes('apellido'))                                           { mapeo[h] = 'apellido';  return }
    if (hl === 'nombre')                                                   { mapeo[h] = 'nombre';    return }
    if (hl.includes('contacto') || hl === 'tel' || hl.includes('telef')) { mapeo[h] = 'telefono';  return }
    if (hl === 'p' || hl === 'est' || hl === 'presente')                  { mapeo[h] = '__asist';   return }
    if (hl === 'lider' || hl === 'líder')                                  { mapeo[h] = '__lider';   return }
    if (hl === 'área' || hl === 'area')                                    { mapeo[h] = '__area';    return }
    if (hl.includes('comentario') || hl.includes('obs'))                  { mapeo[h] = 'notas';     return }
    mapeo[h] = null
  })
  return mapeo
}

function elegirHoja(wb) {
  const prioridad = [/membresia/i, /membresía/i, /lista.general/i, /lista/i, /asistencia/i]
  for (const rx of prioridad) {
    const found = wb.SheetNames.find(n => rx.test(n))
    if (found) return found
  }
  return wb.SheetNames[0]
}

router.post('/analizar', requireAuth, async (req, res) => {
  const { file } = req.body ?? {}
  if (!file) return res.status(400).json({ error: 'Archivo requerido (base64)' })
  if (file.length > 8_000_000) return res.status(413).json({ error: 'Archivo demasiado grande (máx ~6MB)' })

  try {
    let wb
    try { wb = XLSX.read(Buffer.from(file, 'base64'), { type: 'buffer' }) }
    catch (_) { return res.status(400).json({ error: 'El archivo no es un Excel válido (.xlsx).' }) }

    if (!wb.SheetNames?.length) return res.status(400).json({ error: 'El archivo Excel no tiene hojas de datos.' })

    const sheetName = elegirHoja(wb)
    const ws = wb.Sheets[sheetName]
    if (!ws) return res.status(400).json({ error: 'No se encontró la hoja de datos.' })

    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    const headerIdx = detectarEncabezado(raw)
    const allHeaders = raw[headerIdx].map(h => String(h ?? '').trim())
    const headers = allHeaders.filter(h => h && !VACIO_RE.test(h))
    const formato = detectarFormato(headers)
    const mapeo = buildMapeo(headers)

    const dataRows = raw.slice(headerIdx + 1).filter(row => {
      if (!row.some(v => v !== null && v !== '')) return false
      const vals = row.map(v => cleanStr(v))
      return vals.some(v => v.length > 1 && !VACIO_RE.test(v) && !/^\d+$/.test(v))
    })

    const muestra = dataRows.slice(0, 5).map(row => {
      const obj = {}
      allHeaders.forEach((h, i) => {
        let v = row[i]
        if (isEmpty(v)) { obj[h] = ''; return }
        if (String(h).toLowerCase().includes('contacto') || String(h).toLowerCase() === 'tel') {
          v = cleanTel(v)
        } else { v = cleanStr(v) }
        obj[h] = v
      })
      return obj
    })

    res.json({
      hojas: wb.SheetNames,
      hojaSeleccionada: sheetName,
      columnas: headers,
      muestra,
      total: dataRows.length,
      formato,
      mapeo,
      confianza: 0.95,
      sugerencias: `Formato detectado: ${formato}. Hoja: ${sheetName}.`,
      metodo: 'automatico',
    })
  } catch (e) {
    res.status(400).json({ error: 'Error procesando archivo: ' + e.message })
  }
})

router.post('/importar', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { file, mapeo = {}, opcionDuplicados = 'saltar', hojaSeleccionada, previewOnly = false } = req.body ?? {}
  if (!file) return res.status(400).json({ error: 'Archivo requerido' })

  try {
    let wb
    try { wb = XLSX.read(Buffer.from(file, 'base64'), { type: 'buffer' }) }
    catch (_) { return res.status(400).json({ error: 'El archivo no es un Excel válido.' }) }

    const sheetKey = hojaSeleccionada ?? elegirHoja(wb)
    const ws = wb.Sheets[sheetKey]
    if (!ws) return res.status(400).json({ error: 'Hoja no encontrada: ' + sheetKey })

    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    const headerIdx = detectarEncabezado(raw)
    const allHeaders = raw[headerIdx].map(h => String(h ?? '').trim())
    const dataRows = raw.slice(headerIdx + 1)

    if (previewOnly) {
      const muestra = []
      const erroresPrev = []
      let nuevos = 0, actualizadosPrev = 0, saltadosPrev = 0

      for (const [idx, row] of dataRows.slice(0, 200).entries()) {
        if (!row.some(v => v !== null && v !== '')) { saltadosPrev++; continue }
        const persona = {}
        allHeaders.forEach((h, i) => {
          const campo = mapeo[h]
          if (!campo || ['__num', '__asist', '__lider'].includes(campo)) return
          const raw_v = row[i]
          if (campo === '__miembro') {
            const texto = String(raw_v || '').replace(//g, '').replace(/^[xX\s]+/, '').trim()
            const partes = texto.split(/\s+/)
            if (partes.length >= 2) { persona.apellido = partes[0]; persona.nombre = partes.slice(1).join(' ') }
            else { persona.nombre = texto }
            return
          }
          const val = String(raw_v ?? '').trim()
          if (val) persona[campo] = val
        })
        if (!persona.nombre) { erroresPrev.push(`Fila ${idx + 2}: sin nombre`); continue }
        const existe = await pgOne(
          'SELECT "id" FROM "Persona" WHERE "iglesiaId"=$1 AND "nombre"=$2 AND "apellido"=$3 AND "deletedAt" IS NULL LIMIT 1',
          [iglesiaId, persona.nombre, persona.apellido || '']
        )
        if (existe) { actualizadosPrev++; if (muestra.length < 5) muestra.push({ ...persona, _accion: 'actualizar' }) }
        else { nuevos++; if (muestra.length < 5) muestra.push({ ...persona, _accion: 'nuevo' }) }
      }

      return res.json({
        ok: true, previewOnly: true,
        total: dataRows.length, nuevos, actualizados: actualizadosPrev,
        saltados: saltadosPrev, errores: erroresPrev,
        muestra: muestra.slice(0, 8)
      })
    }

    let importados = 0, actualizados = 0, saltados = 0
    const errores = [], detalles = []

    for (const [idx, row] of dataRows.entries()) {
      if (!row.some(v => v !== null && v !== '')) { saltados++; continue }

      const persona = {}
      allHeaders.forEach((h, i) => {
        const campo = mapeo[h]
        if (!campo) return
        const raw_v = row[i]
        if (['__num', '__asist', '__lider'].includes(campo)) return

        if (campo === '__miembro') {
          const texto = cleanStr(raw_v)
          if (!texto || isEmpty(texto)) return
          const partes = texto.trim().split(/\s+/)
          if (partes.length >= 2) { persona.apellido = partes[0]; persona.nombre = partes.slice(1).join(' ') }
          else { persona.apellido = texto; persona.nombre = texto }
          return
        }
        if (campo === '__area') {
          const v = String(raw_v ?? '').trim()
          if (!isEmpty(v)) persona._area = v
          return
        }

        let val = raw_v
        if (campo === 'apellido' || campo === 'nombre') {
          val = cleanStr(val); if (isEmpty(val)) return
        } else if (campo === 'telefono') {
          val = cleanTel(val); if (!val || val.length < 6) return
        } else if (campo === 'estado') {
          const e = String(val ?? '').toUpperCase()
          val = ['ACTIVO', 'INACTIVO', 'VISITANTE', 'NUEVO'].includes(e) ? e : 'ACTIVO'
        } else if (['bautizadoAgua', 'bautizadoEspiritu'].includes(campo)) {
          val = /^(si|sí|yes|1|x|true)$/i.test(String(val ?? ''))
        } else if (campo === 'fechaNacimiento') {
          if (val instanceof Date) val = val.toISOString().slice(0, 10)
          else { const d = new Date(val); val = !isNaN(d) ? d.toISOString().slice(0, 10) : null }
        } else {
          val = String(val ?? '').trim(); if (isEmpty(val)) return
        }
        if (val !== null && val !== undefined && val !== '') persona[campo] = val
      })

      if (!persona.nombre && !persona.apellido) { saltados++; continue }
      if (!persona.nombre) persona.nombre = persona.apellido
      if (!persona.apellido) persona.apellido = ''
      if (!persona.estado) persona.estado = 'ACTIVO'

      let existe = null
      if (persona.telefono) {
        existe = await pgOne(
          'SELECT "id" FROM "Persona" WHERE "iglesiaId"=$1 AND "telefono"=$2 AND "telefono"!=\'\' AND "deletedAt" IS NULL LIMIT 1',
          [iglesiaId, persona.telefono]
        )
      }
      if (!existe) {
        existe = await pgOne(
          'SELECT "id" FROM "Persona" WHERE "iglesiaId"=$1 AND "nombre"=$2 AND "apellido"=$3 AND "deletedAt" IS NULL LIMIT 1',
          [iglesiaId, persona.nombre, persona.apellido]
        )
      }

      if (existe) {
        if (opcionDuplicados === 'saltar') { saltados++; continue }
        if (opcionDuplicados === 'actualizar') {
          const { _area, nombre, apellido, ...campos } = persona
          const keys = Object.keys(campos)
          if (keys.length) {
            const sets = keys.map((k, i) => `"${k}"=$${i + 1}`).join(',')
            await pgExec(
              `UPDATE "Persona" SET ${sets},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$${keys.length + 1} AND "iglesiaId"=$${keys.length + 2}`,
              [...Object.values(campos), existe.id, iglesiaId]
            )
          }
          actualizados++
          detalles.push({ accion: 'actualizado', nombre: `${persona.nombre} ${persona.apellido}` })
          continue
        }
      }

      try {
        const { _area, ...campos } = persona
        await pgExec(
          `INSERT INTO "Persona"
            ("iglesiaId","nombre","apellido","email","telefono","fechaNacimiento","cultoDia","estado","asignadoAUserId","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          [
            iglesiaId,
            campos.nombre || '',
            campos.apellido || '',
            campos.email || '',
            campos.telefono || '',
            campos.fechaNacimiento || null,
            campos.cultoDia || '',
            campos.estado || 'ACTIVO',
            Number(req.user.id),
          ]
        )
        importados++
        detalles.push({ accion: 'creado', nombre: `${persona.nombre} ${persona.apellido}` })
      } catch (e) {
        errores.push(`Fila ${idx + headerIdx + 2}: ${e.message}`)
      }
    }

    registrar({
      userId: req.user.id, email: req.user.email, rol: req.user.rol,
      accion: 'IMPORTAR_EXCEL', entidad: 'PERSONA', entidadId: '',
      detalle: `${importados} creadas, ${actualizados} actualizadas, ${saltados} saltadas`,
      iglesiaId,
    })

    res.json({ ok: true, importados, actualizados, saltados, errores, total: dataRows.length, detalles: detalles.slice(0, 10) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.post('/exportar', requireAuth, async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const { filtros = {}, nombreArchivo = 'membresia', cultoId = null } = req.body ?? {}

  const where = [`p."iglesiaId"=$1`, `p."deletedAt" IS NULL`]
  const params = [iglesiaId]
  let idx = 2
  if (filtros.estado)   { where.push(`p."estado"=$${idx++}`);   params.push(filtros.estado) }
  if (filtros.cultoDia) { where.push(`p."cultoDia"=$${idx++}`); params.push(filtros.cultoDia) }
  if (filtros.grupoId)  { where.push(`p."grupoId"=$${idx++}`);  params.push(Number(filtros.grupoId)) }

  const [cfgRows, personas, asistRows] = await Promise.all([
    pgMany('SELECT "clave","valor" FROM "Configuracion" WHERE "iglesiaId"=$1 OR "iglesiaId" IS NULL ORDER BY "iglesiaId" NULLS FIRST', [iglesiaId]).catch(() => []),
    pgMany(
      `SELECT p.*, g."nombre" as "grupoNombre", u."nombre" as "liderNombre"
       FROM "Persona" p
       LEFT JOIN "Grupo" g ON p."grupoId"=g."id" AND g."deletedAt" IS NULL
       LEFT JOIN "User" u ON p."asignadoAUserId"=u."id"
       WHERE ${where.join(' AND ')}
       ORDER BY p."apellido", p."nombre"`,
      params
    ),
    cultoId ? pgMany('SELECT "personaId","presente" FROM "Asistencia" WHERE "cultoId"=$1', [Number(cultoId)]) : Promise.resolve([]),
  ])

  const cfg = {}
  for (const r of cfgRows) cfg[r.clave] = r.valor
  const nombreIglesia = cfg.nombre_iglesia || 'CULTO'
  const fechaHoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })

  const asistMap = {}
  asistRows.forEach(a => { asistMap[a.personaId] = a.presente })

  const sheetData = [
    [nombreIglesia, '', '', '', `Fecha: ${fechaHoy}`, '', '', '', ''],
    ['AVISO: SIEMPRE QUE LLEGUE ALGUIEN QUE NO ESTÉ EN LA LISTA, PEDIR NOMBRE, APELLIDO Y TELÉFONO.', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['N°', 'APELLIDO', 'NOMBRE', 'Contacto', 'P', '', 'LIDER', 'ÁREA', 'COMENTARIO'],
  ]

  personas.forEach((p, i) => {
    const presente = cultoId ? (asistMap[p.id] ? 1 : 0) : null
    const apellido = presente === 1 ? `✓${p.apellido || ''}` : (p.apellido || '')
    sheetData.push([
      i + 1, apellido, p.nombre || '', cleanTel(p.telefono),
      presente === 1 ? 'True' : presente === 0 ? 'False' : '',
      '', p.liderNombre || '', p.grupoNombre || '', p.notas || '',
    ])
  })

  const stats = await pgMany(
    `SELECT "estado", COUNT(*)::int as "total" FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL GROUP BY "estado"`,
    [iglesiaId]
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 5 }, { wch: 3 }, { wch: 22 }, { wch: 10 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, ws, cultoId ? 'ASISTENCIA' : 'MEMBRESÍA')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    [nombreIglesia, ''],
    ['Generado:', new Date().toLocaleString('es-AR')],
    ['Total miembros:', personas.length],
    [''],
    ['Estado', 'Cantidad'],
    ...stats.map(s => [s.estado, Number(s.total)]),
  ]), 'Resumen')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.xlsx"`)
  res.send(buf)
})

export default router
