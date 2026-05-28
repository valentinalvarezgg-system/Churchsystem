import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import * as XLSX from 'xlsx'
const router = Router()
router.get('/', requireAuth, (req, res) => {
  const { page=1,limit=30,desde,hasta,tipo } = req.query
  const where=[]; const params=[]
  if (desde) { where.push('f.fecha>=?'); params.push(desde) }
  if (hasta) { where.push('f.fecha<=?'); params.push(hasta) }
  if (tipo)  { where.push('f.tipo=?');  params.push(tipo) }
  const wStr = where.length ? 'WHERE '+where.join(' AND ') : ''
  const offset=(Number(page)-1)*Number(limit)
  const totales=db.get(`SELECT COUNT(*) as registros,SUM(monto) as total FROM finanzas f ${wStr}`,params)
  const porTipo=db.all(`SELECT tipo,COUNT(*) as qty,SUM(monto) as subtotal FROM finanzas f ${wStr} GROUP BY tipo`,params)
  const data=db.all(`SELECT f.*,c.nombre as cultoNombre,u.nombre as autorNombre FROM finanzas f LEFT JOIN cultos c ON f.cultoId=c.id LEFT JOIN users u ON f.userId=u.id ${wStr} ORDER BY f.fecha DESC,f.id DESC LIMIT ? OFFSET ?`,[...params,Number(limit),offset])
  const total=Number(totales?.registros??0)
  const tendencia = db.all(
    `SELECT strftime('%Y-%m', fecha) as mes, SUM(monto) as total, COUNT(*) as qty
     FROM finanzas WHERE fecha >= date('now','-8 months')
     GROUP BY mes ORDER BY mes ASC`)
  const cfg = Object.fromEntries(db.all("SELECT clave, valor FROM configuracion WHERE clave IN ('divisa','pais','idioma')").map(r => [r.clave, r.valor]))
  res.json({ data, total, pages: Math.ceil(total/Number(limit)), totales, porTipo, tendencia, currency: cfg.divisa || 'ARS', country: cfg.pais || 'AR', lang: cfg.idioma || 'es' })
})
router.get('/resumen-mensual', requireAuth, (_req, res) => {
  res.json(db.all(`SELECT strftime('%Y-%m',fecha) as mes,tipo,SUM(monto) as total,COUNT(*) as qty FROM finanzas WHERE fecha>=date('now','-6 months') GROUP BY mes,tipo ORDER BY mes ASC`))
})
router.post('/', requireAuth, (req, res) => {
  const { monto,tipo='OFRENDA',fecha,cultoId=null,descripcion='',anonimo=1 } = req.body||{}
  if (!monto||!fecha) return res.status(400).json({ error:'monto y fecha requeridos' })
  const { lastID } = db.run('INSERT INTO finanzas (monto,tipo,fecha,cultoId,descripcion,anonimo,userId) VALUES (?,?,?,?,?,?,?)',[Number(monto),tipo,fecha,cultoId||null,descripcion,anonimo?1:0,req.user.id])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'REGISTRAR',entidad:'FINANZA',entidadId:lastID,detalle:`${tipo} $${monto}` })
  res.status(201).json({ ok:true,id:lastID })
})
router.put('/:id', requireAuth, (req, res) => {
  const f=db.get('SELECT * FROM finanzas WHERE id=?',[req.params.id])
  if (!f) return res.status(404).json({ error:'No encontrado' })
  const m={...f,...req.body}
  db.run('UPDATE finanzas SET monto=?,tipo=?,fecha=?,cultoId=?,descripcion=?,anonimo=? WHERE id=?',[Number(m.monto),m.tipo,m.fecha,m.cultoId||null,m.descripcion,m.anonimo?1:0,req.params.id])
  res.json({ ok:true })
})
router.delete('/:id', requireAuth, requireRol('PASTOR_GENERAL'), (req, res) => { db.run('DELETE FROM finanzas WHERE id=?',[req.params.id]); res.json({ ok:true }) })
router.get('/export', requireAuth, (req, res) => {
  const { desde,hasta } = req.query
  const where=[]; const params=[]
  if (desde) { where.push('fecha>=?'); params.push(desde) }
  if (hasta) { where.push('fecha<=?'); params.push(hasta) }
  const wStr = where.length ? 'WHERE '+where.join(' AND ') : ''
  const rows=db.all(`SELECT f.fecha,f.tipo,f.monto,f.descripcion,c.nombre as culto FROM finanzas f LEFT JOIN cultos c ON f.cultoId=c.id ${wStr} ORDER BY f.fecha DESC`,params)
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Finanzas')
  const buf=XLSX.write(wb,{type:'buffer',bookType:'xlsx'})
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition','attachment; filename="finanzas.xlsx"')
  res.send(buf)
})
export default router
