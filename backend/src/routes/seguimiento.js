import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
const router = Router()
router.get('/:personaId', requireAuth, (req, res) => {
  res.json(db.all(`SELECT s.*,u.nombre as autorNombre,u.email as autorEmail FROM seguimientos s LEFT JOIN users u ON s.userId=u.id WHERE s.personaId=? ORDER BY s.id DESC`,[req.params.personaId]))
})
router.post('/', requireAuth, (req, res) => {
  const { personaId,tipo='CONTACTO',nota='',proximoContacto=null } = req.body||{}
  if (!personaId) return res.status(400).json({ error:'personaId requerido' })
  const { lastID } = db.run('INSERT INTO seguimientos (personaId,userId,tipo,nota,proximoContacto) VALUES (?,?,?,?,?)',[personaId,req.user.id,tipo,nota,proximoContacto||null])
  res.status(201).json(db.get('SELECT * FROM seguimientos WHERE id=?',[lastID]))
})
router.delete('/:id', requireAuth, (req, res) => {
  const s = db.get('SELECT * FROM seguimientos WHERE id=?',[req.params.id])
  if (!s) return res.status(404).json({ error:'No encontrado' })
  if (Number(s.userId)!==Number(req.user.id) && req.user.rol!=='PASTOR_GENERAL') return res.status(403).json({ error:'Sin permisos' })
  db.run('DELETE FROM seguimientos WHERE id=?',[req.params.id])
  res.json({ ok:true })
})
router.get('/', requireAuth, (req, res) => {
  res.json(db.all(`SELECT s.*,u.nombre as autorNombre,p.nombre as personaNombre,p.apellido as personaApellido FROM seguimientos s LEFT JOIN users u ON s.userId=u.id LEFT JOIN personas p ON s.personaId=p.id ORDER BY s.id DESC LIMIT ?`,[Number(req.query.limit||20)]))
})
export default router
