import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
const router = Router()
router.get('/', requireAuth, (req, res) => {
  const u=db.get('SELECT id,email,nombre,rol,cultoDia,cultoTurno,createdAt FROM users WHERE id=?',[req.user.id])
  if (!u) return res.status(404).json({ error:'No encontrado' })
  res.json({ ...u, stats:{ totalPersonas:Number(db.get('SELECT COUNT(*) as c FROM personas WHERE asignadoA=?',[req.user.id])?.c??0), totalSeguimientos:Number(db.get('SELECT COUNT(*) as c FROM seguimientos WHERE userId=?',[req.user.id])?.c??0), totalMensajes:Number(db.get('SELECT COUNT(*) as c FROM mensajes WHERE userId=?',[req.user.id])?.c??0) } })
})
router.put('/', requireAuth, async (req, res) => {
  const { nombre,passwordActual,passwordNuevo } = req.body||{}
  const u=db.get('SELECT * FROM users WHERE id=?',[req.user.id])
  if (!u) return res.status(404).json({ error:'No encontrado' })
  if (passwordNuevo) {
    if (!passwordActual) return res.status(400).json({ error:'Ingresá tu contraseña actual' })
    if (!(await bcrypt.compare(passwordActual,u.password))) return res.status(401).json({ error:'Contraseña actual incorrecta' })
    db.run('UPDATE users SET nombre=?,password=? WHERE id=?',[nombre||u.nombre,await bcrypt.hash(passwordNuevo,10),req.user.id])
  } else {
    db.run('UPDATE users SET nombre=? WHERE id=?',[nombre||u.nombre,req.user.id])
  }
  res.json({ ok:true })
})
export default router
