import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
const router = Router()
router.get('/', requireAuth, (req, res) => {
  const { page=1,limit=15 } = req.query
  const where=["c.archivado=0"]; const params=[]
  if (!['PASTOR_GENERAL','CONSOLIDACION'].includes(req.user.rol)) { where.push("(c.destinatarios='TODOS' OR c.destinatarios=?)"); params.push(req.user.rol) }
  const wStr='WHERE '+where.join(' AND ')
  const offset=(Number(page)-1)*Number(limit)
  const total=Number(db.get(`SELECT COUNT(*) as cnt FROM comunicados c ${wStr}`,params)?.cnt??0)
  const data=db.all(`SELECT c.*,u.nombre as autorNombre FROM comunicados c LEFT JOIN users u ON c.userId=u.id ${wStr} ORDER BY c.fijado DESC,c.id DESC LIMIT ? OFFSET ?`,[...params,Number(limit),offset])
  res.json({ data,total,pages:Math.ceil(total/Number(limit)) })
})
router.post('/', requireAuth, (req, res) => {
  const { titulo,contenido,tipo='GENERAL',destinatarios='TODOS',fijado=0 } = req.body||{}
  if (!titulo?.trim()||!contenido?.trim()) return res.status(400).json({ error:'Título y contenido requeridos' })
  const { lastID }=db.run('INSERT INTO comunicados (titulo,contenido,tipo,destinatarios,fijado,userId) VALUES (?,?,?,?,?,?)',[titulo.trim(),contenido.trim(),tipo,destinatarios,fijado?1:0,req.user.id])
  res.status(201).json({ ok:true,id:lastID })
})
router.put('/:id', requireAuth, (req, res) => {
  const c=db.get('SELECT * FROM comunicados WHERE id=?',[req.params.id])
  if (!c) return res.status(404).json({ error:'No encontrado' })
  if (Number(c.userId)!==Number(req.user.id)&&req.user.rol!=='PASTOR_GENERAL') return res.status(403).json({ error:'Sin permisos' })
  const m={...c,...req.body}
  db.run("UPDATE comunicados SET titulo=?,contenido=?,tipo=?,destinatarios=?,fijado=?,archivado=?,updatedAt=datetime('now') WHERE id=?",[m.titulo,m.contenido,m.tipo,m.destinatarios,m.fijado?1:0,m.archivado?1:0,req.params.id])
  res.json({ ok:true })
})
router.delete('/:id', requireAuth, (req, res) => {
  const c=db.get('SELECT * FROM comunicados WHERE id=?',[req.params.id])
  if (!c||((Number(c.userId)!==Number(req.user.id))&&req.user.rol!=='PASTOR_GENERAL')) return res.status(403).json({ error:'Sin permisos' })
  db.run('UPDATE comunicados SET archivado=1 WHERE id=?',[req.params.id])
  res.json({ ok:true })
})
export default router
