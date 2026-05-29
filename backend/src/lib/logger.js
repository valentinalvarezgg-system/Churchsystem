import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'authorization',
      'password',
      'token',
      'refreshToken',
      'DATABASE_URL',
      'JWT_SECRET',
      'RESEND_API_KEY',
      'MP_ACCESS_TOKEN',
    ],
    censor: '[redacted]',
  },
})

export function httpLogger() {
  return (req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
      logger[level](
        {
          method: req.method,
          path: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        },
        'HTTP request'
      )
    })
    next()
  }
}

export default logger
