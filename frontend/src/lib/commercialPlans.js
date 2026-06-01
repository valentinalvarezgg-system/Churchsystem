export const COMMERCIAL_PLAN_ORDER = ['FREE', 'STARTER', 'PRO', 'MAX', 'CHURCH_100', 'CHURCH_500', 'CHURCH_1000']

export const COMMERCIAL_TO_ACCESS = {
  FREE: 'STARTER',
  STARTER: 'STARTER',
  PRO: 'PRO',
  MAX: 'MAX',
  CHURCH_100: 'PRO',
  CHURCH_500: 'MAX',
  CHURCH_1000: 'MAX',
  LIDER: 'STARTER',
  CULTO: 'STARTER',
  CONSOLIDACION: 'PRO',
  ADMINISTRACION: 'PRO',
  GENERAL: 'PRO',
}

export function resolveAccessTier(plan = 'STARTER') {
  const key = String(plan || 'STARTER').trim().toUpperCase()
  return COMMERCIAL_TO_ACCESS[key] || (COMMERCIAL_TO_ACCESS[key.replace('+', '')] || 'STARTER')
}

export function normalizeCommercialPlan(plan = '') {
  const key = String(plan || '').trim().toUpperCase()
  if (COMMERCIAL_PLAN_ORDER.includes(key)) return key
  const aliases = {
    BASICO: 'STARTER',
    ESTANDAR: 'PRO',
    CHURCH100: 'CHURCH_100',
    CHURCH500: 'CHURCH_500',
    CHURCH1000: 'CHURCH_1000',
  }
  return aliases[key] || (COMMERCIAL_PLAN_ORDER.includes(key.replace('+', '')) ? key.replace('+', '') : '')
}

export const COMMERCIAL_PLAN_UI = {
  FREE: {
    group: 'leadership',
    name: 'Free',
    badge: 'Probar',
    description: {
      es: 'Para probar Church System sin riesgo.',
      pt: 'Para testar o Church System sem risco.',
      en: 'To try Church System with no risk.',
    },
    features: {
      es: ['Hasta 50 personas', '1 administrador', 'Check-in básico', 'Branding Church System'],
      pt: ['Até 50 pessoas', '1 administrador', 'Check-in básico', 'Branding Church System'],
      en: ['Up to 50 people', '1 admin', 'Basic check-in', 'Church System branding'],
    },
  },
  STARTER: {
    group: 'leadership',
    name: 'Starter',
    description: {
      es: 'Base operativa para líderes y equipos pastorales.',
      pt: 'Base operacional para líderes e equipes pastorais.',
      en: 'Operational base for leaders and pastoral teams.',
    },
    features: {
      es: ['Dashboard', 'Personas y perfiles', 'Grupos', 'Check-in QR', '150 WhatsApp incluidos'],
      pt: ['Dashboard', 'Pessoas e perfis', 'Grupos', 'Check-in QR', '150 WhatsApp incluídos'],
      en: ['Dashboard', 'People profiles', 'Groups', 'QR check-in', '150 WhatsApp included'],
    },
  },
  PRO: {
    group: 'leadership',
    name: 'Pro',
    badge: 'Más popular',
    description: {
      es: 'Operación semanal completa para liderazgo activo.',
      pt: 'Operação semanal completa para liderança ativa.',
      en: 'Complete weekly operations for active leadership.',
    },
    features: {
      es: ['Todo Starter', 'Asistencia y cultos', 'Mensajes y alertas', 'Reportes', '500 WhatsApp incluidos'],
      pt: ['Tudo do Starter', 'Presença e cultos', 'Mensagens e alertas', 'Relatórios', '500 WhatsApp incluídos'],
      en: ['Everything in Starter', 'Attendance and services', 'Messaging and alerts', 'Reports', '500 WhatsApp included'],
    },
  },
  MAX: {
    group: 'leadership',
    name: 'Max',
    description: {
      es: 'Escala avanzada para liderazgo con automatización.',
      pt: 'Escala avançada para liderança com automação.',
      en: 'Advanced scale for leadership with automation.',
    },
    features: {
      es: ['Todo Pro', 'Usuarios y permisos', 'Excel + IA', 'Asistente IA', '1.500 WhatsApp incluidos'],
      pt: ['Tudo do Pro', 'Usuários e permissões', 'Excel + IA', 'Assistente IA', '1.500 WhatsApp incluídos'],
      en: ['Everything in Pro', 'Users and permissions', 'Excel + AI', 'AI assistant', '1,500 WhatsApp included'],
    },
  },
  CHURCH_100: {
    group: 'church',
    name: 'Church 100',
    description: {
      es: 'Iglesias pequeñas con operación y comunicación activa.',
      pt: 'Igrejas pequenas com operação e comunicação ativa.',
      en: 'Small churches with active operations and communication.',
    },
    features: {
      es: ['Hasta 100 personas', 'Todo Pro', '2.000 WhatsApp', '100 SMS fallback'],
      pt: ['Até 100 pessoas', 'Tudo do Pro', '2.000 WhatsApp', '100 SMS fallback'],
      en: ['Up to 100 people', 'Everything in Pro', '2,000 WhatsApp', '100 SMS fallback'],
    },
  },
  CHURCH_500: {
    group: 'church',
    name: 'Church 500',
    badge: 'Escala',
    description: {
      es: 'Iglesias medianas con seguimiento, reportes y comunicación fuerte.',
      pt: 'Igrejas médias com acompanhamento, relatórios e comunicação forte.',
      en: 'Medium churches with follow-up, reporting, and strong communication.',
    },
    features: {
      es: ['Hasta 500 personas', 'Todo Max', '8.000 WhatsApp', '300 SMS fallback'],
      pt: ['Até 500 pessoas', 'Tudo do Max', '8.000 WhatsApp', '300 SMS fallback'],
      en: ['Up to 500 people', 'Everything in Max', '8,000 WhatsApp', '300 SMS fallback'],
    },
  },
  CHURCH_1000: {
    group: 'church',
    name: 'Church 1000+',
    description: {
      es: 'Iglesias grandes o multisede con operación integral.',
      pt: 'Igrejas grandes ou multisite com operação integral.',
      en: 'Large or multi-campus churches with full operations.',
    },
    features: {
      es: ['Hasta 1.000+ personas', 'Todo Max', '20.000 WhatsApp', '800 SMS fallback'],
      pt: ['Até 1.000+ pessoas', 'Tudo do Max', '20.000 WhatsApp', '800 SMS fallback'],
      en: ['Up to 1,000+ people', 'Everything in Max', '20,000 WhatsApp', '800 SMS fallback'],
    },
  },
}

export function getCommercialPlanUi(planKey = 'PRO', lang = 'es') {
  const normalized = normalizeCommercialPlan(planKey) || 'PRO'
  const entry = COMMERCIAL_PLAN_UI[normalized] || COMMERCIAL_PLAN_UI.PRO
  return {
    key: normalized,
    group: entry.group,
    badge: entry.badge || '',
    name: entry.name,
    description: entry.description?.[lang] || entry.description?.es || entry.name,
    features: entry.features?.[lang] || entry.features?.es || [],
  }
}
