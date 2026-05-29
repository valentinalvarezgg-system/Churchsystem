/**
 * IA MULTI-PROVEEDOR — Anthropic Claude · OpenAI GPT · Groq (gratis)
 * Selección automática según lo configurado en Configuración → IA
 */
import { Router } from 'express'
import { pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()


// ── Obtener contexto real de la congregación ──────────────────────────────────
async function getCtx(iglesiaId) {
  const [
    totales,
    ultimosCultos,
    gruposTop,
    proximasAlertas,
  ] = await Promise.all([
    pgOne(
      `SELECT
         COUNT(*)::int AS personas,
         COUNT(*) FILTER (WHERE "estado"='ACTIVO')::int AS activos,
         COUNT(*) FILTER (WHERE "estado"='VISITANTE')::int AS visitantes,
         COUNT(*) FILTER (WHERE "estado"='NUEVO')::int AS nuevos,
         COUNT(*) FILTER (
           WHERE NOT EXISTS (
             SELECT 1 FROM "Seguimiento" s
             WHERE s."iglesiaId"=$1 AND s."personaId"="Persona"."id" AND s."deletedAt" IS NULL
           )
         )::int AS "sinSeguimiento"
       FROM "Persona"
       WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT c."nombre", c."fecha",
              COUNT(a."id") FILTER (WHERE a."presente"=true)::int AS presentes,
              COUNT(a."id")::int AS total
       FROM "Culto" c
       LEFT JOIN "Asistencia" a ON a."cultoId"=c."id" AND a."iglesiaId"=c."iglesiaId"
       WHERE c."iglesiaId"=$1 AND c."deletedAt" IS NULL
       GROUP BY c."id"
       ORDER BY c."fecha" DESC
       LIMIT 5`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT g."nombre", COUNT(p."id")::int AS total
       FROM "Grupo" g
       LEFT JOIN "Persona" p ON p."grupoId"=g."id" AND p."iglesiaId"=g."iglesiaId" AND p."deletedAt" IS NULL
       WHERE g."iglesiaId"=$1 AND g."deletedAt" IS NULL
       GROUP BY g."id"
       ORDER BY total DESC
       LIMIT 5`,
      [iglesiaId]
    ),
    pgMany(
      `SELECT "nombre", "apellido", "estado"
       FROM "Persona"
       WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL AND "estado" IN ('VISITANTE','NUEVO')
       ORDER BY "fechaIngreso" DESC NULLS LAST
       LIMIT 10`,
      [iglesiaId]
    ),
  ])

  return {
    totales: {
      personas: Number(totales?.personas || 0),
      activos: Number(totales?.activos || 0),
      visitantes: Number(totales?.visitantes || 0),
      nuevos: Number(totales?.nuevos || 0),
      grupos: Number(gruposTop?.length || 0),
      cultos: Number(ultimosCultos?.length || 0),
      sinSeguimiento: Number(totales?.sinSeguimiento || 0),
      oracionActiva: 0,
    },
    ultimosCultos,
    gruposTop,
    proximasAlertas,
  }
}

// ── Obtener configuración de IA desde DB ──────────────────────────────────────
async function getIAConfig(iglesiaId) {
  const rows = await pgMany(
    'SELECT "clave", "valor" FROM "Configuracion" WHERE "iglesiaId"=$1 OR "iglesiaId" IS NULL ORDER BY "iglesiaId" NULLS FIRST',
    [iglesiaId]
  )
  const c = {}
  for (const r of rows) c[r.clave] = r.valor
  return {
    proveedor:       c.ia_proveedor   || 'anthropic',
    anthropic_key:   c.anthropic_key  || process.env.ANTHROPIC_API_KEY || '',
    openai_key:      c.openai_key     || process.env.OPENAI_API_KEY    || '',
    groq_key:        c.groq_key       || process.env.GROQ_API_KEY      || '',
    modelo_anthropic: c.modelo_anthropic || 'claude-haiku-4-5-20251001',
    modelo_openai:    c.modelo_openai   || 'gpt-4o-mini',
    modelo_groq:      c.modelo_groq     || 'llama-3.3-70b-versatile',
  }
}

// ── Llamar al proveedor correcto ──────────────────────────────────────────────
async function llamarIA(proveedor, config, system, messages) {

  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (proveedor === 'anthropic') {
    if (!config.anthropic_key) throw new Error('Sin API key de Anthropic')
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':          config.anthropic_key,
        'anthropic-version':  '2023-06-01',
      },
      body: JSON.stringify({
        model:      config.modelo_anthropic,
        max_tokens: 1024,
        system,
        messages,
      }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error?.message || `Anthropic error ${r.status}`)
    return d.content?.[0]?.text || 'Sin respuesta'
  }

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  if (proveedor === 'openai') {
    if (!config.openai_key) throw new Error('Sin API key de OpenAI')
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${config.openai_key}`,
      },
      body: JSON.stringify({
        model:       config.modelo_openai,
        max_tokens:  1024,
        messages:    [{ role: 'system', content: system }, ...messages],
      }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error?.message || `OpenAI error ${r.status}`)
    return d.choices?.[0]?.message?.content || 'Sin respuesta'
  }

  // ── Groq (gratis, muy rápido) ──────────────────────────────────────────────
  if (proveedor === 'groq') {
    if (!config.groq_key) throw new Error('Sin API key de Groq')
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${config.groq_key}`,
      },
      body: JSON.stringify({
        model:      config.modelo_groq,
        max_tokens: 1024,
        messages:   [{ role: 'system', content: system }, ...messages],
      }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error?.message || `Groq error ${r.status}`)
    return d.choices?.[0]?.message?.content || 'Sin respuesta'
  }

  throw new Error(`Proveedor desconocido: ${proveedor}`)
}

// ── POST /ia/chat ─────────────────────────────────────────────────────────────
router.post('/chat', requireAuth, async (req, res) => {
  const { pregunta, historial = [] } = req.body || {}
  if (!pregunta?.trim()) return res.status(400).json({ error: 'pregunta requerida' })

  const config    = await getIAConfig(req.user.iglesiaId)
  const proveedor = config.proveedor

  // Verificar que el proveedor tiene key configurada
  const keyMap = { anthropic: config.anthropic_key, openai: config.openai_key, groq: config.groq_key }
  if (!keyMap[proveedor]) {
    return res.json({
      respuesta: `⚠️ IA no configurada. Andá a **Configuración → IA**, elegí un proveedor y pegá tu API key.\n\n**Opciones disponibles:**\n• **Groq** — Gratuito, muy rápido (recomendado para empezar)\n• **Anthropic Claude** — El mejor para análisis pastoral\n• **OpenAI ChatGPT** — GPT-4o-mini es económico`,
      proveedor: null,
    })
  }

  const ctx    = await getCtx(req.user.iglesiaId)
  const system = `Sos el asistente pastoral de Church System. Fecha: ${new Date().toISOString().slice(0,10)}.
Datos de la congregación:
- Total personas: ${ctx.totales.personas} (${ctx.totales.activos} activos, ${ctx.totales.visitantes} visitantes, ${ctx.totales.nuevos} nuevos)
- Grupos: ${ctx.totales.grupos}
- Sin seguimiento: ${ctx.totales.sinSeguimiento}
- Peticiones de oración activas: ${ctx.totales.oracionActiva}
- Últimos cultos: ${ctx.ultimosCultos.map(c=>`${c.nombre}(${c.fecha}):${c.presentes}/${c.total}`).join(', ')||'ninguno'}
- Grupos principales: ${ctx.gruposTop.map(g=>`${g.nombre}:${g.total}`).join(', ')||'ninguno'}
Respondé en español rioplatense, de forma cálida y pastoral. Sé concreto y útil.`

  const messages = [
    ...historial.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: pregunta },
  ]

  try {
    const respuesta = await llamarIA(proveedor, config, system, messages)
    res.json({ respuesta, proveedor })
  } catch (e) {
    // Dar mensaje claro según el tipo de error
    let msg = e.message || 'Error desconocido'
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      msg = 'No se pudo conectar con el servidor de IA. Verificá tu conexión a internet.'
    } else if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('Unauthorized')) {
      msg = 'API key inválida. Revisá la configuración en Configuración → IA.'
    } else if (msg.includes('429') || msg.includes('rate_limit')) {
      msg = 'Límite de uso alcanzado. Esperá un momento e intentá de nuevo.'
    } else if (msg.includes('model_not_found') || msg.includes('does not exist')) {
      msg = 'Modelo no disponible. Revisá la configuración del proveedor.'
    }
    res.status(500).json({ error: msg, proveedor })
  }
})

// ── GET /ia/sugerencias ───────────────────────────────────────────────────────
router.get('/sugerencias', requireAuth, async (req, res) => {
  const ctx = await getCtx(req.user.iglesiaId)
  const s   = []
  if (ctx.totales.sinSeguimiento > 0)
    s.push({ texto:`¿Qué hacer con las ${ctx.totales.sinSeguimiento} personas sin seguimiento?`, tipo:'alerta' })
  if (ctx.totales.visitantes > 0)
    s.push({ texto:`Tengo ${ctx.totales.visitantes} visitantes. ¿Cómo los consolido?`, tipo:'pastoral' })
  s.push({ texto:'Dame un resumen del estado actual de la congregación', tipo:'resumen' })
  s.push({ texto:'Redactá un mensaje de bienvenida para nuevos visitantes', tipo:'mensaje' })
  if (ctx.totales.oracionActiva > 0)
    s.push({ texto:`Hay ${ctx.totales.oracionActiva} peticiones de oración activas. ¿Cómo organizarlas?`, tipo:'oracion' })
  res.json(s.slice(0, 4))
})

// ── GET /ia/estado ────────────────────────────────────────────────────────────
router.get('/estado', requireAuth, async (req, res) => {
  const config    = await getIAConfig(req.user.iglesiaId)
  const keyMap    = { anthropic: config.anthropic_key, openai: config.openai_key, groq: config.groq_key }
  const activa    = !!keyMap[config.proveedor]
  res.json({
    activa,
    proveedor:        config.proveedor,
    modelo:           config[`modelo_${config.proveedor}`],
    anthropic_ok:     !!config.anthropic_key,
    openai_ok:        !!config.openai_key,
    groq_ok:          !!config.groq_key,
  })
})

export default router
