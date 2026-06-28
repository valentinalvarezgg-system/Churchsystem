/**
 * pricing.js — Precios de suscripción recurrente y cotización USD/ARS.
 *
 * Fuente de verdad para los montos cobrados vía MP Preapproval.
 * El catálogo visual (billing.js) es diferente — aquí están los precios de cobro.
 */
import https from 'https'
import logger from './logger.js'
import { getCommercialPlan } from './billing.js'

// ── Caché en memoria de la cotización ────────────────────────────
let _cotizacion  = null
let _fetchedAt   = 0
const CACHE_TTL  = 23 * 3600 * 1000 // 23 horas

/**
 * Devuelve la cotización oficial USD → ARS.
 * Fuentes (en orden de prioridad):
 *   1. Variable de entorno COTIZACION_USD_ARS  (override manual / GodMode)
 *   2. Caché en memoria (< 23 hs)
 *   3. API pública dolarapi.com — cotización oficial BCRA
 *      TODO: Migrar a endpoint oficial del BCRA si se necesita SLA garantizado.
 *   4. Fallback: último valor cacheado ó 1200
 */
export async function getCotizacion() {
  const fromEnv = Number(process.env.COTIZACION_USD_ARS)
  if (fromEnv > 0) return fromEnv

  if (_cotizacion && Date.now() - _fetchedAt < CACHE_TTL) return _cotizacion

  try {
    const val = await _fetchBCRA()
    if (val > 0) {
      _cotizacion = val
      _fetchedAt  = Date.now()
      logger.info({ cotizacion: val }, 'Cotización USD/ARS actualizada desde BCRA')
      return val
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo obtener cotización BCRA')
  }

  return _cotizacion || 1200
}

/** Invalida el caché para forzar un refresh en el próximo getCotizacion(). */
export function invalidarCotizacion() {
  _fetchedAt = 0
}

function _fetchBCRA() {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'dolarapi.com',
        path:     '/v1/dolares/oficial',
        method:   'GET',
        headers:  { Accept: 'application/json', 'User-Agent': 'ChurchSystem/3.1' },
      },
      res => {
        let data = ''
        res.on('data', c => { data += c })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            const venta  = Number(parsed.venta || 0)
            if (venta > 0) resolve(venta)
            else reject(new Error('Cotización BCRA inválida: ' + data.slice(0, 80)))
          } catch (e) { reject(e) }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(8000, () => req.destroy(new Error('Timeout BCRA fetch')))
    req.end()
  })
}

/**
 * Calcula el monto en ARS para un plan usando la cotización actual.
 * @param {string} plan
 * @returns {Promise<{ usd: number, ars: number, cotizacion: number }>}
 */
export async function montoARS(plan) {
  const commercial = getCommercialPlan(plan)
  const usd = Number(commercial?.prices?.USD || 0)
  if (!commercial || commercial.free || !(usd > 0)) {
    throw new Error(`Plan desconocido para pricing: ${plan}`)
  }
  const cotizacion = await getCotizacion()
  const ars = Math.round(usd * cotizacion)
  return { usd, ars, cotizacion }
}
