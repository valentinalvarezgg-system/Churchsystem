const INSECURE_VALUES = new Set([
  'change-me',
  'changeme',
  'secret',
  'jwt-secret',
  'dev-secret',
  'admin123',
  'password',
  '123456',
])

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

function valueLooksUnsafe(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return !normalized || INSECURE_VALUES.has(normalized) || normalized.length < 32
}

function databaseLooksUnsafe(value = '') {
  if (!value) return true
  try {
    const url = new URL(value)
    // Aceptar tanto postgres:// como postgresql:// (el driver pg soporta ambos)
    return url.protocol !== 'postgresql:' && url.protocol !== 'postgres:'
  } catch {
    return true
  }
}

export function assertLaunchEnvironment() {
  const errors = []
  const warnings = []

  if (valueLooksUnsafe(process.env.JWT_SECRET)) {
    // Warning en lugar de error: el servidor debe poder arrancar aun si el secret es débil.
    // Render permite configurarlo post-deploy. Un JWT corto es inseguro pero no fatal.
    warnings.push('JWT_SECRET no configurado o inseguro (< 32 chars). Actualizar en Render.')
  }

  if (databaseLooksUnsafe(process.env.DATABASE_URL)) {
    errors.push('DATABASE_URL debe ser una URL PostgreSQL válida (postgresql:// o postgres://).')
  } else {
    // Advertencia suave: sslmode es recomendado pero pg.js ya configura SSL por CA del sistema
    try {
      const dbUrl = new URL(process.env.DATABASE_URL)
      if (!dbUrl.searchParams.get('sslmode')) {
        warnings.push('DATABASE_URL sin ?sslmode=require. pg.js igual usa SSL por CA del sistema.')
      }
    } catch { /* url inválida, ya capturado arriba */ }
  }

  if (isProduction()) {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
      errors.push('NODE_TLS_REJECT_UNAUTHORIZED=0 esta prohibido en production.')
    }
    if (process.env.ALLOW_LEGACY_SQLJS === 'true') {
      errors.push('ALLOW_LEGACY_SQLJS no puede estar activo en production.')
    }
    if (!process.env.FRONTEND_URL && !process.env.PUBLIC_URL) {
      errors.push('FRONTEND_URL o PUBLIC_URL debe estar configurado en production.')
    }
    if (!process.env.RESEND_API_KEY) {
      warnings.push('RESEND_API_KEY no configurado: los emails reales no van a salir.')
    }
    if (!process.env.MP_ACCESS_TOKEN) {
      warnings.push('MP_ACCESS_TOKEN no configurado: los pagos reales no van a funcionar.')
    }
    if (!(process.env.META_SYSTEM_TOKEN || process.env.META_ACCESS_TOKEN) || !process.env.META_PHONE_NUMBER_ID) {
      warnings.push('META_SYSTEM_TOKEN / META_PHONE_NUMBER_ID no configurados: WhatsApp Cloud API no va a enviar mensajes.')
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function requireLaunchEnvironment() {
  const result = assertLaunchEnvironment()
  if (!result.ok) {
    throw new Error(`Configuracion insegura para arrancar: ${result.errors.join(' ')}`)
  }
  return result
}
