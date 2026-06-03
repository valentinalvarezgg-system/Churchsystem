import crypto from 'crypto'

export function getWebhookVerifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || ''
}

export function verifyWebhookToken(query = {}, expectedToken = getWebhookVerifyToken()) {
  const mode = query['hub.mode']
  const verifyToken = query['hub.verify_token']
  const challenge = query['hub.challenge']
  if (mode === 'subscribe' && expectedToken && verifyToken === expectedToken) {
    return String(challenge || '')
  }
  return null
}

export function verifyWebhookSignature(rawBody, signatureHeader, appSecret = process.env.META_APP_SECRET || '') {
  if (!appSecret || !signatureHeader || !rawBody) return true
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
  } catch {
    return false
  }
}
