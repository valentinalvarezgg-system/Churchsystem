import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
const router = Router()
router.get('/', requireAuth, (_req, res) => {
  const ultimos = db.all('SELECT id FROM cultos ORDER BY fecha DESC LIMIT 3').map(c=>c.id)
  let sinAsistir = []
  if (ultimos.length>0) {
    const inC = ultimos.map(()=>'?').join(',')
    sinAsistir = db.all(`SELECT p.id,p.nombre,p.apellido,p.telefono,p.estado,u.nombre as liderNombre FROM personas p LEFT JOIN users u ON p.asignadoA=u.id WHERE p.estado='ACTIVO' AND p.id NOT IN (SELECT DISTINCT a.personaId FROM asistencias a WHERE a.cultoId IN (${inC}) AND a.presente=1) ORDER BY p.nombre ASC LIMIT 30`,ultimos)
  }
  const sinSeguimiento = db.all(`SELECT p.id,p.nombre,p.apellido,p.telefono,u.nombre as liderNombre,(SELECT MAX(s.createdAt) FROM seguimientos s WHERE s.personaId=p.id) as ultimoSeguimiento FROM personas p LEFT JOIN users u ON p.asignadoA=u.id WHERE p.estado IN ('ACTIVO','VISITANTE','NUEVO') AND (NOT EXISTS (SELECT 1 FROM seguimientos s WHERE s.personaId=p.id) OR (SELECT MAX(s.createdAt) FROM seguimientos s WHERE s.personaId=p.id)<date('now','-30 days')) ORDER BY ultimoSeguimiento ASC LIMIT 20`)
  const visitantesSinConsolidar = db.all(`SELECT p.id,p.nombre,p.apellido,p.telefono,p.fechaIngreso,u.nombre as liderNombre FROM personas p LEFT JOIN users u ON p.asignadoA=u.id WHERE p.estado='VISITANTE' AND p.fechaIngreso<=date('now','-14 days') ORDER BY p.fechaIngreso ASC LIMIT 20`)
  const contactosVencidos = db.all(`SELECT s.proximoContacto,s.tipo,p.nombre,p.apellido,p.id as personaId,p.telefono FROM seguimientos s JOIN personas p ON s.personaId=p.id WHERE s.proximoContacto IS NOT NULL AND s.proximoContacto<date('now') AND s.id IN (SELECT MAX(id) FROM seguimientos WHERE proximoContacto IS NOT NULL GROUP BY personaId) ORDER BY s.proximoContacto ASC LIMIT 15`)
  const hoy = new Date()
  const cumpleanosSemana = db.all(`SELECT id,nombre,apellido,telefono,fechaNacimiento,strftime('%m-%d',fechaNacimiento) as cumDia FROM personas WHERE fechaNacimiento IS NOT NULL AND fechaNacimiento!=''`).filter(p=>{
    if (!p.cumDia) return false
    const [m,d]=p.cumDia.split('-').map(Number); const f=new Date(hoy.getFullYear(),m-1,d)
    if(f<hoy)f.setFullYear(hoy.getFullYear()+1); return(f-hoy)/86400000<=7
  })
  res.json({ sinAsistir:{data:sinAsistir,total:sinAsistir.length}, sinSeguimiento:{data:sinSeguimiento,total:sinSeguimiento.length}, visitantesSinConsolidar:{data:visitantesSinConsolidar,total:visitantesSinConsolidar.length}, contactosVencidos:{data:contactosVencidos,total:contactosVencidos.length}, cumpleanosSemana:{data:cumpleanosSemana,total:cumpleanosSemana.length}, resumen:{total:sinAsistir.length+sinSeguimiento.length+visitantesSinConsolidar.length+contactosVencidos.length+cumpleanosSemana.length,critico:sinAsistir.length+contactosVencidos.length} })
})
export default router
