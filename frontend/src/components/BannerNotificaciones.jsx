import { useState, useEffect } from 'react'
import { useNotificaciones } from '../hooks/useNotificaciones.js'

/**
 * BannerNotificaciones — aparece una sola vez, suave, en la parte inferior
 * Pregunta si el usuario quiere activar las notificaciones
 */
export default function BannerNotificaciones() {
  const { estado, activar } = useNotificaciones()
  const [visible, setVisible]       = useState(false)
  const [activando, setActivando]   = useState(false)
  const [resultado, setResultado]   = useState(null) // 'ok' | 'error'

  useEffect(() => {
    // Mostrar solo si: tiene soporte, no fue respondido antes, y no está denegado
    if (estado === 'sin-soporte' || estado === 'denegado' || estado === 'activo') return
    const yaRespondio = localStorage.getItem('notif-respuesta')
    if (!yaRespondio) {
      // Esperar 5 segundos antes de mostrar
      const t = setTimeout(() => setVisible(true), 5000)
      return () => clearTimeout(t)
    }
  }, [estado])

  if (!visible) return null

  async function handleActivar() {
    setActivando(true)
    const ok = await activar()
    setActivando(false)
    if (ok) {
      setResultado('ok')
      localStorage.setItem('notif-respuesta', 'si')
      setTimeout(() => setVisible(false), 3000)
    } else {
      setResultado('error')
      localStorage.setItem('notif-respuesta', 'no')
    }
  }

  function handleRechazar() {
    localStorage.setItem('notif-respuesta', 'no')
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(94vw, 420px)',
      background: 'var(--surface)',
      border: '1px solid var(--border-med)',
      borderRadius: 16,
      padding: '14px 16px',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 1000,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      animation: 'slideUp .3s ease',
    }}>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(20px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>

      <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>
        {resultado === 'ok' ? '✅' : resultado === 'error' ? '❌' : '🔔'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {resultado === 'ok' ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
              ¡Notificaciones activadas!
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Te vamos a avisar sobre seguimientos, cumpleaños y alertas importantes.
            </div>
          </>
        ) : resultado === 'error' ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
              No se pudo activar
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Podés activarlas después desde Configuración.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>
              ¿Activar notificaciones?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              Recibí alertas de seguimientos vencidos, cumpleaños y visitantes sin consolidar.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleActivar}
                disabled={activando}
                style={{
                  padding: '8px 16px', borderRadius: 10, fontSize: 13,
                  fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: 'var(--primary)', color: 'white',
                  opacity: activando ? 0.7 : 1,
                }}>
                {activando ? '⏳ Activando...' : '🔔 Activar'}
              </button>
              <button
                onClick={handleRechazar}
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 13,
                  cursor: 'pointer', border: '1px solid var(--border-med)',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontWeight: 500,
                }}>
                Ahora no
              </button>
            </div>
          </>
        )}
      </div>

      {!resultado && (
        <button
          onClick={handleRechazar}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-faint)', fontSize: 16, padding: '2px 4px',
            flexShrink: 0, lineHeight: 1,
          }}>
          ✕
        </button>
      )}
    </div>
  )
}
