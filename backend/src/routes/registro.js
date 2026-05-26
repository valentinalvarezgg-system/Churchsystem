/**
 * registro.js — Ruta pública para crear nuevas iglesias (tenants)
 * POST /registro/crear → crea la DB del tenant + usuario admin + retorna JWT
 */
import { Router }  from 'express'
import bcrypt      from 'bcryptjs'
import jwt         from 'jsonwebtoken'
import { getTenantDb, getTenantId } from '../middlewares/tenant.js'

const router = Router()

const PLANES = {
  basico:   { label: 'Básico',   personas: 100,  precio: 8000  },
  estandar: { label: 'Estándar', personas: 500,  precio: 15000 },
  pro:      { label: 'Pro',      personas: 99999, precio: 25000 },
}

// POST /registro/crear
router.post('/crear', async (req, res) => {
  const {
    nombreIglesia, nombre, email, password,
    telefono = '', ciudad = '', plan = 'estandar'
  } = req.body || {}

  // Validaciones
  if (!nombreIglesia?.trim()) return res.status(400).json({ error: 'Nombre de iglesia requerido' })
  if (!email?.trim())         return res.status(400).json({ error: 'Email requerido' })
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })

  // Generar tenantId desde el nombre de la iglesia
  const tenantId = nombreIglesia
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'iglesia'

  try {
    // Obtener/crear DB del tenant
    const db = await getTenantDb(tenantId)

    // Verificar que el email no exista
    const existe = db.get('SELECT id FROM users WHERE email=?', [email.trim().toLowerCase()])
    if (existe) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' })

    // Crear el usuario admin
    const hash = await bcrypt.hash(password, 10)
    db.run(
      `INSERT INTO users (nombre, email, password, rol, activo)
       VALUES (?, ?, ?, 'PASTOR_GENERAL', 1)`,
      [nombre?.trim() || 'Pastor', email.trim().toLowerCase(), hash]
    )
    const userId = db.get('SELECT last_insert_rowid() as id')?.id

    // Configurar la iglesia
    const planInfo = PLANES[plan] || PLANES.estandar
    const config = {
      nombre_iglesia:   nombreIglesia.trim(),
      plan:             plan,
      plan_label:       planInfo.label,
      plan_personas_max: String(planInfo.personas),
      email_iglesia:    email.trim().toLowerCase(),
      telefono_iglesia: telefono.trim(),
      ciudad:           ciudad.trim(),
      trial_inicio:     new Date().toISOString().slice(0, 10),
      trial_fin:        new Date(Date.now() + 14*24*60*60*1000).toISOString().slice(0, 10),
      setup_completado: '0',
    }

    for (const [k, v] of Object.entries(config)) {
      db.run(
        `INSERT INTO configuracion (clave, valor) VALUES (?,?)
         ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
        [k, v]
      )
    }

    db.save()

    // Generar JWT
    const token = jwt.sign(
      { id: userId, email: email.trim().toLowerCase(), rol: 'PASTOR_GENERAL', tenantId },
      process.env.JWT_SECRET || 'church-secret',
      { expiresIn: '30d' }
    )

    const appUrl = `https://${tenantId}.churchsystem.com.ar/app`

    console.log(`🏢  Nueva iglesia registrada: ${nombreIglesia} (${tenantId}) — plan: ${plan}`)

    res.json({
      ok: true,
      tenantId,
      token,
      user: { id: userId, nombre: nombre?.trim() || 'Pastor', email, rol: 'PASTOR_GENERAL' },
      appUrl,
      trial: { inicio: config.trial_inicio, fin: config.trial_fin, dias: 14 },
    })

  } catch (err) {
    console.error('Registro error:', err.message)
    res.status(500).json({ error: 'Error al crear la cuenta: ' + err.message })
  }
})

// GET /registro/verificar/:tenantId — verificar si un tenant existe
router.get('/verificar/:tenantId', (req, res) => {
  const { tenantId } = req.params
  const valid = /^[a-z0-9-]{3,30}$/.test(tenantId)
  res.json({ disponible: valid, tenantId })
})

export default router
