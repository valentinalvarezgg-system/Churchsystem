import { useEffect, useState, useRef, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { makeI18n } from '../lib/i18n.js'
import ChatGrupo from '../components/ChatGrupo.jsx'

const GRUP_I18N = {
  es: { title:'Grupos', newGroup:'+ Nuevo grupo', noGroups:'No hay grupos',
        editModal:'Editar grupo', newModal:'Nuevo grupo',
        nameLabel:'Nombre *', serviceLabel:'Culto', shiftLabel:'Turno', noLeader:'Sin líder', noAssign:'Sin asignar',
        members:'miembro(s)', noMembers:'Sin miembros asignados',
        specialCulto:'Sin culto', nameCol:'Nombre', phoneCol:'Teléfono', statusCol:'Estado',
        delTitle:'¿Eliminar grupo?', delSuffix:'será eliminado. Sus miembros quedarán sin grupo.',
        groupDeleted:'Grupo eliminado', stats:'Estadísticas', memberList:'Miembros' },
  pt: { title:'Grupos', newGroup:'+ Novo grupo', noGroups:'Sem grupos',
        editModal:'Editar grupo', newModal:'Novo grupo',
        nameLabel:'Nome *', serviceLabel:'Culto', shiftLabel:'Turno', noLeader:'Sem líder', noAssign:'Sem atribuição',
        members:'membro(s)', noMembers:'Sem membros atribuídos',
        specialCulto:'Sem culto', nameCol:'Nome', phoneCol:'Telefone', statusCol:'Estado',
        delTitle:'Excluir grupo?', delSuffix:'será excluído. Seus membros ficarão sem grupo.',
        groupDeleted:'Grupo excluído', stats:'Estatísticas', memberList:'Membros' },
  en: { title:'Groups', newGroup:'+ New group', noGroups:'No groups',
        editModal:'Edit group', newModal:'New group',
        nameLabel:'Name *', serviceLabel:'Service', shiftLabel:'Shift', noLeader:'No leader', noAssign:'Not assigned',
        members:'member(s)', noMembers:'No assigned members',
        specialCulto:'No service', nameCol:'Name', phoneCol:'Phone', statusCol:'Status',
        delTitle:'Delete group?', delSuffix:'will be deleted. Its members will have no group.',
        groupDeleted:'Group deleted', stats:'Statistics', memberList:'Members' },
}

const CULTOS = ['','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const EMPTY  = {nombre:'',cultoDia:'',cultoTurno:0,liderId:'',descripcion:'',tipo:'REGULAR',fechaFin:'',cupo:''}

// ── Tab Inscripciones para grupos temporales ─────────────────
function TabInscripciones({ grupoId, cupo }) {
  const [inscripciones, setInscripciones] = useState([])
  const [personas, setPersonas]           = useState([])
  const [search, setSearch]               = useState('')
  const [loading, setLoading]             = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setInscripciones(await apiFetch(`/grupos/${grupoId}/inscripciones`) || []) } catch {}
    setLoading(false)
  }, [grupoId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch(`/personas?search=${encodeURIComponent(search)}&limit=30`)
      .then(r => setPersonas(r?.data || r || []))
      .catch(() => {})
  }, [search])

  const inscritos = inscripciones.filter(i => i.estado !== 'BAJA')
  const cupoUsado = inscritos.length
  const pct = cupo ? Math.round(cupoUsado / cupo * 100) : null

  async function inscribir(personaId) {
    try { await apiFetch(`/grupos/${grupoId}/inscripciones`,{method:'POST',body:JSON.stringify({personaId})}); toast.success('Inscripto'); load() }
    catch(e) { toast.error(e.message) }
  }

  async function cambiarEstado(i, estado) {
    try { await apiFetch(`/grupos/${grupoId}/inscripciones/${i.id}`,{method:'PUT',body:JSON.stringify({estado})}); load() }
    catch(e) { toast.error(e.message) }
  }

  const ESTADO_COLOR = { INSCRIPTO:'var(--c-info)', COMPLETADO:'var(--c-success)', BAJA:'var(--c-danger)' }

  return (
    <div>
      {cupo && (
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
            <span style={{color:'var(--text-muted)'}}>Cupo utilizado</span>
            <span style={{fontWeight:700}}>{cupoUsado} / {cupo} ({pct}%)</span>
          </div>
          <div style={{height:8,background:'var(--bg-2)',borderRadius:4,overflow:'hidden'}}>
            <div style={{width:`${Math.min(pct,100)}%`,height:'100%',background: pct>=100?'var(--c-danger)':pct>=80?'var(--c-warning)':'var(--c-success)',transition:'width .3s'}}/>
          </div>
        </div>
      )}

      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6,fontWeight:600}}>Inscribir persona</div>
        <input className="input" placeholder="Buscar por nombre..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:6}}/>
        <div style={{maxHeight:150,overflowY:'auto',border:'1px solid var(--border)',borderRadius:8}}>
          {personas.filter(p => !inscripciones.find(i=>i.personaId===p.id && i.estado!=='BAJA')).slice(0,15).map(p=>(
            <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',borderBottom:'1px solid var(--border)',fontSize:12}}>
              <span>{p.nombre} {p.apellido}</span>
              <button className="btn btn-primary btn-sm" style={{fontSize:11,padding:'2px 8px'}} onClick={()=>inscribir(p.id)}>Inscribir</button>
            </div>
          ))}
          {personas.length===0 && <p style={{padding:'8px 10px',color:'var(--text-muted)',fontSize:12}}>Escribí un nombre para buscar</p>}
        </div>
      </div>

      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6,fontWeight:600}}>Inscriptos ({cupoUsado})</div>
      {loading ? <p style={{color:'var(--text-muted)'}}>Cargando...</p>
      : inscripciones.length === 0 ? <p style={{color:'var(--text-muted)',textAlign:'center',padding:'16px 0'}}>Sin inscriptos aún</p>
      : inscripciones.map(i => (
        <div key={i.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:'var(--bg-2)',borderRadius:8,marginBottom:4,fontSize:12}}>
          <div style={{flex:1}}>
            <span style={{fontWeight:600}}>{i.nombre} {i.apellido}</span>
            {i.telefono && <span style={{color:'var(--text-muted)',marginLeft:8}}>{i.telefono}</span>}
          </div>
          <select value={i.estado}
            onChange={e=>cambiarEstado(i,e.target.value)}
            style={{fontSize:11,padding:'2px 8px',borderRadius:20,border:`1px solid ${ESTADO_COLOR[i.estado]}`,color:ESTADO_COLOR[i.estado],background:'transparent',cursor:'pointer'}}>
            {['INSCRIPTO','COMPLETADO','BAJA'].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

const ETAPA_COLOR = {
  NUEVO_CREYENTE:'#3B82F6', CONSOLIDADO:'#F59E0B', DISCIPULO:'#22C55E',
  LIDER:'#8B5CF6', MINISTRO:'#F43F5E', null:'#94A3B8', undefined:'#94A3B8'
}
const ESTADO_COLOR = { ACTIVO:'#22C55E', VISITANTE:'#3B82F6', INACTIVO:'#94A3B8' }

// ── Panel de estadísticas ────────────────────────────────────
function StatsPanel({ grupoId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const barRef  = useRef(null)
  const donutEtapaRef  = useRef(null)
  const donutEstadoRef = useRef(null)
  const chartsRef = useRef([])

  useEffect(() => {
    setLoading(true)
    apiFetch(`/grupos/${grupoId}/stats`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [grupoId])

  useEffect(() => {
    if (!data || loading) return
    if (window.__chartjs_loaded) { renderCharts(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
    s.onload = () => { window.__chartjs_loaded = true; renderCharts() }
    document.head.appendChild(s)
  }, [data, loading])

  function renderCharts() {
    const Chart = window.Chart
    if (!Chart) return

    // Destruir charts previos
    chartsRef.current.forEach(c => { try { c.destroy() } catch {} })
    chartsRef.current = []

    // 1. Barras — crecimiento mensual
    if (barRef.current && data?.crecimiento?.length) {
      chartsRef.current.push(new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: data.crecimiento.map(r => r.mes.slice(5)),
          datasets: [{ label: 'Nuevos miembros', data: data.crecimiento.map(r => r.nuevos),
            backgroundColor: '#6D5DFB', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      }))
    }

    // 2. Donut — etapa espiritual
    if (donutEtapaRef.current && data?.porEtapa?.length) {
      chartsRef.current.push(new Chart(donutEtapaRef.current, {
        type: 'doughnut',
        data: {
          labels: data.porEtapa.map(r => (r.estadoEspiritual||'Sin etapa').replace(/_/g,' ')),
          datasets: [{ data: data.porEtapa.map(r => r.total),
            backgroundColor: data.porEtapa.map(r => ETAPA_COLOR[r.estadoEspiritual] || '#94A3B8'),
            borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }, cutout: '65%' }
      }))
    }

    // 3. Donut — estado
    if (donutEstadoRef.current && data?.porEstado?.length) {
      chartsRef.current.push(new Chart(donutEstadoRef.current, {
        type: 'doughnut',
        data: {
          labels: data.porEstado.map(r => r.estado),
          datasets: [{ data: data.porEstado.map(r => r.total),
            backgroundColor: data.porEstado.map(r => ESTADO_COLOR[r.estado] || '#94A3B8'),
            borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }, cutout: '65%' }
      }))
    }
  }

  if (loading) return <div style={{padding:30,textAlign:'center',color:'var(--text-muted)'}}>Cargando estadísticas...</div>
  if (!data)   return <div style={{padding:30,textAlign:'center',color:'var(--text-muted)'}}>Sin datos disponibles</div>

  const { resumen, ultimo } = data

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {[
          ['Total', resumen.total || 0, 'var(--primary)'],
          ['Bautizados', resumen.bautizados || 0, 'var(--c-info)'],
          ['Discipulado completo', resumen.discipulados || 0, 'var(--c-success)'],
        ].map(([l, v, c]) => (
          <div key={l} style={{background:'var(--bg-2)',borderRadius:10,padding:'12px 10px',textAlign:'center'}}>
            <div style={{fontSize:26,fontWeight:800,color:c}}>{v}</div>
            <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Último miembro */}
      {ultimo && (
        <div style={{fontSize:12,color:'var(--text-muted)',padding:'8px 12px',background:'var(--bg-2)',borderRadius:8}}>
          Último ingreso: <strong style={{color:'var(--text)'}}>{ultimo.nombre} {ultimo.apellido}</strong>
          {' — '}{new Date(ultimo.createdAt).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'})}
        </div>
      )}

      {/* Barra crecimiento */}
      <div>
        <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:'var(--text-muted)'}}>Nuevos miembros por mes (últimos 12)</div>
        <div style={{position:'relative',height:160}}>
          <canvas ref={barRef} role="img" aria-label="Crecimiento mensual del grupo" />
        </div>
      </div>

      {/* Donuts */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:'var(--text-muted)'}}>Por etapa espiritual</div>
          <div style={{position:'relative',height:160}}>
            <canvas ref={donutEtapaRef} role="img" aria-label="Distribución por etapa espiritual" />
          </div>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:'var(--text-muted)'}}>Por estado</div>
          <div style={{position:'relative',height:160}}>
            <canvas ref={donutEstadoRef} role="img" aria-label="Distribución por estado" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function Grupos() {
  const t = makeI18n(GRUP_I18N)
  const user = getUser()
  const canDelete = user?.rol === 'PASTOR_GENERAL'
  const navigate = useNavigate()
  const [grupos, setGrupos]         = useState([])
  const [users, setUsers]           = useState([])
  const [modal, setModal]           = useState(null)
  const [detalle, setDetalle]       = useState(null)
  const [detalleTab, setDetalleTab] = useState('members')
  const [form, setForm]             = useState(EMPTY)
  const [msg, setMsg]               = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try { setGrupos(await apiFetch('/grupos')||[]) } catch(e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => {
    load()
    apiFetch('/users').then(u=>setUsers(u||[])).catch(()=>{})
  }, [])

  function openModal(g=null) {
    setForm(g ? {...EMPTY,...g,liderId:g.liderId||''} : EMPTY)
    setModal(g ? 'edit' : 'new'); setMsg(null)
  }

  async function openDetalle(g) {
    setDetalleTab('members')
    try { setDetalle(await apiFetch(`/grupos/${g.id}`)) } catch {}
  }

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      const body = {...form,cultoTurno:Number(form.cultoTurno)||0,liderId:form.liderId||null}
      if (modal==='edit') await apiFetch(`/grupos/${form.id}`,{method:'PUT',body:JSON.stringify(body)})
      else await apiFetch('/grupos',{method:'POST',body:JSON.stringify(body)})
      setModal(null); load()
    } catch (e) { setMsg({type:'error',text:e.message}) }
  }

  async function handleDelete() {
    if (!confirmDel) return
    try { await apiFetch(`/grupos/${confirmDel.id}`,{method:'DELETE'}); setConfirmDel(null); load(); toast.success(t('groupDeleted')) }
    catch (e) { toast.error(e.message) }
  }

  const f = (k,v) => setForm(prev=>({...prev,[k]:v}))
  const TAB = (active) => ({
    padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)', transition:'all .15s'
  })

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title"><Icons.Groups /> {t('title')} <span style={{fontSize:15,fontWeight:400,color:'var(--text-muted)'}}>({grupos.length})</span></h1>
          <button className="btn btn-primary" onClick={()=>openModal()}>{t('newGroup')}</button>
        </div>
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        {loading
          ? <div className="empty"><p>Cargando...</p></div>
          : error
          ? <div className="alert alert-error" style={{margin:'0 0 16px'}}>{error}</div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
              {grupos.length===0 && <div className="card empty"><div className="empty-icon"><Icons.Groups /></div><p>{t('noGroups')}</p></div>}
              {grupos.map(g=>(
                <div key={g.id} className="card" style={{cursor:'pointer'}} onClick={()=>openDetalle(g)}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                    <div>
                      <h3 style={{fontSize:16,fontWeight:700,marginBottom:4}}>{g.nombre}</h3>
                      <p style={{fontSize:12,color:'var(--text-muted)'}}>{g.cultoDia||t('specialCulto')}{g.cultoDia?` · T${g.cultoTurno}`:''}</p>
                    </div>
                    <span style={{fontSize:28,fontWeight:700,color:'var(--primary)'}}>{g.totalPersonas||0}</span>
                  </div>
                  {g.liderNombre && <p style={{fontSize:12,marginTop:8,color:'var(--text-muted)'}}><Icons.Profile /> {g.liderNombre}</p>}
                  {g.descripcion && <p style={{fontSize:12,marginTop:6,color:'var(--text-muted)'}}>{g.descripcion}</p>}
                  <div style={{marginTop:14,display:'flex',gap:8}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openModal(g)}>{t('edit')}</button>
                    {canDelete && <button className="btn btn-danger btn-sm" onClick={()=>setConfirmDel({id:g.id,nombre:g.nombre})}>Eliminar</button>}
                  </div>
                </div>
              ))}
            </div>
        }

        {/* ── Modal editar/crear ── */}
        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{modal==='edit'?t('editModal'):t('newModal')}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>×</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group full"><label>{t('nameLabel')}</label><input name="nombre" className="form-input" value={form.nombre} onChange={e=>f('nombre',e.target.value)} required /></div>
                    <div className="form-group"><label>Tipo</label>
                      <select name="tipo" className="form-input" value={form.tipo} onChange={e=>f('tipo',e.target.value)}>
                        <option value="REGULAR">Regular</option>
                        <option value="TEMPORAL">Temporal / Estacional</option>
                      </select>
                    </div>
                    {form.tipo==='TEMPORAL' && <>
                      <div className="form-group"><label>Fecha de fin</label><input type="date" name="fechaFin" className="form-input" value={form.fechaFin} onChange={e=>f('fechaFin',e.target.value)}/></div>
                      <div className="form-group"><label>Cupo máximo</label><input type="number" min="1" name="cupo" className="form-input" value={form.cupo} placeholder="Sin límite" onChange={e=>f('cupo',e.target.value)}/></div>
                    </>}
                    <div className="form-group"><label>{t('serviceLabel')}</label>
                      <select name="cultoDia" className="form-input" value={form.cultoDia} onChange={e=>f('cultoDia',e.target.value)}>
                        {CULTOS.map(c=><option key={c} value={c}>{c||t('notAssigned')}</option>)}</select></div>
                    <div className="form-group"><label>{t('shiftLabel')}</label>
                      <select name="cultoTurno" className="form-input" value={form.cultoTurno} onChange={e=>f('cultoTurno',e.target.value)}>
                        {[0,1,2,3].map(n=><option key={n} value={n}>{t('shiftLabel')} {n}</option>)}</select></div>
                    <div className="form-group full"><label>{t('leader')}</label>
                      <select name="liderId" className="form-input" value={form.liderId} onChange={e=>f('liderId',e.target.value)}>
                        <option value="">{t('noLeader')}</option>
                        {users.map(u=><option key={u.id} value={u.id}>{u.nombre||u.email}</option>)}</select></div>
                    <div className="form-group full"><label>{t('description')}</label><textarea name="descripcion" className="form-input" value={form.descripcion} onChange={e=>f('descripcion',e.target.value)} /></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={()=>setModal(null)}>{t('cancel')}</button>
                  <button type="submit" className="btn btn-primary">{t('save')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal detalle (Miembros + Estadísticas) ── */}
        {detalle && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetalle(null)}>
            <div className="modal" style={{maxWidth:600}}>
              <div className="modal-header" style={{flexDirection:'column',alignItems:'flex-start',gap:10}}>
                <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
                  <h3 className="modal-title">{detalle.nombre}</h3>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setDetalle(null)}>×</button>
                </div>
                <div style={{display:'flex',gap:4,background:'var(--bg-2)',borderRadius:8,padding:3}}>
                  <button style={TAB(detalleTab==='members')} onClick={()=>setDetalleTab('members')}>{t('memberList')} ({detalle.miembros?.length||0})</button>
                  {detalle.tipo==='TEMPORAL' && <button style={TAB(detalleTab==='inscripciones')} onClick={()=>setDetalleTab('inscripciones')}>📋 Inscripciones</button>}
                  <button style={TAB(detalleTab==='chat')} onClick={()=>setDetalleTab('chat')}>💬 Chat</button>
                  <button style={TAB(detalleTab==='stats')} onClick={()=>setDetalleTab('stats')}>📊 {t('stats')}</button>
                </div>
              </div>

              <div className="modal-body">
                {detalleTab === 'members' && (
                  detalle.miembros?.length > 0 ? <>
                    <div className="table-responsive-mobile-hide table-responsive">
                      <table style={{minWidth:500}}>
                        <thead><tr><th>{t('nameCol')}</th><th>{t('phoneCol')}</th><th>{t('statusCol')}</th></tr></thead>
                        <tbody>{(detalle.miembros||[]).map(m=>(
                          <tr key={m.id}>
                            <td><span className="persona-link" onClick={()=>navigate(`/personas/${m.id}`)}>{m.nombre} {m.apellido}</span></td>
                            <td>{m.telefono||'—'}</td>
                            <td><span className={`badge badge-${m.estado?.toLowerCase()}`}>{m.estado}</span></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="members-mobile-list">
                      {(detalle.miembros||[]).map(m=>(
                        <div key={m.id} className="member-card-mobile">
                          <div style={{flex:1}}>
                            <div className="member-name persona-link" onClick={()=>navigate(`/personas/${m.id}`)}>{m.nombre} {m.apellido}</div>
                            <div className="member-meta">{m.telefono||'Sin teléfono'}</div>
                          </div>
                          <span className={`badge badge-${m.estado?.toLowerCase()}`}>{m.estado}</span>
                        </div>
                      ))}
                    </div>
                  </> : <div className="empty"><p>{t('noMembers')}</p></div>
                )}

                {detalleTab === 'inscripciones' && (
                  <TabInscripciones grupoId={detalle.id} cupo={detalle.cupo} />
                )}
                {detalleTab === 'chat' && (
                  <ChatGrupo grupoId={detalle.id} grupoNombre={detalle.nombre} />
                )}
                {detalleTab === 'stats' && (
                  <StatsPanel grupoId={detalle.id} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <ConfirmModal
        open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={handleDelete}
        title={t('delTitle')} danger
        message={confirmDel ? `"${confirmDel.nombre}" ${t('delSuffix')}` : ''}
        confirmLabel={t('delete')} cancelLabel={t('cancel')}
      />
    </div>
  )
}
