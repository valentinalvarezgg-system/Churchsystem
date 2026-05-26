import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
const router = Router()
const FULL = ['PASTOR_GENERAL','CONSOLIDACION']
router.get('/', requireAuth, (req, res) => {
  const { rol,id,cultoDia,cultoTurno } = req.user
  const { page=1,limit=20,search='',estado,grupoId } = req.query
  const where=[]; const params=[]
  if (rol==='LIDER'||rol==='STAFF') { where.push('p.asignadoA=?'); params.push(id) }
  else if (rol==='PASTOR_CULTO') { where.push('p.cultoDia=? AND p.cultoTurno=?'); params.push(cultoDia,cultoTurno) }
  if (search) { where.push('(p.nombre LIKE ? OR p.apellido LIKE ? OR p.email LIKE ? OR p.telefono LIKE ?)'); const s=`%${search}%`; params.push(s,s,s,s) }
  if (estado) { where.push('p.estado=?'); params.push(estado) }
  if (grupoId) { where.push('p.grupoId=?'); params.push(Number(grupoId)) }
  const wStr = where.length ? 'WHERE '+where.join(' AND ') : ''
  const offset = (Number(page)-1)*Number(limit)
  const total = Number(db.get(`SELECT COUNT(*) as c FROM personas p ${wStr}`,params)?.c??0)
  const data = db.all(`SELECT p.*,u.nombre as liderNombre,g.nombre as grupoNombre FROM personas p LEFT JOIN users u ON p.asignadoA=u.id LEFT JOIN grupos g ON p.grupoId=g.id ${wStr} ORDER BY p.id DESC LIMIT ? OFFSET ?`,[...params,Number(limit),offset])
  res.json({ data, total, page:Number(page), pages:Math.ceil(total/Number(limit)) })
})
router.get('/:id', requireAuth, (req, res) => {
  const p = db.get('SELECT * FROM personas WHERE id=?',[req.params.id])
  if (!p) return res.status(404).json({ error:'No encontrada' })
  res.json(p)
})
router.post('/', requireAuth, (req, res) => {
  const { nombre,apellido='',email='',telefono='',cultoDia='',cultoTurno=0,grupoId=null,asignadoA=null,estado='ACTIVO',notas='',fechaIngreso=null,fechaNacimiento=null,estadoEspiritual='NUEVO_CREYENTE',ocupacion='' } = req.body||{}
  if (!nombre?.trim()) return res.status(400).json({ error:'Nombre requerido' })
  const { lastID } = db.run(`INSERT INTO personas (nombre,apellido,email,telefono,cultoDia,cultoTurno,grupoId,asignadoA,estado,notas,fechaIngreso,fechaNacimiento,estadoEspiritual,ocupacion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[nombre.trim(),apellido,email,telefono,cultoDia,Number(cultoTurno),grupoId||null,asignadoA||req.user.id,estado,notas,fechaIngreso||new Date().toISOString().slice(0,10),fechaNacimiento||null,estadoEspiritual,ocupacion])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'CREAR',entidad:'PERSONA',entidadId:lastID,detalle:nombre })
  res.status(201).json({ ok:true, id:lastID })
})
router.put('/:id', requireAuth, (req, res) => {
  const p = db.get('SELECT * FROM personas WHERE id=?',[req.params.id])
  if (!p) return res.status(404).json({ error:'No encontrada' })
  if (!FULL.includes(req.user.rol) && Number(p.asignadoA)!==Number(req.user.id)) return res.status(403).json({ error:'Sin permisos' })
  const m = {...p,...req.body}
  db.run(`UPDATE personas SET nombre=?,apellido=?,email=?,telefono=?,cultoDia=?,cultoTurno=?,grupoId=?,asignadoA=?,estado=?,notas=?,fechaIngreso=?,fechaNacimiento=?,estadoEspiritual=?,bautizadoAgua=?,bautizadoEspiritu=?,discipuladoCompletado=?,ocupacion=?,updatedAt=datetime('now') WHERE id=?`,[m.nombre,m.apellido,m.email,m.telefono,m.cultoDia,Number(m.cultoTurno)||0,m.grupoId||null,m.asignadoA||null,m.estado,m.notas,m.fechaIngreso,m.fechaNacimiento||null,m.estadoEspiritual||'NUEVO_CREYENTE',m.bautizadoAgua?1:0,m.bautizadoEspiritu?1:0,m.discipuladoCompletado?1:0,m.ocupacion||'',req.params.id])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'EDITAR',entidad:'PERSONA',entidadId:req.params.id,detalle:m.nombre })
  res.json({ ok:true })
})
router.delete('/:id', requireAuth, (req, res) => {
  if (req.user.rol!=='PASTOR_GENERAL') return res.status(403).json({ error:'Solo Pastor General puede eliminar' })
  const p = db.get('SELECT nombre FROM personas WHERE id=?',[req.params.id])
  if (!p) return res.status(404).json({ error:'No encontrada' })
  db.run('DELETE FROM personas WHERE id=?',[req.params.id])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'ELIMINAR',entidad:'PERSONA',entidadId:req.params.id,detalle:p.nombre })
  res.json({ ok:true })
})
export default router
