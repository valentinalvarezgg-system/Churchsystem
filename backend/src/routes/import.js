import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import * as XLSX from 'xlsx'
const router = Router()
router.post('/preview', requireAuth, (req, res) => {
  const { file } = req.body||{}
  if (!file) return res.status(400).json({ error:'Archivo requerido (base64)' })
  if (file.length>7000000) return res.status(413).json({ error:'Archivo muy grande (máx 5MB)' })
  try {
    const wb = XLSX.read(Buffer.from(file,'base64'),{type:'buffer'})
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})
    res.json({ total:rows.length, columns:Object.keys(rows[0]||{}), preview:rows.slice(0,5) })
  } catch(e) { res.status(400).json({ error:'Error leyendo archivo: '+e.message }) }
})
router.post('/personas', requireAuth, (req, res) => {
  const { file,mapeo={} } = req.body||{}
  if (!file) return res.status(400).json({ error:'Archivo requerido' })
  const m = { nombre:mapeo.nombre||'nombre', apellido:mapeo.apellido||'apellido', email:mapeo.email||'email', telefono:mapeo.telefono||'telefono', fechaNacimiento:mapeo.fechaNacimiento||'fechaNacimiento', cultoDia:mapeo.cultoDia||'cultoDia', estado:mapeo.estado||'estado' }
  try {
    const wb = XLSX.read(Buffer.from(file,'base64'),{type:'buffer'})
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})
    let importados=0; const errores=[]
    for (const [i,row] of rows.entries()) {
      const nombre = String(row[m.nombre]||'').trim()
      if (!nombre) { errores.push(`Fila ${i+2}: sin nombre`); continue }
      try { db.run(`INSERT INTO personas (nombre,apellido,email,telefono,fechaNacimiento,cultoDia,estado,asignadoA) VALUES (?,?,?,?,?,?,?,?)`,[nombre,String(row[m.apellido]||'').trim(),String(row[m.email]||'').trim(),String(row[m.telefono]||'').trim(),row[m.fechaNacimiento]||null,String(row[m.cultoDia]||'').trim(),String(row[m.estado]||'ACTIVO').trim(),req.user.id]); importados++ }
      catch(e) { errores.push(`Fila ${i+2}: ${e.message}`) }
    }
    registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'IMPORTAR',entidad:'PERSONA',entidadId:'',detalle:`${importados} importadas` })
    res.json({ ok:true, importados, errores, total:rows.length })
  } catch(e) { res.status(400).json({ error:e.message }) }
})
export default router
