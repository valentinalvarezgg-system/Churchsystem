import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const TIPOS = ['EVENTO','REUNION','RETIRO','CONFERENCIA','CULTO_ESPECIAL','OTRO']
const TCOLOR = { EVENTO:'#2563EB', REUNION:'#7C3AED', RETIRO:'#16A34A', CONFERENCIA:'#D97706', CULTO_ESPECIAL:'#DC2626', OTRO:'#64748B' }
const TBG    = { EVENTO:'#DBEAFE', REUNION:'#EDE9FE', RETIRO:'#DCFCE7', CONFERENCIA:'#FEF3C7', CULTO_ESPECIAL:'#FEE2E2', OTRO:'#F3F4F6' }

function fmtFecha(f) {
  if (!f) return ''
  const d = new Date(f + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function diasRestantes(fecha) {
  const hoy  = new Date(); hoy.setHours(0,0,0,0)
  const ev   = new Date(fecha + 'T00:00:00')
  const diff = Math.round((ev - hoy) / 86400000)
  if (diff < 0)  return { label: 'Pasado', color: 'var(--text-muted)' }
  if (diff === 0) return { label: 'Hoy', color: '#DC2626' }
  if (diff === 1) return { label: 'Mañana', color: '#D97706' }
  return { label: `En ${diff} días`, color: '#16A34A' }
}

export default function Eventos() {
  const user = getUser()
  const canManage = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(user?.rol)

  const hoy = new Date().toISOString().slice(0,10)
  const en90 = new Date(Date.now() + 90*86400000).toISOString().slice(0,10)

  const [eventos, setEventos]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm]         = useState({ titulo:'', tipo:'EVENTO', fecha:hoy, hora:'', lugar:'', descripcion:'', todoElDia:false })
  const [filtro, setFiltro]     = useState('proximos') // proximos | todos | pasados
  const [msg, setMsg]           = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      let url = '/eventos'
      if (filtro === 'proximos') url += `?desde=${hoy}&hasta=${en90}`
      else if (filtro === 'pasados') url += `?desde=2000-01-01&hasta=${hoy}`
      else url += `?desde=2000-01-01&hasta=2099-12-31`
      setEventos(await apiFetch(url) || [])
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [filtro])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditando(null)
    setForm({ titulo:'', tipo:'EVENTO', fecha:hoy, hora:'', lugar:'', descripcion:'', todoElDia:false })
    setMsg(null)
    setModal(true)
  }

  function openEdit(ev) {
    setEditando(ev)
    setForm({ titulo:ev.titulo, tipo:ev.tipo, fecha:ev.fecha, hora:ev.hora||'', lugar:ev.lugar||'', descripcion:ev.descripcion||'', todoElDia:!!ev.todoElDia })
    setMsg(null)
    setModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      if (editando) {
        await apiFetch(`/eventos/${editando.id}`, { method:'PUT', body:JSON.stringify(form) })
      } else {
        await apiFetch('/eventos', { method:'POST', body:JSON.stringify(form) })
      }
      setModal(false)
      load()
    } catch(err) { setMsg({ type:'error', text:err.message }) }
  }

  async function eliminar() {
    if (!confirmDel) return
    try { await apiFetch(`/eventos/${confirmDel}`, { method:'DELETE' }); setConfirmDel(null); load(); toast.success('Evento eliminado') }
    catch(e) { toast.error(e.message) }
  }

  const agrupadosPorMes = eventos.reduce((acc, ev) => {
    const mes = ev.fecha?.slice(0,7) || '?'
    if (!acc[mes]) acc[mes] = []
    acc[mes].push(ev)
    return acc
  }, {})

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Calendar /> Eventos</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>Actividades y calendario de la iglesia</p>
          </div>
          {canManage && <button className="btn btn-primary" onClick={openNew}>+ Nuevo evento</button>}
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {[['proximos','Próximos'],['todos','Todos'],['pasados','Pasados']].map(([k,l])=>(
            <button key={k} className={`btn btn-sm ${filtro===k?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltro(k)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="empty"><div className="spinner-sm" /></div>
        ) : error ? (
          <div className="alert alert-error" style={{margin:'0 0 16px'}}>
            {error} <button className="btn btn-ghost btn-sm" style={{marginLeft:12}} onClick={load}>Reintentar</button>
          </div>
        ) : eventos.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Icons.Calendar /></div>
            <p>{filtro==='proximos' ? 'Sin eventos próximos' : 'Sin eventos'}</p>
            {canManage && <button className="btn btn-primary" onClick={openNew}>Crear primer evento</button>}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            {Object.entries(agrupadosPorMes).sort().map(([mes, evs]) => {
              const [y,m] = mes.split('-')
              const nombreMes = new Date(Number(y), Number(m)-1, 1).toLocaleDateString('es-AR',{month:'long',year:'numeric'})
              return (
                <div key={mes}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>
                     {nombreMes.charAt(0).toUpperCase()+nombreMes.slice(1)}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {evs.map(ev => {
                      const restantes = diasRestantes(ev.fecha)
                      return (
                        <div key={ev.id} className="card" style={{padding:'14px 18px',borderLeft:`3px solid ${TCOLOR[ev.tipo]||'#2563EB'}`,display:'flex',gap:14,alignItems:'flex-start'}}>
                          {/* Fecha */}
                          <div style={{minWidth:52,textAlign:'center',padding:'8px 6px',background:'var(--bg-2)',borderRadius:8,flexShrink:0}}>
                            <div style={{fontSize:20,fontWeight:800,color:'var(--primary)',lineHeight:1}}>{ev.fecha?.slice(8,10)}</div>
                            <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',marginTop:2}}>
                              {new Date(ev.fecha+'T00:00:00').toLocaleDateString('es-AR',{month:'short'})}
                            </div>
                          </div>

                          {/* Info */}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
                              <span style={{padding:'2px 8px',borderRadius:3,fontSize:11,fontWeight:600,background:TBG[ev.tipo],color:TCOLOR[ev.tipo]}}>{ev.tipo}</span>
                              <span style={{fontSize:11,fontWeight:600,color:restantes.color}}>{restantes.label}</span>
                            </div>
                            <h3 style={{fontSize:15,fontWeight:700,margin:'0 0 4px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ev.titulo}</h3>
                            <div style={{fontSize:12,color:'var(--text-muted)',display:'flex',gap:12,flexWrap:'wrap'}}>
                              {ev.hora && <span> {ev.todoElDia?'Todo el día':ev.hora}</span>}
                              {ev.lugar && <span> {ev.lugar}</span>}
                            </div>
                            {ev.descripcion && <p style={{fontSize:12,color:'var(--text-muted)',margin:'6px 0 0',lineHeight:1.5}}>{ev.descripcion}</p>}
                          </div>

                          {/* Acciones */}
                          {canManage && (
                            <div style={{display:'flex',gap:6,flexShrink:0}}>
                              <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(ev)}>Editar</button>
                              <button className="btn btn-ghost btn-sm" style={{color:'var(--c-danger)'}} onClick={()=>setConfirmDel(ev.id)}></button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{editando?'Editar evento':'Nuevo evento'}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>×</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg && <div className={`alert alert-${msg.type}`} style={{marginBottom:12}}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group full">
                      <label>Título *</label>
                      <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required placeholder="Nombre del evento" />
                    </div>
                    <div className="form-group">
                      <label>Tipo</label>
                      <select className="form-input" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                        {TIPOS.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Fecha *</label>
                      <input className="form-input" type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} required />
                    </div>
                    <div className="form-group">
                      <label>Horario</label>
                      <input className="form-input" type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} disabled={form.todoElDia} />
                    </div>
                    <div className="form-group">
                      <label>Lugar</label>
                      <input className="form-input" value={form.lugar} onChange={e=>setForm(f=>({...f,lugar:e.target.value}))} placeholder="Dirección o salón" />
                    </div>
                    <div className="form-group full">
                      <label>Descripción</label>
                      <textarea className="form-input" value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} rows={3} placeholder="Detalles del evento..." />
                    </div>
                    <div className="form-group full">
                      <label style={{display:'flex',gap:10,alignItems:'center',cursor:'pointer',fontWeight:400}}>
                        <input type="checkbox" checked={form.todoElDia} onChange={e=>setForm(f=>({...f,todoElDia:e.target.checked,hora:e.target.checked?'':f.hora}))} style={{width:16,height:16,accentColor:'var(--primary)'}} />
                        Todo el día
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">{editando?'Guardar cambios':'Crear evento'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      <ConfirmModal
        open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={eliminar}
        title="¿Eliminar evento?" danger
        message="Este evento será eliminado permanentemente."
        confirmLabel="Eliminar" cancelLabel="Cancelar"
      />
    </div>
  )
}
