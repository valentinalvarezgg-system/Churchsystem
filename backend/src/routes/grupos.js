import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
const router = Router()
router.get('/', requireAuth, (_req, res) => {
  res.json(db.all(`SELECT g.*,u.nombre as liderNombre,(SELECT COUNT(*) FROM personas p WHERE p.grupoId=g.id) as totalPersonas FROM grupos g LEFT JOIN users u ON g.liderId=u.id ORDER BY g.id DESC`))
})
router.get('/:id', requireAuth, (req, res) => {
  const g = db.get('SELECT * FROM grupos WHERE id=?',[req.params.id])
  if (!g) return res.status(404).json({ error:'No encontrado' })
  res.json({...g, miembros:db.all('SELECT id,nombre,apellido,telefono,estado FROM personas WHERE grupoId=?',[req.params.id])})
})
router.post('/', requireAuth, (req, res) => {
  const { nombre,cultoDia='',cultoTurno=0,liderId=null,descripcion='' } = req.body||{}
  if (!nombre?.trim()) return res.status(400).json({ error:'Nombre requerido' })
  const { lastID } = db.run('INSERT INTO grupos (nombre,cultoDia,cultoTurno,liderId,descripcion) VALUES (?,?,?,?,?)',[nombre.trim(),cultoDia,Number(cultoTurno),liderId||null,descripcion])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'CREAR',entidad:'GRUPO',entidadId:lastID,detalle:nombre })
  res.status(201).json({ ok:true, id:lastID })
})
router.put('/:id', requireAuth, (req, res) => {
  const g = db.get('SELECT * FROM grupos WHERE id=?',[req.params.id])
  if (!g) return res.status(404).json({ error:'No encontrado' })
  const m = {...g,...req.body}
  db.run('UPDATE grupos SET nombre=?,cultoDia=?,cultoTurno=?,liderId=?,descripcion=? WHERE id=?',[m.nombre,m.cultoDia,Number(m.cultoTurno)||0,m.liderId||null,m.descripcion,req.params.id])
  res.json({ ok:true })
})
router.delete('/:id', requireAuth, (req, res) => {
  if (req.user.rol!=='PASTOR_GENERAL') return res.status(403).json({ error:'No autorizado' })
  db.run('UPDATE personas SET grupoId=NULL WHERE grupoId=?',[req.params.id])
  db.run('DELETE FROM grupos WHERE id=?',[req.params.id])
  res.json({ ok:true })
})
export default router
