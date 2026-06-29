import { Router } from 'express'
import { pgMany } from '../lib/pg.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

router.get('/', requireAuth, wrap(async (req, res) => {
  const iglesiaId = Number(req.user.iglesiaId)
  if (!iglesiaId) return res.status(400).json({ error: 'Tenant invalido' })

  const ultimos = await pgMany(
    'SELECT "id" FROM "Culto" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL ORDER BY "fecha" DESC LIMIT 3',
    [iglesiaId]
  )
  const cultoIds = ultimos.map(c => Number(c.id))

  const [
    sinAsistir,
    sinSeguimiento,
    visitantesSinConsolidar,
    contactosVencidos,
    cumpleanosSemana,
  ] = await Promise.all([
    cultoIds.length
      ? pgMany(
      `SELECT p."id", p."nombre", p."apellido", p."telefono", p."estado", u."nombre" AS "liderNombre"
       FROM "Persona" p
       LEFT JOIN "User" u ON u."id" = p."asignadoAUserId" AND u."iglesiaId" = p."iglesiaId"
       WHERE p."iglesiaId"=$1
         AND p."deletedAt" IS NULL
         AND p."estado"='ACTIVO'
         AND NOT EXISTS (
           SELECT 1 FROM "Asistencia" a
           WHERE a."iglesiaId"=$1 AND a."personaId"=p."id" AND a."cultoId" = ANY($2::int[]) AND a."presente"=true
         )
       ORDER BY p."nombre" ASC
       LIMIT 30`,
        [iglesiaId, cultoIds]
      )
      : Promise.resolve([]),

    pgMany(
      `WITH ultimo AS (
         SELECT "personaId", MAX("createdAt") AS "ultimoSeguimiento"
           FROM "Seguimiento"
          WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
          GROUP BY "personaId"
       )
       SELECT p."id", p."nombre", p."apellido", p."telefono", u."nombre" AS "liderNombre",
              ultimo."ultimoSeguimiento"
     FROM "Persona" p
     LEFT JOIN "User" u ON u."id" = p."asignadoAUserId" AND u."iglesiaId" = p."iglesiaId"
     LEFT JOIN ultimo ON ultimo."personaId"=p."id"
     WHERE p."iglesiaId"=$1
       AND p."deletedAt" IS NULL
       AND p."estado" IN ('ACTIVO','VISITANTE','NUEVO')
       AND (ultimo."ultimoSeguimiento" IS NULL OR ultimo."ultimoSeguimiento" < NOW() - INTERVAL '30 days')
     ORDER BY "ultimoSeguimiento" ASC NULLS FIRST
     LIMIT 20`,
      [iglesiaId]
    ),

    pgMany(
      `SELECT p."id", p."nombre", p."apellido", p."telefono", p."fechaIngreso", u."nombre" AS "liderNombre"
     FROM "Persona" p
     LEFT JOIN "User" u ON u."id" = p."asignadoAUserId" AND u."iglesiaId" = p."iglesiaId"
     WHERE p."iglesiaId"=$1
       AND p."deletedAt" IS NULL
       AND p."estado"='VISITANTE'
       AND p."fechaIngreso" IS NOT NULL
       AND p."fechaIngreso" <= TO_CHAR(CURRENT_DATE - INTERVAL '14 days', 'YYYY-MM-DD')
     ORDER BY p."fechaIngreso" ASC
     LIMIT 20`,
      [iglesiaId]
    ),

    pgMany(
      `SELECT s."proximoContacto", s."tipo", p."nombre", p."apellido", p."id" AS "personaId", p."telefono"
     FROM "Seguimiento" s
     JOIN "Persona" p ON p."id"=s."personaId" AND p."iglesiaId"=s."iglesiaId"
     WHERE s."iglesiaId"=$1
       AND s."deletedAt" IS NULL
       AND p."deletedAt" IS NULL
       AND s."proximoContacto" IS NOT NULL
       AND s."proximoContacto" < TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
       AND s."id" IN (
         SELECT MAX("id") FROM "Seguimiento"
         WHERE "iglesiaId"=$1 AND "proximoContacto" IS NOT NULL AND "deletedAt" IS NULL
         GROUP BY "personaId"
       )
     ORDER BY s."proximoContacto" ASC
     LIMIT 15`,
      [iglesiaId]
    ),

    pgMany(
      `SELECT "id", "nombre", "apellido", "telefono", "fechaNacimiento",
            TO_CHAR(("fechaNacimiento")::date, 'MM-DD') AS "cumDia"
     FROM "Persona"
     WHERE "iglesiaId"=$1
       AND "deletedAt" IS NULL
       AND "fechaNacimiento" IS NOT NULL
       AND "fechaNacimiento" <> ''
       AND "fechaNacimiento" ~ '^\\d{4}-\\d{2}-\\d{2}$'
       AND (
         MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM ("fechaNacimiento")::date)::int, EXTRACT(DAY FROM ("fechaNacimiento")::date)::int)
         BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
         OR
         MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM ("fechaNacimiento")::date)::int, EXTRACT(DAY FROM ("fechaNacimiento")::date)::int)
         BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       )
     LIMIT 20`,
      [iglesiaId]
    ).catch(() => []),
  ])

  res.json({
    sinAsistir: { data: sinAsistir, total: sinAsistir.length },
    sinSeguimiento: { data: sinSeguimiento, total: sinSeguimiento.length },
    visitantesSinConsolidar: { data: visitantesSinConsolidar, total: visitantesSinConsolidar.length },
    contactosVencidos: { data: contactosVencidos, total: contactosVencidos.length },
    cumpleanosSemana: { data: cumpleanosSemana, total: cumpleanosSemana.length },
    resumen: {
      total: sinAsistir.length + sinSeguimiento.length + visitantesSinConsolidar.length + contactosVencidos.length + cumpleanosSemana.length,
      critico: sinAsistir.length + contactosVencidos.length,
    },
  })
}))

export default router
