import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import Icons from '../components/Icons.jsx'

function PlanCard({ planKey, label, precio, moneda, features, current, onSuscribir, loading }) {
  const isPro = planKey === 'PRO'
  return (
    <div style={{
      background: 'var(--surface)', border: `2px solid ${isPro ? 'var(--primary)' : 'var(--border)'}`,
      borderRadius: 16, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16,
      position: 'relative', flex: '1 1 280px', maxWidth: 360,
    }}>
      {isPro && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700,
          padding: '3px 14px', borderRadius: 20,
        }}>Recomendado</div>
      )}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{label}</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary)' }}>
            {moneda === 'USD' ? 'USD ' : ''}${Number(precio).toLocaleString('es-AR')}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}> / mes</span>
          {moneda !== 'USD' && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{moneda}</div>}
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
            <Icons.CheckCircle size={14} color="var(--c-success)" style={{ flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto' }}>
        {current ? (
          <div style={{
            textAlign: 'center', padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: 'var(--c-success-bg)', color: 'var(--c-success)',
          }}>
            <Icons.CheckCircle size={14} /> Plan actual
          </div>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%' }}
            disabled={loading} onClick={() => onSuscribir(planKey)}>
            {loading ? <span className="spinner-sm" /> : `Suscribirse al plan ${label}`}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Billing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [estado, setEstado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(null)

  const cargar = useCallback(() => {
    apiFetch('/subscriptions/billing-estado')
      .then(d => setEstado(d))
      .catch(() => toast.error('No se pudo cargar el estado de facturación'))
  }, [])

  useEffect(() => {
    cargar()
    if (searchParams.get('pago') === 'ok') {
      toast.success('Pago procesado. Tu plan se actualizará en instantes.')
    }
  }, [cargar, searchParams])

  async function suscribir(planKey) {
    setLoadingPlan(planKey)
    setLoading(true)
    try {
      const data = await apiFetch('/subscriptions/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      if (data?.initPoint) {
        window.location.href = data.initPoint
      } else {
        toast.error('No se pudo iniciar el proceso de pago')
      }
    } catch (err) {
      toast.error(err?.message || 'Error al crear suscripción')
    } finally {
      setLoading(false)
      setLoadingPlan(null)
    }
  }

  const PRO_FEATURES = [
    'Hasta 500 personas',
    'Todos los módulos de gestión',
    'Seguimiento y alertas',
    'Asistencia y cultos',
    'Mensajes y comunicados',
    'Reportes e historial',
  ]
  const MAX_FEATURES = [
    'Hasta 1000 personas',
    'Todo lo de PRO',
    'Excel con IA',
    'Asistente IA pastoral',
    'Backup automático',
    'Módulos premium',
  ]

  if (!estado) return (
    <div className="layout"><Menu />
      <main className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <span className="spinner-sm" />
      </main>
    </div>
  )

  const { enTrial, diasTrial, trialFin, suscActiva, suscVence, efectivePlan, enGracia, diasGracia, montoPRO, montoMAX } = estado

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Facturación y plan</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Administrá tu suscripción y método de pago.</p>
          </div>

          {/* Estado actual */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Estado actual</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>

              {enTrial && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 200,
                  background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1 }}>Trial activo</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>
                    {diasTrial} día{diasTrial !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>hasta el {trialFin}</div>
                  <div style={{ marginTop: 8, height: 5, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min((diasTrial / 30) * 100, 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: 3 }} />
                  </div>
                </div>
              )}

              {suscActiva && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 200,
                  background: 'var(--c-success-bg)', border: '1px solid rgba(22,163,74,0.2)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-success)', textTransform: 'uppercase', letterSpacing: 1 }}>Suscripción activa</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>Plan {efectivePlan}</div>
                  {suscVence && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>próximo cobro: {suscVence}</div>}
                </div>
              )}

              {enGracia && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 200,
                  background: 'var(--c-danger-bg)', border: '1px solid rgba(220,38,38,0.2)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-danger)', textTransform: 'uppercase', letterSpacing: 1 }}>Período de gracia</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>
                    {diasGracia} día{diasGracia !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Actualizá tu pago para evitar interrupciones</div>
                </div>
              )}

              {!enTrial && !suscActiva && !enGracia && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10, flex: 1, minWidth: 200,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Plan actual</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>Free</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Suscribite para acceder a todas las funciones</div>
                </div>
              )}
            </div>
          </div>

          {/* Planes disponibles */}
          {!suscActiva && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                {enTrial ? 'Elegí tu plan para después del trial' : 'Elegí un plan'}
              </h3>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
                <PlanCard
                  planKey="PRO"
                  label="PRO"
                  precio={montoPRO?.ars || 14400}
                  moneda="ARS"
                  features={PRO_FEATURES}
                  current={efectivePlan === 'PRO' && suscActiva}
                  onSuscribir={suscribir}
                  loading={loadingPlan === 'PRO' && loading}
                />
                <PlanCard
                  planKey="MAX"
                  label="MAX"
                  precio={montoMAX?.ars || 30000}
                  moneda="ARS"
                  features={MAX_FEATURES}
                  current={efectivePlan === 'MAX' && suscActiva}
                  onSuscribir={suscribir}
                  loading={loadingPlan === 'MAX' && loading}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                Precios en ARS según cotización oficial USD/ARS del BCRA.
                PRO: USD {montoPRO?.usd || 12}/mes · MAX: USD {montoMAX?.usd || 25}/mes.
              </p>
            </>
          )}

          {/* Cancelar suscripción */}
          {suscActiva && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Gestionar suscripción</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Para cambiar de plan o cancelar tu suscripción, contactanos por email o usá el portal de Mercado Pago.
              </p>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--c-danger)' }}
                onClick={() => navigate('/app/configuracion')}>
                Ir a Configuración
              </button>
            </div>
          )}

          {/* Preguntas frecuentes */}
          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Preguntas frecuentes</h3>
            {[
              ['¿Pierdo mis datos si cancelo?', 'No. Tus datos se conservan durante 90 días después de la cancelación.'],
              ['¿Puedo cambiar de plan en cualquier momento?', 'Sí, podés cambiar de plan contactándonos. Los cambios aplican desde el próximo ciclo de facturación.'],
              ['¿Cómo se realiza el cobro?', 'A través de Mercado Pago con suscripción recurrente mensual. Podés cancelar cuando quieras.'],
              ['¿El precio incluye IVA?', 'Los precios mostrados no incluyen IVA. Se aplica según la legislación del país de facturación.'],
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
