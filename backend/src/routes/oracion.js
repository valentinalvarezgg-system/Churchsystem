import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
const router = Router()
router.get('/', requireAuth, (req, res) => {
  const { estado,page=1,limit=20 } = req.query
  const where=estado?['o.estado=?']:[]; const params=estado?[estado]:[]
  const wStr=where.length?'WHERE '+where.join(' AND '):''
  const offset=(Number(page)-1)*Number(limit)
  const total=Number(db.get(`SELECT COUNT(*) as c FROM oracion o ${wStr}`,params)?.c??0)
  const data=db.all(`SELECT o.*,u.nombre as autorNombre,(SELECT COUNT(*) FROM oracion_apoyo a WHERE a.oracionId=o.id) as apoyos FROM oracion o LEFT JOIN users u ON o.userId=u.id ${wStr} ORDER BY o.id DESC LIMIT ? OFFSET ?`,[...params,Number(limit),offset])
  res.json({ data,total,pages:Math.ceil(total/Number(limit)) })
})
router.post('/', requireAuth, (req, res) => {
  const { titulo,descripcion='',privado=0 } = req.body||{}
  if (!titulo?.trim()) return res.status(400).json({ error:'Título requerido' })
  const { lastID }=db.run('INSERT INTO oracion (titulo,descripcion,privado,userId,estado) VALUES (?,?,?,?,?)',[titulo.trim(),descripcion,privado?1:0,req.user.id,'ACTIVA'])
  res.status(201).json({ ok:true,id:lastID })
})
router.put('/:id/estado', requireAuth, (req, res) => {
  const { estado } = req.body||{}
  const ESTADOS=['ACTIVA','RESPONDIDA','EN_ESPERA','ARCHIVADA']
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error:'Estado inválido' })
  const o=db.get('SELECT * FROM oracion WHERE id=?',[req.params.id])
  if (!o) return res.status(404).json({ error:'No encontrada' })
  if (Number(o.userId)!==Number(req.user.id)&&req.user.rol!=='PASTOR_GENERAL') return res.status(403).json({ error:'Sin permisos' })
  db.run("UPDATE oracion SET estado=?,updatedAt=datetime('now') WHERE id=?",[estado,req.params.id])
  res.json({ ok:true })
})
router.post('/:id/apoyo', requireAuth, (req, res) => {
  const ex=db.get('SELECT id FROM oracion_apoyo WHERE oracionId=? AND userId=?',[req.params.id,req.user.id])
  if (ex) { db.run('DELETE FROM oracion_apoyo WHERE oracionId=? AND userId=?',[req.params.id,req.user.id]); return res.json({ ok:true,accion:'quitado' }) }
  db.run('INSERT INTO oracion_apoyo (oracionId,userId) VALUES (?,?)',[req.params.id,req.user.id])
  res.json({ ok:true,accion:'agregado' })
})
router.delete('/:id', requireAuth, (req, res) => {
  const o=db.get('SELECT * FROM oracion WHERE id=?',[req.params.id])
  if (!o) return res.status(404).json({ error:'No encontrada' })
  if (Number(o.userId)!==Number(req.user.id)&&req.user.rol!=='PASTOR_GENERAL') return res.status(403).json({ error:'Sin permisos' })
  db.run('DELETE FROM oracion_apoyo WHERE oracionId=?',[req.params.id])
  db.run('DELETE FROM oracion WHERE id=?',[req.params.id])
  res.json({ ok:true })
})
export default router
