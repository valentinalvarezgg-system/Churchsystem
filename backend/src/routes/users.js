import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../lib/db.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
const router = Router()
const ADMIN = requireRol('PASTOR_GENERAL')
router.get('/', requireAuth, ADMIN, (_req, res) => {
  res.json(db.all('SELECT id,email,nombre,rol,cultoDia,cultoTurno,grupoId,activo,createdAt FROM users ORDER BY id DESC'))
})
router.post('/', requireAuth, ADMIN, async (req, res) => {
  const { email,password,nombre='',rol='LIDER',cultoDia='',cultoTurno=0 } = req.body||{}
  if (!email||!password) return res.status(400).json({ error:'Email y contraseña requeridos' })
  if (db.get('SELECT id FROM users WHERE email=?',[email.toLowerCase()])) return res.status(409).json({ error:'Email ya registrado' })
  const hash = await bcrypt.hash(password,10)
  const { lastID } = db.run('INSERT INTO users (email,password,nombre,rol,cultoDia,cultoTurno) VALUES (?,?,?,?,?,?)',[email.toLowerCase(),hash,nombre,rol,cultoDia,Number(cultoTurno)])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'CREAR',entidad:'USER',entidadId:lastID,detalle:email })
  res.status(201).json({ ok:true, id:lastID })
})
router.put('/:id', requireAuth, ADMIN, async (req, res) => {
  const u = db.get('SELECT * FROM users WHERE id=?',[req.params.id])
  if (!u) return res.status(404).json({ error:'No encontrado' })
  const { nombre,rol,cultoDia,cultoTurno,activo,password } = req.body||{}
  const hash = password ? await bcrypt.hash(password,10) : u.password
  db.run('UPDATE users SET nombre=?,rol=?,cultoDia=?,cultoTurno=?,activo=?,password=? WHERE id=?',[nombre??u.nombre,rol??u.rol,cultoDia??u.cultoDia,Number(cultoTurno??u.cultoTurno),activo!=null?Number(activo):u.activo,hash,req.params.id])
  res.json({ ok:true })
})
router.delete('/:id', requireAuth, ADMIN, (req, res) => {
  if (Number(req.params.id)===Number(req.user.id)) return res.status(400).json({ error:'No podés eliminarte' })
  db.run('UPDATE users SET activo=0 WHERE id=?',[req.params.id])
  res.json({ ok:true })
})
export default router
