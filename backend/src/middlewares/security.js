function sanitizeVal(v) {
  if (typeof v !== 'string') return v
  return v.replace(/\0/g,'').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,'')
    .replace(/javascript\s*:/gi,'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'')
}
function sanitizeDeep(obj) {
  if (typeof obj === 'string') return sanitizeVal(obj)
  if (Array.isArray(obj)) return obj.map(sanitizeDeep)
  if (obj && typeof obj === 'object') {
    const c = {}; for (const [k,v] of Object.entries(obj)) c[k]=sanitizeDeep(v); return c
  }
  return obj
}
export function sanitizeBody(req,_res,next) {
  if (req.body) req.body = sanitizeDeep(req.body)
  if (req.query) for (const [k,v] of Object.entries(req.query)) if (typeof v==='string') req.query[k]=sanitizeVal(v)
  next()
}
export function requireJSON(req,res,next) {
  if (['POST','PUT','PATCH'].includes(req.method)) {
    const ct = req.headers['content-type']||''
    if (!ct.includes('application/json') && !ct.includes('multipart/form-data'))
      return res.status(415).json({ error: 'Content-Type debe ser application/json' })
  }
  next()
}
export function securityLogger(req,res,next) {
  res.on('finish',()=>{
    if ([401,403,429].includes(res.statusCode)) {
      const ip = req.headers['x-forwarded-for']||req.socket?.remoteAddress||'?'
      console.warn(`[SEC] ${res.statusCode} ${req.method} ${req.path} IP:${ip}`)
    }
  }); next()
}
export function validate(schema) {
  return (req,res,next) => {
    const r = schema.safeParse(req.body)
    if (!r.success) return res.status(400).json({ error:'Datos inválidos', detalle:r.error.errors.map(e=>`${e.path.join('.')}: ${e.message}`) })
    req.body = r.data; next()
  }
}
export function errorHandler(err,req,res,_next) {
  console.error('[ERROR]', req.method, req.path, err.message)
  if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ error:'Ya existe un registro con esos datos' })
  if (err.message?.includes('NOT NULL')) return res.status(400).json({ error:'Faltan campos obligatorios' })
  res.status(500).json({ error: process.env.NODE_ENV==='production' ? 'Error interno' : (err.message||'Error') })
}
