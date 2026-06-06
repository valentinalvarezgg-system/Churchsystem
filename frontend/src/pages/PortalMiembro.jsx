import { useEffect, useState, useCallback } from 'react'
import LoginMiembro from './LoginMiembro.jsx'
import { toast } from '../components/Toast.jsx'

const API = typeof window !== 'undefined'
  ? window.location.origin.replace(/:\d+/, ':4000') + '/api'
  : 'http://localhost:4000/api'

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('miembro_token')
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) }
  })
  if (r.status === 401) { localStorage.removeItem('miembro_token'); localStorage.removeItem('miembro_persona'); window.location.reload(); return }
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Error') }
  return r.json()
}

// ── Componentes de sección ───────────────────────────────────

function SectionCard({ title, children, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#0F172A' }}>
        <span>{icon}</span>{title}
      </h2>
      {children}
    </div>
  )
}

function BadgeEtapa({ etapa }) {
  const colors = { NUEVO_CREYENTE:'#3B82F6', CONSOLIDADO:'#F59E0B', DISCIPULO:'#22C55E', LIDER:'#8B5CF6', MINISTRO:'#EC4899' }
  const c = colors[etapa] || '#94A3B8'
  return (
    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: c + '20', color: c, fontWeight: 700 }}>
      {(etapa || 'SIN ETAPA').replace(/_/g, ' ')}
    </span>
  )
}

function SeccionPerfil({ perfil, onActualizar }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ telefono: perfil.telefono || '', email: perfil.portalEmail || perfil.email || '', ocupacion: perfil.ocupacion || '' })
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try { await apiFetch('/miembro/perfil', { method: 'PUT', body: JSON.stringify(form) }); setEditando(false); onActualizar() }
    catch(e) { toast.error(e.message) }
    setGuardando(false)
  }

  const fmt = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  return (
    <SectionCard title="Mi perfil" icon="👤">
      {!editando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Email', perfil.portalEmail || perfil.email], ['Teléfono', perfil.telefono || '—'], ['Ocupación', perfil.ocupacion || '—'], ['Cumpleaños', fmt(perfil.fechaNacimiento)], ['Grupo', perfil.grupoNombre || '—'], ['Iglesia', perfil.iglesiaNombre || '—']].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3 }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <BadgeEtapa etapa={perfil.estadoEspiritual} />
            {perfil.bautizadoAgua && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }}>Bautizado agua</span>}
            {perfil.bautizadoEspiritu && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EDE9FE', color: '#6D28D9', fontWeight: 600 }}>Bautizado espíritu</span>}
          </div>
          <button onClick={() => setEditando(true)}
            style={{ alignSelf: 'flex-start', marginTop: 8, padding: '7px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
            ✏️ Editar datos de contacto
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['Email', 'email', 'email'], ['Teléfono', 'telefono', 'tel'], ['Ocupación', 'ocupacion', 'text']].map(([l, k, t]) => (
            <div key={k}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{l}</label>
              <input type={t} value={form[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', background: '#F8FAFC', color: '#0F172A' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setEditando(false)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: '#64748B' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#6D5DFB', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function SeccionAsistencia({ data }) {
  if (!data) return null
  const { historial = [], total, presentes, porcentaje } = data
  return (
    <SectionCard title="Mi asistencia" icon="📋">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[['Total', total, '#6D5DFB'], ['Presentes', presentes, '#22C55E'], ['Porcentaje', `${porcentaje}%`, porcentaje >= 75 ? '#22C55E' : porcentaje >= 50 ? '#F59E0B' : '#EF4444']].map(([l, v, c]) => (
          <div key={l} style={{ textAlign: 'center', background: '#F8FAFC', borderRadius: 10, padding: '12px 8px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .3, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
        {historial.slice(0, 12).map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#F8FAFC', borderRadius: 8, fontSize: 12 }}>
            <span>{new Date(a.createdAt).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span style={{ fontWeight: 700, color: a.presente ? '#22C55E' : '#EF4444' }}>{a.presente ? '✓ Presente' : '✗ Ausente'}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function SeccionEventos({ eventos }) {
  if (!eventos?.length) return (
    <SectionCard title="Próximos eventos" icon="📅">
      <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Sin eventos próximos</p>
    </SectionCard>
  )
  return (
    <SectionCard title="Próximos eventos" icon="📅">
      {eventos.map(ev => (
        <div key={ev.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'center', background: '#EDE9FE', borderRadius: 10, padding: '8px 10px', minWidth: 44 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#6D5DFB' }}>{new Date(ev.fecha + 'T12:00:00').getDate()}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase' }}>{new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{ev.titulo}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
              {ev.hora && `🕐 ${ev.hora} `}{ev.lugar && `📍 ${ev.lugar}`}
            </div>
            {ev.descripcion && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 3 }}>{ev.descripcion.slice(0, 80)}{ev.descripcion.length > 80 ? '...' : ''}</div>}
          </div>
        </div>
      ))}
    </SectionCard>
  )
}

function SeccionComunicados({ comunicados }) {
  const [expandido, setExpandido] = useState(null)
  if (!comunicados?.length) return (
    <SectionCard title="Comunicados" icon="📢">
      <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Sin comunicados</p>
    </SectionCard>
  )
  const TIPO_COLOR = { GENERAL: '#3B82F6', URGENTE: '#EF4444', PASTORAL: '#22C55E', EVENTO: '#F59E0B' }
  return (
    <SectionCard title="Comunicados" icon="📢">
      {comunicados.map(c => (
        <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                {c.fijado && <span style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B' }}>📌</span>}
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: (TIPO_COLOR[c.tipo]||'#94A3B8')+'20', color: TIPO_COLOR[c.tipo]||'#94A3B8', fontWeight: 700 }}>{c.tipo}</span>
                <span style={{ fontSize: 10, color: '#CBD5E1' }}>{c.createdAt?.slice(0, 10)}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{c.titulo}</div>
              <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0', lineHeight: 1.5, overflow: expandido === c.id ? 'visible' : 'hidden', maxHeight: expandido === c.id ? 'none' : '2.8em' }}>
                {c.contenido}
              </p>
              {c.contenido?.length > 100 && (
                <button onClick={() => setExpandido(expandido === c.id ? null : c.id)}
                  style={{ background: 'none', border: 'none', color: '#6D5DFB', fontSize: 12, cursor: 'pointer', padding: '3px 0', fontWeight: 600 }}>
                  {expandido === c.id ? 'Ver menos ↑' : 'Ver más ↓'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </SectionCard>
  )
}

function SeccionCambiarPassword() {
  const [form, setForm] = useState({ actual: '', nuevo: '', confirmar: '' })
  const [msg, setMsg]   = useState(null)
  const [loading, setLoading] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (form.nuevo !== form.confirmar) { setMsg({ type:'error', text:'Las contraseñas no coinciden' }); return }
    if (form.nuevo.length < 6) { setMsg({ type:'error', text:'Mínimo 6 caracteres' }); return }
    setLoading(true); setMsg(null)
    try {
      await apiFetch('/miembro/auth/cambiar-password', { method: 'POST', body: JSON.stringify({ passwordActual: form.actual, passwordNuevo: form.nuevo }) })
      setMsg({ type: 'success', text: '¡Contraseña actualizada!' })
      setForm({ actual: '', nuevo: '', confirmar: '' })
    } catch(e) { setMsg({ type: 'error', text: e.message }) }
    setLoading(false)
  }

  return (
    <SectionCard title="Cambiar contraseña" icon="🔒">
      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {['actual','nuevo','confirmar'].map(k => (
          <div key={k}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3, textTransform: 'capitalize' }}>
              {k === 'actual' ? 'Contraseña actual' : k === 'nuevo' ? 'Nueva contraseña' : 'Confirmar nueva'}
            </label>
            <input type="password" value={form[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} required
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, boxSizing: 'border-box', background: '#F8FAFC' }} />
          </div>
        ))}
        {msg && <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: msg.type === 'error' ? '#FEF2F2' : '#F0FDF4', color: msg.type === 'error' ? '#DC2626' : '#16A34A' }}>{msg.text}</div>}
        <button type="submit" disabled={loading}
          style={{ padding: '10px', borderRadius: 8, border: 'none', background: '#6D5DFB', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, marginTop: 4 }}>
          {loading ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>
    </SectionCard>
  )
}

// ── Portal principal ─────────────────────────────────────────
export default function PortalMiembro() {
  const [token, setToken]     = useState(() => localStorage.getItem('miembro_token'))
  const [persona, setPersona] = useState(() => { try { return JSON.parse(localStorage.getItem('miembro_persona') || 'null') } catch { return null } })
  const [tab, setTab]         = useState('inicio')
  const [perfil, setPerfil]   = useState(null)
  const [asistencia, setAsistencia] = useState(null)
  const [eventos, setEventos] = useState([])
  const [comunicados, setComunicados] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  const loadDatos = useCallback(async () => {
    if (!token) return
    setLoadingData(true)
    try {
      const [p, a, ev, com] = await Promise.allSettled([
        apiFetch('/miembro/perfil'),
        apiFetch('/miembro/asistencia'),
        apiFetch('/miembro/eventos'),
        apiFetch('/miembro/comunicados'),
      ])
      if (p.status === 'fulfilled' && p.value) setPerfil(p.value)
      if (a.status === 'fulfilled' && a.value) setAsistencia(a.value)
      if (ev.status === 'fulfilled' && ev.value) setEventos(ev.value)
      if (com.status === 'fulfilled' && com.value) setComunicados(com.value)
    } catch {}
    setLoadingData(false)
  }, [token])

  useEffect(() => { if (token) loadDatos() }, [token, loadDatos])

  function handleLogin(t, p) { setToken(t); setPersona(p) }

  function logout() {
    localStorage.removeItem('miembro_token'); localStorage.removeItem('miembro_persona')
    setToken(null); setPerfil(null); setPersona(null)
  }

  if (!token) return <LoginMiembro onLogin={handleLogin} />

  const TABS = [
    { id: 'inicio', label: 'Inicio', icon: '🏠' },
    { id: 'asistencia', label: 'Asistencia', icon: '📋' },
    { id: 'eventos', label: 'Eventos', icon: '📅' },
    { id: 'comunicados', label: 'Comunicados', icon: '📢' },
    { id: 'perfil', label: 'Mi perfil', icon: '👤' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0F172A,#1E1B4B)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⛪</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Portal del Miembro</div>
            {persona && <div style={{ fontSize: 11, color: '#94A3B8' }}>Hola, {persona.nombre} 👋</div>}
          </div>
        </div>
        <button onClick={logout} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#94A3B8', fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Salir
        </button>
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 100px' }}>
        {loadingData && !perfil && <p style={{ textAlign: 'center', color: '#94A3B8', padding: '40px 0' }}>Cargando...</p>}

        {tab === 'inicio' && (
          <>
            {perfil && (
              <div style={{ background: 'linear-gradient(135deg,#6D5DFB,#8B5CF6)', borderRadius: 16, padding: '20px', marginBottom: 16, color: '#fff' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{perfil.nombre} {perfil.apellido}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <BadgeEtapa etapa={perfil.estadoEspiritual} />
                  {perfil.grupoNombre && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 600 }}>📍 {perfil.grupoNombre}</span>}
                  {perfil.iglesiaNombre && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 600 }}>⛪ {perfil.iglesiaNombre}</span>}
                </div>
              </div>
            )}
            <SeccionComunicados comunicados={comunicados.slice(0, 3)} />
            <SeccionEventos eventos={eventos.slice(0, 3)} />
          </>
        )}
        {tab === 'asistencia' && <SeccionAsistencia data={asistencia} />}
        {tab === 'eventos' && <SeccionEventos eventos={eventos} />}
        {tab === 'comunicados' && <SeccionComunicados comunicados={comunicados} />}
        {tab === 'perfil' && perfil && (
          <>
            <SeccionPerfil perfil={perfil} onActualizar={loadDatos} />
            <SeccionCambiarPassword />
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #E2E8F0',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))'
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px',
              color: tab === t.id ? '#6D5DFB' : '#94A3B8', transition: 'color .15s'
            }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
