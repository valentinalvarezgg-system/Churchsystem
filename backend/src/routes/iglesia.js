import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { pgExec, pgOne } from '../lib/pg.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function generarToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `IGL-${seg()}-${seg()}`
}

async function getCurrentUser(userId) {
  return pgOne(
    'SELECT "id","email","nombre","rol","plan","iglesiaId" FROM "User" WHERE "id"=$1 AND "activo"=true AND "deletedAt" IS NULL LIMIT 1',
    [userId]
  )
}

router.get('/token', requireAuth, wrap(async (req, res) => {
  const user = await getCurrentUser(req.user.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (!['PASTOR_GENERAL', 'CONSOLIDACION'].includes(user.rol)) {
    return res.status(403).json({ error: 'Solo el pastor general puede ver el token' })
  }
  if (!user.iglesiaId) return res.status(400).json({ error: 'Usuario sin iglesia asociada' })

  let iglesia = await pgOne('SELECT "id","nombre","token" FROM "Iglesia" WHERE "id"=$1 AND "deletedAt" IS NULL LIMIT 1', [user.iglesiaId])
  if (!iglesia) return res.status(404).json({ error: 'Iglesia no encontrada' })

  if (!iglesia.token) {
    const token = generarToken()
    await pgExec('UPDATE "Iglesia" SET "token"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2', [token, iglesia.id])
    iglesia = await pgOne('SELECT "id","nombre","token" FROM "Iglesia" WHERE "id"=$1 LIMIT 1', [iglesia.id])
  }

  const miembros = await pgOne(
    'SELECT COUNT(*)::int as c FROM "User" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL',
    [iglesia.id]
  )

  return res.json({
    token: iglesia.token,
    nombre: iglesia.nombre,
    plan: user.plan || 'GENERAL',
    miembros: Number(miembros?.c || 0),
  })
}))

router.post('/token/regenerar', requireAuth, wrap(async (req, res) => {
  const user = await getCurrentUser(req.user.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.rol !== 'PASTOR_GENERAL') return res.status(403).json({ error: 'Solo pastor general' })
  if (!user.iglesiaId) return res.status(400).json({ error: 'Usuario sin iglesia asociada' })

  const token = generarToken()
  await pgExec('UPDATE "Iglesia" SET "token"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2', [token, user.iglesiaId])

  await sendNotificationEmail({
    to: user.email,
    subject: 'Token de iglesia regenerado - Church System',
    title: 'Token de iglesia regenerado',
    intro: 'Se generó un nuevo token para invitar personas a tu iglesia.',
    lines: ['Los tokens anteriores quedan desactivados.', `Nuevo token: ${token}`],
  }).catch(() => {})

  return res.json({ token, mensaje: 'Token regenerado.' })
}))

router.post('/unirse', requireAuth, wrap(async (req, res) => {
  const { token } = req.body || {}
  if (!token?.trim()) return res.status(400).json({ error: 'Token requerido' })

  const user = await getCurrentUser(req.user.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  const iglesia = await pgOne(
    'SELECT "id","nombre","token" FROM "Iglesia" WHERE "token"=$1 AND "deletedAt" IS NULL LIMIT 1',
    [token.trim().toUpperCase()]
  )
  if (!iglesia) return res.status(404).json({ error: 'Token inválido.' })

  await pgExec(
    'UPDATE "User" SET "iglesiaId"=$1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2',
    [iglesia.id, req.user.id]
  )

  const admin = await pgOne(
    'SELECT "email","nombre" FROM "User" WHERE "iglesiaId"=$1 AND "rol"=$2 AND "deletedAt" IS NULL ORDER BY "id" ASC LIMIT 1',
    [iglesia.id, 'PASTOR_GENERAL']
  )

  await Promise.all([
    sendNotificationEmail({
      to: user.email,
      subject: 'Te uniste a una iglesia - Church System',
      title: 'Token de iglesia utilizado',
      intro: `Te uniste a ${iglesia.nombre}.`,
      lines: ['Este aviso confirma el uso de un token de iglesia.'],
    }).catch(() => {}),
    admin?.email
      ? sendNotificationEmail({
          to: admin.email,
          subject: 'Nuevo usuario unido por token - Church System',
          title: 'Token de iglesia utilizado',
          intro: `Un usuario se unió a ${iglesia.nombre}.`,
          lines: [`Usuario: ${user.email}`],
        }).catch(() => {})
      : null,
  ])

  return res.json({
    ok: true,
    iglesia: { id: iglesia.id, nombre: iglesia.nombre },
    plan: user.plan || 'GENERAL',
    mensaje: `Te uniste a ${iglesia.nombre}.`,
  })
}))

router.post('/validar-token', wrap(async (req, res) => {
  const { token } = req.body || {}
  if (!token?.trim()) return res.status(400).json({ error: 'Token requerido' })

  const iglesia = await pgOne(
    'SELECT "id","nombre" FROM "Iglesia" WHERE "token"=$1 AND "deletedAt" IS NULL LIMIT 1',
    [token.trim().toUpperCase()]
  )
  if (!iglesia) return res.status(404).json({ valido: false, error: 'Token no encontrado' })

  const planRef = await pgOne(
    'SELECT "plan" FROM "User" WHERE "iglesiaId"=$1 AND "rol"=$2 AND "deletedAt" IS NULL ORDER BY "id" ASC LIMIT 1',
    [iglesia.id, 'PASTOR_GENERAL']
  )

  return res.json({ valido: true, iglesia: iglesia.nombre, plan: planRef?.plan || 'GENERAL' })
}))

export default router
