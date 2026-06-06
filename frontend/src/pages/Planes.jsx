import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout.jsx'
import { apiFetch, getStoredContext } from '../services/api.js'
import { usePlan } from '../hooks/usePlan.js'
import { COMMERCIAL_PLAN_ORDER, getCommercialPlanUi } from '../lib/commercialPlans.js'
import { EMAILS } from '../utils/legal.js'
import { useOrientation } from '../hooks/useOrientation.js'

function CheckIcon({ color = '#22c55e', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M5.5 10.5L8.5 13.5L14.5 6.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowPathIcon({ color = 'var(--text-muted)', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        d="M6 7H14V15M14 7L5.5 15.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const SECTION_COPY = {
  es: {
    title: 'Elegí cómo querés operar Church System',
    subtitle: 'Dos líneas claras: liderazgo individual y operación completa para congregaciones. La plataforma queda lista para crecer sin rehacer permisos, comunicaciones ni cobros.',
    leadership: 'Planes para líderes',
    leadershipSub: 'Para pastores, líderes, discipuladores y equipos chicos.',
    church: 'Planes para iglesias',
    churchSub: 'Para congregaciones que necesitan operación, equipo y comunicación a escala.',
    current: 'Plan actual',
    freeOnly: 'Solo para nuevas cuentas',
    freeHint: 'El plan Free se activa desde registro y mantiene branding Church System.',
    checkout: 'Continuar con checkout',
    active: 'Plan actual',
    disabled: 'No disponible',
    payments: 'Pagos seguros vía Mercado Pago o suscripciones integradas.',
    cancel: 'Podés cambiar de plan o cancelar cuando quieras.',
    contact: 'Hablar con ventas',
    info: 'Incluye',
    audiences: {
      individual: 'Liderazgo',
      church: 'Iglesia',
    },
  },
  pt: {
    title: 'Escolha como quer operar o Church System',
    subtitle: 'Duas linhas claras: liderança individual e operação completa para congregações. A plataforma fica pronta para crescer sem refazer permissões, comunicações ou cobranças.',
    leadership: 'Planos para líderes',
    leadershipSub: 'Para pastores, líderes, discipuladores e equipes pequenas.',
    church: 'Planos para igrejas',
    churchSub: 'Para congregações que precisam de operação, equipe e comunicação em escala.',
    current: 'Plano atual',
    freeOnly: 'Apenas para novas contas',
    freeHint: 'O plano Free é ativado no cadastro e mantém branding Church System.',
    checkout: 'Continuar para checkout',
    active: 'Plano atual',
    disabled: 'Indisponível',
    payments: 'Pagamentos seguros via Mercado Pago ou assinaturas integradas.',
    cancel: 'Você pode mudar de plano ou cancelar quando quiser.',
    contact: 'Falar com vendas',
    info: 'Inclui',
    audiences: {
      individual: 'Liderança',
      church: 'Igreja',
    },
  },
  en: {
    title: 'Choose how you want to run Church System',
    subtitle: 'Two clear tracks: individual leadership and full church operations. The platform is ready to grow without redoing permissions, communications, or billing.',
    leadership: 'Plans for leaders',
    leadershipSub: 'For pastors, leaders, disciplers, and small teams.',
    church: 'Plans for churches',
    churchSub: 'For congregations that need operations, teams, and communication at scale.',
    current: 'Current plan',
    freeOnly: 'Only for new accounts',
    freeHint: 'The Free plan is activated during signup and keeps Church System branding.',
    checkout: 'Continue to checkout',
    active: 'Current plan',
    disabled: 'Unavailable',
    payments: 'Secure payments via Mercado Pago or integrated subscriptions.',
    cancel: 'You can change plans or cancel anytime.',
    contact: 'Talk to sales',
    info: 'Includes',
    audiences: {
      individual: 'Leadership',
      church: 'Church',
    },
  },
}

const CURRENCY_SYMBOL = {
  ARS: '$',
  USD: 'US$',
  BRL: 'R$',
  CLP: '$',
  COP: '$',
  MXN: '$',
  PEN: 'S/',
  UYU: '$U',
}

function formatPrice(value, currency) {
  const amount = Number(value || 0)
  return `${CURRENCY_SYMBOL[currency] || currency} ${amount.toLocaleString()}`
}

export default function Planes() {
  const ctx = getStoredContext()
  const lang = (ctx.lang || 'es').slice(0, 2)
  const tt = SECTION_COPY[lang] || SECTION_COPY.es
  const { plan: accessTier, commercialPlan, loading: loadingPlan } = usePlan()
  const { isPhone } = useOrientation()
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    apiFetch(`/plan/lista?country=${ctx.country || 'AR'}&lang=${lang}`)
      .then(list => setCatalog(Array.isArray(list) ? list : []))
      .catch(() => setCatalog([]))
  }, [ctx.country, lang])

  const plans = useMemo(() => {
    return COMMERCIAL_PLAN_ORDER
      .map(key => {
        const server = catalog.find(item => item.id === key)
        const ui = getCommercialPlanUi(key, lang)
        if (!server && !ui) return null
        return {
          key,
          audience: server?.audience || ui.group,
          free: !!server?.free || key === 'FREE',
          featured: !!server?.featured,
          accessTier: server?.accessTier || (key === 'CHURCH_100' ? 'PRO' : key === 'CHURCH_500' || key === 'CHURCH_1000' ? 'MAX' : key),
          personas: Number(server?.personas || 0),
          includedWhatsApp: Number(server?.includedWhatsApp || 0),
          includedSms: Number(server?.includedSms || 0),
          brandingRequired: !!server?.brandingRequired,
          currency: server?.currency || ctx.currency || 'ARS',
          price: Number(server?.precio || 0),
          label: server?.label || ui.name,
          description: server?.description || ui.description,
          features: ui.features,
          badge: ui.badge || '',
        }
      })
      .filter(Boolean)
  }, [catalog, ctx.currency, lang])

  const currentPlanKey = commercialPlan || accessTier
  const grouped = {
    leadership: plans.filter(plan => plan.audience === 'individual' || plan.audience === 'leadership'),
    church: plans.filter(plan => plan.audience === 'church'),
  }

  async function handleUpgrade(plan) {
    if (!plan || plan.key === currentPlanKey) return
    if (plan.free) {
      setMsg({ tipo: 'info', texto: tt.freeHint })
      return
    }
    setLoading(plan.key)
    setMsg(null)
    try {
      const res = await apiFetch('/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({ plan: plan.key, frecuencia: 'mensual', metodo: 'mp' }),
      })
      if (res?.checkout_url || res?.init_point) {
        window.location.href = res.checkout_url || res.init_point
        return
      }
      if (res?.approvalUrl) {
        window.location.href = res.approvalUrl
        return
      }
      if (res?.error) {
        setMsg({ tipo: 'error', texto: res.error })
        return
      }
      setMsg({ tipo: 'info', texto: 'Preparando checkout...' })
    } catch (error) {
      setMsg({ tipo: 'error', texto: error.message || 'No se pudo iniciar el checkout.' })
    } finally {
      setLoading(null)
    }
  }

  const renderCard = plan => {
    const isCurrent = plan.key === currentPlanKey
    const buttonLabel = isCurrent
      ? tt.active
      : plan.free
        ? tt.freeOnly
        : tt.checkout

    return (
      <div key={plan.key} style={{
        borderRadius: 18,
        border: plan.featured ? '2px solid #6B5CFF' : '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: plan.featured ? '0 8px 32px rgba(107,92,255,0.18)' : 'none',
      }}>
        {(plan.featured || plan.badge) && (
          <div style={{
            background: 'linear-gradient(135deg,#6B5CFF,#4845D2)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
            padding: '6px 0',
            letterSpacing: '0.04em',
          }}>
            {plan.badge || 'Popular'}
          </div>
        )}

        <div style={{ padding: '22px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {tt.audiences[plan.audience] || plan.audience}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{plan.label}</div>
            </div>
            {isCurrent && (
              <div style={{
                alignSelf: 'flex-start',
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
              }}>
                {tt.current}
              </div>
            )}
          </div>

          <div style={{ fontSize: 14, color: 'var(--text-muted)', minHeight: 40, marginBottom: 18 }}>
            {plan.description}
          </div>

          <div style={{ marginBottom: 18 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: 'var(--text)' }}>
              {plan.free ? '0' : formatPrice(plan.price, plan.currency)}
            </span>
            {!plan.free && (
              <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--text-muted)' }}>/mes</span>
            )}
          </div>

          <button
            onClick={() => handleUpgrade(plan)}
            disabled={isCurrent || loading === plan.key}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              cursor: isCurrent ? 'default' : 'pointer',
              fontWeight: 700,
              fontSize: 14,
              opacity: isCurrent ? 0.65 : 1,
              background: isCurrent
                ? 'var(--border)'
                : plan.free
                  ? 'rgba(255,255,255,0.08)'
                  : 'linear-gradient(135deg,#6B5CFF,#4845D2)',
              color: isCurrent ? 'var(--text-muted)' : '#fff',
              marginBottom: 18,
            }}
          >
            {loading === plan.key ? '...' : buttonLabel}
          </button>

          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10 }}>{tt.info}</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {plan.features.map(feature => (
              <div key={feature} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <CheckIcon />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 12,
            display: 'grid',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            <div>Personas: {plan.personas >= 1000 ? '1000+' : plan.personas}</div>
            <div>WhatsApp incluidos: {plan.includedWhatsApp.toLocaleString()}</div>
            <div>SMS fallback: {plan.includedSms.toLocaleString()}</div>
            {plan.brandingRequired && <div>Branding Church System requerido</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout title="Planes">
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '24px 16px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            {tt.title}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 760, margin: '0 auto' }}>
            {tt.subtitle}
          </p>
          {!loadingPlan && currentPlanKey && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
              padding: '6px 14px',
              borderRadius: 20,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}>
              {tt.current}: <strong style={{ color: 'var(--text)' }}>{getCommercialPlanUi(currentPlanKey, lang).name}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 28 }}>
          <section>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{tt.leadership}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{tt.leadershipSub}</div>
            </div>
            <div style={{
              display: isPhone ? 'flex' : 'grid',
              flexDirection: isPhone ? 'column' : undefined,
              gridTemplateColumns: isPhone ? undefined : 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}>
              {grouped.leadership.map(renderCard)}
            </div>
          </section>

          <section>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{tt.church}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{tt.churchSub}</div>
            </div>
            <div style={{
              display: isPhone ? 'flex' : 'grid',
              flexDirection: isPhone ? 'column' : undefined,
              gridTemplateColumns: isPhone ? undefined : 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}>
              {grouped.church.map(renderCard)}
            </div>
          </section>
        </div>

        {msg && (
          <div style={{
            marginTop: 24,
            padding: '14px 18px',
            borderRadius: 12,
            background: msg.tipo === 'error' ? '#ef444418' : '#3b82f618',
            color: msg.tipo === 'error' ? '#ef4444' : '#60a5fa',
            border: `1px solid ${msg.tipo === 'error' ? '#ef444433' : '#3b82f633'}`,
            fontSize: 14,
            textAlign: 'center',
          }}>
            {msg.texto}
          </div>
        )}

        <div style={{
          marginTop: 34,
          padding: '18px 20px',
          borderRadius: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <CheckIcon color="#22c55e" /> {tt.payments}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <ArrowPathIcon /> {tt.cancel}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <CheckIcon color="var(--primary)" />
            <a href={`mailto:${EMAILS.ventas}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              {tt.contact}
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}
