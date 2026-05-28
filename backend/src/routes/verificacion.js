import { Router } from 'express'
import db from '../lib/db.js'
import { buildSystemEmail, sendNotificationEmail, sendSystemEmail } from '../lib/email.js'

const router = Router()

function genCodigo() { return Math.floor(100000 + Math.random() * 900000).toString() }

router.post('/enviar', async (req, res) => {
  const { email, nombre } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })
  const user = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.emailVerificado) return res.json({ ok:true, yaVerificado:true })
  const codigo = genCodigo()
  const expira = new Date(Date.now()+15*60*1000).toISOString()
  db.run('UPDATE users SET codigoVerif=?, codigoExpira=? WHERE email=?', [codigo, expira, email.toLowerCase()])
  try {
    await sendSystemEmail({
      to: email,
      subject:'Tu codigo de verificacion - Church System',
      html: buildSystemEmail({
        title:'Codigo de verificacion',
        intro:`Hola ${nombre || user.nombre || 'Usuario'}, usa este codigo para verificar tu cuenta.`,
        lines:[`Codigo: ${codigo}`, 'Expira en 15 minutos.'],
      }),
      text:`Codigo de verificacion: ${codigo}`,
    })
    res.json({ ok:true, mensaje:`Código enviado a ${email}` })
  } catch(e) {
    if (process.env.NODE_ENV !== 'production') return res.json({ ok:true, mensaje:'Dev mode', codigoDev:codigo })
    res.status(500).json({ error: 'No se pudo enviar el email' })
  }
})

router.post('/verificar', async (req, res) => {
  const { email, codigo } = req.body
  if (!email || !codigo) return res.status(400).json({ error: 'Email y código requeridos' })
  const user = db.get('SELECT * FROM users WHERE email=?', [email.toLowerCase()])
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.emailVerificado) return res.json({ ok:true, yaVerificado:true })
  if (!user.codigoExpira || new Date(user.codigoExpira) < new Date())
    return res.status(400).json({ error: 'El código expiró.' })
  if (user.codigoVerif !== codigo.trim())
    return res.status(400).json({ error: 'Código incorrecto.' })
  db.run('UPDATE users SET emailVerificado=1, codigoVerif=NULL, codigoExpira=NULL WHERE email=?', [email.toLowerCase()])
  try {
    await sendNotificationEmail({
      to: email,
      subject:'Cuenta verificada - Church System',
      title:'Cuenta verificada',
      intro:'Bienvenido a Church System. Ya podes ingresar.',
      actionUrl:`${process.env.FRONTEND_URL || process.env.BASE_URL || 'https://churchsystem.com.ar'}/app/login`,
      actionLabel:'Ingresar',
    })
  } catch(e) {}
  res.json({ ok:true, mensaje:'¡Cuenta verificada!' })
})

router.post('/reenviar', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })
  const user = db.get('SELECT * FROM users WHERE email=?', [email.toLowerCase()])
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.emailVerificado) return res.json({ ok:true, yaVerificado:true })
  const codigo = genCodigo()
  const expira = new Date(Date.now()+15*60*1000).toISOString()
  db.run('UPDATE users SET codigoVerif=?, codigoExpira=? WHERE email=?', [codigo, expira, email.toLowerCase()])
  try {
    await sendSystemEmail({
      to: email,
      subject:'Tu nuevo codigo - Church System',
      html: buildSystemEmail({
        title:'Nuevo codigo',
        intro:'Usa este codigo para completar la verificacion.',
        lines:[`Codigo: ${codigo}`, 'Expira en 15 minutos.'],
      }),
      text:`Nuevo codigo: ${codigo}`,
    })
    res.json({ ok:true, mensaje:'Nuevo código enviado.' })
  } catch(e) {
    if (process.env.NODE_ENV !== 'production') return res.json({ ok:true, codigoDev:codigo })
    res.status(500).json({ error:'No se pudo enviar' })
  }
})

export default router
