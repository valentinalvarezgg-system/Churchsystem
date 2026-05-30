import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const TIPOS = ['WHATSAPP', 'EMAIL']

const PLANTILLAS_DEFAULT = [
  { id: 'd1', nombre: 'Bienvenida', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! <Icons.Users /> Bienvenido/a a nuestra comunidad. Es un placer tenerte con nosotros. ¡Que Dios te bendiga!' },
  { id: 'd2', nombre: 'Recordatorio culto', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! <Icons.Prayer /> Te recordamos que este domingo tenemos culto. Te esperamos!' },
  { id: 'd3', nombre: 'Seguimiento', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! ¿Cómo estás? Te contactamos desde la iglesia para saber cómo te encontrás. Estamos orando por vos <Icons.Prayer />' },
  { id: 'd4', nombre: 'Cumpleaños', tipo: 'WHATSAPP', contenido: '🎂 Feliz cumpleaños {nombre}! Que Dios te colme de bendiciones en este nuevo año de vida. Te queremos mucho! ❤️' },
]

export default function Mensajes() {
  const user = getUser()
  const canSend = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF'].includes(user?.rol)

  const [tab, setTab]           = useState('enviar')
  const [grupos, setGrupos]     = useState([])
  const [personas, setPersonas] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [historial, setHistorial]   = useState([])
  const [hTotal, setHTotal]         = useState(0)
  const [hPage, setHPage]           = useState(1)
  const [msg, setMsg]           = useState(null)
  const [sending, setSending]   = useState(false)
  const [config, setConfig]     = useState({})
  const [loadingBase, setLoadingBase] = useState(true)
  const [errorBase, setErrorBase] = useState(null)
  const [editPlantilla, setEditPlantilla] = useState(null)
  const [showNewP, setShowNewP] = useState(false)
  const [confirmBorrarId, setConfirmBorrarId] = useState(null)
  const [newP, setNewP]         = useState({ nombre: '', tipo: 'WHATSAPP', contenido: '' })
  const [form, setForm]         = useState({
    tipo: 'WHATSAPP', personaId: '', grupoId: '', estado: '',
    mensaje: '', modo: 'individual', asunto: 'Mensaje pastoral'
  })

  const loadBase = useCallback(async () => {
    setLoadingBase(true); setErrorBase(null)
    try {
      const [g, p, pl, c] = await Promise.all([
        apiFetch('/grupos'),
        apiFetch('/personas?limit=400'),
        apiFetch('/mensajes/plantillas'),
        apiFetch('/config'),
      ])
      setGrupos(g || [])
      setPersonas(p?.data || [])
      setPlantillas(pl || [])
      setConfig(c || {})
    } catch (e) {
      setErrorBase(e.message || 'No se pudo cargar mensajería')
    }
    setLoadingBase(false)
  }, [])

  useEffect(() => { loadBase() }, [loadBase])

  const loadHistorial = useCallback(async () => {
    try {
      const r = await apiFetch(`/mensajes?limit=30&page=${hPage}`)
      setHistorial(r?.data || [])
      setHTotal(r?.total || 0)
    } catch {}
  }, [hPage])

  useEffect(() => { loadHistorial() }, [loadHistorial])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Preview del mensaje con variables reemplazadas
  const preview = form.mensaje
    .replace(/{nombre}/g, 'María')
    .replace(/{apellido}/g, 'González')
    .replace(/{grupo}/g, 'Matrimonios')

  // Contar destinatarios estimados
  const contarDestinatarios = () => {
    if (form.modo === 'individual') return form.personaId ? 1 : 0
    if (form.grupoId) return grupos.find(g => String(g.id) === String(form.grupoId))?.totalMiembros || '?'
    if (form.estado)  return personas.filter(p => p.estado === form.estado).length
    return personas.length
  }

  async function handleEnviar(e) {
    e.preventDefault(); setMsg(null); setSending(true)
    try {
      let res
      if (form.modo === 'individual') {
        if (!form.personaId) { setMsg({ type: 'error', text: 'Seleccioná una persona' }); setSending(false); return }
        res = await apiFetch('/mensajes/enviar', {
          method: 'POST',
          body: JSON.stringify({ personaId: Number(form.personaId), tipo: form.tipo, mensaje: form.mensaje, asunto: form.asunto })
        })
        const txt = res.demo ? '≡ Mensaje guardado (email sin configurar — andá a Configuración → Integraciones → Email)'
          : res.enviado ? `<Icons.Attendance /> Mensaje enviado por ${form.tipo}`
          : `⚠ No se pudo enviar: ${res.error}`
        setMsg({ type: res.enviado || res.demo ? 'success' : 'warning', text: txt })
      } else {
        res = await apiFetch('/mensajes/masivo', {
          method: 'POST',
          body: JSON.stringify({ grupoId: form.grupoId || null, estado: form.estado || null, tipo: form.tipo, mensaje: form.mensaje, asunto: form.asunto })
        })
        setMsg({ type: 'success', text: `<Icons.Attendance /> ${res.enviados}/${res.total} mensajes enviados` + (res.errores > 0 ? ` · ${res.errores} errores` : '') })
      }
      loadHistorial()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setSending(false)
  }

  async function guardarPlantilla(e) {
    e.preventDefault()
    try {
      if (editPlantilla?.id && !String(editPlantilla.id).startsWith('d')) {
        await apiFetch(`/mensajes/plantillas/${editPlantilla.id}`, { method: 'PUT', body: JSON.stringify(newP) })
      } else {
        await apiFetch('/mensajes/plantillas', { method: 'POST', body: JSON.stringify(newP) })
      }
      const p = await apiFetch('/mensajes/plantillas').catch(() => [])
      setPlantillas(p || [])
      setNewP({ nombre: '', tipo: 'WHATSAPP', contenido: '' })
      setShowNewP(false); setEditPlantilla(null)
    } catch (err) { toast.error(err.message) }
  }

  async function borrarPlantilla() {
    if (!confirmBorrarId) return
    try {
      await apiFetch(`/mensajes/plantillas/${confirmBorrarId}`, { method: 'DELETE' })
      setPlantillas(p => p.filter(x => x.id !== confirmBorrarId))
    } catch (err) { toast.error(err.message) }
    setConfirmBorrarId(null)
  }

  const todasPlantillas = [...PLANTILLAS_DEFAULT, ...plantillas]
  const twOk  = config.twilio_configurado
  const emlOk = config.email_configurado

  const badgeColor = (tipo) => tipo === 'WHATSAPP'
    ? { background: '#dcfce7', color: 'var(--c-success)' }
    : { background: 'var(--c-info-bg)', color: 'var(--c-info)' }

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Messages /> Mensajería</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10 }}>
              <span style={{ ...badgeColor('WHATSAPP'), padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                WhatsApp {twOk ? '✓' : '⚠ sin configurar'}
              </span>
              <span style={{ ...badgeColor('EMAIL'), padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                Email {emlOk ? '✓' : '⚠ sin configurar'}
              </span>
            </p>
          </div>
        </div>

        {errorBase && (
          <div className="alert alert-error" style={{marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
            <span>{errorBase}</span>
            <button className="btn btn-ghost btn-sm" onClick={loadBase}>Reintentar</button>
          </div>
        )}
        {loadingBase && <div className="empty" style={{marginBottom:12}}><p>Cargando mensajería...</p></div>}

        <div className="mobile-tabs" style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 20 }}>
          {[['enviar', '✉ Enviar'], ['plantillas', 'Plantillas'], ['historial', '≡ Historial']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? 'btn btn-primary' : 'btn btn-ghost'}>{l}</button>
          ))}
        </div>

        {/* ── ENVIAR ── */}
        {tab === 'enviar' && (
          <div className="messages-compose-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Nuevo mensaje</h3>
              {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

              <form onSubmit={handleEnviar}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  {/* Modo */}
                  <div className="form-group">
                    <label>Modo de envío</label>
                    <select name="modo" className="form-input" value={form.modo} onChange={e => f('modo', e.target.value)}>
                      <option value="individual">Individual</option>
                      <option value="masivo">Masivo</option>
                    </select>
                  </div>

                  {/* Canal */}
                  <div className="form-group">
                    <label>Canal</label>
                    <select name="tipo" className="form-input" value={form.tipo} onChange={e => f('tipo', e.target.value)}>
                      <option value="WHATSAPP"><Icons.CheckIn /> WhatsApp{!twOk ? ' (sin config)' : ''}</option>
                      <option value="EMAIL">✉ Email{!emlOk ? ' (sin config)' : ''}</option>
                    </select>
                  </div>

                  {/* Asunto — solo para email */}
                  {form.tipo === 'EMAIL' && (
                    <div className="form-group full">
                      <label>Asunto del email</label>
                      <input name="asunto" className="form-input" value={form.asunto} onChange={e => f('asunto', e.target.value)} />
                    </div>
                  )}

                  {/* Destinatario individual */}
                  {form.modo === 'individual' && (
                    <div className="form-group full">
                      <label>Destinatario</label>
                      <select name="personaId" className="form-input" value={form.personaId} onChange={e => f('personaId', e.target.value)} required>
                        <option value="">Seleccioná una persona...</option>
                        {personas.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre} {p.apellido} — {p.telefono || p.email || '—'}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Destinatario masivo */}
                  {form.modo === 'masivo' && (
                    <div className="form-group full">
                      <label>Enviar a</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8 }}>
                        <select name="grupoId" className="form-input" value={form.grupoId} onChange={e => { f('grupoId', e.target.value); f('estado', '') }}>
                          <option value="">-- Por grupo --</option>
                          {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                        </select>
                        <select name="estado" className="form-input" value={form.estado} onChange={e => { f('estado', e.target.value); f('grupoId', '') }}>
                          <option value="">-- Por estado --</option>
                          {['ACTIVO', 'VISITANTE', 'NUEVO', 'INACTIVO'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Dejar ambos vacíos = toda la congregación · Estimado: {contarDestinatarios()} personas
                      </span>
                    </div>
                  )}

                  {/* Mensaje */}
                  <div className="form-group full">
                    <label>Mensaje <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>variables: {'{nombre}'} {'{apellido}'} {'{grupo}'}</span></label>
                    <textarea name="mensaje" className="form-input" style={{ minHeight: 100 }} required
                      value={form.mensaje} onChange={e => f('mensaje', e.target.value)}
                      placeholder="Hola {nombre}! Te escribimos desde la iglesia..." />
                  </div>
                </div>

                {/* Preview */}
                {form.mensaje && (
                  <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--text-muted)', marginBottom: 6 }}>Vista previa</p>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{preview}</p>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? 'Enviando...' : form.modo === 'individual' ? '↑ Enviar mensaje' : `↑ Enviar a todos (${contarDestinatarios()})`}
                </button>
              </form>
            </div>

            {/* Plantillas lateral */}
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Plantillas rápidas</h3>
              <div className="template-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todasPlantillas.filter(p => p.tipo === form.tipo).map(p => (
                  <div key={p.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => { f('mensaje', p.contenido); setMsg(null) }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{p.nombre}</div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{p.contenido.slice(0, 70)}...</p>
                  </div>
                ))}
                {todasPlantillas.filter(p => p.tipo === form.tipo).length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin plantillas para {form.tipo}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PLANTILLAS ── */}
        {tab === 'plantillas' && (
          <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Plantillas personalizadas</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowNewP(true); setEditPlantilla(null); setNewP({ nombre: '', tipo: 'WHATSAPP', contenido: '' }) }}>+ Nueva</button>
            </div>

            {showNewP && (
              <form className="mobile-inline-form" onSubmit={guardarPlantilla} style={{ marginBottom: 24, padding: 16, background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                <div className="form-grid">
                  <div className="form-group"><label>Nombre</label><input name="nombre" className="form-input" value={newP.nombre} onChange={e => setNewP(p => ({ ...p, nombre: e.target.value }))} required /></div>
                  <div className="form-group"><label>Tipo</label>
                    <select name="tipo" className="form-input" value={newP.tipo} onChange={e => setNewP(p => ({ ...p, tipo: e.target.value }))}>
                      <option value="WHATSAPP"><Icons.CheckIn /> WhatsApp</option>
                      <option value="EMAIL">✉ Email</option>
                    </select>
                  </div>
                  <div className="form-group full">
                    <label>Contenido <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>— variables: {'{nombre}'} {'{apellido}'}</span></label>
                    <textarea name="contenido" className="form-input" style={{ minHeight: 80 }} required value={newP.contenido} onChange={e => setNewP(p => ({ ...p, contenido: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowNewP(false); setEditPlantilla(null) }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary btn-sm">Guardar</button>
                </div>
              </form>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Las plantillas con 📌 son predeterminadas del sistema. Las tuyas se muestran abajo.
            </p>

            {[...PLANTILLAS_DEFAULT, ...plantillas].map(p => (
              <div key={p.id} className="template-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                    <strong style={{ fontSize: 14 }}>{String(p.id).startsWith('d') ? '📌 ' : ''}{p.nombre}</strong>
                    <span style={{ ...badgeColor(p.tipo), padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{p.tipo}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{p.contenido}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setTab('enviar'); f('mensaje', p.contenido); f('tipo', p.tipo) }}>Usar</button>
                  {!String(p.id).startsWith('d') && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmBorrarId(p.id)}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab === 'historial' && (
          <div className="card messages-history-card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Mensajes enviados ({hTotal})</h3>
            </div>
            {historial.length > 0 && (
              <div className="messages-mobile-history">
                {historial.map(m => (
                  <article className="message-history-card" key={m.id}>
                    <div>
                      <span style={{ ...badgeColor(m.tipo), padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{m.tipo}</span>
                      {m.enviado
                        ? <span className="badge badge-activo">Enviado</span>
                        : <span className="badge badge-inactivo">Error</span>}
                    </div>
                    <strong>{m.personaNombre ? `${m.personaNombre} ${m.personaApellido || ''}` : 'Sin persona'}</strong>
                    <p>{m.mensaje}</p>
                    <small>{m.destino} · {m.createdAt?.slice(0, 16).replace('T', ' ')}</small>
                  </article>
                ))}
              </div>
            )}
            {historial.length === 0
              ? <div className="empty"><div className="empty-icon"><Icons.Messages /></div><p>Sin mensajes aún</p></div>
              : <div className="table-responsive"><table className="messages-history-table" style={{minWidth:500}}>
                  <thead><tr><th>Canal</th><th>Persona</th><th>Destino</th><th>Mensaje</th><th>Estado</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {historial.map(m => (
                      <tr key={m.id}>
                        <td><span style={{ ...badgeColor(m.tipo), padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{m.tipo}</span></td>
                        <td style={{ fontSize: 13 }}>{m.personaNombre ? `${m.personaNombre} ${m.personaApellido || ''}` : '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.destino}</td>
                        <td style={{ maxWidth: 200, overflowX:'auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{m.mensaje}</td>
                        <td>
                          {m.enviado
                            ? <span className="badge badge-activo">Enviado</span>
                            : <span className="badge badge-inactivo" title={m.error || ''}>Error</span>
                          }
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
            }
            {Math.ceil(hTotal / 30) > 1 && (
              <div className="pagination">
                <span className="pag-info">Pág {hPage}/{Math.ceil(hTotal / 30)}</span>
                <button className="pag-btn" disabled={hPage === 1} onClick={() => setHPage(p => p - 1)}>←</button>
                <button className="pag-btn" disabled={hPage === Math.ceil(hTotal / 30)} onClick={() => setHPage(p => p + 1)}>→</button>
              </div>
            )}
          </div>
        )}
      </main>
      <ConfirmModal
        open={!!confirmBorrarId} onClose={()=>setConfirmBorrarId(null)} onConfirm={borrarPlantilla}
        title="¿Eliminar plantilla?" danger
        message="Esta plantilla será eliminada permanentemente."
        confirmLabel="Eliminar" cancelLabel="Cancelar"
      />
    </div>
  )
}
