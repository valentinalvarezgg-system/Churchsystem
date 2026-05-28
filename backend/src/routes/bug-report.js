import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { Resend } from 'resend'

const router = Router()
let resend = null
try { resend = new Resend(process.env.RESEND_API_KEY) } catch(_) {}

router.post('/bug-report', requireAuth, async (req, res) => {
  const { descripcion, url, userAgent } = req.body
  const { email, nombre, iglesia } = req.user

  if (!process.env.RESEND_API_KEY) {
    return res.json({ ok: true, warning: 'Email no configurado' })
  }

  try {
    await resend.emails.send({
      from: 'Church System <bugs@churchsystem.com.ar>',
      to: ['soporte@churchsystem.com.ar'],
      subject: `🐛 Bug Report - ${iglesia || 'Usuario'}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DC2626;">🐛 Bug Report</h2>
          <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 8px 0;"><strong>Usuario:</strong> ${nombre} (${email})</p>
            <p style="margin: 8px 0;"><strong>Iglesia:</strong> ${iglesia || 'N/A'}</p>
            <p style="margin: 8px 0;"><strong>URL:</strong> <a href="${url}">${url}</a></p>
            <p style="margin: 8px 0;"><strong>Navegador:</strong> ${userAgent}</p>
          </div>
          <div style="margin: 16px 0;">
            <h3 style="color: #374151;">Descripción:</h3>
            <p style="white-space: pre-wrap; background: #FEF2F2; padding: 16px; border-radius: 8px; border-left: 4px solid #DC2626;">${descripcion}</p>
          </div>
          <p style="color: #6B7280; font-size: 14px; margin-top: 24px;">Church System Beta 2.5 - Reporte automático</p>
        </div>
      `
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Error enviando email:', error)
    res.json({ ok: true, warning: 'Error al enviar email' })
  }
})

export default router
