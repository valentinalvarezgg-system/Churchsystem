import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import db from '../lib/db.js'
const __dirname=path.dirname(fileURLToPath(import.meta.url))
const DB_FILE=path.resolve(__dirname,'../../church.db')
const router = Router()
router.get('/download', requireAuth, requireRol('PASTOR_GENERAL'), (_req, res) => {
  if (!fs.existsSync(DB_FILE)) return res.status(404).json({ error:'Base de datos no encontrada' })
  res.setHeader('Content-Type','application/octet-stream')
  res.setHeader('Content-Disposition',`attachment; filename="church-backup-${new Date().toISOString().slice(0,10)}.db"`)
  res.send(fs.readFileSync(DB_FILE))
})
router.get('/info', requireAuth, requireRol('PASTOR_GENERAL'), (_req, res) => {
  const stat=fs.existsSync(DB_FILE)?fs.statSync(DB_FILE):null
  res.json({ tamano:stat?Math.round(stat.size/1024)+' KB':'N/A', modificado:stat?.mtime?.toISOString()||null, totales:{ personas:Number(db.get('SELECT COUNT(*) as c FROM personas')?.c??0), grupos:Number(db.get('SELECT COUNT(*) as c FROM grupos')?.c??0), cultos:Number(db.get('SELECT COUNT(*) as c FROM cultos')?.c??0), seguimientos:Number(db.get('SELECT COUNT(*) as c FROM seguimientos')?.c??0), mensajes:Number(db.get('SELECT COUNT(*) as c FROM mensajes')?.c??0), finanzas:Number(db.get('SELECT COUNT(*) as c FROM finanzas')?.c??0) } })
})
export default router
