import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../lib/db.js'
import { requireAuth } from '../middlewares/auth.js'
import { sendNotificationEmail } from '../lib/email.js'
const router = Router()
function genCodigo() { return Math.floor(100000 + Math.random() * 900000).toString() }
router.get('/', requireAuth, (req, res) => {
  const u=db.get('SELECT id,email,nombre,rol,cultoDia,cultoTurno,createdAt FROM users WHERE id=?',[req.user.id])
  if (!u) return res.status(404).json({ error:'No encontrado' })
  res.json({ ...u, stats:{ totalPersonas:Number(db.get('SELECT COUNT(*) as c FROM personas WHERE asignadoA=?',[req.user.id])?.c??0), totalSeguimientos:Number(db.get('SELECT COUNT(*) as c FROM seguimientos WHERE userId=?',[req.user.id])?.c??0), totalMensajes:Number(db.get('SELECT COUNT(*) as c FROM mensajes WHERE userId=?',[req.user.id])?.c??0) } })
})
router.put('/', requireAuth, async (req, res) => {
  const { nombre,passwordActual,passwordNuevo,codigo } = req.body||{}
  const u=db.get('SELECT * FROM users WHERE id=?',[req.user.id])
  if (!u) return res.status(404).json({ error:'No encontrado' })
  if (passwordNuevo) {
    if (!passwordActual) return res.status(400).json({ error:'Ingresá tu contraseña actual' })
    if (!(await bcrypt.compare(passwordActual,u.password))) return res.status(401).json({ error:'Contraseña actual incorrecta' })

    if (!codigo) {
      const code = genCodigo()
      const pendingHash = await bcrypt.hash(passwordNuevo,10)
      const expira = new Date(Date.now()+10*60*1000).toISOString()
      db.run(
        "UPDATE users SET nombre=?, codigoVerif=?, codigoExpira=?, codigoContexto='PASSWORD_CHANGE', pendingPassword=? WHERE id=?",
        [nombre||u.nombre, code, expira, pendingHash, req.user.id]
      )
      await sendNotificationEmail({
        to:u.email,
        subject:'Codigo para cambio de password - Church System',
        title:'Confirmar cambio de password',
        intro:'Recibimos una solicitud para cambiar tu password.',
        lines:[`Codigo: ${code}`, 'Expira en 10 minutos.', 'Si no fuiste vos, cambia tu password y avisa a seguridad@churchsystem.com.ar.'],
      }).catch(() => {})
      return res.json({ ok:true, requiresCode:true, mensaje:'Te enviamos un codigo de 6 digitos.' })
    }

    if (u.codigoContexto !== 'PASSWORD_CHANGE')
      return res.status(400).json({ error:'Primero solicitá el código de confirmación.' })
    if (!u.codigoExpira || new Date(u.codigoExpira) < new Date())
      return res.status(400).json({ error:'El código expiró.' })
    if (String(u.codigoVerif || '') !== String(codigo).trim())
      return res.status(400).json({ error:'Código incorrecto.' })

    db.run(
      'UPDATE users SET nombre=?,password=?,codigoVerif=NULL,codigoExpira=NULL,codigoContexto=NULL,pendingPassword=NULL WHERE id=?',
      [nombre||u.nombre,u.pendingPassword,req.user.id]
    )
    await sendNotificationEmail({
      to:u.email,
      subject:'Password actualizado - Church System',
      title:'Tu password fue actualizado',
      intro:'Este aviso confirma un cambio de password en tu cuenta.',
      lines:['Si no reconoces esta accion, contacta a seguridad@churchsystem.com.ar.'],
    }).catch(() => {})
  } else {
    db.run('UPDATE users SET nombre=? WHERE id=?',[nombre||u.nombre,req.user.id])
  }
  res.json({ ok:true })
})
export default router
