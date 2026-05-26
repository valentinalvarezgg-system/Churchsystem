import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.post('/bug-report', requireAuth, async (req, res) => {
  const { descripcion, url, userAgent } = req.body
  const { email, nombre, iglesia } = req.user

  console.log('━━━ BUG REPORT ━━━')
  console.log('Usuario:', nombre, '(', email, ')')
  console.log('Iglesia:', iglesia || 'N/A')
  console.log('URL:', url)
  console.log('User Agent:', userAgent)
  console.log('Descripción:', descripcion)
  console.log('━━━━━━━━━━━━━━━━━━')

  // TODO: enviar email a contacto@churchsystem.com.ar con nodemailer o Resend

  res.json({ ok: true })
})

export default router
