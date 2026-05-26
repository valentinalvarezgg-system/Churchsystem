import { Router } from 'express'
import { createHash } from 'crypto'
import os from 'os'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
const router = Router()
const SECRET_QR = process.env.QR_SECRET||'church-qr-2024'

// IP local para QR accesibles desde cualquier dispositivo
function getLocalIP() {
  const nets = Object.values(os.networkInterfaces()).flat()
  return nets.find(n => n.family === 'IPv4' && !n.internal)?.address || 'localhost'
}
const FRONTEND_PORT = process.env.FRONTEND_PORT || process.env.PORT || '4000'
const token = (id) => createHash('sha256').update(`${id}:${SECRET_QR}`).digest('hex').slice(0,16)
router.get('/token/:cultoId', requireAuth, (req, res) => {
  const culto=db.get('SELECT * FROM cultos WHERE id=?',[req.params.cultoId])
  if (!culto) return res.status(404).json({ error:'Culto no encontrado' })
  const t=token(culto.id)
  const ip = getLocalIP()
  // Preferir PUBLIC_URL (Cloudflare/producción) sobre IP local
  const publicUrl = process.env.PUBLIC_URL
  const url = publicUrl
    ? `${publicUrl}/checkin/${culto.id}/${t}`
    : `http://${ip}:${FRONTEND_PORT}/checkin/${culto.id}/${t}`
  res.json({ token:t, url, culto, ip })
})
router.get('/info/:cultoId/:tok', (req, res) => {
  if (req.params.tok!==token(req.params.cultoId)) return res.status(403).json({ error:'QR inválido' })
  const culto=db.get('SELECT id,nombre,fecha,cultoDia FROM cultos WHERE id=?',[req.params.cultoId])
  if (!culto) return res.status(404).json({ error:'No encontrado' })
  res.json({ culto, totalPresentes:Number(db.get('SELECT COUNT(*) as c FROM asistencias WHERE cultoId=? AND presente=1',[req.params.cultoId])?.c??0) })
})
router.post('/registrar/:cultoId/:tok', (req, res) => {
  if (req.params.tok!==token(req.params.cultoId)) return res.status(403).json({ error:'QR inválido' })
  const { nombre,telefono } = req.body||{}
  if (!nombre?.trim()) return res.status(400).json({ error:'Nombre requerido' })
  let persona=null
  if (telefono) persona=db.get("SELECT * FROM personas WHERE REPLACE(REPLACE(telefono,'-',''),' ','') LIKE ?",[`%${telefono.replace(/\D/g,'').slice(-8)}%`])
  if (!persona) persona=db.get('SELECT * FROM personas WHERE nombre LIKE ? LIMIT 1',[`%${nombre.trim().split(' ')[0]}%`])
  if (!persona) { const { lastID }=db.run("INSERT INTO personas (nombre,telefono,estado) VALUES (?,?,'VISITANTE')",[nombre.trim(),telefono||'']); persona=db.get('SELECT * FROM personas WHERE id=?',[lastID]) }
  const ex=db.get('SELECT id FROM asistencias WHERE cultoId=? AND personaId=?',[req.params.cultoId,persona.id])
  if (ex) db.run('UPDATE asistencias SET presente=1 WHERE cultoId=? AND personaId=?',[req.params.cultoId,persona.id])
  else    db.run('INSERT INTO asistencias (cultoId,personaId,presente) VALUES (?,?,1)',[req.params.cultoId,persona.id])
  res.json({ ok:true, persona:{nombre:persona.nombre,estado:persona.estado}, totalPresentes:Number(db.get('SELECT COUNT(*) as c FROM asistencias WHERE cultoId=? AND presente=1',[req.params.cultoId])?.c??0) })
})
export default router

// ── GET /checkin/descriptores ──────────────────────────────────────────────────
// Devuelve lista de personas con fotoUrl para que face-api las cargue en el browser
// Los descriptores se calculan en el cliente (face-api.js), no en el servidor
router.get('/descriptores', requireAuth, (_req, res) => {
  const personas = db.all(
    `SELECT id, nombre, apellido, fotoUrl, estado
     FROM personas
     WHERE fotoUrl IS NOT NULL AND fotoUrl != ''
     ORDER BY apellido, nombre`
  )
  res.json(personas)
})
