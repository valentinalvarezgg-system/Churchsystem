import { useEffect, useState, useCallback } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'

const ESTADOS = ['ACTIVA','RESPONDIDA','EN_ESPERA','ARCHIVADA']
const ECOLOR  = { ACTIVA:'#2563EB', RESPONDIDA:'#16A34A', EN_ESPERA:'#D97706', ARCHIVADA:'#64748B' }
const EBG     = { ACTIVA:'#DBEAFE', RESPONDIDA:'#DCFCE7', EN_ESPERA:'#FEF3C7', ARCHIVADA:'#F3F4F6' }
const REACCIONES = ['🙏','❤️','✝️','🕊️','⭐']

export default function Oracion() {
  const user = getUser()
  const isAdmin = user?.rol === 'PASTOR_GENERAL'

  const [data, setData]     = useState([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [pages, setPages]   = useState(1)
  const [filtro, setFiltro] = useState('ACTIVA')
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState({ titulo:'', descripcion:'', privado:0 })
  const [msg, setMsg]       = useState(null)
  const [apoyando, setApoyando] = useState(null)

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page, limit:12 })
    if (filtro) p.set('estado', filtro)
    try {
      const r = await apiFetch(`/oracion?${p}`)
      setData(r.data||[]); setTotal(r.total||0); setPages(r.pages||1)
    } catch {}
  }, [page, filtro])

  useEffect(() => { load() }, [load])

  async function apoyo(id) {
    setApoyando(id)
    try { await apiFetch(`/oracion/${id}/apoyo`, { method:'POST' }); load() }
    catch {}
    setTimeout(() => setApoyando(null), 600)
  }

  async function cambiarEstado(id, estado) {
    try { await apiFetch(`/oracion/${id}/estado`, { method:'PUT', body: JSON.stringify({estado}) }); load() }
    catch(e) { alert(e.message) }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta petición?')) return
    try { await apiFetch(`/oracion/${id}`, { method:'DELETE' }); load() }
    catch(e) { alert(e.message) }
  }

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      await apiFetch('/oracion', { method:'POST', body: JSON.stringify(form) })
      setModal(false); setForm({ titulo:'', descripcion:'', privado:0 }); load()
    } catch(err) { setMsg({ type:'error', text: err.message }) }
  }

  const contadores = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: 0 }), {})
  data.forEach(() => {}) // placeholder — los contadores vienen del total

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">🙏 Muro de oración</h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
              {total} peticiones · La comunidad ora junta
            </p>
          </div>
          <button className="btn btn-primary" data-tip="Publicar nueva petición"
            onClick={() => { setModal(true); setMsg(null) }}>
            + Nueva petición
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
          <button onClick={() => { setFiltro(''); setPage(1) }}
            className={!filtro ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
            Todas ({total})
          </button>
          {ESTADOS.map(e => (
            <button key={e} onClick={() => { setFiltro(e); setPage(1) }}
              className={filtro===e ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              style={filtro===e ? { background: ECOLOR[e], borderColor: ECOLOR[e] } : {}}>
              {e === 'ACTIVA' ? '🔵' : e === 'RESPONDIDA' ? '✅' : e === 'EN_ESPERA' ? '⏳' : '📦'}
              {' '}{e.replace('_',' ')}
            </button>
          ))}
        </div>

        {/* Grid de peticiones */}
        {data.length === 0
          ? <div className="empty"><div className="empty-icon">🙏</div><p>Sin peticiones en esta categoría</p></div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
              {data.map(o => {
                const esPropio = o.userId === user?.id
                return (
                  <div key={o.id} className="card" style={{
                    padding:'18px 20px',
                    borderLeft: `3px solid ${ECOLOR[o.estado] || 'var(--primary)'}`,
                    transition:'box-shadow .15s',
                    display:'flex', flexDirection:'column', gap:10,
                  }}>
                    {/* Título y estado */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <h3 style={{ fontSize:14, fontWeight:700, margin:0, lineHeight:1.4, flex:1 }}>
                        {o.privado && <span style={{ fontSize:12, marginRight:5 }}>🔒</span>}
                        {o.titulo}
                      </h3>
                      <span style={{
                        padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700,
                        background: EBG[o.estado], color: ECOLOR[o.estado], flexShrink:0,
                      }}>
                        {o.estado?.replace('_',' ')}
                      </span>
                    </div>

                    {/* Descripción */}
                    {o.descripcion && (
                      <p style={{ fontSize:13, color:'var(--text-2)', margin:0, lineHeight:1.6 }}>
                        {o.descripcion}
                      </p>
                    )}

                    {/* Separador */}
                    <div style={{ borderTop:'1px solid var(--border)' }} />

                    {/* Autor y fecha */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                        <span style={{ fontWeight:600 }}>{o.autorNombre || 'Anónimo'}</span>
                        <span style={{ marginLeft:8, color:'var(--text-faint)' }}>
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-AR', {day:'numeric',month:'short'}) : ''}
                        </span>
                      </div>

                      {/* Apoyos */}
                      <button
                        onClick={() => apoyo(o.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:5,
                          background: apoyando===o.id ? 'var(--c-purple)' : 'var(--c-purple-bg)',
                          color: apoyando===o.id ? 'var(--surface)' : 'var(--c-purple)',
                          border:'none', padding:'5px 12px', borderRadius:20,
                          cursor:'pointer', fontSize:13, fontWeight:700,
                          transition:'all .2s',
                          transform: apoyando===o.id ? 'scale(1.15)' : 'scale(1)',
                        }}>
                        🙏 {o.apoyos || 0}
                      </button>
                    </div>

                    {/* Acciones — solo admin o propietario */}
                    {(esPropio || isAdmin) && (
                      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                        <select name="estado" value={o.estado} onChange={e => cambiarEstado(o.id, e.target.value)}
                          style={{
                            flex:1, padding:'5px 8px', borderRadius:'var(--r)',
                            border:'1px solid var(--border-med)', fontSize:11,
                            background:'var(--surface)', color:'var(--text)', cursor:'pointer', outline:'none',
                          }}>
                          {ESTADOS.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                        </select>
                        <button className="btn btn-danger btn-xs" data-tip="Eliminar petición"
                          onClick={() => eliminar(o.id)}>✕</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        }

        {/* Paginación */}
        {pages > 1 && (
          <div className="pagination">
            <span className="pag-info">Pág {page}/{pages} · {total}</span>
            <button className="pag-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>←</button>
            <button className="pag-btn" disabled={page===pages} onClick={() => setPage(p=>p+1)}>→</button>
          </div>
        )}

        {/* Modal nueva petición */}
        {modal && (
          <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">🙏 Nueva petición de oración</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-group">
                    <label>¿Por qué pedís oración? *</label>
                    <input name="titulo" className="form-input" required
                      placeholder="Ej: Sanidad, trabajo, familia..."
                      value={form.titulo} onChange={e => setForm(f=>({...f, titulo:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label>Detalles (opcional)</label>
                    <textarea name="descripcion" className="form-input" rows={4}
                      placeholder="Contanos más sobre la situación..."
                      value={form.descripcion} onChange={e => setForm(f=>({...f, descripcion:e.target.value}))}/>
                  </div>
                  <label style={{
                    display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                    padding:'10px 12px', borderRadius:'var(--r)', background:'var(--bg)',
                    border:'1px solid var(--border)', fontSize:13, fontWeight:500,
                    textTransform:'none', letterSpacing:0, color:'var(--text)',
                  }}>
                    <input name="privado" type="checkbox"
                      checked={!!form.privado}
                      onChange={e => setForm(f=>({...f, privado: e.target.checked ? 1 : 0}))}
                      style={{ width:16, height:16, accentColor:'var(--primary)', cursor:'pointer' }}/>
                    <div>
                      <div>🔒 Petición privada</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400 }}>
                        Solo visible para pastores y líderes
                      </div>
                    </div>
                  </label>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">🙏 Publicar petición</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
