import { Router } from 'express'
import https from 'https'
import { readFileSync, existsSync } from 'fs'
import webpush from 'web-push'
import logger from '../lib/logger.js'
import { pgExec, pgMany, pgOne } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'
import { sendWhatsAppText } from '../services/whatsapp.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Agent HTTPS con CA del sistema para que webpush no falle con push services externos
// (Apple Web Push, FCM, Mozilla) que tienen certificados firmados por CAs del sistema.
const CA_PATHS = [
  '/etc/ssl/cert.pem',                  // macOS
  '/etc/ssl/certs/ca-certificates.crt', // Ubuntu/Debian
  '/etc/pki/tls/certs/ca-bundle.crt',   // RHEL
]
let httpsAgent
for (const p of CA_PATHS) {
  if (existsSync(p)) {
    try { httpsAgent = new https.Agent({ ca: readFileSync(p), rejectUnauthorized: true }); break }
    catch { /* siguiente */ }
  }
}
if (!httpsAgent) {
  logger.warn('Push: sin CA local, usando TLS sin verificación')
  httpsAgent = new https.Agent({ rejectUnauthorized: false })
}

// Wrapper que siempre pasa el agent correcto
const pushSend = (subscription, payload, extra = {}) =>
  webpush.sendNotification(subscription, payload, { agent: httpsAgent, TTL: 86400, ...extra })

function uniqueIds(values = []) {
  return [...new Set(values.map(Number).filter(Number.isFinite).filter(id => id > 0))]
}

function toCountMap(rows = [], key = 'iglesiaId') {
  return new Map(rows.map(row => [Number(row[key]), Number(row.n || 0)]))
}

async function getAdminSubscriptionsMap(iglesiaIds = []) {
  const ids = uniqueIds(iglesiaIds)
  if (!ids.length) return new Map()
  const rows = await pgMany(
    `SELECT ps."iglesiaId", ps."endpoint", ps."keys"
       FROM "PushSubscription" ps
       INNER JOIN "User" u ON u."id" = ps."userId"
      WHERE ps."iglesiaId" = ANY($1::int[])
        AND u."deletedAt" IS NULL
        AND u."rol" IN ('PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION')`,
    [ids]
  ).catch(() => [])
  const subsByChurch = new Map()
  for (const row of rows) {
    const iglesiaId = Number(row.iglesiaId)
    if (!subsByChurch.has(iglesiaId)) subsByChurch.set(iglesiaId, [])
    subsByChurch.get(iglesiaId).push(row)
  }
  return subsByChurch
}

async function getChurchNamesMap(iglesiaIds = []) {
  const ids = uniqueIds(iglesiaIds)
  if (!ids.length) return new Map()
  const rows = await pgMany(
    `SELECT "iglesiaId", "valor"
       FROM "Configuracion"
      WHERE "iglesiaId" = ANY($1::int[])
        AND "clave"='nombre_iglesia'`,
    [ids]
  ).catch(() => [])
  return new Map(rows.map(row => [Number(row.iglesiaId), row.valor || 'tu iglesia']))
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@churchsystem.com.ar',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  logger.info('Push: VAPID configurado OK')
} else {
  logger.warn('Push: VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY no configurados')
}

router.get('/vapid-key', requireAuth, (_req, res) => {
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null })
})

router.post('/subscribe', requireAuth, wrap(async (req, res) => {
  const { subscription } = req.body || {}
  if (!subscription?.endpoint || !subscription?.keys) {
    return res.status(400).json({ error: 'Suscripción inválida' })
  }
  await pgExec(
    `INSERT INTO "PushSubscription" ("iglesiaId","userId","endpoint","keys","createdAt")
     VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
     ON CONFLICT ("endpoint")
     DO UPDATE SET
       "iglesiaId"=EXCLUDED."iglesiaId",
       "userId"=EXCLUDED."userId",
       "keys"=EXCLUDED."keys"`,
    [req.user.iglesiaId, req.user.id, String(subscription.endpoint), JSON.stringify(subscription.keys)]
  )
  return res.json({ ok: true })
}))

router.delete('/unsubscribe', requireAuth, wrap(async (req, res) => {
  const { endpoint } = req.body || {}
  if (!endpoint) return res.status(400).json({ error: 'Endpoint requerido' })
  await pgExec(
    'DELETE FROM "PushSubscription" WHERE "userId"=$1 AND "iglesiaId"=$2 AND "endpoint"=$3',
    [req.user.id, req.user.iglesiaId, String(endpoint)]
  )
  return res.json({ ok: true })
}))

router.post('/test', requireAuth, wrap(async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(400).json({ error: 'VAPID no configurado' })
  const subs = await pgMany(
    'SELECT "endpoint","keys" FROM "PushSubscription" WHERE "userId"=$1 AND "iglesiaId"=$2',
    [req.user.id, req.user.iglesiaId]
  )
  if (!subs.length) return res.status(404).json({ error: 'No hay suscripciones activas' })

  let ok = 0
  let errors = 0
  for (const row of subs) {
    try {
      await pushSend(
        { endpoint: row.endpoint, keys: JSON.parse(row.keys) },
        JSON.stringify({ title: 'Church System', body: 'Notificaciones activas OK', url: '/', icon: '/icon.svg' })
      )
      ok++
    } catch (err) {
      errors++
      if (err.statusCode === 410) {
        await pgExec('DELETE FROM "PushSubscription" WHERE "endpoint"=$1', [row.endpoint])
      }
    }
  }
  return res.json({ ok: true, enviadas: ok, errores: errors })
}))

export async function sendPushToAdmins(iglesiaId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return
  const subs = (await getAdminSubscriptionsMap([iglesiaId])).get(Number(iglesiaId)) || []
  if (!subs.length) return
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  for (const row of subs) {
    try {
      await pushSend({ endpoint: row.endpoint, keys: JSON.parse(row.keys) }, data)
    } catch (err) {
      if (err.statusCode === 410) {
        await pgExec('DELETE FROM "PushSubscription" WHERE "endpoint"=$1', [row.endpoint])
      }
    }
  }
}

export async function enviarAlertas() {
  if (!process.env.VAPID_PUBLIC_KEY) return
  const iglesias = await pgMany('SELECT "id" FROM "Iglesia" WHERE "deletedAt" IS NULL')
  const iglesiaIds = uniqueIds(iglesias.map(iglesia => iglesia.id))
  const [cumpleanosMap, vencidosMap, visitantesMap, subsByChurch, churchNamesMap] = await Promise.all([
    pgMany(
      `SELECT "iglesiaId", COUNT(*)::int as n
         FROM "Persona"
        WHERE "iglesiaId" = ANY($1::int[])
          AND "deletedAt" IS NULL
          AND "estado" <> 'INACTIVO'
          AND NULLIF("fechaNacimiento",'') IS NOT NULL
          AND to_char((NULLIF("fechaNacimiento",'')::date), 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')
        GROUP BY "iglesiaId"`,
      [iglesiaIds]
    ).then(rows => toCountMap(rows)).catch(() => new Map()),
    pgMany(
      `SELECT "iglesiaId", COUNT(*)::int as n
         FROM "Seguimiento"
        WHERE "iglesiaId" = ANY($1::int[])
          AND "deletedAt" IS NULL
          AND "proximoContacto" IS NOT NULL
          AND ("proximoContacto")::date <= CURRENT_DATE
        GROUP BY "iglesiaId"`,
      [iglesiaIds]
    ).then(rows => toCountMap(rows)).catch(() => new Map()),
    pgMany(
      `SELECT "iglesiaId", COUNT(*)::int as n
         FROM "Persona"
        WHERE "iglesiaId" = ANY($1::int[])
          AND "deletedAt" IS NULL
          AND "estado" = 'VISITANTE'
          AND NULLIF("fechaIngreso",'') IS NOT NULL
          AND (NULLIF("fechaIngreso",'')::date) <= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY "iglesiaId"`,
      [iglesiaIds]
    ).then(rows => toCountMap(rows)).catch(() => new Map()),
    getAdminSubscriptionsMap(iglesiaIds),
    getChurchNamesMap(iglesiaIds),
  ])

  for (const iglesia of iglesias) {
    const iglesiaId = iglesia.id
    const cumpleanos = Number(cumpleanosMap.get(Number(iglesiaId)) || 0)

    // ── Enviar WhatsApp de cumpleaños a cada persona que cumpla hoy ──
    if (cumpleanos > 0) {
      try {
        const cumpleaneros = await pgMany(
          `SELECT p."id", p."nombre", p."apellido", p."telefono"
           FROM "Persona" p
           WHERE p."iglesiaId"=$1
             AND p."deletedAt" IS NULL
             AND p."estado" <> 'INACTIVO'
             AND NULLIF(p."telefono",'') IS NOT NULL
             AND NULLIF(p."fechaNacimiento",'') IS NOT NULL
             AND to_char((NULLIF(p."fechaNacimiento",'')::date), 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')`,
          [iglesiaId]
        )
        const nombreIglesia = churchNamesMap.get(Number(iglesiaId)) || 'tu iglesia'

        for (const p of cumpleaneros) {
          try {
            const mensaje = `¡Feliz cumpleaños ${p.nombre}! 🎂🎉\nToda la familia de ${nombreIglesia} te desea un día lleno de bendiciones. ¡Que Dios te siga colmando de su gracia!`
            await sendWhatsAppText({ iglesiaId, personaId: p.id, userId: null, to: p.telefono, text: mensaje })
            logger.info({ iglesiaId, personaId: p.id }, 'Saludo de cumpleaños enviado por WhatsApp')
          } catch (err) {
            logger.warn({ iglesiaId, personaId: p.id, err: err.message }, 'No se pudo enviar saludo de cumpleaños')
          }
        }
      } catch (err) {
        logger.warn({ iglesiaId, err: err.message }, 'Error procesando saludos de cumpleaños')
      }
    }

    const vencidos = Number(vencidosMap.get(Number(iglesiaId)) || 0)
    const visitantes = Number(visitantesMap.get(Number(iglesiaId)) || 0)

    const alertas = [
      ...(cumpleanos > 0 ? [`${cumpleanos} cumpleaños hoy`] : []),
      ...(vencidos > 0 ? [`${vencidos} seguimientos vencidos`] : []),
      ...(visitantes > 0 ? [`${visitantes} visitantes sin consolidar`] : []),
    ]
    if (!alertas.length) continue

    const subs = subsByChurch.get(Number(iglesiaId)) || []
    if (!subs.length) continue

    const payload = JSON.stringify({
      title: 'Alertas pastorales',
      body: alertas.join(' · '),
      url: '/alertas',
    })

    for (const row of subs) {
      try {
        await pushSend({ endpoint: row.endpoint, keys: JSON.parse(row.keys) }, payload)
      } catch (err) {
        if (err.statusCode === 410) {
          await pgExec('DELETE FROM "PushSubscription" WHERE "endpoint"=$1', [row.endpoint])
        }
      }
    }
    logger.info({ iglesiaId, alertas }, 'Alertas push enviadas')
  }
}

export default router
