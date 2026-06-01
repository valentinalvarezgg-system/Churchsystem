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
    <div className="cs-notif-banner" style={{
      position: 'fixed',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9998,
      maxWidth: 420,
      width: 'calc(100% - 32px)',
      background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          ¿Activar notificaciones?
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Recibí alertas de seguimientos vencidos y cumpleaños.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleCerrar}
            disabled={activando}
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-2)',
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
          color: 'var(--text-faint)',
          transition: 'color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => !activando && (e.currentTarget.style.color = 'var(--text)')}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
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
