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

export default router
