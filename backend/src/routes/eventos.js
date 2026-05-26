import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
const router = Router()
router.get('/', requireAuth, (req, res) => {
  const hoy=new Date().toISOString().slice(0,10)
  const d=req.query.desde||hoy, h=req.query.hasta||new Date(Date.now()+90*86400000).toISOString().slice(0,10)
  res.json(db.all(`SELECT e.*,u.nombre as autorNombre FROM eventos e LEFT JOIN users u ON e.userId=u.id WHERE e.fecha BETWEEN ? AND ? ORDER BY e.fecha ASC,e.hora ASC`,[d,h]))
})
router.get('/proximos', requireAuth, (_req, res) => {
  res.json(db.all('SELECT * FROM eventos WHERE fecha>=? ORDER BY fecha ASC LIMIT 10',[new Date().toISOString().slice(0,10)]))
})
router.post('/', requireAuth, (req, res) => {
  const { titulo,tipo='EVENTO',fecha,hora='',lugar='',descripcion='',todoElDia=0 } = req.body||{}
  if (!titulo?.trim()||!fecha) return res.status(400).json({ error:'titulo y fecha requeridos' })
  const { lastID } = db.run('INSERT INTO eventos (titulo,tipo,fecha,hora,lugar,descripcion,todoElDia,userId) VALUES (?,?,?,?,?,?,?,?)',[titulo.trim(),tipo,fecha,hora,lugar,descripcion,todoElDia?1:0,req.user.id])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'CREAR',entidad:'EVENTO',entidadId:lastID,detalle:titulo })
  res.status(201).json({ ok:true,id:lastID })
})
router.put('/:id', requireAuth, (req, res) => {
  const ev=db.get('SELECT * FROM eventos WHERE id=?',[req.params.id]); if (!ev) return res.status(404).json({ error:'No encontrado' })
  const m={...ev,...req.body}
  db.run('UPDATE eventos SET titulo=?,tipo=?,fecha=?,hora=?,lugar=?,descripcion=?,todoElDia=? WHERE id=?',[m.titulo,m.tipo,m.fecha,m.hora,m.lugar,m.descripcion,m.todoElDia?1:0,req.params.id])
  res.json({ ok:true })
})
router.delete('/:id', requireAuth, (req, res) => { db.run('DELETE FROM eventos WHERE id=?',[req.params.id]); res.json({ ok:true }) })
export default router
