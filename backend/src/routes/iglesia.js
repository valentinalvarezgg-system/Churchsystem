import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import db from '../lib/db.js'

const router = Router()

function generarToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('')
  return `IGL-${seg()}-${seg()}`
}

router.get('/token', requireAuth, (req, res) => {
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.id])
  if (!['PASTOR_GENERAL','CONSOLIDACION'].includes(user?.rol))
    return res.status(403).json({ error: 'Solo el pastor general puede ver el token' })
  let iglesia = db.get('SELECT * FROM iglesias WHERE adminId = ?', [user.id])
  if (!iglesia) {
    const token = generarToken()
    db.run('INSERT INTO iglesias (nombre, token, adminId, plan) VALUES (?,?,?,?)',
      [user.iglesia||'Mi Iglesia', token, user.id, user.plan||'GENERAL'])
    iglesia = db.get('SELECT * FROM iglesias WHERE adminId = ?', [user.id])
  }
  res.json({ token: iglesia.token, nombre: iglesia.nombre, plan: iglesia.plan,
    miembros: db.get('SELECT COUNT(*) as c FROM users WHERE iglesiaId=?',[iglesia.id])?.c||0 })
})

router.post('/token/regenerar', requireAuth, (req, res) => {
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.id])
  if (user?.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Solo pastor general' })
  const t = generarToken()
  const ig = db.get('SELECT * FROM iglesias WHERE adminId = ?', [user.id])
  if (ig) db.run('UPDATE iglesias SET token=? WHERE id=?', [t, ig.id])
  else db.run('INSERT INTO iglesias (nombre,token,adminId,plan) VALUES (?,?,?,?)',
    [user.iglesia||'Mi Iglesia', t, user.id, user.plan||'GENERAL'])
  res.json({ token: t, mensaje: 'Token regenerado.' })
})

router.post('/unirse', requireAuth, (req, res) => {
  const { token } = req.body
  if (!token?.trim()) return res.status(400).json({ error: 'Token requerido' })
  const ig = db.get('SELECT * FROM iglesias WHERE token=?', [token.trim().toUpperCase()])
  if (!ig) return res.status(404).json({ error: 'Token inválido.' })
  db.run('UPDATE users SET iglesiaId=?, plan=? WHERE id=?', [ig.id, ig.plan||'GENERAL', req.user.id])
  res.json({ ok:true, iglesia:{id:ig.id,nombre:ig.nombre}, plan:ig.plan, mensaje:`Te uniste a ${ig.nombre}.` })
})

router.post('/validar-token', (req, res) => {
  const { token } = req.body
  if (!token?.trim()) return res.status(400).json({ error: 'Token requerido' })
  const ig = db.get('SELECT id,nombre,plan FROM iglesias WHERE token=?', [token.trim().toUpperCase()])
  if (!ig) return res.status(404).json({ valido:false, error:'Token no encontrado' })
  res.json({ valido:true, iglesia:ig.nombre, plan:ig.plan })
})

export default router
