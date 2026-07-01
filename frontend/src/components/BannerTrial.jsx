import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../services/api.js'
import Icons from './Icons.jsx'

export default function BannerTrial() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    apiFetch('/subscriptions/billing-estado')
      .then(d => setEstado(d))
      .catch(() => {})
  }, [])

  if (!estado || dismissed) return null

  const { enTrial, diasTrial, trialFin, enGracia, diasGracia, suscActiva, efectivePlan } = estado

  // Suscripción activa sin problemas: sin banner
  if (suscActiva && !enGracia) return null
  // Post-trial degradado y sin gracia
  if (!enTrial && !enGracia && !suscActiva && efectivePlan === 'FREE') {
    return (
      <div style={{
        background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.2)',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <Icons.Shield size={16} color="var(--primary)" />
        <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>
          Tu período de prueba terminó. Suscribite para retomar el acceso completo.
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/billing')}>Ver planes</button>
      </div>
    )
  }

  // Gracia activa: rojo urgente
  if (enGracia) {
    return (
      <div style={{
        background: 'var(--c-danger-bg)', borderBottom: '1px solid rgba(220,38,38,0.25)',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <Icons.AlertTriangle size={16} color="var(--c-danger)" />
        <span style={{ fontSize: 13, color: 'var(--c-danger)', flex: 1, fontWeight: 600 }}>
          Problema con tu pago — {diasGracia} día{diasGracia !== 1 ? 's' : ''} de gracia restantes
        </span>
        <button className="btn btn-sm" style={{ background: 'var(--c-danger)', color: '#fff', border: 'none' }}
          onClick={() => navigate('/billing')}>
          Actualizar pago
        </button>
      </div>
    )
  }

  // Trial activo
  if (enTrial) {
    const color = diasTrial <= 3 ? 'var(--c-warning)' : 'var(--primary)'
    const bg    = diasTrial <= 3 ? 'rgba(217,119,6,0.08)' : 'rgba(99,102,241,0.06)'
    const border= diasTrial <= 3 ? 'rgba(217,119,6,0.2)' : 'rgba(99,102,241,0.15)'
    return (
      <div style={{
        background: bg, borderBottom: `1px solid ${border}`,
        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <Icons.CheckCircle size={15} color={color} />
        <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>
          Trial PRO activo · <strong style={{ color }}>{diasTrial} día{diasTrial !== 1 ? 's' : ''}</strong> restantes
          {trialFin ? ` (hasta ${trialFin})` : ''}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/billing')}>Ver planes</button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 4 }}
          onClick={() => setDismissed(true)} aria-label="Cerrar">
          <Icons.X size={14} />
        </button>
      </div>
    )
  }

  return null
}
