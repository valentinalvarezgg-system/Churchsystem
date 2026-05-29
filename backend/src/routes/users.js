import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth, requireRol } from '../middlewares/auth.js'
import { registrar } from '../utils/auditoria.js'
import { sendNotificationEmail } from '../lib/email.js'

const router = Router()
const ADMIN = requireRol('PASTOR_GENERAL')

async function ensureRoleId(codigo = 'LIDER') {
  const normalized = String(codigo || 'LIDER').toUpperCase()
  const row = await pgOne(
    `INSERT INTO "Rol" ("codigo","nombre","createdAt","updatedAt")
     VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("codigo") DO UPDATE SET "updatedAt"=CURRENT_TIMESTAMP
     RETURNING id`,
    [normalized, normalized.replace(/_/g, ' ')]
  )
  return row.id
}

router.get('/', requireAuth, ADMIN, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const rows = await pgMany(
    'SELECT "id","email","nombre","rol","cultoDia","cultoTurno","activo","createdAt" FROM "User" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL ORDER BY "id" DESC',
    [req.user.iglesiaId]
  )
  res.json(rows)
})

router.post('/', requireAuth, ADMIN, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const { email, password, nombre = '', rol = 'LIDER', cultoDia = '', cultoTurno = 0 } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  const exists = await pgOne(
    'SELECT id FROM "User" WHERE lower("email")=lower($1) AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [email.toLowerCase(), req.user.iglesiaId]
  )
  if (exists) return res.status(409).json({ error: 'Email ya registrado' })

  const hash = await bcrypt.hash(password, 10)
  const roleId = await ensureRoleId(rol)
  const created = await pgOne(
    `INSERT INTO "User"
      ("email","password","nombre","apellido","activo","emailVerificado","iglesiaId","rolId","createdAt","updatedAt","rol","cultoDia","cultoTurno","plan","pais","divisa","idioma")
     VALUES
      ($1,$2,$3,'',true,false,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$6,$7,$8,'GENERAL','AR','ARS','es')
     RETURNING "id","email"`,
    [email.toLowerCase(), hash, nombre, req.user.iglesiaId, roleId, rol, cultoDia, Number(cultoTurno)]
  )

  registrar({ userId: req.user.id, email: req.user.email, rol: req.user.rol, accion: 'CREAR', entidad: 'USER', entidadId: created.id, detalle: email, iglesiaId: req.user.iglesiaId })
  await sendNotificationEmail({
    to: created.email,
    subject: 'Usuario creado - Church System',
    title: 'Tu usuario fue creado',
    intro: `${req.user.email} creó un usuario para vos en Church System.`,
    lines: [`Rol: ${rol}`],
  }).catch(() => {})
  res.status(201).json({ ok: true, id: created.id })
})

router.put('/:id', requireAuth, ADMIN, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  const u = await pgOne(
    'SELECT * FROM "User" WHERE "id"=$1 AND "iglesiaId"=$2 AND "deletedAt" IS NULL LIMIT 1',
    [Number(req.params.id), req.user.iglesiaId]
  )
  if (!u) return res.status(404).json({ error: 'No encontrado' })

  const { nombre, rol, cultoDia, cultoTurno, activo, password } = req.body || {}
  const roleId = await ensureRoleId(rol || u.rol || 'LIDER')
  const hash = password ? await bcrypt.hash(password, 10) : u.password

  await pgExec(
    `UPDATE "User"
     SET "nombre"=$1, "rol"=$2, "rolId"=$3, "cultoDia"=$4, "cultoTurno"=$5, "activo"=$6, "password"=$7, "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$8 AND "iglesiaId"=$9`,
    [
      nombre ?? u.nombre,
      rol ?? u.rol,
      roleId,
      cultoDia ?? u.cultoDia ?? '',
      Number(cultoTurno ?? u.cultoTurno ?? 0),
      activo != null ? !!activo : !!u.activo,
      hash,
      Number(req.params.id),
      req.user.iglesiaId,
    ]
  )

  if (password) {
    await sendNotificationEmail({
      to: u.email,
      subject: 'Password actualizado por administrador - Church System',
      title: 'Tu password fue actualizado',
      intro: `${req.user.email} actualizó tu password desde gestión de usuarios.`,
      lines: ['Si no reconocés esta acción, contactá a seguridad@churchsystem.com.ar.'],
    }).catch(() => {})
  }

  res.json({ ok: true })
})

router.delete('/:id', requireAuth, ADMIN, async (req, res) => {
  if (!req.user.iglesiaId) return res.status(400).json({ error: 'Tenant inválido' })
  if (Number(req.params.id) === Number(req.user.id)) return res.status(400).json({ error: 'No podés eliminarte' })

  await pgExec(
    'UPDATE "User" SET "activo"=false, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "iglesiaId"=$2',
    [Number(req.params.id), req.user.iglesiaId]
  )
  res.json({ ok: true })
})

export default router
