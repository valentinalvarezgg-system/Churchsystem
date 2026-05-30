import ExcelJS from 'exceljs'

function normalizeCell(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'object') {
    if (v.text) return String(v.text)
    if (v.result !== undefined && v.result !== null) return v.result
    if (v.richText) return v.richText.map(t => t.text || '').join('')
  }
  return v
}

function aoaFromWorksheet(ws) {
  const out = []
  const maxCols = Math.max(1, ws.columnCount || 1)
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = []
    for (let c = 1; c <= maxCols; c++) row.push(normalizeCell(ws.getCell(r, c).value))
    out.push(row)
  }
  return out
}

function sheetToJson(sheet, opts = {}) {
  const defval = opts.defval
  const aoa = sheet?.__aoa || []
  if (opts.header === 1) return aoa.map(r => r.map(v => (v === null || v === undefined ? defval ?? null : v)))
  const headers = (aoa[0] || []).map(h => String(h ?? '').trim())
  const rows = []
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] || []
    const obj = {}
    let hasAny = false
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j]
      if (!key) continue
      const val = row[j]
      obj[key] = (val === null || val === undefined || val === '') ? (defval ?? '') : val
      if (obj[key] !== '' && obj[key] !== null) hasAny = true
    }
    if (hasAny || headers.length) rows.push(obj)
  }
  return rows
}

const XLSX = {
  async read(buffer) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    const out = { SheetNames: [], Sheets: {} }
    wb.eachSheet((ws) => {
      const name = ws.name
      out.SheetNames.push(name)
      out.Sheets[name] = { __aoa: aoaFromWorksheet(ws), '!cols': null }
    })
    return out
  },
  utils: {
    book_new() { return { __sheets: [] } },
    book_append_sheet(wb, ws, name) { wb.__sheets.push({ name, ws }) },
    aoa_to_sheet(aoa) { return { __aoa: aoa || [], '!cols': null } },
    json_to_sheet(rows) {
      const list = Array.isArray(rows) ? rows : []
      const headers = [...new Set(list.flatMap(r => Object.keys(r || {})))]
      const aoa = [headers, ...list.map(r => headers.map(h => r?.[h] ?? ''))]
      return { __aoa: aoa, '!cols': null }
    },
    sheet_to_json: sheetToJson,
  },
  async write(wb, opts = {}) {
    const out = new ExcelJS.Workbook()
    for (const s of wb.__sheets || []) {
      const ws = out.addWorksheet(String(s.name || 'Sheet1').slice(0, 31) || 'Sheet1')
      const aoa = s.ws?.__aoa || []
      aoa.forEach((row) => ws.addRow(Array.isArray(row) ? row : []))
      const cols = s.ws?.['!cols']
      if (Array.isArray(cols) && cols.length) {
        ws.columns = cols.map(c => ({ width: Number(c?.wch || 12) }))
      }
    }
    if (opts.type === 'buffer') return out.xlsx.writeBuffer()
    throw new Error('Only buffer output is supported')
  },
}

export default XLSX
