import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'

const DIAS_REGULARES = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const CULTOS_ESPECIALES = ['Oración','Mujeres','Sanos por la Palabra','Pre-Adolescentes','Adolescentes','Jóvenes','Jóvenes Adultos','Escuelita']
const HORARIOS = ['8:45','10hs','18hs','19hs','20hs','21hs']

export default function Asistencia() {
  const user = getUser()
  const canManage = ['PASTOR_GENERAL','PASTOR_CULTO'].includes(user?.rol)
  const [cultos, setCultos]       = useState([])
  const [selected, setSelected]   = useState(null)
  const [detalle, setDetalle]     = useState(null)
  const [search, setSearch]       = useState('')
  const [presentes, setPresentes] = useState(new Set())
  const [saving, setSaving]       = useState(false)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ nombre:'', fecha:new Date().toISOString().slice(0,10), cultoDia:'DOMINGO', cultoTurno:0, observaciones:'', esEspecial:false, nombreEspecial:'', horario:'18hs' })
  const [msg, setMsg]             = useState(null)

  async function loadCultos() {
    try { setCultos(await apiFetch('/cultos') || []) } catch {}
  }
  useEffect(() => { loadCultos() }, [])

  const loadDetalle = useCallback(async () => {
    if (!selected) return
    try {
      const p = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await apiFetch(`/cultos/${selected}/asistencia${p}`)
      setDetalle(res)
      setPresentes(new Set(res.personas.filter(p=>p.presente).map(p=>Number(p.id))))
    } catch {}
  }, [selected, search])

  useEffect(() => { loadDetalle() }, [loadDetalle])

  function togglePresente(id) {
    setPresentes(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function guardar() {
    setSaving(true); setMsg(null)
    try {
      const res = await apiFetch(`/cultos/${selected}/asistencia`, { method:'POST', body:JSON.stringify({ presentes:[...presentes] }) })
      setMsg({ type:'success', text:`<Icons.Attendance /> ${res.presentes} presentes guardados` })
      loadCultos()
    } catch(e) { setMsg({ type:'error', text:e.message }) }
    setSaving(false)
  }

  async function crearCulto(e) {
    e.preventDefault()
    try {
      await apiFetch('/cultos', { method:'POST', body:JSON.stringify({...form, cultoTurno:Number(form.cultoTurno)||0}) })
      setModal(false); loadCultos()
    } catch(e) { alert(e.message) }
  }

  async function eliminarCulto(id) {
    if (!confirm('¿Eliminar este culto y su asistencia?')) return
    try { await apiFetch(`/cultos/${id}`,{method:'DELETE'}); setSelected(null); setDetalle(null); loadCultos() }
    catch(e) { alert(e.message) }
  }

  const cultoActual = cultos.find(c=>Number(c.id)===Number(selected))

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title"><Icons.Attendance /> Asistencia a cultos</h1>
          {canManage && <button className="btn btn-primary" data-tip="Crear un nuevo registro de culto" onClick={()=>setModal(true)}>+ Nuevo culto</button>}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'start'}}>
          <div className="card" style={{padding:0, overflowX:'auto'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',fontSize:12,fontWeight:600,color:'var(--text-muted)'}}>CULTOS ({cultos.length})</div>
            {cultos.length===0 ? <div className="empty" style={{padding:30}}><p>Sin cultos</p></div>
              : cultos.map(c=>(
                <div key={c.id} onClick={()=>{setSelected(Number(c.id));setSearch('');setMsg(null)}}
                  style={{padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid var(--border)',
                    background:Number(selected)===Number(c.id)?'#eff6ff':'transparent',
                    borderLeft:Number(selected)===Number(c.id)?'3px solid var(--primary)':'3px solid transparent'}}>
                  <div style={{fontWeight:600,fontSize:13}}>{c.nombre}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{c.fecha}</div>
                  <div style={{fontSize:11,marginTop:4}}><span className="badge badge-activo">{c.presentes||0} presentes</span></div>
                </div>
              ))
            }
          </div>
          <div>
            {!selected ? <div className="card empty"><div className="empty-icon"><Icons.Attendance /></div><p>Seleccioná un culto</p></div>
              : <div className="card" style={{padding:0, overflowX:'auto'}}>
                  <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                    <div>
                      <h2 style={{fontSize:16,fontWeight:700,margin:0}}>{cultoActual?.nombre}</h2>
                      <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{cultoActual?.fecha}</p>
                    </div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      {detalle && <span style={{fontSize:13,color:'var(--text-muted)'}}>{presentes.size}/{detalle.personas.length}</span>}
                      {canManage && <>
                        <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>{saving?'Guardando...':'💾 Guardar'}</button>
                        <button className="btn btn-ghost btn-sm" data-tip="Descargar planilla Excel con la asistencia" onClick={()=>window.open(`http://localhost:4000/export/asistencia/${selected}?token=${localStorage.getItem("token")}`,"_blank")}>↑ Exportar</button>
                        <button className="btn btn-danger btn-sm" data-tip="Eliminar este culto y su registro de asistencia" onClick={()=>eliminarCulto(selected)}>Eliminar</button>
                      </>}
                    </div>
                  </div>
                  {msg && <div style={{margin:'0 16px',marginTop:10}}><div className={`alert alert-${msg.type}`}>{msg.text}</div></div>}
                  <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',gap:10}}>
                    <input name="h" className="input input-search" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
                    {detalle && <button className="btn btn-ghost btn-sm" onClick={()=>setPresentes(p=>p.size===detalle.personas.length?new Set():new Set((detalle?.personas || []).map(x=>Number(x.id))))}>{presentes.size===detalle.personas?.length?'Desmarcar todos':'Marcar todos'}</button>}
                  </div>
                  {!detalle ? <div className="empty"><p>Cargando...</p></div>
                    : <div style={{maxHeight:'calc(100vh - 340px)',overflowY:'auto'}}>
                        <table style={{minWidth:500}}>
                          <thead><tr><th style={{width:44}}>✓</th><th>Nombre</th><th>Estado</th></tr></thead>
                          <tbody>{(detalle?.personas || []).map(p=>(
                            <tr key={p.id} onClick={()=>canManage&&togglePresente(Number(p.id))} style={{cursor:canManage?'pointer':'default',background:presentes.has(Number(p.id))?'#f0fdf4':''}}>
                              <td><input name="has" type="checkbox" readOnly checked={presentes.has(Number(p.id))} style={{width:16,height:16,accentColor:'var(--primary)'}}/></td>
                              <td><strong>{p.nombre} {p.apellido}</strong></td>
                              <td><span className={`badge badge-${p.estado?.toLowerCase()}`}>{p.estado}</span></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                  }
                </div>
            }
          </div>
        </div>
        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
            <div className="modal">
              <div className="modal-header"><h3 className="modal-title">Nuevo culto</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>✕</button></div>
              <form onSubmit={crearCulto}>
                <div className="modal-body">
                  <div className="form-grid">
                    <div className="form-group full"><label>Nombre *</label><input name="nombre" className="form-input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} required placeholder={form.esEspecial ? form.nombreEspecial || "Oración" : `${form.cultoDia||"DOMINGO"} ${form.horario||"18hs"}`}/></div>
                    <div className="form-group"><label>Fecha *</label><input name="fecha" className="form-input" type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} required/></div>
                    <div className="form-group full">
                      <label>Tipo</label>
                      <div style={{display:'flex',gap:8,marginBottom:10}}>
                        {[['regular','Culto regular'],['especial','Culto especial']].map(([k,l])=>(
                          <label key={k} style={{display:'flex',gap:8,alignItems:'center',padding:'7px 12px',border:`1px solid ${!form.esEspecial===!(k==='especial')?'var(--primary)':'var(--border)'}`,borderRadius:'var(--r)',cursor:'pointer',fontSize:13,fontWeight:!form.esEspecial===!(k==='especial')?600:400,background:!form.esEspecial===!(k==='especial')?'var(--primary-soft)':'transparent'}}>
                            <input name="esEspecial" type="radio" checked={form.esEspecial===(k==='especial')} onChange={()=>setForm(f=>({...f,esEspecial:k==='especial',nombre:k==='especial'?f.nombreEspecial||'':`${f.cultoDia} ${f.horario}`}))} style={{accentColor:'var(--primary)'}}/>
                            {l}
                          </label>
                        ))}
                      </div>
                      {!form.esEspecial ? (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                          <div><label style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:4}}>Día</label>
                            <select name="cultoDia" className="form-input" value={form.cultoDia} onChange={e=>setForm(f=>({...f,cultoDia:e.target.value,nombre:`${e.target.value} ${f.horario}`}))}>
                              {DIAS_REGULARES.map(d=><option key={d} value={d}>{d}</option>)}
                            </select></div>
                          <div><label style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:4}}>Horario</label>
                            <select name="horario" className="form-input" value={form.horario} onChange={e=>setForm(f=>({...f,horario:e.target.value,nombre:`${f.cultoDia} ${e.target.value}`}))}>
                              {HORARIOS.map(h=><option key={h} value={h}>{h}</option>)}
                            </select></div>
                        </div>
                      ) : (
                        <select name="nombreEspecial" className="form-input" value={form.nombreEspecial} onChange={e=>setForm(f=>({...f,nombreEspecial:e.target.value,nombre:e.target.value}))}>
                          <option value="">Seleccioná...</option>
                          {CULTOS_ESPECIALES.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Crear</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
