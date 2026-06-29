import logger from './logger.js'
import { pgMany, pgExec, pgOne } from './pg.js'
import { invalidarCotizacion } from './pricing.js'
import { sendNotificationEmail, buildSystemEmail, sendSystemEmail } from './email.js'

function uniqueChurchIds(items = [], key = 'iglesiaId') {
  return [...new Set(
    items
      .map(item => Number(item?.[key] ?? item?.iglesia_id))
      .filter(Number.isFinite)
      .filter(id => id > 0)
  )]
}

function ensureStatsEntry(map, iglesiaId) {
  if (!map.has(iglesiaId)) {
    map.set(iglesiaId, { personas: 0, grupos: 0, cultos: 0, mensajes: 0, users: 0 })
  }
  return map.get(iglesiaId)
}

async function upsertConfig(iglesiaId, clave, valor) {
  await pgExec(
    `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
     VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("iglesiaId","clave") DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
    [iglesiaId, clave, valor]
  )
}

async function degradarAFree(iglesiaId) {
  for (const [k, v] of [['suscripcion_activa','0'],['plan','FREE'],['plan_label','Free']]) {
    await upsertConfig(iglesiaId, k, v)
  }
}

async function getAdmin(iglesiaId) {
  return pgOne(
    `SELECT email, nombre FROM "User"
      WHERE "iglesiaId"=$1 AND "rol"='PASTOR_GENERAL' AND "activo"=true AND "deletedAt" IS NULL
      ORDER BY id ASC LIMIT 1`,
    [iglesiaId]
  ).catch(() => null)
}

async function getAdminsMap(iglesiaIds = []) {
  if (!iglesiaIds.length) return new Map()
  const rows = await pgMany(
    `SELECT DISTINCT ON ("iglesiaId") "iglesiaId", email, nombre
       FROM "User"
      WHERE "iglesiaId" = ANY($1::int[])
        AND "rol"='PASTOR_GENERAL'
        AND "activo"=true
        AND "deletedAt" IS NULL
      ORDER BY "iglesiaId", id ASC`,
    [iglesiaIds]
  ).catch(() => [])
  return new Map(rows.map(row => [Number(row.iglesiaId), row]))
}

async function getOngoardingStats(iglesiaId) {
  const [p, g, c, m, u] = await Promise.all([
    pgOne(`SELECT COUNT(*)::int AS n FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "Grupo"   WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "Culto"   WHERE "iglesiaId"=$1`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "Mensaje" WHERE "iglesiaId"=$1`, [iglesiaId]).catch(() => ({ n: 0 })),
    pgOne(`SELECT COUNT(*)::int AS n FROM "User"    WHERE "iglesiaId"=$1 AND "activo"=true AND "deletedAt" IS NULL`, [iglesiaId]).catch(() => ({ n: 0 })),
  ])
  return { personas: p?.n || 0, grupos: g?.n || 0, cultos: c?.n || 0, mensajes: m?.n || 0, users: u?.n || 0 }
}

async function getOnboardingStatsMap(iglesiaIds = []) {
  if (!iglesiaIds.length) return new Map()
  const [personas, grupos, cultos, mensajes, users] = await Promise.all([
    pgMany(`SELECT "iglesiaId", COUNT(*)::int AS n FROM "Persona" WHERE "iglesiaId" = ANY($1::int[]) AND "deletedAt" IS NULL GROUP BY "iglesiaId"`, [iglesiaIds]).catch(() => []),
    pgMany(`SELECT "iglesiaId", COUNT(*)::int AS n FROM "Grupo" WHERE "iglesiaId" = ANY($1::int[]) AND "deletedAt" IS NULL GROUP BY "iglesiaId"`, [iglesiaIds]).catch(() => []),
    pgMany(`SELECT "iglesiaId", COUNT(*)::int AS n FROM "Culto" WHERE "iglesiaId" = ANY($1::int[]) GROUP BY "iglesiaId"`, [iglesiaIds]).catch(() => []),
    pgMany(`SELECT "iglesiaId", COUNT(*)::int AS n FROM "Mensaje" WHERE "iglesiaId" = ANY($1::int[]) GROUP BY "iglesiaId"`, [iglesiaIds]).catch(() => []),
    pgMany(`SELECT "iglesiaId", COUNT(*)::int AS n FROM "User" WHERE "iglesiaId" = ANY($1::int[]) AND "activo"=true AND "deletedAt" IS NULL GROUP BY "iglesiaId"`, [iglesiaIds]).catch(() => []),
  ])
  const statsByChurch = new Map()
  for (const iglesiaId of iglesiaIds) ensureStatsEntry(statsByChurch, iglesiaId)
  for (const row of personas) ensureStatsEntry(statsByChurch, Number(row.iglesiaId)).personas = Number(row.n || 0)
  for (const row of grupos) ensureStatsEntry(statsByChurch, Number(row.iglesiaId)).grupos = Number(row.n || 0)
  for (const row of cultos) ensureStatsEntry(statsByChurch, Number(row.iglesiaId)).cultos = Number(row.n || 0)
  for (const row of mensajes) ensureStatsEntry(statsByChurch, Number(row.iglesiaId)).mensajes = Number(row.n || 0)
  for (const row of users) ensureStatsEntry(statsByChurch, Number(row.iglesiaId)).users = Number(row.n || 0)
  return statsByChurch
}

async function procesarTrials() {
  const hoy = new Date().toISOString().slice(0, 10)

  // Trials que vencen en 7, 3 o 1 días → email CTA
  const porVencer = await pgMany(
    `SELECT c."iglesiaId", c."valor" AS trial_fin
       FROM "Configuracion" c
      WHERE c."clave"='trial_fin'
        AND c."valor" BETWEEN $1 AND $2`,
    [hoy, new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)]
  ).catch(() => [])
  const porVencerChurchIds = uniqueChurchIds(porVencer)
  const adminsMap = await getAdminsMap(porVencerChurchIds)
  const statsMap = await getOnboardingStatsMap(porVencerChurchIds)

  for (const row of porVencer) {
    const dias = Math.ceil((new Date(row.trial_fin) - new Date()) / 86400000)
    if (![7, 3, 1].includes(dias)) continue

    const admin = adminsMap.get(Number(row.iglesiaId))
    if (!admin?.email) continue

    const stats = statsMap.get(Number(row.iglesiaId)) || { personas: 0, grupos: 0, cultos: 0, mensajes: 0, users: 0 }
    const appUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || ''
    sendNotificationEmail({
      to:          admin.email,
      subject:     `Tu trial vence en ${dias} día${dias > 1 ? 's' : ''} — Church System`,
      title:       `Quedan ${dias} día${dias > 1 ? 's' : ''} de prueba gratuita`,
      intro:       `Hola ${admin.nombre}, tu período de prueba PRO vence el ${row.trial_fin}.`,
      lines:       [
        `Llevás ${stats.personas} personas, ${stats.grupos} grupos y ${stats.cultos} cultos registrados.`,
        'Suscribite para conservar todo tu trabajo y seguir creciendo.',
      ],
      actionUrl:   `${appUrl}/app/billing`,
      actionLabel: 'Ver planes y precios',
    }).catch(() => {})
  }

  // Trials vencidos sin suscripción activa → degradar a FREE
  const vencidos = await pgMany(
    `SELECT c."iglesiaId"
       FROM "Configuracion" c
      WHERE c."clave"='trial_fin'
        AND c."valor" < $1
        AND NOT EXISTS (
          SELECT 1 FROM "Configuracion" c2
           WHERE c2."iglesiaId"=c."iglesiaId"
             AND c2."clave"='suscripcion_activa'
             AND c2."valor"='1'
        )`,
    [hoy]
  ).catch(() => [])

  for (const row of vencidos) {
    await degradarAFree(row.iglesiaId).catch(() => {})
    logger.info({ iglesiaId: row.iglesiaId }, 'Trial vencido → degradado a FREE')
  }
}

async function procesarGracia() {
  const ahora = new Date()

  // Suscripciones en gracia activa → email diario de recordatorio
  const enGracia = await pgMany(
    `SELECT iglesia_id, plan, gracia_hasta
       FROM suscripciones
      WHERE gracia_hasta > NOW()
        AND estado IN ('authorized','pending')`,
    []
  ).catch(() => [])
  const graciaAdminsMap = await getAdminsMap(uniqueChurchIds(enGracia, 'iglesia_id'))

  for (const sus of enGracia) {
    const dias = Math.ceil((new Date(sus.gracia_hasta) - ahora) / 86400000)
    const admin = graciaAdminsMap.get(Number(sus.iglesia_id))
    if (!admin?.email) continue

    const appUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || ''
    sendNotificationEmail({
      to:          admin.email,
      subject:     `Período de gracia: ${dias} día${dias !== 1 ? 's' : ''} para actualizar tu pago`,
      title:       `Problema con tu pago — ${dias} día${dias !== 1 ? 's' : ''} restantes`,
      intro:       `Hola ${admin.nombre}, no pudimos procesar el cobro de tu plan ${sus.plan}.`,
      lines:       [
        `El período de gracia vence el ${new Date(sus.gracia_hasta).toISOString().slice(0, 10)}.`,
        'Actualizá tu método de pago para evitar la interrupción del servicio.',
      ],
      actionUrl:   `${appUrl}/app/billing`,
      actionLabel: 'Actualizar método de pago',
    }).catch(() => {})
  }

  // Gracia vencida → degradar a FREE
  const graciaVencida = await pgMany(
    `SELECT iglesia_id, preapproval_id
       FROM suscripciones
      WHERE gracia_hasta < NOW()
        AND gracia_hasta IS NOT NULL
        AND estado != 'cancelled'`,
    []
  ).catch(() => [])
  const graciaVencidaAdminsMap = await getAdminsMap(uniqueChurchIds(graciaVencida, 'iglesia_id'))

  for (const sus of graciaVencida) {
    await degradarAFree(sus.iglesia_id).catch(() => {})
    await pgExec(
      `UPDATE suscripciones SET estado='cancelled', gracia_hasta=NULL, actualizado_at=CURRENT_TIMESTAMP
        WHERE iglesia_id=$1 AND preapproval_id=$2`,
      [sus.iglesia_id, sus.preapproval_id]
    ).catch(() => {})

    const admin = graciaVencidaAdminsMap.get(Number(sus.iglesia_id))
    if (admin?.email) {
      const appUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || ''
      sendNotificationEmail({
        to:          admin.email,
        subject:     'Acceso interrumpido — Church System',
        title:       'Tu plan fue cambiado al plan gratuito',
        intro:       `Hola ${admin.nombre}, tu período de gracia venció y el acceso fue reducido al plan Free.`,
        lines:       ['Podés volver a suscribirte en cualquier momento para recuperar el acceso completo.'],
        actionUrl:   `${appUrl}/app/billing`,
        actionLabel: 'Reactivar suscripción',
      }).catch(() => {})
    }
    logger.info({ iglesiaId: sus.iglesia_id }, 'Gracia vencida → degradado a FREE')
  }
}

async function procesarEmailsOnboarding() {
  const ahora = new Date()

  // Días desde trial_inicio para secuencia de onboarding: 1, 7, 23, 29
  const DIAS_SECUENCIA = [1, 7, 23, 29]

  const inicios = await pgMany(
    `SELECT c."iglesiaId", c."valor" AS trial_inicio
       FROM "Configuracion" c
      WHERE c."clave"='trial_inicio'`,
    []
  ).catch(() => [])
  const iniciosChurchIds = uniqueChurchIds(inicios)
  const onboardingAdminsMap = await getAdminsMap(iniciosChurchIds)
  const onboardingStatsMap = await getOnboardingStatsMap(iniciosChurchIds)

  for (const row of inicios) {
    const inicio = new Date(row.trial_inicio)
    const dias   = Math.round((ahora - inicio) / 86400000)
    if (!DIAS_SECUENCIA.includes(dias)) continue

    const admin  = onboardingAdminsMap.get(Number(row.iglesiaId))
    if (!admin?.email) continue

    const stats  = onboardingStatsMap.get(Number(row.iglesiaId)) || { personas: 0, grupos: 0, cultos: 0, mensajes: 0, users: 0 }
    const appUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || ''

    const sequences = {
      1: {
        subject: 'Bienvenido a Church System — guía de inicio',
        title:   'Empezá en 3 pasos',
        lines: [
          '1. Agregá tus primeras personas en Personas → Nueva persona.',
          '2. Creá un grupo o célula en el módulo Grupos.',
          '3. Registrá el primer culto en Asistencia.',
        ],
      },
      7: {
        subject: `¿Cómo va tu primera semana? — ${stats.personas} personas cargadas`,
        title:   'Cómo va tu iglesia',
        lines: [
          `Llevás ${stats.personas} personas, ${stats.grupos} grupos y ${stats.cultos} cultos registrados.`,
          stats.personas > 0 ? 'Probá el seguimiento automático desde Alertas.' : 'Cargá tus primeras personas para empezar a usar el sistema.',
        ],
      },
      23: {
        subject: 'Tu trial termina en 7 días — no pierdas tu trabajo',
        title:   'Quedan 7 días de prueba gratuita',
        lines: [
          `Llevás ${stats.personas} personas, ${stats.grupos} grupos y ${stats.cultos} cultos registrados.`,
          'Suscribite antes de que termine el trial para conservar todos tus datos y módulos.',
        ],
      },
      29: {
        subject: 'Último día de prueba gratuita — Church System',
        title:   'Hoy es el último día de tu trial',
        lines: [
          `Toda tu iglesia — ${stats.personas} personas, ${stats.grupos} grupos — seguirá disponible si te suscribís hoy.`,
          'El plan PRO tiene todo lo que necesitás para el seguimiento pastoral diario.',
        ],
      },
    }

    const seq = sequences[dias]
    if (!seq) continue

    sendNotificationEmail({
      to:          admin.email,
      subject:     seq.subject,
      title:       seq.title,
      intro:       `Hola ${admin.nombre},`,
      lines:       seq.lines,
      actionUrl:   `${appUrl}/app/billing`,
      actionLabel: dias >= 23 ? 'Ver planes y suscribirme' : 'Ir al panel',
    }).catch(() => {})
  }
}

export async function tickDiario() {
  logger.info('tickDiario: inicio')
  try {
    invalidarCotizacion()
    await procesarTrials()
    await procesarGracia()
    await procesarEmailsOnboarding()
    logger.info('tickDiario: completado')
  } catch (err) {
    logger.error({ err: err.message }, 'tickDiario error')
  }
}
