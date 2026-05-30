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
  STARTER: {
    key:'STARTER',
    label:{ es:'Starter', pt:'Starter', en:'Starter' },
    personas:300,
    precios:{ USD:29, ARS:29000, BRL:149, CLP:28000, COP:120000, MXN:550, PEN:110, UYU:1150 },
  },
  PRO: {
    key:'PRO',
    label:{ es:'Pro', pt:'Pro', en:'Pro' },
    personas:1000,
    precios:{ USD:59, ARS:59000, BRL:299, CLP:55000, COP:230000, MXN:1100, PEN:220, UYU:2350 },
  },
  MAX: {
    key:'MAX',
    label:{ es:'Max', pt:'Max', en:'Max' },
    personas:99999,
    precios:{ USD:99, ARS:99000, BRL:499, CLP:92000, COP:390000, MXN:1850, PEN:365, UYU:3950 },
  },
}

export const LEGACY_PLAN_MAP = {
  // Legacy 5-plan keys
  lider:'STARTER',
  culto:'STARTER',
  consolidacion:'PRO',
  administracion:'PRO',
  general:'MAX',
  // Old lowercase aliases
  basico:'STARTER',
  estandar:'PRO',
  pro:'PRO',
  // New 3-plan lowercase
  starter:'STARTER',
  max:'MAX',
}

export function normalizeCountry(code = '') {
  const normalized = String(code || '').trim().toUpperCase()
  return COUNTRIES[normalized] || FALLBACK_COUNTRY
}

export function normalizeLanguage(language = '', country = FALLBACK_COUNTRY) {
  const raw = String(language || country.language || 'es').trim().toLowerCase().slice(0, 2)
  return ['es','pt','en'].includes(raw) ? raw : 'es'
}

export function normalizePlan(plan = 'PRO') {
  const raw = String(plan || 'PRO').trim()
  const key = LEGACY_PLAN_MAP[raw.toLowerCase()] || raw.toUpperCase()
  return PLANES[key] ? key : 'PRO'
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
