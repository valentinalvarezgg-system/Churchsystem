import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { usePlan } from '../hooks/usePlan.js'

const PLANES = [
  {
    key: 'STARTER',
    nombre: 'Starter',
    precio: { ARS: 29000, USD: 29, BRL: 149, CLP: 27000, COP: 125000, MXN: 550, PEN: 115, UYU: 1200 },
    color: '#3b82f6',
    emoji: '🌱',
    descripcion: 'Para iglesias que están empezando a organizarse.',
    modulos: [
      'Dashboard de resumen',
      'Gestión de personas',
      'Grupos y células',
      'Comunicados',
      'Seguimiento pastoral',
      'Discipulado',
      'Check-in QR',
      'Analytics básico',
    ],
    limitaciones: [
      'Sin módulo de asistencia',
      'Sin mensajería masiva',
      'Sin reportes avanzados',
    ],
  },
  {
    key: 'PRO',
    nombre: 'Pro',
    precio: { ARS: 59000, USD: 59, BRL: 299, CLP: 55000, COP: 249000, MXN: 1100, PEN: 230, UYU: 2400 },
    color: '#6B5CFF',
    emoji: '⚡',
    descripcion: 'Para iglesias activas que necesitan herramientas completas.',
    destacado: true,
    modulos: [
      'Todo lo de Starter',
      'Asistencia a cultos',
      'Calendario de eventos',
      'Mensajería masiva',
      'Sistema de alertas',
      'Reportes avanzados',
      'Historial pastoral',
      'Consolidación',
      'Configuración avanzada',
    ],
    limitaciones: [
      'Sin gestión de usuarios',
      'Sin Asistente IA',
      'Sin backup automático',
    ],
  },
  {
    key: 'MAX',
    nombre: 'Max',
    precio: { ARS: 99000, USD: 99, BRL: 499, CLP: 92000, COP: 419000, MXN: 1850, PEN: 385, UYU: 4000 },
    color: '#f59e0b',
    emoji: '🚀',
    descripcion: 'Para iglesias que quieren el sistema completo sin límites.',
    modulos: [
      'Todo lo de Pro',
      'Gestión de usuarios',
      'Permisos por rol',
      'Asistente IA',
      'Excel + IA',
      'Backup automático',
      'Dashboard ejecutivo',
      'Cultos asignados por usuario',
      'Analytics completo',
    ],
    limitaciones: [],
  },
]

const CURRENCY_SYMBOL = {
  ARS: '$', USD: 'US$', BRL: 'R$', CLP: '$', COP: '$', MXN: '$', PEN: 'S/', UYU: '$U',
}
const CURRENCY_SUFFIX = {
  ARS: ' ARS', USD: '', BRL: '', CLP: ' CLP', COP: ' COP', MXN: ' MXN', PEN: '', UYU: '',
}

function formatPrice(valor, currency) {
  if (currency === 'USD' || currency === 'BRL' || currency === 'PEN') return valor.toLocaleString()
  return valor.toLocaleString()
}

export default function Planes() {
  const navigate = useNavigate()
  const user = getUser()
  const { plan: planActual } = usePlan()
  const currency = localStorage.getItem('church_currency') || 'USD'
  const [loading, setLoading] = useState(null)
  const [msg, setMsg] = useState(null)

  async function handleUpgrade(planKey) {
    if (planKey === planActual) return
    setLoading(planKey)
    setMsg(null)
    try {
      // Inicia el flujo de suscripción
      const res = await apiFetch('/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({ plan: planKey, frecuencia: 'mensual', metodo: 'mp' }),
      })
      if (res?.checkout_url || res?.init_point) {
        window.location.href = res.checkout_url || res.init_point
      } else if (res?.error) {
        setMsg({ tipo: 'error', texto: res.error })
      } else {
        setMsg({ tipo: 'info', texto: 'Redirigiendo al pago...' })
      }
    } catch (e) {
      setMsg({ tipo: 'error', texto: 'No se pudo iniciar el pago. Intentá de nuevo o contactá soporte.' })
    } finally {
      setLoading(null)
    }
  }

  const sym = CURRENCY_SYMBOL[currency] || 'US$'
  const suf = CURRENCY_SUFFIX[currency] || ''

  return (
    <Layout title="Planes">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Elegí el plan para tu iglesia
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
            Todos los planes incluyen acceso a la plataforma completa. Podés cambiar de plan en cualquier momento.
          </p>
          {planActual && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-muted)',
            }}>
              Plan actual: <strong style={{ color: 'var(--text)' }}>{planActual}</strong>
            </div>
          )}
        </div>

        {/* Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}>
          {PLANES.map(plan => {
            const esCurrent = plan.key === planActual
            const precio = plan.precio[currency] || plan.precio.USD

            return (
              <div key={plan.key} style={{
                borderRadius: 18,
                border: plan.destacado
                  ? `2px solid ${plan.color}`
                  : '1px solid var(--border)',
                background: 'var(--surface)',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: plan.destacado ? `0 4px 24px ${plan.color}22` : 'none',
              }}>
                {plan.destacado && (
                  <div style={{
                    background: plan.color,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: 'center',
                    padding: '5px 0',
                    letterSpacing: '0.05em',
                  }}>
                    ★ MÁS POPULAR
                  </div>
                )}

                <div style={{ padding: '24px 22px' }}>
                  {/* Encabezado del plan */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: `${plan.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      {plan.emoji}
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{plan.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{plan.descripcion}</div>
                    </div>
                  </div>

                  {/* Precio */}
                  <div style={{ marginBottom: 20 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: plan.color }}>
                      {sym}{formatPrice(precio, currency)}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>
                      {suf}/mes
                    </span>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={esCurrent || loading === plan.key}
                    style={{
                      width: '100%',
                      padding: '11px 0',
                      borderRadius: 12,
                      border: 'none',
                      cursor: esCurrent ? 'default' : 'pointer',
                      fontWeight: 700,
                      fontSize: 14,
                      transition: 'opacity .15s',
                      opacity: esCurrent ? 0.6 : 1,
                      background: esCurrent
                        ? 'var(--border)'
                        : `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                      color: esCurrent ? 'var(--text-muted)' : '#fff',
                      marginBottom: 18,
                    }}>
                    {loading === plan.key ? '...' : esCurrent ? '✓ Plan actual' : `Elegir ${plan.nombre}`}
                  </button>

                  {/* Módulos incluidos */}
                  <div style={{ marginBottom: 12 }}>
                    {plan.modulos.map((m, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '4px 0', fontSize: 13, color: 'var(--text)',
                      }}>
                        <span style={{ color: plan.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>

                  {/* Limitaciones */}
                  {plan.limitaciones.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      {plan.limitaciones.map((l, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '3px 0', fontSize: 12, color: 'var(--text-muted)',
                        }}>
                          <span style={{ flexShrink: 0, marginTop: 1 }}>–</span>
                          <span>{l}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Mensaje de estado */}
        {msg && (
          <div style={{
            marginTop: 24, padding: '14px 18px', borderRadius: 12,
            background: msg.tipo === 'error' ? '#ef444418' : '#3b82f618',
            color: msg.tipo === 'error' ? '#ef4444' : '#3b82f6',
            border: `1px solid ${msg.tipo === 'error' ? '#ef444433' : '#3b82f633'}`,
            fontSize: 14, textAlign: 'center',
          }}>
            {msg.texto}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 36, padding: '18px 20px', borderRadius: 14,
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>🔒</span> Pagos seguros via Mercado Pago
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>↩️</span> Cancelás cuando querés
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>💬</span>
            <a href="mailto:ventas@churchsystem.com.ar" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              Contactar ventas
            </a>
          </div>
        </div>

      </div>
    </Layout>
  )
}
