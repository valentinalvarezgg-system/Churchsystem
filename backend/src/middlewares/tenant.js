export function getTenantId(hostname = '') {
  const host = String(hostname || '').split(':')[0].toLowerCase()

  const mainHosts = [
    'churchsystem.com.ar',
    'www.churchsystem.com.ar',
    'localhost',
    '127.0.0.1',
    '192.168.1.2',
  ]
  if (mainHosts.includes(host)) return 'main'

  const match = host.match(/^(?:app\.)?([^.]+)\.churchsystem\.com\.ar$/)
  if (match) return match[1]

  return 'main'
}

export function tenantMiddleware(req, _res, next) {
  req.tenantId = getTenantId(req.hostname || req.headers.host)
  next()
}

export function tenantFilter(tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : ''
  return `WHERE ${prefix}"iglesiaId" = $1`
}
