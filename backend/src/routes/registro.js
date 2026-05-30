import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import logger from '../lib/logger.js'
import { pgExec, pgOne } from '../lib/pg.js'
import { getPlanPrice, normalizeCountry, normalizeLanguage, normalizePlan, PLANES } from '../lib/billing.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado')
  return process.env.JWT_SECRET
}

function tenantSlug(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'iglesia'
}

function randomToken() {
  return `IGL-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
}

async function ensureRoleId(codigo = 'PASTOR_GENERAL') {
  const row = await pgOne(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`,
    [codigo, codigo.replace(/_/g, ' ')]
  )
  return row.id
}

router.post('/crear', async (req, res) => {
  const {
    nombreIglesia, nombre, email, password,
    telefono = '', plan = 'CONSOLIDACION',
    country = 'AR', pais = country, currency = '', divisa = currency,
    lang = '', idioma = lang, promo = '',
  } = req.body || {}

  if (!nombreIglesia?.trim()) return res.status(400).json({ error: 'Nombre de iglesia requerido' })
  if (!email?.trim()) return res.status(400).json({ error: 'Email requerido' })
  if (!password || password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })

  const tenantId = tenantSlug(nombreIglesia)

  try {
    const exists = await pgOne('SELECT id FROM "User" WHERE lower("email")=lower($1) LIMIT 1', [email.trim().toLowerCase()])
    if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' })

    const countryInfo = normalizeCountry(pais)
    const selectedIdioma = normalizeLanguage(idioma, countryInfo)
    const selectedPlanKey = normalizePlan(plan)
    const selectedDivisa = String(divisa || countryInfo.currency || 'USD').toUpperCase()
    const price = getPlanPrice(selectedPlanKey, selectedDivisa)
    const planInfo = PLANES[selectedPlanKey]
    const promoCode = promo
      ? await pgOne('SELECT * FROM "promo_codes" WHERE "code"=$1 LIMIT 1', [String(promo).toUpperCase()])
      : null

    const iglesia = await pgOne(
      'INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id, token',
      [nombreIglesia.trim(), randomToken()]
    )

    const roleId = await ensureRoleId('PASTOR_GENERAL')
    const hash = await bcrypt.hash(password, 10)
    const created = await pgOne(
      `INSERT INTO "User"
        ("email","password","nombre","apellido","activo","emailVerificado","iglesiaId","rolId","createdAt","updatedAt",
         "rol","plan","pais","divisa","idioma","telefono","iglesia","promoCode","promoDescuento","promoMeses","promoUsadoAt")
       VALUES
        ($1,$2,$3,'',true,false,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
         'PASTOR_GENERAL',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING "id","email","nombre","rol","iglesiaId","plan","pais","divisa","idioma"`,
      [
        email.trim().toLowerCase(),
        hash,
        nombre?.trim() || 'Pastor',
        iglesia.id,
        roleId,
        selectedPlanKey,
        countryInfo.code,
        price.currency,
        selectedIdioma,
        telefono.trim(),
        nombreIglesia.trim(),
        promoCode?.code || '',
        Number(promoCode?.descuento_porcentaje || 0),
        Number(promoCode?.duracion_meses || 0),
        promoCode ? new Date().toISOString() : null,
      ]
    )

    if (promoCode?.id) {
      const usos = Number(promoCode.usos || 0) + 1
      const maxUsos = Number(promoCode.max_usos ?? 1)
      await pgExec('UPDATE "promo_codes" SET "usos"=$1, "usado"=$2 WHERE "id"=$3', [usos, maxUsos > 0 && usos >= maxUsos ? 1 : 0, promoCode.id])
    }

    const token = jwt.sign(
      {
        id: created.id,
        email: created.email,
        rol: created.rol,
        nombre: created.nombre,
        iglesiaId: created.iglesiaId,
        plan: created.plan,
        pais: created.pais,
        divisa: created.divisa,
        idioma: created.idioma,
      },
      SECRET(),
      { expiresIn: '30d' }
    )

    const appUrl = `https://${tenantId}.churchsystem.com.ar/app`
    logger.info({ tenantId, nombreIglesia, plan: selectedPlanKey }, 'Nueva iglesia registrada')

    await sendNotificationEmail({
      to: created.email,
      subject: 'Registro exitoso - Church System',
      title: 'Tu iglesia fue creada',
      intro: `Hola ${created.nombre}, ${nombreIglesia.trim()} ya tiene su espacio en Church System.`,
      lines: [
        `Plan: ${planInfo.label[selectedIdioma] || planInfo.label.es}`,
        `Pais y divisa: ${countryInfo.code} / ${price.currency}`,
        promoCode ? `Invitacion aplicada: ${promoCode.code} (${promoCode.descuento_porcentaje}% OFF por ${promoCode.duracion_meses} meses)` : '',
      ],
      actionUrl: appUrl,
      actionLabel: 'Abrir panel',
    }).catch(() => {})

    return res.json({
      ok: true,
      tenantId,
      token,
      user: created,
      appUrl,
      trial: {
        inicio: new Date().toISOString().slice(0, 10),
        fin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dias: 14,
      },
      billing: { country: countryInfo.code, currency: price.currency, price: price.amount, promo: promoCode?.code || null },
      iglesiaToken: iglesia.token,
    })
  } catch (err) {
    logger.error({ err: err.message, tenantId }, 'Registro error')
    return res.status(500).json({ error: `Error al crear la cuenta: ${err.message}` })
  }
})

router.get('/verificar/:tenantId', async (req, res) => {
  const { tenantId } = req.params
  const valid = /^[a-z0-9-]{3,30}$/.test(tenantId)
  if (!valid) return res.json({ disponible: false, tenantId })

  const exists = await pgOne('SELECT id FROM "Iglesia" WHERE lower("nombre")=lower($1) LIMIT 1', [tenantId])
  res.json({ disponible: !exists, tenantId })
})

export default router

