import { useState } from 'react'
import { useNotificaciones } from '../hooks/useNotificaciones.js'
import Icons from './Icons.jsx'

const ESTADO_META = {
  idle:          { Icon: Icons.Comunicados,  label: 'Desactivadas', color: 'var(--text-muted)' },
  solicitando:   { Icon: Icons.Refresh,      label: 'Activando...', color: 'var(--c-warning)'  },
  activo:        { Icon: Icons.CheckCircle,  label: 'Activas',      color: 'var(--c-success)'  },
  denegado:      { Icon: Icons.XCircle,      label: 'Bloqueadas',   color: 'var(--c-danger)'   },
  'sin-soporte': { Icon: Icons.X,            label: 'Sin soporte',  color: 'var(--text-muted)' },
}

export default function BtnNotificaciones() {
  const { permiso, suscrito, cargando: hookCargando, error, soportado, suscribir, desuscribir, testear } = useNotificaciones()
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg]           = useState(null)
  const estado = !soportado ? 'sin-soporte' : permiso === 'denied' ? 'denegado' : suscrito ? 'activo' : 'idle'

  const { Icon, label, color } = ESTADO_META[estado] || ESTADO_META.idle

  async function handleToggle() {
    setCargando(true); setMsg(null)
    if (estado === 'activo') {
      await desuscribir()
      setMsg({ type: 'ok', text: 'Notificaciones desactivadas' })
    } else {
      const ok = await suscribir()
      if (ok) setMsg({ type: 'ok',    text: '¡Notificaciones activadas!' })
      else    setMsg({ type: 'error', text: estado === 'denegado'
        ? 'Permiso bloqueado. Habilitalo en la configuración del browser.'
        : error || 'No se pudo activar. Intentá de nuevo.' })
    }
    setCargando(false)
  }

  async function handleProbar() {
    setCargando(true); setMsg(null)
    const r = await testear()
    if (r.error) setMsg({ type: 'error', text: r.error })
    else         setMsg({ type: 'ok',    text: `Notificación enviada (${r.enviadas} dispositivo${r.enviadas !== 1 ? 's' : ''})` })
    setCargando(false)
  }

  return (
    <div style={{
      padding: '16px', borderRadius: 12,
      background: 'var(--bg)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: estado === 'activo' ? 'var(--c-success-bg)' : 'var(--bg-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon color={color} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            Notificaciones push
          </div>
          <div style={{ fontSize: 12, color, fontWeight: 600 }}>
            {label}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
        Recibí alertas en el browser o en tu celular cuando hay seguimientos vencidos,
        cumpleaños o visitantes sin consolidar — aunque la app esté cerrada.
      </p>

      {['Cumpleaños del día', 'Seguimientos vencidos', 'Visitantes +30 días sin consolidar'].map(item => (
        <div key={item} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-2)', marginBottom: 5,
        }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
          {item}
        </div>
      ))}

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

      {estado !== 'sin-soporte' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems:'center' }}>
          {estado !== 'denegado' && (
            <button
              onClick={handleToggle}
              disabled={cargando || hookCargando}
              aria-pressed={estado === 'activo'}
              data-tip={estado === 'activo' ? 'Desactivar notificaciones' : 'Activar notificaciones'}
              style={{
                width: 52, height: 30, borderRadius: 999, padding: 3,
                cursor: cargando || hookCargando ? 'default' : 'pointer',
                background: estado === 'activo' ? 'var(--c-success)' : 'var(--bg-2)',
                border: '1px solid var(--border-med)',
                opacity: cargando || hookCargando ? 0.6 : 1,
                display:'inline-flex', alignItems:'center', justifyContent: estado === 'activo' ? 'flex-end' : 'flex-start',
                transition:'var(--t)',
              }}>
              <span style={{
                width:24, height:24, borderRadius:'50%', background:'var(--surface)',
                boxShadow:'var(--shadow-sm)', display:'block',
              }} />
            </button>
          )}
          <span style={{fontSize:13,color:'var(--text-2)',fontWeight:600}}>
            {cargando || hookCargando ? 'Actualizando...' : estado === 'activo' ? 'Activadas' : 'Desactivadas'}
          </span>

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
              Enviar prueba
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
