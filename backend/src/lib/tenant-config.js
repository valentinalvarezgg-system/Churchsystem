import { pgExec, pgMany } from './pg.js'

export async function readTenantConfig(iglesiaId) {
  const cfg = {}
  const rows = await pgMany(
    'SELECT "iglesiaId","clave","valor" FROM "Configuracion" WHERE "iglesiaId"=$1 OR "iglesiaId" IS NULL ORDER BY "iglesiaId" NULLS FIRST, "createdAt" ASC',
    [iglesiaId]
  )
  for (const row of rows) {
    try {
      cfg[row.clave] = JSON.parse(row.valor)
    } catch {
      cfg[row.clave] = row.valor
    }
  }
  return cfg
}

export async function upsertTenantConfig(iglesiaId, values = {}) {
  const changed = []
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue
    await pgExec(
      `INSERT INTO "Configuracion" ("iglesiaId","clave","valor","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("iglesiaId","clave")
       DO UPDATE SET "valor"=EXCLUDED."valor","updatedAt"=CURRENT_TIMESTAMP`,
      [iglesiaId, key, typeof value === 'string' ? value : JSON.stringify(value)],
    )
    changed.push(key)
  }
  return changed
}

export async function removeTenantConfigKeys(iglesiaId, keys = []) {
  for (const key of keys) {
    await pgExec(
      'DELETE FROM "Configuracion" WHERE "iglesiaId"=$1 AND "clave"=$2',
      [iglesiaId, key],
    )
  }
}
