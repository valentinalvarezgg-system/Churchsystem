import { useState } from 'react'
import { useNotificaciones } from '../hooks/useNotificaciones.js'

const ESTADO_LABEL = {
  idle:          { icon: '🔕', label: 'Desactivadas',    color: 'var(--text-muted)' },
  solicitando:   { icon: '⏳', label: 'Activando...',    color: 'var(--c-warning)'  },
  activo:        { icon: '🔔', label: 'Activas',         color: 'var(--c-success)'  },
  denegado:      { icon: '🚫', label: 'Bloqueadas',      color: 'var(--c-danger)'   },
  'sin-soporte': { icon: '❌', label: 'Sin soporte',     color: 'var(--text-muted)' },
}

export default function BtnNotificaciones() {
  const { estado, activar, desactivar, probar } = useNotificaciones()
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg]           = useState(null)

  const info = ESTADO_LABEL[estado] || ESTADO_LABEL.idle

  async function handleToggle() {
    setCargando(true); setMsg(null)
    if (estado === 'activo') {
      await desactivar()
      setMsg({ type: 'ok', text: 'Notificaciones desactivadas' })
    } else {
      const ok = await activar()
      if (ok) setMsg({ type: 'ok',    text: '🔔 ¡Notificaciones activadas!' })
      else    setMsg({ type: 'error', text: estado === 'denegado'
        ? 'Permiso bloqueado. Habilitalo en la configuración del browser.'
        : 'No se pudo activar. Intentá de nuevo.' })
    }
    setCargando(false)
  }

  async function handleProbar() {
    setCargando(true); setMsg(null)
    const r = await probar()
    if (r.error) setMsg({ type: 'error', text: r.error })
    else         setMsg({ type: 'ok',    text: `✅ Notificación enviada (${r.enviadas} dispositivo${r.enviadas !== 1 ? 's' : ''})` })
    setCargando(false)
  }

  return (
    <div style={{
      padding: '16px', borderRadius: 12,
      background: 'var(--bg)', border: '1px solid var(--border)',
    }}>
      {/* Estado actual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: estado === 'activo' ? 'var(--c-success-bg)' : 'var(--bg-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {info.icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            Notificaciones push
          </div>
          <div style={{ fontSize: 12, color: info.color, fontWeight: 600 }}>
            {info.label}
          </div>
        </div>
      </div>

      {/* Descripción */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
        Recibí alertas en el browser o en tu celular cuando hay seguimientos vencidos,
        cumpleaños o visitantes sin consolidar — aunque la app esté cerrada.
      </p>

      {/* Qué notifica */}
      {['🎂 Cumpleaños del día', '⏰ Seguimientos vencidos', '👋 Visitantes +30 días sin consolidar'].map(item => (
        <div key={item} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-2)', marginBottom: 5,
        }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
          {item}
        </div>
      ))}

      {/* Mensaje de resultado */}
      {msg && (
        <div style={{
          margin: '12px 0 0', padding: '8px 12px', borderRadius: 8, fontSize: 12,
          background: msg.type === 'ok' ? 'var(--c-success-bg)' : 'var(--c-danger-bg)',
          color:      msg.type === 'ok' ? 'var(--c-success)'    : 'var(--c-danger)',
          border: `1px solid ${msg.type === 'ok' ? 'var(--c-success-brd)' : 'var(--c-danger-brd)'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Botones */}
      {estado !== 'sin-soporte' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {estado !== 'denegado' && (
            <button
              onClick={handleToggle}
              disabled={cargando}
              style={{
                padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: cargando ? 'default' : 'pointer',
                background: estado === 'activo' ? 'var(--bg-2)' : 'var(--primary)',
                color:      estado === 'activo' ? 'var(--text-muted)' : 'white',
                border: estado === 'activo' ? '1px solid var(--border-med)' : 'none',
                opacity: cargando ? 0.6 : 1,
              }}>
              {cargando       ? '⏳ Un momento...'
               : estado === 'activo' ? '🔕 Desactivar'
               : '🔔 Activar notificaciones'}
            </button>
          )}

          {estado === 'activo' && (
            <button
              onClick={handleProbar}
              disabled={cargando}
              style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', border: '1px solid var(--border-med)',
                background: 'transparent', color: 'var(--text-2)',
                opacity: cargando ? 0.6 : 1,
              }}>
              📨 Enviar prueba
            </button>
          )}

          {estado === 'denegado' && (
            <p style={{ fontSize: 12, color: 'var(--c-danger)', margin: 0 }}>
              Para activarlas, habilitá los permisos de notificación en la configuración de tu browser.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
