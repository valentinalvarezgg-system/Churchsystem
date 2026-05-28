import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
const router = Router()
const PASOS=['bienvenida','datos','primer_llamada','material_entregado','segunda_visita','conectado_grupo','discipulado']
router.get('/', requireAuth, (req, res) => {
  const { estado,page=1,limit=20 } = req.query
  const where=[]; const params=[]
  if (estado) { where.push('c.estado=?'); params.push(estado) }
  if (!['PASTOR_GENERAL','CONSOLIDACION'].includes(req.user.rol)) { where.push('c.consolidadorId=?'); params.push(req.user.id) }
  const wStr=where.length?'WHERE '+where.join(' AND '):''
  const offset=(Number(page)-1)*Number(limit)
  const total=Number(db.get(`SELECT COUNT(*) as c FROM consolidaciones c ${wStr}`,params)?.c??0)
  const data=db.all(`SELECT c.*,p.nombre as personaNombre,p.apellido as personaApellido,p.telefono as personaTel,p.estado as personaEstado,u.nombre as consolidadorNombre FROM consolidaciones c JOIN personas p ON c.personaId=p.id LEFT JOIN users u ON c.consolidadorId=u.id ${wStr} ORDER BY c.id DESC LIMIT ? OFFSET ?`,[...params,Number(limit),offset])
  res.json({ data,total,pages:Math.ceil(total/Number(limit)),pasos:PASOS })
})
router.get('/stats', requireAuth, (_req, res) => {
  res.json({ porEstado:db.all('SELECT estado,COUNT(*) as total FROM consolidaciones GROUP BY estado'), tasa:db.get(`SELECT COUNT(*) as total,SUM(CASE WHEN estado='COMPLETADA' THEN 1 ELSE 0 END) as completadas FROM consolidaciones`) })
})
router.post('/', requireAuth, (req, res) => {
  const { personaId,consolidadorId,notas='' } = req.body||{}
  if (!personaId) return res.status(400).json({ error:'personaId requerido' })
  const existe=db.get("SELECT id FROM consolidaciones WHERE personaId=? AND estado NOT IN ('COMPLETADA','TRANSFERIDA')",[personaId])
  if (existe) return res.status(409).json({ error:'Ya tiene un proceso activo' })
  const pasosInicial=JSON.stringify(PASOS.reduce((a,p)=>({...a,[p]:false}),{}))
  const { lastID }=db.run('INSERT INTO consolidaciones (personaId,consolidadorId,notas,pasos,estado) VALUES (?,?,?,?,?)',[personaId,consolidadorId||req.user.id,notas,pasosInicial,'PRIMER_CONTACTO'])
  db.run("UPDATE personas SET estado='NUEVO' WHERE id=? AND estado='VISITANTE'",[personaId])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'CONSOLIDACION',entidad:'PERSONA',entidadId:personaId })
  res.status(201).json({ ok:true,id:lastID })
})
router.put('/:id', requireAuth, (req, res) => {
  const c=db.get('SELECT * FROM consolidaciones WHERE id=?',[req.params.id])
  if (!c) return res.status(404).json({ error:'No encontrado' })
  const { estado,notas,pasos,consolidadorId } = req.body||{}
  let pasosActuales={}; try { pasosActuales=JSON.parse(c.pasos||'{}') } catch(_) {}
  const pasosNuevos=pasos?{...pasosActuales,...pasos}:pasosActuales
  const completados=Object.values(pasosNuevos).filter(Boolean).length
  const estadoFinal=estado||(completados===PASOS.length?'COMPLETADA':c.estado)
  db.run("UPDATE consolidaciones SET estado=?,notas=?,pasos=?,consolidadorId=?,updatedAt=datetime('now') WHERE id=?",[estadoFinal,notas??c.notas,JSON.stringify(pasosNuevos),consolidadorId||c.consolidadorId,req.params.id])
  if (estadoFinal==='COMPLETADA') db.run("UPDATE personas SET estado='ACTIVO' WHERE id=?",[c.personaId])
  res.json({ ok:true,estado:estadoFinal,pasosCompletados:completados,total:PASOS.length })
})
export default router
