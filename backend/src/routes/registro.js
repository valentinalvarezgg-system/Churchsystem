import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import logger from '../lib/logger.js'
import { pgExec, pgOne } from '../lib/pg.js'
import { getPlanPrice, normalizeCountry, normalizeLanguage, normalizePlan, PLANES } from '../lib/billing.js'
import { sendNotificationEmail, sendSystemEmail, buildSystemEmail } from '../lib/email.js'
import { issueSession } from '../lib/sessions.js'

const router = Router()

function tenantSlug(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
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

async function issueVerificationCode(userId, email, nombre = '') {
  const codigo = Math.floor(100000 + Math.random() * 900000).toString()
  const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await pgExec(
    'UPDATE "User" SET "codigoVerif"=$1, "codigoExpira"=$2, "codigoContexto"=$3, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4',
    [codigo, expira, 'EMAIL_VERIFY', userId]
  )
  const envio = await sendSystemEmail({
    to: email,
    subject: 'Verificá tu cuenta - Church System',
    html: buildSystemEmail({
      title: 'Código de verificación',
      intro: `Hola ${nombre || 'Pastor'}, este es tu código de verificación:`,
      lines: [`Código: ${codigo}`, 'Expira en 15 minutos.'],
    }),
    text: `Tu código de verificación es ${codigo}. Expira en 15 minutos.`,
  })
  return { envio, codigo }
}

// ── Handler exportado para que /auth/registro lo use como alias deprecado ─────
export async function crearCuentaHandler(req, res) {
  const {
    nombreIglesia, nombre, email, password,
    telefono = '', plan = 'CONSOLIDACION',
    country = 'AR', pais = country, currency = '', divisa = currency,
    lang = '', idioma = lang, promo = '',
    iglesiaToken = '',   // soporte para unirse a iglesia existente
  } = req.body || {}

  if (!nombreIglesia?.trim() && !iglesiaToken?.trim()) {
    return res.status(400).json({ error: 'Nombre de iglesia requerido' })
  }
  if (!email?.trim()) return res.status(400).json({ error: 'Email requerido' })
  if (!password || password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })

  const tenantId = tenantSlug(nombreIglesia || nombre || 'iglesia')

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

    // ── Resolver iglesia ──────────────────────────────────────────────────────
    let iglesiaId
    let iglesiaTokenOut
    let iglesiaCreada = false

    if (iglesiaToken?.trim()) {
      const found = await pgOne(
        'SELECT id, token FROM "Iglesia" WHERE "token"=$1 LIMIT 1',
        [String(iglesiaToken).trim().toUpperCase()]
      )
      if (!found) return res.status(400).json({ error: 'Token de iglesia inválido' })
      iglesiaId = found.id
      iglesiaTokenOut = found.token
    } else {
      const iglesia = await pgOne(
        'INSERT INTO "Iglesia" ("nombre","token","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id, token',
        [nombreIglesia.trim(), randomToken()]
      )
      iglesiaId = iglesia.id
      iglesiaTokenOut = iglesia.token
      iglesiaCreada = true
    }

    const roleId = await ensureRoleId('PASTOR_GENERAL')
    const hashPwd = await bcrypt.hash(password, 10)
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
        hashPwd,
        nombre?.trim() || 'Pastor',
        iglesiaId,
        roleId,
        selectedPlanKey,
        countryInfo.code,
        price.currency,
        selectedIdioma,
        String(telefono || '').trim(),
        (iglesiaCreada ? nombreIglesia?.trim() : '') || '',
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

    // Emitir sesión con refresh token revocable
    const session = await issueSession(created, req, res)

    const appUrl = `https://${tenantId}.churchsystem.com.ar/app`
    logger.info({ tenantId, iglesiaCreada, plan: selectedPlanKey }, 'Nueva cuenta registrada')

    await sendNotificationEmail({
      to: created.email,
      subject: 'Registro exitoso - Church System',
      title: iglesiaCreada ? 'Tu iglesia fue creada' : 'Cuenta creada en Church System',
      intro: `Hola ${created.nombre}, ${iglesiaCreada ? (nombreIglesia?.trim() + ' ya tiene su espacio en Church System.') : 'tu cuenta fue creada correctamente.'}`,
      lines: [
        `Plan: ${planInfo?.label?.[selectedIdioma] || planInfo?.label?.es || selectedPlanKey}`,
        `Pais y divisa: ${countryInfo.code} / ${price.currency}`,
        promoCode ? `Invitacion aplicada: ${promoCode.code} (${promoCode.descuento_porcentaje}% OFF por ${promoCode.duracion_meses} meses)` : '',
        iglesiaToken ? 'Te uniste mediante token de iglesia.' : '',
      ],
      actionUrl: appUrl,
      actionLabel: 'Abrir panel',
    }).catch(() => {})

    const verify = await issueVerificationCode(created.id, created.email, created.nombre)
      .catch(err => ({ envio: { error: true, message: err?.message || 'verify_send_failed' } }))

    const response = {
      ok: true,
      tenantId,
      token: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      user: session.user,
      appUrl,
      trial: {
        inicio: new Date().toISOString().slice(0, 10),
        fin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        dias: 14,
      },
      billing: { country: countryInfo.code, currency: price.currency, price: price.amount, promo: promoCode?.code || null },
      iglesiaToken: iglesiaTokenOut,
    }
    if (verify?.envio?.error && process.env.NODE_ENV !== 'production') {
      response.codigoVerificacionDev = verify.codigo
      response.aviso = 'No se pudo enviar email de verificación en entorno local'
    }
    return res.json(response)
  } catch (err) {
    logger.error({ err: err.message, tenantId }, 'Registro error')
    return res.status(500).json({ error: `Error al crear la cuenta: ${err.message}` })
  }
}

router.post('/crear', crearCuentaHandler)

router.get('/verificar/:tenantId', async (req, res) => {
  const { tenantId } = req.params
  const valid = /^[a-z0-9-]{3,30}$/.test(tenantId)
  if (!valid) return res.json({ disponible: false, tenantId })

  const exists = await pgOne('SELECT id FROM "Iglesia" WHERE lower("nombre")=lower($1) LIMIT 1', [tenantId])
  res.json({ disponible: !exists, tenantId })
})

export default router
