import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'

const ESTADOS = ['PRIMER_CONTACTO','EN_PROCESO','COMPLETADA','TRANSFERIDA']
const ECOLOR  = { PRIMER_CONTACTO:'#D97706', EN_PROCESO:'#2563EB', COMPLETADA:'#16A34A', TRANSFERIDA:'#64748B' }
const ELABEL  = { PRIMER_CONTACTO:'Primer contacto', EN_PROCESO:'En proceso', COMPLETADA:'Completada', TRANSFERIDA:'Transferida' }
const PASOS = [
  { key:'bienvenida',         icon:'⊕', label:'Bienvenida personal' },
  { key:'datos',              icon:'✉', label:'Datos registrados' },
  { key:'primer_llamada',     icon:'📞', label:'Primera llamada' },
  { key:'material_entregado', icon:'▤', label:'Material entregado' },
  { key:'segunda_visita',     icon:'🏠', label:'Segunda visita' },
  { key:'conectado_grupo',    icon:'⊞', label:'Conectado a grupo' },
  { key:'discipulado',        icon:'▧',  label:'Inicio de discipulado' },
]

export default function Consolidacion() {
  const navigate = useNavigate()
  const [data, setData]     = useState([])
  const [stats, setStats]   = useState(null)
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal]   = useState(null)
  const [nuevaModal, setNuevaModal] = useState(false)
  const [personas, setPersonas]     = useState([])
  const [formNuevo, setFormNuevo]   = useState({ personaId:'', notas:'' })
  const [msg, setMsg]       = useState(null)
  const [view, setView]     = useState('lista') // lista | kanban

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page, limit:20 })
    if (filtro) p.set('estado', filtro)
    try {
      const [r, s] = await Promise.all([
        apiFetch(`/consolidacion?${p}`),
        apiFetch('/consolidacion/stats')
      ])
      setData(r.data||[]); setTotal(r.total||0); setPages(r.pages||1); setStats(s)
    } catch {}
  }, [page, filtro])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch('/personas?limit=200&estado=VISITANTE')
      .then(r => setPersonas(r?.data||[])).catch(() => {})
  }, [])

  async function crearConsolidacion(e) {
    e.preventDefault()
    try {
      await apiFetch('/consolidacion', { method:'POST', body: JSON.stringify(formNuevo) })
      setNuevaModal(false); setFormNuevo({ personaId:'', notas:'' }); load()
    } catch(err) { setMsg({ type:'error', text: err.message }) }
  }

  async function actualizarPaso(id, campo, valor) {
    try {
      await apiFetch(`/consolidacion/${id}`, {
        method:'PUT', body: JSON.stringify({ pasos: { [campo]: valor ? 1 : 0 } })
      })
      // Actualizar el modal localmente
      setModal(m => {
        if (!m) return m
        const pasos = JSON.parse(m.pasos||'{}')
        pasos[campo] = valor ? 1 : 0
        return { ...m, pasos: JSON.stringify(pasos) }
      })
      load()
    } catch(e) { alert(e.message) }
  }

  const porEstado = e => stats?.porEstado?.find(s => s.estado===e)?.total || 0
  const totalStats = ESTADOS.reduce((a, e) => a + porEstado(e), 0)

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Consolidación</h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
              Proceso de integración de nuevos miembros
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ display:'flex', background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)', overflowX:'auto' }}>
              {[['lista','≡'],['kanban','▦']].map(([k,ic]) => (
                <button key={k} onClick={() => setView(k)}
                  style={{
                    padding:'7px 14px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                    background: view===k ? 'var(--primary)' : 'transparent',
                    color: view===k ? 'var(--surface)' : 'var(--text-muted)',
                    transition:'all .15s'
                  }}>
                  {ic}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" data-tip="Iniciar proceso para un visitante"
              onClick={() => { setNuevaModal(true); setMsg(null) }}>
              + Nuevo proceso
            </button>
          </div>
        </div>

        {/* Stats pipeline */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
          {ESTADOS.map((e, i) => {
            const n    = porEstado(e)
            const pct  = totalStats > 0 ? Math.round(n/totalStats*100) : 0
            const isActive = filtro === e
            return (
              <div key={e} onClick={() => setFiltro(isActive ? '' : e)}
                style={{
                  padding:'16px', borderRadius:'var(--r-lg)', cursor:'pointer', transition:'all .2s',
                  border: isActive ? `2px solid ${ECOLOR[e]}` : '1px solid var(--border)',
                  background: isActive ? ECOLOR[e]+'15' : 'var(--surface)',
                  boxShadow: isActive ? `0 4px 16px ${ECOLOR[e]}30` : 'none',
                }}>
                {/* Flecha entre etapas */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <div style={{
                    width:28, height:28, borderRadius:'50%',
                    background: ECOLOR[e]+'20', border:`2px solid ${ECOLOR[e]}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:800, color: ECOLOR[e],
                  }}>
                    {i+1}
                  </div>
                  {i < 3 && <div style={{ height:1, flex:1, background:`linear-gradient(90deg,${ECOLOR[e]},${ECOLOR[ESTADOS[i+1]]}50)` }}/>}
                </div>
                <div style={{ fontSize:28, fontWeight:800, color: ECOLOR[e], lineHeight:1, marginBottom:3 }}>{n}</div>
                <div style={{ fontSize:11, fontWeight:600, color: ECOLOR[e], textTransform:'uppercase', letterSpacing:.5 }}>
                  {ELABEL[e]}
                </div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{pct}% del total</div>
              </div>
            )
          })}
        </div>

        {/* Vista Lista */}
        {view === 'lista' && (
          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            {data.length === 0
              ? <div className="empty"><div className="empty-icon"><Icons.Users /></div><p>Sin procesos activos</p></div>
              : <table style={{minWidth:500}}>
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Estado</th>
                      <th>Progreso</th>
                      <th>Pasos completados</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(c => {
                      const pasos = JSON.parse(c.pasos||'{}')
                      const completados = Object.values(pasos).filter(Boolean).length
                      const pct = Math.round(completados / PASOS.length * 100)
                      const color = pct===100 ? '#16A34A' : pct >= 50 ? '#2563EB' : '#D97706'
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong className="persona-link" data-tip="Ver perfil"
                              onClick={() => navigate(`/personas/${c.personaId}`)}>
                              {c.personaNombre} {c.personaApellido}
                            </strong>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.personaTel||''}</div>
                          </td>
                          <td>
                            <span style={{
                              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                              background: ECOLOR[c.estado]+'15', color: ECOLOR[c.estado],
                              border:`1px solid ${ECOLOR[c.estado]}30`,
                            }}>
                              {ELABEL[c.estado]}
                            </span>
                          </td>
                          <td style={{ minWidth:140 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ flex:1, height:6, background:'var(--bg-2)', borderRadius:3, overflowX:'auto' }}>
                                <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3, transition:'width .4s' }}/>
                              </div>
                              <span style={{ fontSize:11, fontWeight:600, color, flexShrink:0 }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize:12 }}>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              {PASOS.map(p => (
                                <span key={p.key} style={{
                                  fontSize:14, opacity: pasos[p.key] ? 1 : 0.2,
                                  title: p.label,
                                }} title={p.label}>
                                  {p.icon}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-sm" data-tip="Gestionar pasos"
                              onClick={() => setModal(c)}>
                              Gestionar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
          </div>
        )}

        {/* Vista Kanban */}
        {view === 'kanban' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
            {ESTADOS.map(e => {
              const items = data.filter(c => c.estado === e)
              return (
                <div key={e} style={{ background:'var(--bg)', borderRadius:'var(--r-lg)', padding:'12px', minHeight:200 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <span style={{ fontSize:12, fontWeight:700, color: ECOLOR[e], textTransform:'uppercase', letterSpacing:.5 }}>
                      {ELABEL[e]}
                    </span>
                    <span style={{
                      background: ECOLOR[e]+'15', color: ECOLOR[e],
                      borderRadius:20, padding:'1px 8px', fontSize:11, fontWeight:700,
                    }}>
                      {items.length}
                    </span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {items.map(c => {
                      const pasos = JSON.parse(c.pasos||'{}')
                      const pct = Math.round(Object.values(pasos).filter(Boolean).length/PASOS.length*100)
                      return (
                        <div key={c.id}
                          onClick={() => setModal(c)}
                          style={{
                            background:'var(--surface)', border:'1px solid var(--border)',
                            borderRadius:'var(--r)', padding:'10px 12px', cursor:'pointer',
                            transition:'box-shadow .15s', borderLeft:`3px solid ${ECOLOR[e]}`,
                          }}
                          onMouseEnter={e2 => e2.currentTarget.style.boxShadow='var(--shadow-md)'}
                          onMouseLeave={e2 => e2.currentTarget.style.boxShadow='none'}>
                          <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>
                            {c.personaNombre} {c.personaApellido}
                          </div>
                          <div style={{ height:4, background:'var(--bg-2)', borderRadius:2, overflowX:'auto' }}>
                            <div style={{ width:`${pct}%`, height:'100%', background: ECOLOR[e], borderRadius:2 }}/>
                          </div>
                          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>{pct}% completado</div>
                        </div>
                      )
                    })}
                    {items.length === 0 && (
                      <div style={{ textAlign:'center', color:'var(--text-faint)', fontSize:12, padding:'16px 0' }}>
                        Sin procesos
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Paginación */}
        {pages > 1 && (
          <div className="pagination">
            <span className="pag-info">Pág {page}/{pages} · {total}</span>
            <button className="pag-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>←</button>
            <button className="pag-btn" disabled={page===pages} onClick={() => setPage(p=>p+1)}>→</button>
          </div>
        )}

        {/* Modal gestionar pasos */}
        {modal && (() => {
          const pasos = JSON.parse(modal.pasos||'{}')
          const completados = Object.values(pasos).filter(Boolean).length
          const pct = Math.round(completados / PASOS.length * 100)
          return (
            <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(null)}>
              <div className="modal" style={{ maxWidth:500 }}>
                <div className="modal-header">
                  <div>
                    <h3 className="modal-title"><Icons.Users /> {modal.personaNombre} {modal.personaApellido}</h3>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
                      <span style={{ color: ECOLOR[modal.estado], fontWeight:600 }}>{ELABEL[modal.estado]}</span>
                      {' · '}{pct}% completado
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>✕</button>
                </div>
                <div className="modal-body">
                  {/* Barra de progreso */}
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>
                      <span>{completados}/{PASOS.length} pasos</span>
                      <span style={{ fontWeight:700, color: pct===100?'var(--c-success)':'var(--primary)' }}>{pct}%</span>
                    </div>
                    <div style={{ height:8, background:'var(--bg-2)', borderRadius:4, overflowX:'auto' }}>
                      <div style={{
                        width:`${pct}%`, height:'100%', borderRadius:4,
                        background: pct===100 ? 'var(--c-success)' : 'var(--primary)',
                        transition:'width .4s ease',
                      }}/>
                    </div>
                  </div>
                  {/* Lista de pasos */}
                  {PASOS.map(p => {
                    const done = !!pasos[p.key]
                    return (
                      <div key={p.key}
                        onClick={() => actualizarPaso(modal.id, p.key, !done)}
                        style={{
                          display:'flex', alignItems:'center', gap:12,
                          padding:'12px 10px', borderRadius:'var(--r)',
                          marginBottom:4, cursor:'pointer',
                          background: done ? 'var(--c-success-bg)' : 'var(--bg)',
                          border: `1px solid ${done ? 'rgba(22,163,74,.2)' : 'var(--border)'}`,
                          transition:'all .15s',
                        }}>
                        <div style={{
                          width:22, height:22, borderRadius:'50%', flexShrink:0,
                          background: done ? 'var(--c-success)' : 'var(--bg-2)',
                          border: `2px solid ${done ? 'var(--c-success)' : 'var(--border-med)'}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, color:'var(--surface)', fontWeight:800,
                          transition:'all .2s',
                        }}>
                          {done ? '✓' : ''}
                        </div>
                        <span style={{ fontSize:18 }}>{p.icon}</span>
                        <span style={{
                          fontSize:14, fontWeight: done ? 600 : 400,
                          color: done ? 'var(--c-success)' : 'var(--text)',
                          textDecoration: done ? 'none' : 'none',
                          flex:1,
                        }}>
                          {p.label}
                        </span>
                        {done && <span style={{ fontSize:11, color:'var(--c-success)', fontWeight:600 }}>✓ Completado</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/personas/${modal.personaId}`)}>
                    Ver perfil →
                  </button>
                  <button className="btn btn-ghost" onClick={() => setModal(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Modal nuevo proceso */}
        {nuevaModal && (
          <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setNuevaModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">+ Nuevo proceso de consolidación</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setNuevaModal(false)}>✕</button>
              </div>
              <form onSubmit={crearConsolidacion}>
                <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-group">
                    <label>Persona visitante *</label>
                    <select name="personaId" className="form-input" required
                      value={formNuevo.personaId}
                      onChange={e => setFormNuevo(f=>({...f, personaId:e.target.value}))}>
                      <option value="">Seleccioná un visitante...</option>
                      {personas.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                      ))}
                    </select>
                    {personas.length === 0 && (
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                        No hay visitantes registrados. Agregá personas con estado "Visitante".
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Notas iniciales</label>
                    <textarea name="notas" className="form-input" rows={3}
                      placeholder="Cómo llegó, con quién vino, observaciones..."
                      value={formNuevo.notas}
                      onChange={e => setFormNuevo(f=>({...f, notas:e.target.value}))}/>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setNuevaModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Iniciar proceso</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
