export const COUNTRIES = {
  AR: { code:'AR', name:'Argentina', currency:'ARS', locale:'es-AR', language:'es', mercadoPago:true },
  BR: { code:'BR', name:'Brasil', currency:'BRL', locale:'pt-BR', language:'pt', mercadoPago:true },
  CL: { code:'CL', name:'Chile', currency:'CLP', locale:'es-CL', language:'es', mercadoPago:true },
  CO: { code:'CO', name:'Colombia', currency:'COP', locale:'es-CO', language:'es', mercadoPago:true },
  MX: { code:'MX', name:'Mexico', currency:'MXN', locale:'es-MX', language:'es', mercadoPago:true },
  PE: { code:'PE', name:'Peru', currency:'PEN', locale:'es-PE', language:'es', mercadoPago:true },
  UY: { code:'UY', name:'Uruguay', currency:'UYU', locale:'es-UY', language:'es', mercadoPago:true },
  US: { code:'US', name:'United States', currency:'USD', locale:'en-US', language:'en', mercadoPago:false },
}

export const FALLBACK_COUNTRY = {
  code:'INTL',
  name:'Internacional',
  currency:'USD',
  locale:'en-US',
  language:'en',
  mercadoPago:false,
}

export const PLANES = {
  LIDER: {
    key:'LIDER',
    label:{ es:'Lider', pt:'Lider', en:'Leader' },
    personas:100,
    precios:{ USD:15, ARS:15000, BRL:75, CLP:14000, COP:60000, MXN:280, PEN:55, UYU:600 },
  },
  CULTO: {
    key:'CULTO',
    label:{ es:'Culto', pt:'Culto', en:'Service' },
    personas:250,
    precios:{ USD:30, ARS:30000, BRL:150, CLP:28000, COP:120000, MXN:560, PEN:110, UYU:1200 },
  },
  CONSOLIDACION: {
    key:'CONSOLIDACION',
    label:{ es:'Consolidacion', pt:'Consolidacao', en:'Follow-up' },
    personas:500,
    precios:{ USD:50, ARS:50000, BRL:250, CLP:47000, COP:200000, MXN:950, PEN:185, UYU:2000 },
  },
  ADMINISTRACION: {
    key:'ADMINISTRACION',
    label:{ es:'Administracion', pt:'Administracao', en:'Administration' },
    personas:1000,
    precios:{ USD:80, ARS:80000, BRL:400, CLP:75000, COP:320000, MXN:1500, PEN:295, UYU:3200 },
  },
  GENERAL: {
    key:'GENERAL',
    label:{ es:'General', pt:'Geral', en:'General' },
    personas:99999,
    precios:{ USD:120, ARS:120000, BRL:600, CLP:112000, COP:480000, MXN:2250, PEN:440, UYU:4800 },
  },
}

export const LEGACY_PLAN_MAP = {
  basico:'LIDER',
  estandar:'CONSOLIDACION',
  pro:'GENERAL',
  lider:'LIDER',
  culto:'CULTO',
  consolidacion:'CONSOLIDACION',
  administracion:'ADMINISTRACION',
  general:'GENERAL',
}

export function normalizeCountry(code = '') {
  const normalized = String(code || '').trim().toUpperCase()
  return COUNTRIES[normalized] || FALLBACK_COUNTRY
}

export function normalizeLanguage(language = '', country = FALLBACK_COUNTRY) {
  const raw = String(language || country.language || 'es').trim().toLowerCase().slice(0, 2)
  return ['es','pt','en'].includes(raw) ? raw : 'es'
}

export function normalizePlan(plan = 'CONSOLIDACION') {
  const raw = String(plan || 'CONSOLIDACION').trim()
  const key = LEGACY_PLAN_MAP[raw.toLowerCase()] || raw.toUpperCase()
  return PLANES[key] ? key : 'CONSOLIDACION'
}

export function currencyForCountry(countryCode = '') {
  return normalizeCountry(countryCode).currency
}

export function getPlanPrice(planKey, currency = 'USD') {
  const plan = PLANES[normalizePlan(planKey)]
  const cur = String(currency || 'USD').toUpperCase()
  return {
    amount: plan.precios[cur] || plan.precios.USD,
    currency: plan.precios[cur] ? cur : 'USD',
  }
}

export function getPlanCatalog({ country = 'AR', language } = {}) {
  const countryInfo = normalizeCountry(country)
  const lang = normalizeLanguage(language, countryInfo)
  return Object.values(PLANES).map(plan => {
    const price = getPlanPrice(plan.key, countryInfo.currency)
    return {
      id: plan.key,
      label: plan.label[lang] || plan.label.es,
      personas: plan.personas,
      precio: price.amount,
      currency: price.currency,
      country: countryInfo.code,
      mercadoPago: countryInfo.mercadoPago && price.currency !== 'USD',
    }
  })
}

export function formatMoney(amount, currency = 'USD', locale = 'es-AR') {
  try {
    return new Intl.NumberFormat(locale, {
      style:'currency',
      currency,
      maximumFractionDigits: ['CLP','COP','ARS','UYU'].includes(currency) ? 0 : 2,
    }).format(Number(amount || 0))
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`
  }
}

export function applyDiscount(amount, percentage = 0) {
  const pct = Math.max(0, Math.min(100, Number(percentage || 0)))
  const base = Number(amount || 0)
  const discounted = Math.round((base * (100 - pct) / 100) * 100) / 100
  return { amount: discounted, discountAmount: Math.round((base - discounted) * 100) / 100 }
}

export function publicBillingContext({ country, currency, language } = {}) {
  const countryInfo = normalizeCountry(country)
  const lang = normalizeLanguage(language, countryInfo)
  const selectedCurrency = String(currency || countryInfo.currency || 'USD').toUpperCase()
  return {
    country: countryInfo.code,
    countryName: countryInfo.name,
    currency: selectedCurrency,
    language: lang,
    locale: countryInfo.locale,
    mercadoPago: countryInfo.mercadoPago && selectedCurrency !== 'USD',
    fallbackCurrency: selectedCurrency === 'USD' || !countryInfo.mercadoPago,
  }
}
