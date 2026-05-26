import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
const router = Router()
router.get('/', requireAuth, requireRol('PASTOR_GENERAL','CONSOLIDACION'), (req, res) => {
  const { page=1,limit=50,entidad,accion } = req.query
  const where=[]; const params=[]
  if (entidad) { where.push('entidad=?'); params.push(entidad) }
  if (accion)  { where.push('accion=?');  params.push(accion) }
  const wStr = where.length ? 'WHERE '+where.join(' AND ') : ''
  const offset = (Number(page)-1)*Number(limit)
  const total = Number(db.get(`SELECT COUNT(*) as c FROM auditoria ${wStr}`,params)?.c??0)
  const data  = db.all(`SELECT * FROM auditoria ${wStr} ORDER BY id DESC LIMIT ? OFFSET ?`,[...params,Number(limit),offset])
  res.json({ data, total, page:Number(page), pages:Math.ceil(total/Number(limit)) })
})
export default router
