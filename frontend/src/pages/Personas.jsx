import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'

const ESTADOS = ['ACTIVO','INACTIVO','VISITANTE','NUEVO']
const CULTOS  = ['','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const TIPOS_SEG = ['CONTACTO','VISITA','LLAMADA','REUNION','ORACION','MENSAJE','OTRO']
const EMPTY   = {nombre:'',apellido:'',email:'',telefono:'',cultoDia:'',cultoTurno:0,
  grupoId:'',asignadoA:'',estado:'ACTIVO',notas:'',fechaIngreso:'',fechaNacimiento:''}

export default function Personas() {
  const user = getUser()
  const isAdmin = ['PASTOR_GENERAL','CONSOLIDACION'].includes(user?.rol)
  const canDelete = user?.rol === 'PASTOR_GENERAL'
  const navigate = useNavigate()


  const [data, setData]         = useState([])
  const [total, setTotal]       = useState(0)
  const [pages, setPages]       = useState(1)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [estadoF, setEstadoF]   = useState('')
  const [grupoF,  setGrupoF]    = useState('')
  const [grupos, setGrupos]     = useState([])
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [msg, setMsg]           = useState(null)
  const [loading, setLoading]   = useState(false)
  const [segModal, setSegModal] = useState(null)
  const [segList, setSegList]   = useState([])
  const [segForm, setSegForm]   = useState({tipo:'CONTACTO',nota:'',proximoContacto:''})
  const [importModal, setImportModal] = useState(false)
  const [importData, setImportData]   = useState(null)
  const [importLoading, setImportLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({page, limit:20})
      if (search) p.set('search', search)
      if (estadoF) p.set('estado', estadoF)
      if (grupoF)  p.set('grupoId', grupoF)
      const res = await apiFetch(`/personas?${p}`)
      setData(res.data||[]); setTotal(res.total||0); setPages(res.pages||1)
    } catch (e) { setMsg({type:'error',text:e.message}) }
    setLoading(false)
  }, [page, search, estadoF, grupoF])

  useEffect(() => { load() }, [load])
  useEffect(() => { apiFetch('/grupos').then(g=>setGrupos(g||[])).catch(()=>{}) }, [])

  function openModal(p=null) {
    setForm(p ? {...EMPTY,...p,grupoId:p.grupoId||'',asignadoA:p.asignadoA||''} : EMPTY)
    setModal(p?'edit':'new'); setMsg(null)
  }

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      const body = {...form, cultoTurno:Number(form.cultoTurno)||0,
        grupoId:form.grupoId||null, asignadoA:form.asignadoA||null,
        fechaNacimiento:form.fechaNacimiento||null}
      if (modal==='edit') await apiFetch(`/personas/${form.id}`,{method:'PUT',body:JSON.stringify(body)})
      else await apiFetch('/personas',{method:'POST',body:JSON.stringify(body)})
      setModal(null); load()
    } catch (e) { setMsg({type:'error',text:e.message}) }
  }

  async function handleDelete(id, nombre) {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return
    try { await apiFetch(`/personas/${id}`,{method:'DELETE'}); load() }
    catch (e) { setMsg({type:'error',text:e.message}) }
  }

  async function openSeguimiento(p) {
    setSegModal(p); setSegForm({tipo:'CONTACTO',nota:'',proximoContacto:''})
    try { setSegList(await apiFetch(`/seguimiento/${p.id}`) || []) } catch {}
  }

  async function handleAddSeg(e) {
    e.preventDefault()
    try {
      await apiFetch('/seguimiento',{method:'POST',body:JSON.stringify({personaId:segModal.id,...segForm,proximoContacto:segForm.proximoContacto||null})})
      setSegList(await apiFetch(`/seguimiento/${segModal.id}`) || [])
      setSegForm({tipo:'CONTACTO',nota:'',proximoContacto:''})
    } catch (e) { alert(e.message) }
  }

  async function deleteSeg(id) {
    if (!confirm('¿Eliminar esta nota?')) return
    try { await apiFetch(`/seguimiento/${id}`,{method:'DELETE'}); setSegList(await apiFetch(`/seguimiento/${segModal.id}`) || []) }
    catch (e) { alert(e.message) }
  }

  async function handleFileImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImportLoading(true)
    const reader = new FileReader()
    reader.onload = async ev => {
      const b64 = ev.target.result.split(',')[1]
      try {
        const res = await apiFetch('/excel-ia/importar', {
          method: 'POST',
          body: JSON.stringify({ file: b64, mapeo: {}, opcionDuplicados: 'saltar' })
        })
        setImportData(res)
        load()
      } catch (err) { 
        setMsg({type:'error', text: err.message}) 
      }
      setImportLoading(false)
    }
    reader.readAsDataURL(file)
  }

  async function confirmImport() {
    setImportLoading(true)
    try {
      const res = await apiFetch('/import/personas',{method:'POST',body:JSON.stringify({file:importData.base64})})
      alert(`✅ Importadas: ${res.importados}${res.errores?.length?`\nAvisos: ${res.errores.slice(0,3).join(', ')}`:''}`)
      setImportModal(false); setImportData(null); load()
    } catch (e) { alert(e.message) }
    setImportLoading(false)
  }

  const f = (k,v) => setForm(prev=>({...prev,[k]:v}))
  const sf = (k,v) => setSegForm(prev=>({...prev,[k]:v}))

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">👥 Personas <span style={{fontSize:15,fontWeight:400,color:'var(--text-muted)'}}>({total})</span></h1>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost" data-tip="Importar personas desde una planilla Excel" onClick={()=>setImportModal(true)}>📥 Importar Excel</button>
            <button className="btn btn-primary" data-tip="Agregar una nueva persona a la congregación" onClick={()=>openModal()}>+ Nueva persona</button>
          </div>
        </div>
        {msg && !modal && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <div className="toolbar">
          <input name="buscar_nombre__email" className="input input-search" placeholder="Buscar nombre, email, teléfono..."
            value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} />
          <select name="estadoF" className="input" value={estadoF} onChange={e=>{setEstadoF(e.target.value);setPage(1)}}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <select name="grupoF" className="input" value={grupoF} onChange={e=>{setGrupoF(e.target.value);setPage(1)}} style={{minWidth:140}}>
            <option value="">Todos los grupos</option>
            {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <button className="btn btn-ghost" data-tip="Quitar todos los filtros activos" onClick={()=>{setSearch('');setEstadoF('');setGrupoF('');setPage(1)}}>Limpiar</button>
        </div>
        <div className="card" style={{padding:0, overflowX:'auto'}}>
          {loading ? <div className="empty"><p>Cargando...</p></div>
           : data.length===0 ? <div className="empty"><div className="empty-icon">👤</div><p>No hay personas</p></div>
           : <table style={{minWidth:500}}>
               <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Culto</th><th>Estado</th><th>Acciones</th></tr></thead>
               <tbody>{data.map(p=>(
                 <tr key={p.id}>
                   <td><strong className="persona-link" data-tip="Ver perfil completo" onClick={()=>navigate(`/personas/${p.id}`)}>{p.nombre} {p.apellido}</strong>
                     {p.fechaNacimiento && <div style={{fontSize:11,color:'var(--text-muted)'}}>🎂 {p.fechaNacimiento}</div>}
                   </td>
                   <td style={{color:'var(--text-muted)'}}>{p.email||'—'}</td>
                   <td>{p.telefono||'—'}</td>
                   <td style={{fontSize:12}}>{p.cultoDia||'—'}{p.cultoDia?` T${p.cultoTurno}`:''}</td>
                   <td><span className={`badge badge-${p.estado?.toLowerCase()}`}>{p.estado}</span></td>
                   <td style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                     <button className="btn btn-ghost btn-sm" data-tip="Editar datos de esta persona" onClick={()=>openModal(p)}>Editar</button>
                     <button className="btn btn-ghost btn-sm" data-tip="Agregar nota de seguimiento pastoral" style={{color:'var(--c-purple)'}} onClick={()=>openSeguimiento(p)}>📋 Seguim.</button>
                     {canDelete && <button className="btn btn-danger btn-sm" data-tip="Eliminar persona" onClick={()=>handleDelete(p.id,p.nombre)}>✕</button>}
                   </td>
                 </tr>
               ))}</tbody>
             </table>
          }
        </div>
        {pages>1 && (
          <div className="pagination">
            <span className="pag-info">Pág {page}/{pages} · {total} total</span>
            <button className="pag-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>←</button>
            {Array.from({length:Math.min(pages,7)},(_,i)=>i+Math.max(1,page-3)).filter(n=>n<=pages).map(n=>(
              <button key={n} className={`pag-btn${page===n?' active':''}`} onClick={()=>setPage(n)}>{n}</button>
            ))}
            <button className="pag-btn" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>→</button>
          </div>
        )}

        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{modal==='edit'?'Editar persona':'Nueva persona'}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>✕</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group"><label>Nombre *</label><input name="nombre" className="form-input" value={form.nombre} onChange={e=>f('nombre',e.target.value)} required /></div>
                    <div className="form-group"><label>Apellido</label><input name="apellido" className="form-input" value={form.apellido} onChange={e=>f('apellido',e.target.value)} /></div>
                    <div className="form-group"><label>Email</label><input name="email" className="form-input" type="email" value={form.email} onChange={e=>f('email',e.target.value)} /></div>
                    <div className="form-group"><label>Teléfono</label><input name="telefono" className="form-input" value={form.telefono} onChange={e=>f('telefono',e.target.value)} /></div>
                    <div className="form-group"><label>Fecha nacimiento</label><input name="fechaNacimiento" className="form-input" type="date" value={form.fechaNacimiento||''} onChange={e=>f('fechaNacimiento',e.target.value)} /></div>
                    <div className="form-group"><label>Estado</label>
                      <select name="estado" className="form-input" value={form.estado} onChange={e=>f('estado',e.target.value)}>
                        {ESTADOS.map(s=><option key={s}>{s}</option>)}</select></div>
                    <div className="form-group"><label>Culto</label>
                      <select name="cultoDia" className="form-input" value={form.cultoDia} onChange={e=>f('cultoDia',e.target.value)}>
                        {CULTOS.map(c=><option key={c} value={c}>{c||'Sin asignar'}</option>)}</select></div>
                    <div className="form-group"><label>Turno</label>
                      <select name="cultoTurno" className="form-input" value={form.cultoTurno} onChange={e=>f('cultoTurno',e.target.value)}>
                        {[0,1,2,3].map(t=><option key={t} value={t}>Turno {t}</option>)}</select></div>
                    <div className="form-group full"><label>Grupo</label>
                      <select name="grupoId" className="form-input" value={form.grupoId} onChange={e=>f('grupoId',e.target.value)}>
                        <option value="">Sin grupo</option>
                        {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}</select></div>
                    <div className="form-group full"><label>Notas</label><textarea name="notas" className="form-input" value={form.notas} onChange={e=>f('notas',e.target.value)} /></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={()=>setModal(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" data-tip="Guardar cambios">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {segModal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSegModal(null)}>
            <div className="modal" style={{maxWidth:600}}>
              <div className="modal-header">
                <h3 className="modal-title">📋 Seguimiento — {segModal.nombre} {segModal.apellido}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setSegModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAddSeg} style={{marginBottom:20,padding:14,background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)'}}>
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:10}}>Nueva nota</h4>
                  <div className="form-grid">
                    <div className="form-group"><label>Tipo</label>
                      <select name="tipo" className="form-input" value={segForm.tipo} onChange={e=>sf('tipo',e.target.value)}>
                        {TIPOS_SEG.map(t=><option key={t}>{t}</option>)}</select></div>
                    <div className="form-group"><label>Próximo contacto</label>
                      <input name="proximoContacto" className="form-input" type="date" value={segForm.proximoContacto} onChange={e=>sf('proximoContacto',e.target.value)} /></div>
                    <div className="form-group full"><label>Nota</label>
                      <textarea name="nota" className="form-input" value={segForm.nota} onChange={e=>sf('nota',e.target.value)} placeholder="Describí el contacto o seguimiento..." /></div>
                  </div>
                  <div style={{textAlign:'right',marginTop:8}}>
                    <button type="submit" className="btn btn-primary btn-sm">Agregar nota</button>
                  </div>
                </form>
                {segList.length===0 ? <div className="empty"><p>Sin notas de seguimiento aún</p></div>
                  : segList.map(s=>(
                    <div key={s.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div>
                          <span className="badge badge-nuevo" style={{marginRight:6}}>{s.tipo}</span>
                          <span style={{fontSize:12,color:'var(--text-muted)'}}>{s.createdAt?.slice(0,16).replace('T',' ')} · {s.autorNombre||s.autorEmail}</span>
                          {s.proximoContacto && <span style={{fontSize:11,marginLeft:8,color:'var(--c-purple)'}}>📅 próx: {s.proximoContacto}</span>}
                        </div>
                        <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={()=>deleteSeg(s.id)}>✕</button>
                      </div>
                      {s.nota && <p style={{fontSize:13,marginTop:6,color:'var(--text)'}}>{s.nota}</p>}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {importModal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&(setImportModal(false),setImportData(null))}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">📥 Importar desde Excel</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setImportModal(false);setImportData(null)}}>✕</button>
              </div>
              <div className="modal-body">
                {!importData ? (
                  <div>
                    <p style={{marginBottom:14,fontSize:13,color:'var(--text-muted)'}}>
                      El Excel debe tener columnas: <strong>nombre</strong>, apellido, email, telefono, fechaNacimiento, cultoDia, estado
                    </p>
                    <input name="file_upload" type="file" accept=".xlsx,.xls" onChange={handleFileImport} className="form-input" />
                    {importLoading && <p style={{marginTop:10,fontSize:13}}>Analizando archivo...</p>}
                  </div>
                ) : (
                  <div>
                    <div className="alert alert-success">✅ {importData.total} filas encontradas. Primeras {importData.preview?.length}:</div>
                    <div style={{overflowX:'auto',marginBottom:16}}>
                      <table style={{fontSize:12}}>
                        <thead><tr>{importData.columns?.map(c=><th key={c}>{c}</th>)}</tr></thead>
                        <tbody>{importData.preview?.map((r,i)=>(
                          <tr key={i}>{importData.columns?.map(c=><td key={c}>{String(r[c]||'')}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              {importData && (
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={()=>setImportData(null)}>Cambiar archivo</button>
                  <button className="btn btn-primary" onClick={confirmImport} disabled={importLoading}>
                    {importLoading ? 'Importando...' : `Importar ${importData.total} personas`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
