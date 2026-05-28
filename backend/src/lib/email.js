import { Resend } from 'resend'

let resend = null

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!resend) resend = new Resend(key)
  return resend
}

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY
}

export function systemFrom() {
  return process.env.EMAIL_FROM || 'Church System <no-reply@churchsystem.com.ar>'
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildSystemEmail({ title, intro = '', lines = [], actionUrl = '', actionLabel = 'Abrir Church System' }) {
  const safeLines = lines.filter(Boolean).map(line => `<li style="margin:6px 0">${escapeHtml(line)}</li>`).join('')
  const button = actionUrl
    ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#6B5CFF;color:white;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:18px">${escapeHtml(actionLabel)}</a>`
    : ''
  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#CBD5E1">
  <div style="max-width:560px;margin:0 auto;padding:32px 18px">
    <div style="background:#1E293B;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden">
      <div style="background:#111827;padding:22px 28px;border-bottom:1px solid rgba(255,255,255,.08)">
        <div style="font-size:14px;color:#A78BFA;font-weight:700">Church System</div>
        <h1 style="font-size:22px;line-height:1.25;margin:8px 0 0;color:#F1F5F9">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:28px">
        ${intro ? `<p style="font-size:15px;line-height:1.7;margin:0 0 16px">${escapeHtml(intro)}</p>` : ''}
        ${safeLines ? `<ul style="padding-left:18px;margin:0;color:#CBD5E1;font-size:14px;line-height:1.7">${safeLines}</ul>` : ''}
        ${button}
      </div>
      <div style="background:#0F172A;padding:14px 28px;color:#64748B;font-size:12px">
        Este aviso se envio automaticamente para proteger tu cuenta y tu iglesia.
      </div>
    </div>
  </div>
</body>
</html>`
}

export async function sendSystemEmail({ to, subject, html, text }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean)
  if (!recipients.length) return { skipped:true, reason:'missing_to' }
  const client = getResend()
  if (!client) {
    if (process.env.NODE_ENV !== 'production') return { demo:true }
    return { skipped:true, reason:'RESEND_API_KEY_missing' }
  }
  const result = await client.emails.send({
    from: systemFrom(),
    to: recipients,
    subject,
    html,
    text,
  })
  return { id: result?.data?.id || result?.id || null }
}

export async function sendNotificationEmail({ to, subject, title, intro, lines = [], actionUrl, actionLabel }) {
  const html = buildSystemEmail({ title, intro, lines, actionUrl, actionLabel })
  const text = [title, intro, ...lines, actionUrl].filter(Boolean).join('\n')
  return sendSystemEmail({ to, subject, html, text })
}
