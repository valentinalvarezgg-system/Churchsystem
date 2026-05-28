import { Router } from 'express'
import { Resend } from 'resend'
import db from '../lib/db.js'

const router = Router()
let resend = null
try { resend = new Resend(process.env.RESEND_API_KEY) } catch(_) {}
const FROM = process.env.EMAIL_FROM || 'Church System <no-reply@churchsystem.com.ar>'

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
    await resend.emails.send({ from:FROM, to:email, subject:'Tu código de verificación — Church System',
      html:`<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px;background:#1E293B;border-radius:16px;color:#CBD5E1;text-align:center;"><h2 style="color:#F1F5F9;">Código de verificación</h2><p>Hola ${nombre||user.nombre||'Usuario'},</p><div style="font-size:36px;letter-spacing:12px;font-weight:800;color:#6B5CFF;background:#0F172A;padding:20px;border-radius:12px;margin:20px 0;">${codigo}</div><p style="font-size:13px;color:#64748B;">Expira en 15 minutos.</p></div>` })
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
    await resend.emails.send({ from:FROM, to:email, subject:'¡Cuenta verificada! — Church System',
      html:`<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px;background:#1E293B;border-radius:16px;color:#CBD5E1;text-align:center;"><h2 style="color:#22c55e;">✓ Cuenta verificada</h2><p>Bienvenido a Church System. Ya podés ingresar.</p><a href="https://churchsystem.com.ar/app/login" style="display:inline-block;background:#6B5CFF;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px;">Ingresar →</a></div>` })
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
    await resend.emails.send({ from:FROM, to:email, subject:'Tu nuevo código — Church System',
      html:`<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px;background:#1E293B;border-radius:16px;color:#CBD5E1;text-align:center;"><h2 style="color:#F1F5F9;">Nuevo código</h2><div style="font-size:36px;letter-spacing:12px;font-weight:800;color:#6B5CFF;background:#0F172A;padding:20px;border-radius:12px;margin:20px 0;">${codigo}</div></div>` })
    res.json({ ok:true, mensaje:'Nuevo código enviado.' })
  } catch(e) {
    if (process.env.NODE_ENV !== 'production') return res.json({ ok:true, codigoDev:codigo })
    res.status(500).json({ error:'No se pudo enviar' })
  }
})

export default router
