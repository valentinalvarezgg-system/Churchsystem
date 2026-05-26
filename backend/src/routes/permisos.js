import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
const router = Router()
const MODULOS=['personas','grupos','asistencia','calendario','mensajes','alertas','finanzas','reportes','discipulado','seguimiento','historial','consolidacion','oracion','comunicados']
const DEFAULTS={ PASTOR_GENERAL:Object.fromEntries(MODULOS.map(m=>[m,3])), CONSOLIDACION:{personas:2,grupos:1,asistencia:1,calendario:1,mensajes:2,alertas:2,finanzas:0,reportes:2,discipulado:2,seguimiento:2,historial:2,consolidacion:3,oracion:2,comunicados:2}, PASTOR_CULTO:{personas:2,grupos:2,asistencia:3,calendario:2,mensajes:2,alertas:1,finanzas:0,reportes:1,discipulado:1,seguimiento:2,historial:0,consolidacion:1,oracion:1,comunicados:1}, STAFF:{personas:2,grupos:1,asistencia:2,calendario:1,mensajes:1,alertas:0,finanzas:0,reportes:0,discipulado:1,seguimiento:2,historial:0,consolidacion:1,oracion:1,comunicados:1}, LIDER:{personas:1,grupos:1,asistencia:1,calendario:1,mensajes:0,alertas:0,finanzas:0,reportes:0,discipulado:1,seguimiento:2,historial:0,consolidacion:0,oracion:1,comunicados:1} }
function getOrCreate(userId, rol) {
  let p = db.get('SELECT * FROM permisos WHERE userId=?',[userId])
  if (!p) {
    const d = DEFAULTS[rol]||DEFAULTS.LIDER
    db.run(`INSERT INTO permisos (userId,${MODULOS.join(',')}) VALUES (?,${MODULOS.map(()=>'?').join(',')})`,[userId,...MODULOS.map(m=>d[m]??0)])
    p = db.get('SELECT * FROM permisos WHERE userId=?',[userId])
  }
  return p
}
router.get('/me/actual', requireAuth, (req, res) => { res.json(getOrCreate(req.user.id,req.user.rol)) })
router.get('/:userId', requireAuth, (req, res) => {
  const uid=Number(req.params.userId)
  if (uid!==req.user.id && req.user.rol!=='PASTOR_GENERAL') return res.status(403).json({ error:'Sin acceso' })
  const u=db.get('SELECT rol FROM users WHERE id=?',[uid]); if (!u) return res.status(404).json({ error:'No encontrado' })
  res.json(getOrCreate(uid,u.rol))
})
router.put('/:userId', requireAuth, requireRol('PASTOR_GENERAL'), (req, res) => {
  const uid=Number(req.params.userId)
  const u=db.get('SELECT rol FROM users WHERE id=?',[uid]); if (!u) return res.status(404).json({ error:'No encontrado' })
  if (u.rol==='PASTOR_GENERAL') return res.status(400).json({ error:'No se puede modificar al Pastor General' })
  const campos={}; for (const m of MODULOS) if (req.body[m]!==undefined) { const v=Number(req.body[m]); if(v>=0&&v<=3) campos[m]=v }
  const ex=db.get('SELECT id FROM permisos WHERE userId=?',[uid])
  if (ex) { const sets=Object.keys(campos).map(k=>`${k}=?`).join(','); if(sets) db.run(`UPDATE permisos SET ${sets},updatedAt=datetime('now') WHERE userId=?`,[...Object.values(campos),uid]) }
  else { const d=DEFAULTS[u.rol]||DEFAULTS.LIDER; const vals={...d,...campos}; db.run(`INSERT INTO permisos (userId,${MODULOS.join(',')}) VALUES (?,${MODULOS.map(()=>'?').join(',')})`,[uid,...MODULOS.map(m=>vals[m]??0)]) }
  res.json({ ok:true })
})
router.post('/:userId/reset', requireAuth, requireRol('PASTOR_GENERAL'), (req, res) => {
  const uid=Number(req.params.userId)
  const u=db.get('SELECT rol FROM users WHERE id=?',[uid]); if (!u) return res.status(404).json({ error:'No encontrado' })
  const d=DEFAULTS[u.rol]||DEFAULTS.LIDER
  const ex=db.get('SELECT id FROM permisos WHERE userId=?',[uid])
  if (ex) db.run(`UPDATE permisos SET ${MODULOS.map(m=>`${m}=?`).join(',')},updatedAt=datetime('now') WHERE userId=?`,[...MODULOS.map(m=>d[m]??0),uid])
  else    db.run(`INSERT INTO permisos (userId,${MODULOS.join(',')}) VALUES (?,${MODULOS.map(()=>'?').join(',')})`,[uid,...MODULOS.map(m=>d[m]??0)])
  res.json({ ok:true, permisos:d })
})
export default router
