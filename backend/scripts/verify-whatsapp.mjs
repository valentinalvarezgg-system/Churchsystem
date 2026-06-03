#!/usr/bin/env node
/**
 * verify-whatsapp.mjs
 * Verifica que las variables de Meta estén bien configuradas
 * y hace un test real contra la Graph API.
 *
 * Uso:
 *   node backend/scripts/verify-whatsapp.mjs
 *
 * También puede recibir el número destino para enviar un mensaje de prueba:
 *   node backend/scripts/verify-whatsapp.mjs 5491112345678
 */

import 'dotenv/config'

const REQUIRED = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_SYSTEM_TOKEN',
  'META_PHONE_NUMBER_ID',
  'META_WABA_ID',
  'META_WEBHOOK_VERIFY_TOKEN',
]

const VERSION = process.env.META_GRAPH_VERSION || 'v23.0'
const BASE    = `https://graph.facebook.com/${VERSION}`
const TOKEN   = process.env.META_SYSTEM_TOKEN || process.env.META_ACCESS_TOKEN || ''
const PHONE_ID = process.env.META_PHONE_NUMBER_ID || ''
const WABA_ID  = process.env.META_WABA_ID || ''
const TO       = process.argv[2] || ''

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD  = '\x1b[1m'
const ok  = msg => console.log(`${GREEN}✅ ${msg}${RESET}`)
const err = msg => console.log(`${RED}❌ ${msg}${RESET}`)
const warn = msg => console.log(`${YELLOW}⚠️  ${msg}${RESET}`)
const head = msg => console.log(`\n${BOLD}${msg}${RESET}`)

async function apiFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE}/${path}`
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  console.log(`${BOLD}━━━ Church System — WhatsApp Meta API Verify ━━━${RESET}`)

  // 1. Variables de entorno
  head('1. Variables de entorno')
  let allPresent = true
  for (const key of REQUIRED) {
    if (process.env[key]) ok(`${key} ✓`)
    else { err(`${key} — FALTA`); allPresent = false }
  }
  if (!allPresent) {
    console.log(`\n${RED}Completá las variables faltantes en .env antes de continuar.${RESET}`)
    process.exit(1)
  }

  // 2. Verificar token contra Graph API
  head('2. Validar System Token')
  const meRes = await apiFetch('me?fields=id,name')
  if (meRes.ok) {
    ok(`Token válido — App User: ${meRes.data.name || meRes.data.id}`)
  } else {
    err(`Token inválido: ${meRes.data?.error?.message || meRes.status}`)
    process.exit(1)
  }

  // 3. Verificar Phone Number
  head('3. Verificar Phone Number ID')
  const phoneRes = await apiFetch(`${PHONE_ID}?fields=id,display_phone_number,verified_name,quality_rating,status`)
  if (phoneRes.ok) {
    const p = phoneRes.data
    ok(`Phone Number ID válido`)
    ok(`Número: ${p.display_phone_number}`)
    ok(`Nombre verificado: ${p.verified_name}`)
    ok(`Estado: ${p.status}`)
    ok(`Calidad: ${p.quality_rating || 'N/A'}`)
  } else {
    err(`Phone Number ID inválido: ${phoneRes.data?.error?.message || phoneRes.status}`)
  }

  // 4. Verificar WABA
  head('4. Verificar WhatsApp Business Account')
  const wabaRes = await apiFetch(`${WABA_ID}?fields=id,name,currency,timezone_id,message_template_namespace`)
  if (wabaRes.ok) {
    const w = wabaRes.data
    ok(`WABA válida — Nombre: ${w.name}`)
    ok(`Namespace de templates: ${w.message_template_namespace || 'N/A'}`)
    ok(`Moneda: ${w.currency || 'N/A'} / Timezone: ${w.timezone_id || 'N/A'}`)
  } else {
    err(`WABA ID inválido: ${wabaRes.data?.error?.message || wabaRes.status}`)
  }

  // 5. Listar templates disponibles
  head('5. Templates disponibles')
  const tplRes = await apiFetch(`${WABA_ID}/message_templates?limit=10&fields=name,status,language`)
  if (tplRes.ok) {
    const templates = tplRes.data?.data || []
    if (templates.length === 0) {
      warn('No hay templates aprobados aún. Creá uno en Meta Business Manager.')
    } else {
      for (const t of templates) {
        const icon = t.status === 'APPROVED' ? '✅' : t.status === 'PENDING' ? '⏳' : '❌'
        console.log(`   ${icon} ${t.name} [${t.language}] — ${t.status}`)
      }
    }
  } else {
    warn(`No se pudieron leer templates: ${tplRes.data?.error?.message || tplRes.status}`)
  }

  // 6. Enviar mensaje de prueba (solo si se pasó número)
  if (TO) {
    head(`6. Enviar mensaje de prueba a ${TO}`)
    const sendRes = await apiFetch(`${PHONE_ID}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: TO,
        type: 'text',
        text: { body: '✅ Church System — verificación de conexión WhatsApp exitosa.' },
      }),
    })
    if (sendRes.ok) {
      ok(`Mensaje enviado — message_id: ${sendRes.data?.messages?.[0]?.id}`)
    } else {
      err(`Error al enviar: ${sendRes.data?.error?.message || sendRes.status}`)
      if (sendRes.data?.error?.code === 131030) {
        warn('Código 131030: el número destino no inició conversación. Usá un número que ya te haya escrito.')
      }
    }
  } else {
    warn('Paso 6 omitido — pasá tu número como argumento para probar el envío:')
    warn('  node backend/scripts/verify-whatsapp.mjs 5491112345678')
  }

  // 7. Webhook
  head('7. Webhook')
  const webhookUrl = `${process.env.BASE_URL || 'https://churchsystem.com.ar'}/api/whatsapp/webhook`
  ok(`URL configurada: ${webhookUrl}`)
  ok(`Verify token: ${process.env.META_WEBHOOK_VERIFY_TOKEN ? '✓ presente' : '❌ falta META_WEBHOOK_VERIFY_TOKEN'}`)
  warn('Para verificar el webhook: pegá la URL en Meta Developers → WhatsApp → Configuration → Webhook')

  console.log(`\n${BOLD}${GREEN}━━━ Verificación completa ━━━${RESET}`)
}

main().catch(e => {
  console.error(`${RED}Error fatal: ${e.message}${RESET}`)
  process.exit(1)
})
