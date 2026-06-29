import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getStoredContext, getUser } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import Icons from '../components/Icons.jsx'
import { COMMERCIAL_PLAN_ORDER, getCommercialPlanUi, normalizeCommercialPlan } from '../lib/commercialPlans.js'

const MERCADOPAGO_COUNTRIES = new Set(['AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'UY'])

function PlanCard({ plan, current, loading, onSuscribir, lang }) {
  const ui = getCommercialPlanUi(plan.id, lang)
  const selectedPrice = Number(plan.precio ?? 0)
  const currency = plan.currency || 'USD'
  const isFeatured = !!plan.featured || ui.badge === 'Más popular'
  return (
    <div style={{
      background: 'var(--surface)',
      border: `2px solid ${current ? 'var(--c-success)' : isFeatured ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 18,
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      position: 'relative',
      flex: '1 1 280px',
      minWidth: 260,
    }}>
      {(isFeatured || current) && (
        <div style={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: current ? 'var(--c-success)' : 'var(--primary)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 14px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
        }}>
          {current ? 'Plan actual' : (ui.badge || 'Recomendado')}
        </div>
      )}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{plan.label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{plan.description || ui.description}</div>
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--primary)' }}>
            {currency === 'USD' ? 'USD ' : ''}${selectedPrice.toLocaleString('es-AR')}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}> / mes</span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {currency} · hasta {Number(plan.personas || 0).toLocaleString('es-AR')} personas
          </div>
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(ui.features || []).map(feature => (
          <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
            <Icons.CheckCircle size={14} color="var(--c-success)" style={{ flexShrink: 0, marginTop: 2 }} />
            {feature}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto' }}>
        {current ? (
          <div style={{
            textAlign: 'center',
            padding: '10px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            background: 'var(--c-success-bg)',
            color: 'var(--c-success)',
          }}>
            <Icons.CheckCircle size={14} /> Plan activo para tu iglesia
          </div>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading} onClick={() => onSuscribir(plan.id)}>
            {loading ? <span className="spinner-sm" /> : `Ir al checkout de ${plan.label}`}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Billing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = getUser()
  const storedContext = getStoredContext()
  const country = String(user?.pais || storedContext.country || 'AR').toUpperCase()
  const lang = String(user?.idioma || storedContext.lang || 'es').slice(0, 2)
  const [estado, setEstado] = useState(null)
  const [plans, setPlans] = useState([])
  const [loadingPlan, setLoadingPlan] = useState(null)

  const cargar = useCallback(() => {
    Promise.all([
      apiFetch('/subscriptions/billing-estado'),
      apiFetch(`/plan/lista?country=${country}&lang=${lang}`, { skipAuthRedirect: true }),
    ])
      .then(([billingState, planCatalog]) => {
        setEstado(billingState)
        setPlans(Array.isArray(planCatalog) ? planCatalog : [])
      })
      .catch(() => toast.error('No se pudo cargar el estado de facturación'))
  }, [country, lang])

  useEffect(() => {
    cargar()
    if (searchParams.get('pago') === 'ok') {
      toast.success('Checkout iniciado. Tu plan se actualizará cuando el proveedor confirme el cobro.')
    }
    if (searchParams.get('onboarding') === '1') {
      toast.success('Configuración inicial lista. Revisá facturación para dejar preparado el plan comercial de tu iglesia.')
    }
  }, [cargar, searchParams])

  async function suscribir(planKey) {
    setLoadingPlan(planKey)
    const platform = MERCADOPAGO_COUNTRIES.has(country) ? 'mercadopago' : 'paypal'
    try {
      const data = await apiFetch('/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({
          plan: planKey,
          planName: planKey,
          platform,
          frequency: 'mensual',
        }),
      })
      const checkoutUrl = data?.checkoutUrl || data?.checkout_url || data?.init_point || data?.initPoint || data?.approveUrl || data?.approvalUrl
      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      toast.error('No se pudo iniciar el checkout.')
    } catch (err) {
      toast.error(err?.message || 'Error al crear la suscripción')
    } finally {
      setLoadingPlan(null)
    }
  }

  if (!estado) {
    return (
      <div className="layout"><Menu />
        <main className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <span className="spinner-sm" />
        </main>
      </div>
    )
  }

  const commercialPlans = COMMERCIAL_PLAN_ORDER
    .map(key => plans.find(plan => String(plan.id || '').toUpperCase() === key))
    .filter(Boolean)
    .filter(plan => !plan.free)

  const groupedPlans = [
    {
      key: 'leadership',
      title: lang === 'pt' ? 'Liderança e equipes' : lang === 'en' ? 'Leadership and teams' : 'Liderazgo y equipos',
      subtitle: lang === 'pt'
        ? 'Para líderes, equipes pastorais e operação semanal.'
        : lang === 'en'
          ? 'For leaders, pastoral teams, and weekly operations.'
          : 'Para líderes, equipos pastorales y operación semanal.',
      plans: commercialPlans.filter(plan => getCommercialPlanUi(plan.id, lang).group === 'leadership'),
    },
    {
      key: 'church',
      title: lang === 'pt' ? 'Operação completa da igreja' : lang === 'en' ? 'Full church operations' : 'Operación completa de la iglesia',
      subtitle: lang === 'pt'
        ? 'Para congregações com escala, comunicação e múltiplos responsáveis.'
        : lang === 'en'
          ? 'For congregations with scale, communications, and multiple leaders.'
          : 'Para congregaciones con escala, comunicación y múltiples responsables.',
      plans: commercialPlans.filter(plan => getCommercialPlanUi(plan.id, lang).group === 'church'),
    },
  ].filter(group => group.plans.length > 0)

  const currentPlan = normalizeCommercialPlan(estado.planPago || estado.efectivePlan || 'FREE') || 'FREE'
  const {
    enTrial, diasTrial, trialFin, suscActiva, suscVence, efectivePlan, enGracia, diasGracia, estadoSus,
  } = estado

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Facturación y plan</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              Elegí el plan comercial de tu iglesia y continuá al checkout real.
            </p>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Estado actual</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {enTrial && (
                <div style={{ padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 220, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1 }}>Trial activo</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>{diasTrial} días</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Hasta {trialFin || '—'} · plan efectivo {efectivePlan || 'PRO'}</div>
                </div>
              )}

              {suscActiva && (
                <div style={{ padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 220, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-success)', textTransform: 'uppercase', letterSpacing: 1 }}>Suscripción activa</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>{currentPlan}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Vence {suscVence || '—'} · estado {estadoSus || 'active'}</div>
                </div>
              )}

              {enGracia && (
                <div style={{ padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 220, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-warning)', textTransform: 'uppercase', letterSpacing: 1 }}>Período de gracia</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>{diasGracia} días</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Regularizá el cobro para no perder acceso.</div>
                </div>
              )}

              {!enTrial && !suscActiva && !enGracia && (
                <div style={{ padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 220, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-danger)', textTransform: 'uppercase', letterSpacing: 1 }}>Sin suscripción activa</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>Plan Free</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Elegí un plan pago para continuar con todos los módulos.</div>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              {enTrial ? 'Elegí el plan que quedará activo cuando termine el trial' : 'Elegí el plan comercial de tu iglesia'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
              El checkout usa {MERCADOPAGO_COUNTRIES.has(country) ? 'Mercado Pago' : 'PayPal'} según tu país/configuración actual.
            </p>

            {groupedPlans.map(group => (
              <div key={group.key} style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', color: 'var(--primary)' }}>{group.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{group.subtitle}</div>
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {group.plans.map(plan => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      lang={lang}
                      current={currentPlan === normalizeCommercialPlan(plan.id) && (suscActiva || enTrial)}
                      onSuscribir={suscribir}
                      loading={loadingPlan === plan.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {suscActiva && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Gestionar suscripción</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Si necesitás ajustar configuración comercial, medios de cobro o revisar integraciones, seguí desde Configuración.
              </p>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/configuracion')}>
                Ir a Configuración
              </button>
            </div>
          )}

          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Preguntas frecuentes</h3>
            {[
              ['¿Pierdo mis datos si cancelo?', 'No. Tus datos se conservan durante 90 días después de la cancelación.'],
              ['¿Puedo cambiar de plan en cualquier momento?', 'Sí. Podés iniciar un checkout nuevo para el plan objetivo y luego coordinar la transición comercial.'],
              ['¿Cómo se realiza el cobro?', 'Church System deriva al checkout real del proveedor configurado para tu país.'],
              ['¿Esto impacta el onboarding?', 'Sí. Cuando el proveedor confirma la suscripción, la iglesia queda marcada con facturación confirmada en el onboarding.'],
            ].map(([q, a]) => (
              <div key={q} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{q}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
