import { useState, useEffect } from 'react'
import { useNotificaciones } from '../hooks/useNotificaciones.js'

export default function BannerNotificaciones() {
  const { estado, activar } = useNotificaciones()
  const [visible, setVisible] = useState(false)
  const [activando, setActivando] = useState(false)

  useEffect(() => {
    if (estado === 'sin-soporte' || estado === 'denegado' || estado === 'activo') return
    const yaRespondio = localStorage.getItem('notif-respuesta')
    if (!yaRespondio) {
      const t = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(t)
    }
  }, [estado])

  if (!visible) return null

  async function handleActivar() {
    setActivando(true)
    const ok = await activar()
    if (ok) {
      localStorage.setItem('notif-respuesta', 'si')
      setVisible(false)
    } else {
      setActivando(false)
    }
  }

  function handleCerrar() {
    localStorage.setItem('notif-respuesta', 'no')
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9998,
      maxWidth: 420,
      width: 'calc(100% - 32px)',
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111' }}>
          ¿Activar notificaciones?
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#666' }}>
          Recibí alertas de seguimientos vencidos y cumpleaños.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleCerrar}
            disabled={activando}
            style={{
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: '#444',
              cursor: activando ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Ahora no
          </button>
          <button
            onClick={handleActivar}
            disabled={activando}
            style={{
              background: activando ? '#8B7FE8' : '#6D5DFB',
              border: 'none',
              borderRadius: 8,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: activando ? 'wait' : 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {activando ? (
              <>
                <span className="spinner-xs" />
                Activando...
              </>
            ) : (
              'Activar'
            )}
          </button>
        </div>
      </div>
      <button
        onClick={handleCerrar}
        disabled={activando}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: activando ? 'not-allowed' : 'pointer',
          padding: 4,
          fontSize: 18,
          lineHeight: 1,
          color: '#999',
          transition: 'color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => !activando && (e.currentTarget.style.color = '#333')}
        onMouseLeave={e => e.currentTarget.style.color = '#999'}
      >
        ×
      </button>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        [data-theme="dark"] .cs-notif-banner {
          background: rgba(20, 23, 32, 0.85) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>
    </div>
  )
}
