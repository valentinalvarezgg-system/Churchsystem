import { Router } from 'express'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

// Limpiar texto de marcas de asistencia
const clean = v => String(v || '').replace(/^[✓✔★☑✅\s]+/, '').trim()

router.get('/', requireAuth, (req, res) => {
  const { q = '', limit = 8 } = req.query
  const term = q.trim()
  if (term.length < 2) return res.json([])

  const s = `%${term}%`
  const lim = Math.min(Number(limit) || 8, 20)

  const personas = db.all(
    `SELECT id, nombre, apellido, email, telefono, estado, 'persona' as tipo
     FROM personas
     WHERE nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono LIKE ?
     LIMIT ?`,
    [s, s, s, s, lim]
  )

  const grupos = db.all(
    `SELECT id, nombre, descripcion, 'grupo' as tipo
     FROM grupos WHERE nombre LIKE ? LIMIT 3`, [s]
  )

  const cultos = db.all(
    `SELECT id, nombre, fecha, 'culto' as tipo
     FROM cultos WHERE nombre LIKE ? LIMIT 3`, [s]
  )

  const resultados = [
    ...personas.map(p => ({
      ...p,
      // Limpiar ✓ y ★ del apellido
      apellido: clean(p.apellido),
      nombre:   clean(p.nombre),
      detalle:  p.telefono || p.email || p.estado || '',
    })),
    ...grupos.map(g => ({
      ...g,
      detalle: g.descripcion || 'Grupo',
    })),
    ...cultos.map(c => ({
      ...c,
      nombre: c.nombre,
      detalle: `Culto · ${c.fecha}`,
    })),
  ]

  // Devolver array directo (compatible con BusquedaGlobal y Perfil)
  res.json(resultados)
})

export default router
