import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import db from '../lib/db.js'

const router = Router()

router.get('/personas', requireAuth, (req, res) => {
  const total = db.get('SELECT COUNT(*) as c FROM personas WHERE estado != "INACTIVO"')?.c || 0
  const mesActual = new Date().toISOString().slice(0, 7)
  const mesPasado = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 7)
  
  const nuevosMes = db.get('SELECT COUNT(*) as c FROM personas WHERE substr(createdAt,1,7) = ?', [mesActual])?.c || 0
  const nuevosMesPasado = db.get('SELECT COUNT(*) as c FROM personas WHERE substr(createdAt,1,7) = ?', [mesPasado])?.c || 0
  
  const variacion = nuevosMesPasado > 0 ? Math.round(((nuevosMes - nuevosMesPasado) / nuevosMesPasado) * 100) : 100

  res.json({ total, mes: nuevosMes, variacion, nuevosMes })
})

router.get('/asistencias', requireAuth, (req, res) => {
  const ultimos = db.all('SELECT promedio FROM cultos ORDER BY fecha DESC LIMIT 4')
  const promedio = ultimos.length > 0 
    ? Math.round(ultimos.reduce((a,c) => a + (c.promedio||0), 0) / ultimos.length)
    : 0
  
  const mesActual = new Date().toISOString().slice(0, 7)
  const totalMes = db.get('SELECT SUM(total) as t FROM cultos WHERE substr(fecha,1,7) = ?', [mesActual])?.t || 0
  
  const mesPasado = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 7)
  const ultimos2 = db.all('SELECT promedio FROM cultos WHERE substr(fecha,1,7) = ? ORDER BY fecha DESC LIMIT 4', [mesPasado])
  const promedioPasado = ultimos2.length > 0
    ? Math.round(ultimos2.reduce((a,c) => a + (c.promedio||0), 0) / ultimos2.length)
    : 0
  
  const variacion = promedioPasado > 0 ? Math.round(((promedio - promedioPasado) / promedioPasado) * 100) : 0

  res.json({ promedio, variacion, totalMes })
})

router.get('/grupos', requireAuth, (req, res) => {
  const total = db.get('SELECT COUNT(*) as c FROM grupos WHERE activo = 1')?.c || 0
  const mesPasado = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 7)
  const totalPasado = db.get('SELECT COUNT(*) as c FROM grupos WHERE activo = 1 AND substr(createdAt,1,7) <= ?', [mesPasado])?.c || 0
  
  const variacion = totalPasado > 0 ? Math.round(((total - totalPasado) / totalPasado) * 100) : 0
  
  const miembrosTotal = db.get('SELECT COUNT(*) as c FROM personas WHERE grupoId IS NOT NULL')?.c || 0
  const miembrosProm = total > 0 ? Math.round(miembrosTotal / total) : 0

  res.json({ total, variacion, miembrosProm })
})

router.get('/seguimientos', requireAuth, (req, res) => {
  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = db.get('SELECT COUNT(*) as c FROM seguimientos WHERE substr(fecha,1,7) = ?', [mesActual])?.c || 0
  
  const mesPasado = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 7)
  const mesPasadoCount = db.get('SELECT COUNT(*) as c FROM seguimientos WHERE substr(fecha,1,7) = ?', [mesPasado])?.c || 0
  
  const variacion = mesPasadoCount > 0 ? Math.round(((mes - mesPasadoCount) / mesPasadoCount) * 100) : 0

  res.json({ mes, variacion })
})

router.get('/consolidacion', requireAuth, (req, res) => {
  const totalConsolidados = db.get('SELECT COUNT(*) as c FROM personas WHERE estadoEspiritual IN ("CONSOLIDADO","MINISTERIO")')?.c || 0
  
  const mesPasado = new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 7)
  const pasado = db.get('SELECT COUNT(*) as c FROM personas WHERE estadoEspiritual IN ("CONSOLIDADO","MINISTERIO") AND substr(createdAt,1,7) <= ?', [mesPasado])?.c || 0
  
  const variacion = pasado > 0 ? Math.round(((totalConsolidados - pasado) / pasado) * 100) : 0
  const meta = 150

  res.json({ totalConsolidados, variacion, meta })
})

// Executive dashboard - tendencia últimas 12 semanas
router.get('/tendencia', requireAuth, (req, res) => {
  const semanas = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i * 7)
    const inicio = new Date(d); inicio.setDate(d.getDate() - d.getDay())
    const fin = new Date(inicio); fin.setDate(inicio.getDate() + 6)
    const iStr = inicio.toISOString().slice(0,10)
    const fStr = fin.toISOString().slice(0,10)
    
    const asist = db.get('SELECT SUM(total) as t, COUNT(*) as cultos FROM cultos WHERE fecha BETWEEN ? AND ?', [iStr, fStr])
    const nuevos = db.get('SELECT COUNT(*) as c FROM personas WHERE DATE(createdAt) BETWEEN ? AND ?', [iStr, fStr])?.c || 0
    
    semanas.push({
      semana: `${inicio.getDate()}/${inicio.getMonth()+1}`,
      asistencia: asist?.t || 0,
      cultos: asist?.cultos || 0,
      nuevos
    })
  }
  res.json({ semanas })
})

// Actividad reciente
router.get('/actividad', requireAuth, (req, res) => {
  const personas = db.all('SELECT id, nombre, apellido, estado, createdAt FROM personas ORDER BY createdAt DESC LIMIT 5') || []
  const seguimientos = db.all('SELECT s.*, p.nombre, p.apellido FROM seguimientos s LEFT JOIN personas p ON s.personaId = p.id ORDER BY s.fecha DESC LIMIT 5') || []
  const cultos = db.all('SELECT * FROM cultos ORDER BY fecha DESC LIMIT 3') || []
  const eventos = db.all('SELECT * FROM eventos ORDER BY fecha DESC LIMIT 3') || []
  
  res.json({ personas, seguimientos, cultos, eventos })
})

export default router
