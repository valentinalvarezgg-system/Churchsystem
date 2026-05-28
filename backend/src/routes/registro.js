/**
 * registro.js — Ruta pública para crear nuevas iglesias (tenants)
 * POST /registro/crear → crea la DB del tenant + usuario admin + retorna JWT
 */
import { Router }  from 'express'
import bcrypt      from 'bcryptjs'
import jwt         from 'jsonwebtoken'
import { getTenantDb, getTenantId } from '../middlewares/tenant.js'
import mainDb      from '../lib/db.js'
import { getPlanPrice, normalizeCountry, normalizeLanguage, normalizePlan, PLANES } from '../lib/billing.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()

// POST /registro/crear
router.post('/crear', async (req, res) => {
  const {
    nombreIglesia, nombre, email, password,
    telefono = '', ciudad = '', plan = 'CONSOLIDACION',
    country = 'AR', pais = country, currency = '', divisa = currency,
    lang = '', idioma = lang, promo = '',
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

    const countryInfo = normalizeCountry(pais)
    const selectedIdioma = normalizeLanguage(idioma, countryInfo)
    const selectedPlanKey = normalizePlan(plan)
    const selectedDivisa = String(divisa || countryInfo.currency || 'USD').toUpperCase()
    const price = getPlanPrice(selectedPlanKey, selectedDivisa)
    const planInfo = PLANES[selectedPlanKey]
    const promoCode = promo
      ? mainDb.get('SELECT * FROM promo_codes WHERE code=?', [String(promo).toUpperCase()])
      : null

    // Crear el usuario admin
    const hash = await bcrypt.hash(password, 10)
    db.run(
      `INSERT INTO users (nombre, email, password, rol, activo, plan, pais, divisa, idioma, promoCode, promoDescuento, promoMeses)
       VALUES (?, ?, ?, 'PASTOR_GENERAL', 1, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre?.trim() || 'Pastor',
        email.trim().toLowerCase(),
        hash,
        selectedPlanKey,
        countryInfo.code,
        price.currency,
        selectedIdioma,
        promoCode?.code || '',
        Number(promoCode?.descuento_porcentaje || 0),
        Number(promoCode?.duracion_meses || 0),
      ]
    )
    const userId = db.get('SELECT last_insert_rowid() as id')?.id

    // Configurar la iglesia
    const config = {
      nombre_iglesia:   nombreIglesia.trim(),
      plan:             selectedPlanKey,
      plan_label:       planInfo.label[selectedIdioma] || planInfo.label.es,
      plan_personas_max: String(planInfo.personas),
      pais:             countryInfo.code,
      divisa:           price.currency,
      idioma:           selectedIdioma,
      precio_mensual:   String(price.amount),
      promoCode:        promoCode?.code || '',
      promoDescuento:   String(Number(promoCode?.descuento_porcentaje || 0)),
      promoMeses:       String(Number(promoCode?.duracion_meses || 0)),
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
    if (promoCode?.id) {
      const usos = Number(promoCode.usos || 0) + 1
      const maxUsos = Number(promoCode.max_usos ?? 1)
      mainDb.run('UPDATE promo_codes SET usos=?, usado=? WHERE id=?', [usos, maxUsos > 0 && usos >= maxUsos ? 1 : 0, promoCode.id])
    }

    // Generar JWT
    const token = jwt.sign(
      { id: userId, email: email.trim().toLowerCase(), rol: 'PASTOR_GENERAL', tenantId },
      process.env.JWT_SECRET || 'church-secret',
      { expiresIn: '30d' }
    )

    const appUrl = `https://${tenantId}.churchsystem.com.ar/app`

    console.log(`🏢  Nueva iglesia registrada: ${nombreIglesia} (${tenantId}) — plan: ${selectedPlanKey}`)

    await sendNotificationEmail({
      to: email.trim().toLowerCase(),
      subject: 'Registro exitoso - Church System',
      title: 'Tu iglesia fue creada',
      intro: `Hola ${nombre?.trim() || 'Pastor'}, ${nombreIglesia.trim()} ya tiene su espacio en Church System.`,
      lines: [
        `Plan: ${planInfo.label[selectedIdioma] || planInfo.label.es}`,
        `Pais y divisa: ${countryInfo.code} / ${price.currency}`,
        promoCode ? `Invitacion aplicada: ${promoCode.code} (${promoCode.descuento_porcentaje}% OFF por ${promoCode.duracion_meses} meses)` : '',
      ],
      actionUrl: appUrl,
      actionLabel: 'Abrir panel',
    }).catch(() => {})

    res.json({
      ok: true,
      tenantId,
      token,
      user: { id: userId, nombre: nombre?.trim() || 'Pastor', email, rol: 'PASTOR_GENERAL' },
      appUrl,
      trial: { inicio: config.trial_inicio, fin: config.trial_fin, dias: 14 },
      billing: { country: countryInfo.code, currency: price.currency, price: price.amount, promo: promoCode?.code || null },
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
