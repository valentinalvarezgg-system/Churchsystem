export const COUNTRIES = {
  AR: { code: 'AR', name: 'Argentina', currency: 'ARS', locale: 'es-AR', language: 'es', mercadoPago: true },
  BR: { code: 'BR', name: 'Brasil', currency: 'BRL', locale: 'pt-BR', language: 'pt', mercadoPago: true },
  CL: { code: 'CL', name: 'Chile', currency: 'CLP', locale: 'es-CL', language: 'es', mercadoPago: true },
  CO: { code: 'CO', name: 'Colombia', currency: 'COP', locale: 'es-CO', language: 'es', mercadoPago: true },
  MX: { code: 'MX', name: 'Mexico', currency: 'MXN', locale: 'es-MX', language: 'es', mercadoPago: true },
  PE: { code: 'PE', name: 'Peru', currency: 'PEN', locale: 'es-PE', language: 'es', mercadoPago: true },
  UY: { code: 'UY', name: 'Uruguay', currency: 'UYU', locale: 'es-UY', language: 'es', mercadoPago: true },
  US: { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', language: 'en', mercadoPago: false },
}

export const FALLBACK_COUNTRY = {
  code: 'INTL',
  name: 'Internacional',
  currency: 'USD',
  locale: 'en-US',
  language: 'en',
  mercadoPago: false,
}

export const ACCESS_TIERS = {
  STARTER: {
    key: 'STARTER',
    label: { es: 'Starter', pt: 'Starter', en: 'Starter' },
    personas: 300,
  },
  PRO: {
    key: 'PRO',
    label: { es: 'Pro', pt: 'Pro', en: 'Pro' },
    personas: 1000,
  },
  MAX: {
    key: 'MAX',
    label: { es: 'Max', pt: 'Max', en: 'Max' },
    personas: 99999,
  },
}

export const COMMERCIAL_PLANS = {
  FREE: {
    key: 'FREE',
    accessTier: 'STARTER',
    audience: 'individual',
    featured: false,
    free: true,
    ads: false,
    brandingRequired: true,
    personas: 50,
    includedWhatsApp: 0,
    includedSms: 0,
    labels: { es: 'Free', pt: 'Free', en: 'Free' },
    descriptions: {
      es: 'Para probar Church System sin riesgo.',
      pt: 'Para testar o Church System sem risco.',
      en: 'To try Church System with no risk.',
    },
    prices: { USD: 0, ARS: 0, BRL: 0, CLP: 0, COP: 0, MXN: 0, PEN: 0, UYU: 0 },
  },
  STARTER: {
    key: 'STARTER',
    accessTier: 'STARTER',
    audience: 'individual',
    featured: false,
    free: false,
    ads: false,
    brandingRequired: false,
    personas: 150,
    includedWhatsApp: 150,
    includedSms: 0,
    labels: { es: 'Starter', pt: 'Starter', en: 'Starter' },
    descriptions: {
      es: 'Base operativa para líderes y equipos pastorales.',
      pt: 'Base operacional para líderes e equipes pastorais.',
      en: 'Operational base for leaders and pastoral teams.',
    },
    prices: { USD: 19, ARS: 19000, BRL: 99, CLP: 18000, COP: 79000, MXN: 360, PEN: 72, UYU: 790 },
  },
  PRO: {
    key: 'PRO',
    accessTier: 'PRO',
    audience: 'individual',
    featured: true,
    free: false,
    ads: false,
    brandingRequired: false,
    personas: 500,
    includedWhatsApp: 500,
    includedSms: 0,
    labels: { es: 'Pro', pt: 'Pro', en: 'Pro' },
    descriptions: {
      es: 'Operación semanal completa para liderazgo activo.',
      pt: 'Operação semanal completa para liderança ativa.',
      en: 'Complete weekly operations for active leadership.',
    },
    prices: { USD: 39, ARS: 39000, BRL: 199, CLP: 36000, COP: 159000, MXN: 740, PEN: 145, UYU: 1590 },
  },
  MAX: {
    key: 'MAX',
    accessTier: 'MAX',
    audience: 'individual',
    featured: false,
    free: false,
    ads: false,
    brandingRequired: false,
    personas: 1000,
    includedWhatsApp: 1500,
    includedSms: 50,
    labels: { es: 'Max', pt: 'Max', en: 'Max' },
    descriptions: {
      es: 'Escala avanzada para liderazgo con automatización.',
      pt: 'Escala avançada para liderança com automação.',
      en: 'Advanced scale for leadership with automation.',
    },
    prices: { USD: 79, ARS: 79000, BRL: 399, CLP: 73000, COP: 319000, MXN: 1490, PEN: 295, UYU: 3190 },
  },
  CHURCH_100: {
    key: 'CHURCH_100',
    accessTier: 'PRO',
    audience: 'church',
    featured: false,
    free: false,
    ads: false,
    brandingRequired: false,
    personas: 100,
    includedWhatsApp: 2000,
    includedSms: 100,
    labels: { es: 'Church 100', pt: 'Church 100', en: 'Church 100' },
    descriptions: {
      es: 'Iglesias pequeñas con operación y comunicación activa.',
      pt: 'Igrejas pequenas com operação e comunicação ativa.',
      en: 'Small churches with active operations and communication.',
    },
    prices: { USD: 129, ARS: 129000, BRL: 649, CLP: 119000, COP: 519000, MXN: 2450, PEN: 480, UYU: 5190 },
  },
  CHURCH_500: {
    key: 'CHURCH_500',
    accessTier: 'MAX',
    audience: 'church',
    featured: true,
    free: false,
    ads: false,
    brandingRequired: false,
    personas: 500,
    includedWhatsApp: 8000,
    includedSms: 300,
    labels: { es: 'Church 500', pt: 'Church 500', en: 'Church 500' },
    descriptions: {
      es: 'Iglesias medianas con seguimiento, reportes y comunicación fuerte.',
      pt: 'Igrejas médias com acompanhamento, relatórios e comunicação forte.',
      en: 'Medium churches with follow-up, reporting, and strong communication.',
    },
    prices: { USD: 249, ARS: 249000, BRL: 1249, CLP: 229000, COP: 999000, MXN: 4750, PEN: 930, UYU: 9990 },
  },
  CHURCH_1000: {
    key: 'CHURCH_1000',
    accessTier: 'MAX',
    audience: 'church',
    featured: false,
    free: false,
    ads: false,
    brandingRequired: false,
    personas: 1000,
    includedWhatsApp: 20000,
    includedSms: 800,
    labels: { es: 'Church 1000+', pt: 'Church 1000+', en: 'Church 1000+' },
    descriptions: {
      es: 'Iglesias grandes o multisede con operación integral.',
      pt: 'Igrejas grandes ou multisite com operação integral.',
      en: 'Large or multi-campus churches with full operations.',
    },
    prices: { USD: 499, ARS: 499000, BRL: 2499, CLP: 459000, COP: 1999000, MXN: 9490, PEN: 1870, UYU: 19990 },
  },
}

export const PLANES = Object.fromEntries(
  Object.entries(COMMERCIAL_PLANS).map(([key, plan]) => [
    key,
    {
      ...plan,
      label: plan.labels,
      description: plan.descriptions,
    },
  ])
)

export const COMMERCIAL_TO_ACCESS = Object.fromEntries(
  Object.values(COMMERCIAL_PLANS).map(plan => [plan.key, plan.accessTier])
)

export const LEGACY_PLAN_MAP = {
  lider: 'STARTER',
  culto: 'PRO',
  consolidacion: 'PRO',
  administracion: 'MAX',
  general: 'MAX',
  basico: 'STARTER',
  estandar: 'PRO',
  pro: 'PRO',
  starter: 'STARTER',
  max: 'MAX',
  free: 'FREE',
  church100: 'CHURCH_100',
  church_100: 'CHURCH_100',
  church500: 'CHURCH_500',
  church_500: 'CHURCH_500',
  church1000: 'CHURCH_1000',
  church_1000: 'CHURCH_1000',
}

export function normalizeCountry(code = '') {
  const normalized = String(code || '').trim().toUpperCase()
  return COUNTRIES[normalized] || FALLBACK_COUNTRY
}

export function normalizeLanguage(language = '', country = FALLBACK_COUNTRY) {
  const raw = String(language || country.language || 'es').trim().toLowerCase().slice(0, 2)
  return ['es', 'pt', 'en'].includes(raw) ? raw : 'es'
}

export function normalizePlan(plan = 'PRO') {
  const raw = String(plan || 'PRO').trim()
  const key = LEGACY_PLAN_MAP[raw.toLowerCase()] || raw.toUpperCase()
  return COMMERCIAL_PLANS[key] ? key : 'PRO'
}

export function resolveAccessTier(plan = 'STARTER') {
  const commercialKey = normalizePlan(plan)
  return COMMERCIAL_TO_ACCESS[commercialKey] || 'STARTER'
}

export function getCommercialPlan(planKey = 'PRO') {
  return COMMERCIAL_PLANS[normalizePlan(planKey)]
}

export function currencyForCountry(countryCode = '') {
  return normalizeCountry(countryCode).currency
}

export function getPlanPrice(planKey, currency = 'USD') {
  const plan = getCommercialPlan(planKey)
  const cur = String(currency || 'USD').toUpperCase()
  return {
    amount: plan.prices[cur] ?? plan.prices.USD,
    currency: Object.prototype.hasOwnProperty.call(plan.prices, cur) ? cur : 'USD',
  }
}

export function getPlanCatalog({ country = 'AR', language } = {}) {
  const countryInfo = normalizeCountry(country)
  const lang = normalizeLanguage(language, countryInfo)
  return Object.values(COMMERCIAL_PLANS).map(plan => {
    const price = getPlanPrice(plan.key, countryInfo.currency)
    return {
      id: plan.key,
      label: plan.labels[lang] || plan.labels.es,
      description: plan.descriptions[lang] || plan.descriptions.es,
      accessTier: plan.accessTier,
      audience: plan.audience,
      featured: !!plan.featured,
      free: !!plan.free,
      brandingRequired: !!plan.brandingRequired,
      personas: plan.personas,
      includedWhatsApp: plan.includedWhatsApp,
      includedSms: plan.includedSms,
      precio: price.amount,
      currency: price.currency,
      country: countryInfo.code,
      mercadoPago: !plan.free && countryInfo.mercadoPago && price.currency !== 'USD',
    }
  })
}

export function formatMoney(amount, currency = 'USD', locale = 'es-AR') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: ['CLP', 'COP', 'ARS', 'UYU'].includes(currency) ? 0 : 2,
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
