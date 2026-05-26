import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
const router = Router()
router.get('/', requireAuth, (_req, res) => {
  res.json(db.all(`SELECT c.*,(SELECT COUNT(*) FROM asistencias a WHERE a.cultoId=c.id AND a.presente=1) as presentes,(SELECT COUNT(*) FROM asistencias a WHERE a.cultoId=c.id) as totalRegistrados FROM cultos c ORDER BY c.fecha DESC`))
})
router.post('/', requireAuth, (req, res) => {
  const { nombre,fecha,cultoDia='',cultoTurno=0,observaciones='' } = req.body||{}
  if (!nombre?.trim()||!fecha) return res.status(400).json({ error:'nombre y fecha requeridos' })
  const { lastID } = db.run('INSERT INTO cultos (nombre,fecha,cultoDia,cultoTurno,observaciones) VALUES (?,?,?,?,?)',[nombre.trim(),fecha,cultoDia,Number(cultoTurno),observaciones])
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'CREAR',entidad:'CULTO',entidadId:lastID,detalle:nombre })
  res.status(201).json({ ok:true, id:lastID })
})
router.delete('/:id', requireAuth, (req, res) => {
  if (!['PASTOR_GENERAL','PASTOR_CULTO'].includes(req.user.rol)) return res.status(403).json({ error:'No autorizado' })
  db.run('DELETE FROM asistencias WHERE cultoId=?',[req.params.id])
  db.run('DELETE FROM cultos WHERE id=?',[req.params.id])
  res.json({ ok:true })
})
router.get('/:id/asistencia', requireAuth, (req, res) => {
  const culto = db.get('SELECT * FROM cultos WHERE id=?',[req.params.id])
  if (!culto) return res.status(404).json({ error:'Culto no encontrado' })
  const { search='' } = req.query
  const where = search ? "WHERE (p.nombre LIKE ? OR p.apellido LIKE ?)" : ''
  const params = search ? [`%${search}%`,`%${search}%`] : []
  const personas = db.all(`SELECT p.id,p.nombre,p.apellido,p.estado,p.cultoDia,COALESCE(a.presente,0) as presente FROM personas p LEFT JOIN asistencias a ON a.personaId=p.id AND a.cultoId=? ${where} ORDER BY p.nombre ASC`,[req.params.id,...params])
  res.json({ culto, personas, stats:{ total:personas.length, presentes:personas.filter(p=>p.presente).length, ausentes:personas.filter(p=>!p.presente).length } })
})
router.post('/:id/asistencia', requireAuth, (req, res) => {
  const { presentes=[] } = req.body||{}
  const cultoId = req.params.id
  for (const { id } of db.all('SELECT id FROM personas')) {
    const p = presentes.includes(Number(id)) ? 1 : 0
    const ex = db.get('SELECT id FROM asistencias WHERE cultoId=? AND personaId=?',[cultoId,id])
    if (ex) db.run('UPDATE asistencias SET presente=? WHERE cultoId=? AND personaId=?',[p,cultoId,id])
    else    db.run('INSERT INTO asistencias (cultoId,personaId,presente) VALUES (?,?,?)',[cultoId,id,p])
  }
  registrar({ userId:req.user.id,email:req.user.email,rol:req.user.rol,accion:'ASISTENCIA',entidad:'CULTO',entidadId:cultoId,detalle:`${presentes.length} presentes` })
  res.json({ ok:true, presentes:presentes.length })
})
export default router
