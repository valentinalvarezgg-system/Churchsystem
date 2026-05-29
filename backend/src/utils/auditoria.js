import pino from 'pino'
import { pgExec } from '../lib/pg.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

export function registrar({ userId = null, email = '', rol = '', accion, entidad = '', entidadId = '', detalle = '', iglesiaId = null }) {
  if (!iglesiaId) return
  pgExec(
    `INSERT INTO "AuditLog" ("iglesiaId","userId","action","entity","entityId","detail","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`,
    [Number(iglesiaId), userId ? Number(userId) : null, String(accion || ''), String(entidad || ''), String(entidadId || ''), String(detalle || '')]
  ).catch(err => logger.error({ err: err?.message, email, rol }, 'AuditLog PG error'))
}
