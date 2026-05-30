import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pgExec, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function genCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function countMaybe(query, params = []) {
  try {
    const row = await pgOne(query, params)
    return Number(row?.c || 0)
  } catch {
    return 0
  }
}

router.get('/', requireAuth, wrap(async (req, res) => {
  const user = await pgOne(
    'SELECT "id","email","nombre","rol","cultoDia","cultoTurno","createdAt" FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1',
    [req.user.id]
  )
  if (!user) return res.status(404).json({ error: 'No encontrado' })

  const iglesiaId = req.user.iglesiaId
  const [totalPersonas, totalSeguimientos, totalMensajes] = await Promise.all([
    countMaybe('SELECT COUNT(*)::int as c FROM "Persona" WHERE "iglesiaId"=$1 AND "asignadoAUserId"=$2 AND "deletedAt" IS NULL', [iglesiaId, req.user.id]),
    countMaybe('SELECT COUNT(*)::int as c FROM "Seguimiento" WHERE "iglesiaId"=$1 AND "userId"=$2 AND "deletedAt" IS NULL', [iglesiaId, req.user.id]),
    countMaybe('SELECT COUNT(*)::int as c FROM "Mensaje" WHERE "iglesiaId"=$1 AND "userId"=$2', [iglesiaId, req.user.id]),
  ])

  return res.json({ ...user, stats: { totalPersonas, totalSeguimientos, totalMensajes } })
}))

router.put('/', requireAuth, wrap(async (req, res) => {
  const { nombre, passwordActual, passwordNuevo, codigo } = req.body || {}
  const user = await pgOne('SELECT * FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1', [req.user.id])
  if (!user) return res.status(404).json({ error: 'No encontrado' })

  if (passwordNuevo) {
    if (!passwordActual) return res.status(400).json({ error: 'Ingresá tu contraseña actual' })
    if (!(await bcrypt.compare(passwordActual, user.password))) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }
    if (String(passwordNuevo).length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' })
    }

    if (!codigo) {
      const code = genCodigo()
      const pendingHash = await bcrypt.hash(passwordNuevo, 10)
      const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await pgExec(
        'UPDATE "User" SET "nombre"=$1, "codigoVerif"=$2, "codigoExpira"=$3, "codigoContexto"=$4, "pendingPassword"=$5, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$6',
        [nombre || user.nombre, code, expira, 'PASSWORD_CHANGE', pendingHash, req.user.id]
      )

      await sendNotificationEmail({
        to: user.email,
        subject: 'Codigo para cambio de password - Church System',
        title: 'Confirmar cambio de password',
        intro: 'Recibimos una solicitud para cambiar tu password.',
        lines: [
          `Codigo: ${code}`,
          'Expira en 10 minutos.',
          'Si no fuiste vos, cambia tu password y avisa a seguridad@churchsystem.com.ar.',
        ],
      }).catch(() => {})

      return res.json({ ok: true, requiresCode: true, mensaje: 'Te enviamos un codigo de 6 digitos.' })
    }

    if (user.codigoContexto !== 'PASSWORD_CHANGE') {
      return res.status(400).json({ error: 'Primero solicitá el código de confirmación.' })
    }
    if (!user.codigoExpira || new Date(user.codigoExpira) < new Date()) {
      return res.status(400).json({ error: 'El código expiró.' })
    }
    if (String(user.codigoVerif || '') !== String(codigo).trim()) {
      return res.status(400).json({ error: 'Código incorrecto.' })
    }
    if (!user.pendingPassword) {
      return res.status(400).json({ error: 'No hay cambio de contraseña pendiente.' })
    }

    await pgExec(
      'UPDATE "User" SET "nombre"=$1, "password"=$2, "codigoVerif"=NULL, "codigoExpira"=NULL, "codigoContexto"=NULL, "pendingPassword"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$3',
      [nombre || user.nombre, user.pendingPassword, req.user.id]
    )

    await sendNotificationEmail({
      to: user.email,
      subject: 'Password actualizado - Church System',
      title: 'Tu password fue actualizado',
      intro: 'Este aviso confirma un cambio de password en tu cuenta.',
      lines: ['Si no reconoces esta accion, contacta a seguridad@churchsystem.com.ar.'],
    }).catch(() => {})

    return res.json({ ok: true })
  }

  await pgExec(
    'UPDATE "User" SET "nombre"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2',
    [nombre || user.nombre, req.user.id]
  )
  return res.json({ ok: true })
}))

// Apple App Store guideline 5.1.1 — account deletion required in-app
router.delete('/cuenta', requireAuth, wrap(async (req, res) => {
  const userId = req.user.id
  const { password } = req.body || {}
  if (!password) return res.status(400).json({ error: 'Ingresá tu contraseña para confirmar.' })

  const user = await pgOne('SELECT "password" FROM "User" WHERE "id"=$1 AND "deletedAt" IS NULL', [userId])
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta.' })

  await pgExec(
    'UPDATE "User" SET "deletedAt"=CURRENT_TIMESTAMP, "activo"=false, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
    [userId]
  )

  await sendNotificationEmail({
    to: req.user.email,
    subject: 'Cuenta eliminada — Church System',
    title: 'Tu cuenta fue eliminada',
    intro: 'Tus datos serán eliminados en los próximos 30 días.',
    lines: ['Si fue un error, contactá a soporte@churchsystem.com.ar dentro de 48 horas.'],
  }).catch(() => {})

  return res.json({ ok: true })
}))

export default router
