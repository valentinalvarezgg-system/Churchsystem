import { Router } from 'express'
import { pgExec, pgOne } from '../lib/pg.js'
import { buildSystemEmail, sendNotificationEmail, sendSystemEmail } from '../lib/email.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function genCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function getUserByEmail(email = '') {
  return pgOne(
    'SELECT * FROM "User" WHERE lower("email")=lower($1) AND "deletedAt" IS NULL LIMIT 1',
    [String(email || '').trim().toLowerCase()]
  )
}

async function setVerificationCode(email, codigo, expira) {
  await pgExec(
    'UPDATE "User" SET "codigoVerif"=$1, "codigoExpira"=$2, "updatedAt"=CURRENT_TIMESTAMP WHERE lower("email")=lower($3)',
    [codigo, expira, String(email || '').trim().toLowerCase()]
  )
}

router.post('/enviar', wrap(async (req, res) => {
  const { email, nombre } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  const user = await getUserByEmail(email)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.emailVerificado) return res.json({ ok: true, yaVerificado: true })

  const codigo = genCodigo()
  const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await setVerificationCode(email, codigo, expira)

  try {
    await sendSystemEmail({
      to: email,
      subject: 'Tu codigo de verificacion - Church System',
      html: buildSystemEmail({
        title: 'Codigo de verificacion',
        intro: `Hola ${nombre || user.nombre || 'Usuario'}, usa este codigo para verificar tu cuenta.`,
        lines: [`Codigo: ${codigo}`, 'Expira en 15 minutos.'],
      }),
      text: `Codigo de verificacion: ${codigo}`,
    })
    return res.json({ ok: true, mensaje: `Codigo enviado a ${email}` })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ ok: true, mensaje: 'Dev mode', codigoDev: codigo })
    }
    return res.status(500).json({ error: 'No se pudo enviar el email' })
  }
}))

router.post('/verificar', wrap(async (req, res) => {
  const { email, codigo } = req.body || {}
  if (!email || !codigo) return res.status(400).json({ error: 'Email y código requeridos' })

  const user = await getUserByEmail(email)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.emailVerificado) return res.json({ ok: true, yaVerificado: true })
  if (!user.codigoExpira || new Date(user.codigoExpira) < new Date()) {
    return res.status(400).json({ error: 'El código expiró.' })
  }
  if (String(user.codigoVerif || '') !== String(codigo).trim()) {
    return res.status(400).json({ error: 'Código incorrecto.' })
  }

  await pgExec(
    'UPDATE "User" SET "emailVerificado"=true, "codigoVerif"=NULL, "codigoExpira"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE lower("email")=lower($1)',
    [String(email).trim().toLowerCase()]
  )

  await sendNotificationEmail({
    to: email,
    subject: 'Cuenta verificada - Church System',
    title: 'Cuenta verificada',
    intro: 'Bienvenido a Church System. Ya podes ingresar.',
    actionUrl: `${process.env.FRONTEND_URL || process.env.BASE_URL || 'https://churchsystem.com.ar'}/app/login`,
    actionLabel: 'Ingresar',
  }).catch(() => {})

  return res.json({ ok: true, mensaje: 'Cuenta verificada correctamente.' })
}))

router.post('/reenviar', wrap(async (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  const user = await getUserByEmail(email)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.emailVerificado) return res.json({ ok: true, yaVerificado: true })

  const codigo = genCodigo()
  const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await setVerificationCode(email, codigo, expira)

  try {
    await sendSystemEmail({
      to: email,
      subject: 'Tu nuevo codigo - Church System',
      html: buildSystemEmail({
        title: 'Nuevo codigo',
        intro: 'Usa este codigo para completar la verificacion.',
        lines: [`Codigo: ${codigo}`, 'Expira en 15 minutos.'],
      }),
      text: `Nuevo codigo: ${codigo}`,
    })
    return res.json({ ok: true, mensaje: 'Nuevo código enviado.' })
  } catch {
    if (process.env.NODE_ENV !== 'production') return res.json({ ok: true, codigoDev: codigo })
    return res.status(500).json({ error: 'No se pudo enviar' })
  }
}))

export default router
