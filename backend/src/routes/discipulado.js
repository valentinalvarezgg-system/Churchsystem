import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
const router = Router()
const ETAPAS=['NUEVO_CREYENTE','CONSOLIDADO','DISCIPULO','LIDER','MINISTRO']
const MATERIALES=['BIBLIA_BASICA','CONSOLIDACION_1','CONSOLIDACION_2','DISCIPULADO_1','DISCIPULADO_2','MINISTERIO']
router.get('/', requireAuth, (req, res) => {
  const { etapa,search,page=1,limit=20 } = req.query
  const where=[]; const params=[]
  if (etapa) { where.push('p.estadoEspiritual=?'); params.push(etapa) }
  if (search) { where.push('(p.nombre LIKE ? OR p.apellido LIKE ?)'); params.push(`%${search}%`,`%${search}%`) }
  const wStr=where.length?'WHERE '+where.join(' AND '):''
  const offset=(Number(page)-1)*Number(limit)
  const total=Number(db.get(`SELECT COUNT(*) as c FROM personas p ${wStr}`,params)?.c??0)
  const data=db.all(`SELECT p.id,p.nombre,p.apellido,p.telefono,p.estado,p.estadoEspiritual,p.bautizadoAgua,p.bautizadoEspiritu,p.discipuladoCompletado,u.nombre as liderNombre,(SELECT COUNT(*) FROM seguimientos s WHERE s.personaId=p.id) as totalSeguimientos,(SELECT COUNT(*) FROM discipulado_prog dp WHERE dp.personaId=p.id AND dp.completado=1) as materialesCompletados FROM personas p LEFT JOIN users u ON p.asignadoA=u.id ${wStr} ORDER BY p.estadoEspiritual,p.nombre LIMIT ? OFFSET ?`,[...params,Number(limit),offset])
  res.json({ data,total,pages:Math.ceil(total/Number(limit)),page:Number(page) })
})
router.get('/stats', requireAuth, (_req, res) => {
  res.json({ porEtapa:db.all('SELECT estadoEspiritual,COUNT(*) as total FROM personas GROUP BY estadoEspiritual'), bautizados:db.all(`SELECT SUM(bautizadoAgua) as agua,SUM(bautizadoEspiritu) as espiritu,SUM(discipuladoCompletado) as discipulado FROM personas WHERE estado='ACTIVO'`)[0]||{}, progreso:db.all('SELECT material,COUNT(*) as completados FROM discipulado_prog WHERE completado=1 GROUP BY material') })
})
router.put('/:id', requireAuth, (req, res) => {
  const { estadoEspiritual,bautizadoAgua,bautizadoEspiritu,discipuladoCompletado } = req.body||{}
  const campos=[]; const vals=[]
  if (estadoEspiritual!==undefined) { campos.push('estadoEspiritual=?'); vals.push(estadoEspiritual) }
  if (bautizadoAgua!==undefined) { campos.push('bautizadoAgua=?'); vals.push(bautizadoAgua?1:0) }
  if (bautizadoEspiritu!==undefined) { campos.push('bautizadoEspiritu=?'); vals.push(bautizadoEspiritu?1:0) }
  if (discipuladoCompletado!==undefined) { campos.push('discipuladoCompletado=?'); vals.push(discipuladoCompletado?1:0) }
  if (!campos.length) return res.status(400).json({ error:'Nada que actualizar' })
  db.run(`UPDATE personas SET ${campos.join(',')} WHERE id=?`,[...vals,req.params.id])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'DISCIPULADO',entidad:'PERSONA',entidadId:req.params.id,detalle:estadoEspiritual||'actualizado' })
  res.json({ ok:true })
})
router.get('/:id/materiales', requireAuth, (req, res) => {
  const rows=db.all('SELECT * FROM discipulado_prog WHERE personaId=?',[req.params.id])
  const mapa={}; for (const r of rows) mapa[r.material]=r
  res.json(MATERIALES.map(m=>({ material:m, completado:mapa[m]?.completado||0, fecha:mapa[m]?.fecha||null })))
})
router.put('/:id/materiales/:material', requireAuth, (req, res) => {
  const { completado } = req.body||{}
  const { id,material } = req.params
  const fecha=completado?new Date().toISOString().slice(0,10):null
  const ex=db.get('SELECT id FROM discipulado_prog WHERE personaId=? AND material=?',[id,material])
  if (ex) db.run('UPDATE discipulado_prog SET completado=?,fecha=? WHERE personaId=? AND material=?',[completado?1:0,fecha,id,material])
  else    db.run('INSERT INTO discipulado_prog (personaId,material,completado,fecha) VALUES (?,?,?,?)',[id,material,completado?1:0,fecha])
  res.json({ ok:true })
})
export default router
