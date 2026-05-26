/**
 * EXCEL IA — Importación/Exportación con compatibilidad total
 *
 * Planillas soportadas:
 *   A) Culto 8:45  — encabezado F4, APELLIDO|NOMBRE, marca ✓
 *   B) Culto 10:30 — encabezado F9, APELLIDO|NOMBRE, marca ★
 *   C) Ejemplo     — encabezado F4, NOMBRE|APELLIDO (invertido), columna EST
 *   D) Asistencia  — encabezado F5, columna "Miembro" (apellido+nombre fusionados)
 *
 * Marcas de asistencia: ✓ ✔ ★ ☑ ✅ al inicio del apellido/miembro
 * ÁREA: códigos M C J AD CG PA SE + texto libre → guardado como está
 * Valores nulos: · ///// S/N S/A S/L → tratados como vacío
 */
import { Router }    from 'express'
import db            from '../lib/db.js'
import { requireAuth }  from '../middlewares/auth.js'
import { registrar }    from '../utils/auditoria.js'
import * as XLSX     from 'xlsx'

const router = Router()

// ── Constantes ────────────────────────────────────────────────────────────────

// Marcas de asistencia (al inicio de apellido/nombre/miembro)
const MARCA_RE = /^[✓✔★☑✅\s]+/

// Valores que significan "vacío"
const VACIO_RE = /^(·+|\/+|s\/n|s\/a|s\/l|none|null|false|true|undefined)$/i

// Limpiar teléfono
const cleanTel = v => String(v ?? '').replace(/\.0$/, '').replace(/[^\d+]/g, '').trim()

// Limpiar texto genérico — quitar marcas y espacios
const cleanStr = v => String(v ?? '').replace(MARCA_RE, '').trim()

// ¿Es valor vacío?
const isEmpty = v => !v || VACIO_RE.test(String(v).trim()) || String(v).trim() === ''

// ¿Tiene marca de asistencia?
const tienesMarca = v => MARCA_RE.test(String(v ?? ''))

// Detectar fila de encabezados (busca N°, APELLIDO/NOMBRE/MIEMBRO, Contacto)
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
  return 3 // fallback fila 4
}

// Detectar variante del formato
function detectarFormato(headers) {
  const hl = headers.map(h => String(h).toLowerCase().trim())
  // "Miembro" = apellido+nombre fusionados (asistencia junio)
  if (hl.some(h => h === 'miembro')) return 'miembro_fusionado'
  // NOMBRE antes que APELLIDO
  const iNombre   = hl.findIndex(h => h === 'nombre')
  const iApellido = hl.findIndex(h => h.includes('apellido'))
  if (iNombre >= 0 && iApellido >= 0 && iNombre < iApellido) return 'nombre_primero'
  // Estándar: APELLIDO | NOMBRE
  return 'estandar'
}

// Construir mapeo de columnas
function buildMapeo(headers, formato) {
  const mapeo = {}
  headers.forEach(h => {
    const hl = String(h).toLowerCase().trim()

    if (hl === 'n°' || hl === '#' || hl === 'n')                        { mapeo[h] = '__num';    return }
    if (hl === 'miembro')                                                { mapeo[h] = '__miembro'; return }
    if (hl.includes('apellido'))                                         { mapeo[h] = 'apellido'; return }
    if (hl === 'nombre')                                                  { mapeo[h] = 'nombre';   return }
    if (hl.includes('contacto') || hl === 'tel' || hl.includes('telef')){ mapeo[h] = 'telefono'; return }
    if (hl === 'p' || hl === 'est' || hl === 'presente')                 { mapeo[h] = '__asist';  return }
    if (hl === 'lider' || hl === 'líder')                                 { mapeo[h] = '__lider';  return }
    if (hl === 'área' || hl === 'area')                                   { mapeo[h] = '__area';   return }
    if (hl.includes('comentario') || hl.includes('obs'))                 { mapeo[h] = 'notas';    return }
    mapeo[h] = null
  })
  return mapeo
}

// Filtrar hoja principal (membresía/lista general)
function elegirHoja(wb) {
  const nombres = wb.SheetNames
  const prioridad = [
    /membresia/i, /membresía/i, /lista.general/i, /lista/i, /asistencia/i,
  ]
  for (const rx of prioridad) {
    const found = nombres.find(n => rx.test(n))
    if (found) return found
  }
  return nombres[0]
}

// ── POST /excel-ia/analizar ───────────────────────────────────────────────────
router.post('/analizar', requireAuth, async (req, res) => {
  const { file } = req.body ?? {}
  if (!file) return res.status(400).json({ error: 'Archivo requerido (base64)' })
  if (file.length > 8_000_000) return res.status(413).json({ error: 'Archivo demasiado grande (máx ~6MB)' })

  try {
    let wb
    try {
      wb = XLSX.read(Buffer.from(file, 'base64'), { type: 'buffer' })
    } catch (_) {
      return res.status(400).json({ error: 'El archivo no es un Excel válido (.xlsx). Asegurate de guardar como Excel 97-2003 o posterior.' })
    }
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel no tiene hojas de datos.' })
    }
    const sheetName = elegirHoja(wb)
    const ws = wb.Sheets[sheetName]
    if (!ws) return res.status(400).json({ error: 'No se encontró la hoja de datos.' })
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const headerIdx = detectarEncabezado(raw)
    // Encabezados: filtrar columnas completamente vacías o con solo puntos
    const allHeaders = raw[headerIdx].map(h => String(h ?? '').trim())
    const headers    = allHeaders.filter(h => h && !VACIO_RE.test(h))

    const formato = detectarFormato(headers)
    const mapeo   = buildMapeo(headers, formato)

    // Filas de datos válidas (tienen al menos apellido o nombre o miembro)
    const dataRows = raw.slice(headerIdx + 1).filter(row => {
      if (!row.some(v => v !== null && v !== '')) return false
      const vals = row.map(v => cleanStr(v))
      return vals.some(v => v.length > 1 && !VACIO_RE.test(v) && !/^\d+$/.test(v))
    })

    // Muestra limpia (5 filas)
    const muestra = dataRows.slice(0, 5).map(row => {
      const obj = {}
      allHeaders.forEach((h, i) => {
        let v = row[i]
        if (isEmpty(v)) { obj[h] = ''; return }
        if (String(h).toLowerCase().includes('contacto') || String(h).toLowerCase() === 'tel') {
          v = cleanTel(v)
        } else {
          v = cleanStr(v)
        }
        obj[h] = v
      })
      return obj
    })

    // IA para formatos desconocidos (opcional)
    let metodo     = 'automatico'
    let confianza  = 0.95
    let sugerencias = `Formato detectado: ${formato}. Hoja: ${sheetName}.`

    res.json({
      hojas:            wb.SheetNames,
      hojaSeleccionada: sheetName,
      columnas:         headers,
      muestra,
      total:            dataRows.length,
      formato,
      mapeo,
      confianza,
      sugerencias,
      metodo,
    })
  } catch (e) {
    res.status(400).json({ error: 'Error procesando archivo: ' + e.message })
  }
})

// ── POST /excel-ia/importar ───────────────────────────────────────────────────
router.post('/importar', requireAuth, (req, res) => {
  const { file, mapeo = {}, opcionDuplicados = 'saltar', hojaSeleccionada, previewOnly = false } = req.body ?? {}
  if (!file) return res.status(400).json({ error: 'Archivo requerido' })

  try {
    let wb
    try {
      wb = XLSX.read(Buffer.from(file, 'base64'), { type: 'buffer' })
    } catch (_) {
      return res.status(400).json({ error: 'El archivo no es un Excel válido.' })
    }
    const sheetKey = hojaSeleccionada ?? elegirHoja(wb)
    const ws = wb.Sheets[sheetKey]
    if (!ws) return res.status(400).json({ error: 'Hoja no encontrada: ' + sheetKey })
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    const headerIdx = detectarEncabezado(raw)
    const allHeaders = raw[headerIdx].map(h => String(h ?? '').trim())
    const dataRows  = raw.slice(headerIdx + 1)

    // ── Preview mode: devolver resumen sin escribir a la DB ───────
    if (previewOnly) {
      const muestra = []
      const erroresPrev = []
      let nuevos = 0, actualizadosPrev = 0, saltadosPrev = 0

      for (const [idx, row] of dataRows.slice(0, 200).entries()) {
        if (!row.some(v => v !== null && v !== '')) { saltadosPrev++; continue }
        const persona = {}
        allHeaders.forEach((h, i) => {
          const campo = mapeo[h]
          if (!campo || ['__num','__asist','__lider'].includes(campo)) return
          const raw_v = row[i]
          if (campo === '__miembro') {
            const texto = String(raw_v||'').replace(/\u0001/g,'').replace(/^[xX\s]+/,'').trim()
            const partes = texto.split(/\s+/)
            if (partes.length >= 2) { persona.apellido = partes[0]; persona.nombre = partes.slice(1).join(' ') }
            else { persona.nombre = texto }
            return
          }
          const val = String(raw_v ?? '').trim()
          if (val) persona[campo] = val
        })
        if (!persona.nombre) { erroresPrev.push(`Fila ${idx+2}: sin nombre`); continue }
        // Verificar si ya existe
        const existe = db.get('SELECT id FROM personas WHERE nombre=? AND apellido=?', [persona.nombre, persona.apellido||''])
        if (existe) { actualizadosPrev++; if (muestra.length < 5) muestra.push({...persona, _accion:'actualizar'}) }
        else { nuevos++; if (muestra.length < 5) muestra.push({...persona, _accion:'nuevo'}) }
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

        // Columnas especiales: no guardar en persona
        if (['__num', '__asist', '__lider'].includes(campo)) return

        // Columna "Miembro" = apellido+nombre fusionados → separar
        if (campo === '__miembro') {
          const hayMarca = tienesMarca(raw_v)
          const texto    = cleanStr(raw_v)
          if (!texto || isEmpty(texto)) return
          const partes = texto.trim().split(/\s+/)
          if (partes.length >= 2) {
            persona.apellido = partes[0]
            persona.nombre   = partes.slice(1).join(' ')
          } else {
            persona.apellido = texto
            persona.nombre   = texto
          }
          return
        }

        // Columna ÁREA → guardar como está (texto libre o código)
        if (campo === '__area') {
          const v = String(raw_v ?? '').trim()
          if (!isEmpty(v)) persona._area = v
          return
        }

        let val = raw_v

        if (campo === 'apellido') {
          val = cleanStr(val)
          if (isEmpty(val)) return
        } else if (campo === 'nombre') {
          val = cleanStr(val)
          if (isEmpty(val)) return
        } else if (campo === 'telefono') {
          val = cleanTel(val)
          if (!val || val.length < 6) return
        } else if (campo === 'estado') {
          const e = String(val ?? '').toUpperCase()
          val = ['ACTIVO','INACTIVO','VISITANTE','NUEVO'].includes(e) ? e : 'ACTIVO'
        } else if (['bautizadoAgua','bautizadoEspiritu'].includes(campo)) {
          val = /^(si|sí|yes|1|x|true)$/i.test(String(val ?? '')) ? 1 : 0
        } else if (campo === 'fechaNacimiento') {
          if (val instanceof Date) val = val.toISOString().slice(0, 10)
          else { const d = new Date(val); val = !isNaN(d) ? d.toISOString().slice(0, 10) : null }
        } else if (campo === 'notas') {
          val = String(val ?? '').trim()
          if (isEmpty(val)) return
        } else {
          val = String(val ?? '').trim()
          if (isEmpty(val)) return
        }

        if (val !== null && val !== undefined && val !== '') persona[campo] = val
      })

      // Necesita al menos apellido o nombre
      if (!persona.nombre && !persona.apellido) { saltados++; continue }
      if (!persona.nombre)   persona.nombre   = persona.apellido
      if (!persona.apellido) persona.apellido = ''

      // Estado default
      if (!persona.estado) persona.estado = 'ACTIVO'

      // Detectar duplicado: teléfono → nombre+apellido
      let existe = null
      if (persona.telefono)
        existe = db.get('SELECT id FROM personas WHERE telefono=? AND telefono!=""', [persona.telefono])
      if (!existe)
        existe = db.get('SELECT id FROM personas WHERE nombre=? AND apellido=?', [persona.nombre, persona.apellido])

      if (existe) {
        if (opcionDuplicados === 'saltar') { saltados++; continue }
        if (opcionDuplicados === 'actualizar') {
          const { _area, ...campos } = persona
          const keys = Object.keys(campos)
          if (keys.length) {
            db.run(
              `UPDATE personas SET ${keys.map(k=>`${k}=?`).join(',')}, updatedAt=datetime('now') WHERE id=?`,
              [...Object.values(campos), existe.id]
            )
          }
          actualizados++
          detalles.push({ accion: 'actualizado', nombre: `${persona.nombre} ${persona.apellido}` })
          continue
        }
      }

      try {
        const { _area, ...campos } = persona
        const keys = [...Object.keys(campos), 'asignadoA']
        const vals = [...Object.values(campos), req.user.id]
        db.run(
          `INSERT INTO personas (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,
          vals
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
    })

    res.json({ ok: true, importados, actualizados, saltados, errores, total: dataRows.length, detalles: detalles.slice(0, 10) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ── POST /excel-ia/exportar ───────────────────────────────────────────────────
// Exporta con el formato exacto de la planilla del culto
router.post('/exportar', requireAuth, (req, res) => {
  const { filtros = {}, nombreArchivo = 'membresia', cultoId = null } = req.body ?? {}

  const where = []; const params = []
  if (filtros.estado)   { where.push('p.estado=?');   params.push(filtros.estado) }
  if (filtros.cultoDia) { where.push('p.cultoDia=?'); params.push(filtros.cultoDia) }
  if (filtros.grupoId)  { where.push('p.grupoId=?');  params.push(filtros.grupoId) }

  const cfg = {}
  try { db.all('SELECT clave,valor FROM configuracion').forEach(r => { cfg[r.clave] = r.valor }) } catch {}

  const nombreIglesia = cfg.nombre_iglesia || 'CULTO'
  const fechaHoy      = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' })

  const personas = db.all(
    `SELECT p.*, g.nombre as grupoNombre, u.nombre as liderNombre
     FROM personas p
     LEFT JOIN grupos g ON p.grupoId=g.id
     LEFT JOIN users u ON p.asignadoA=u.id
     ${where.length ? 'WHERE '+where.join(' AND ') : ''}
     ORDER BY p.apellido, p.nombre`, params
  )

  // Mapa asistencia si hay culto
  const asistMap = {}
  if (cultoId) {
    db.all('SELECT personaId, presente FROM asistencias WHERE cultoId=?', [cultoId])
      .forEach(a => { asistMap[a.personaId] = a.presente })
  }

  // Construir en formato exacto de la planilla
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
      i + 1,
      apellido,
      p.nombre || '',
      cleanTel(p.telefono),
      presente === 1 ? 'True' : presente === 0 ? 'False' : '',
      '',
      p.liderNombre || '',
      p.grupoNombre || '',
      p.notas || '',
    ])
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = [
    { wch: 4  }, // N°
    { wch: 22 }, // APELLIDO
    { wch: 16 }, // NOMBRE
    { wch: 14 }, // Contacto
    { wch: 5  }, // P
    { wch: 3  }, // vacía
    { wch: 22 }, // LIDER
    { wch: 10 }, // ÁREA
    { wch: 28 }, // COMENTARIO
  ]
  XLSX.utils.book_append_sheet(wb, ws, cultoId ? 'ASISTENCIA' : 'MEMBRESÍA')

  // Hoja resumen
  const stats = db.all('SELECT estado, COUNT(*) as total FROM personas GROUP BY estado')
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
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}-${new Date().toISOString().slice(0,10)}.xlsx"`)
  res.send(buf)
})

export default router
