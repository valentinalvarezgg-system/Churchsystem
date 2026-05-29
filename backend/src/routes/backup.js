import { Router } from 'express'
import { pgOne } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'

const router = Router()

router.get('/download', requireAuth, requireRol('PASTOR_GENERAL'), (_req, res) => {
  res.status(410).json({ error: 'El backup de base de datos local no está disponible con PostgreSQL. Use el panel de Neon o pg_dump para exportar datos.' })
})

router.get('/info', requireAuth, requireRol('PASTOR_GENERAL'), async (req, res) => {
  const iglesiaId = Number(req.user?.iglesiaId || 0)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })

  const [personas, grupos, cultos, seguimientos, mensajes, finanzas] = await Promise.all([
    pgOne('SELECT COUNT(*)::int AS c FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Grupo" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Culto" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Seguimiento" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
    pgOne('SELECT COUNT(*)::int AS c FROM "Mensaje" WHERE "iglesiaId"=$1', [iglesiaId]).catch(() => ({ c: 0 })),
    pgOne('SELECT COUNT(*)::int AS c FROM "Finanza" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL', [iglesiaId]),
  ])

  res.json({
    tamano: 'N/A (PostgreSQL)',
    modificado: new Date().toISOString(),
    totales: {
      personas: Number(personas?.c ?? 0),
      grupos:   Number(grupos?.c ?? 0),
      cultos:   Number(cultos?.c ?? 0),
      seguimientos: Number(seguimientos?.c ?? 0),
      mensajes: Number(mensajes?.c ?? 0),
      finanzas: Number(finanzas?.c ?? 0),
    },
  })
})

export default router
