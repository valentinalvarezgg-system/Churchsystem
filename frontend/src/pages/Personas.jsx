import { useEffect, useState, useCallback, useRef } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import Modal from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const ESTADOS = ['ACTIVO','INACTIVO','VISITANTE','NUEVO']
const CULTOS  = ['','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const TIPOS_SEG = ['CONTACTO','VISITA','LLAMADA','REUNION','ORACION','MENSAJE','OTRO']
const EMPTY   = {nombre:'',apellido:'',email:'',telefono:'',cultoDia:'',cultoTurno:0,
  grupoId:'',asignadoA:'',estado:'ACTIVO',notas:'',fechaIngreso:'',fechaNacimiento:''}

const CAMPOS_SISTEMA = [
  { key:'nombre',            label:'Nombre *',            req:true },
  { key:'apellido',          label:'Apellido' },
  { key:'email',             label:'Email' },
  { key:'telefono',          label:'Teléfono' },
  { key:'fechaNacimiento',   label:'Fecha nacimiento' },
  { key:'cultoDia',          label:'Culto (día)' },
  { key:'estado',            label:'Estado' },
  { key:'estadoEspiritual',  label:'Estado espiritual' },
  { key:null,                label:'— Ignorar' },
]

export default function Personas() {
  const user = getUser()
  const isAdmin = ['PASTOR_GENERAL','CONSOLIDACION'].includes(user?.rol)
  const canDelete = user?.rol === 'PASTOR_GENERAL'
  const navigate = useNavigate()
  const fileRef = useRef()

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
  const [loading, setLoading]   = useState(false)
  const [segModal, setSegModal] = useState(null)
  const [segList, setSegList]   = useState([])
  const [segForm, setSegForm]   = useState({tipo:'CONTACTO',nota:'',proximoContacto:''})
  
  // Import Excel IA
  const [importModal, setImportModal] = useState(false)
  const [pasoImport, setPasoImport] = useState(0)
  const [fileB64, setFileB64] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [mapeo, setMapeo] = useState({})
  const [opDup, setOpDup] = useState('saltar')
  const [resultado, setResultado] = useState(null)
  const [preview, setPreview] = useState(null)
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
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }, [page, search, estadoF, grupoF])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch('/grupos').then(g => setGrupos(g || [])).catch(() => {})
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    try {
      const url = modal === 'edit' ? `/personas/${form.id}` : '/personas'
      await apiFetch(url, { method: modal === 'edit' ? 'PUT' : 'POST', body: JSON.stringify(form) })
      toast.success(modal === 'edit' ? 'Persona actualizada' : 'Persona creada')
      setModal(null); load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleDelete(id, nombre) {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return
    try { 
      await apiFetch(`/personas/${id}`,{method:'DELETE'})
      toast.success('Persona eliminada')
      load() 
    } catch (e) { toast.error(e.message) }
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
      toast.success('Seguimiento agregado')
    } catch (e) { toast.error(e.message) }
  }

  async function deleteSeg(id) {
    if (!confirm('¿Eliminar esta nota?')) return
    try { 
      await apiFetch(`/seguimiento/${id}`,{method:'DELETE'})
      setSegList(await apiFetch(`/seguimiento/${segModal.id}`) || [])
      toast.success('Nota eliminada')
    } catch (e) { toast.error(e.message) }
  }

  // Import Excel - paso 1: analizar
  async function handleFileImport(e) {
    const f = e.target.files[0]; if (!f) return
    setImportLoading(true); setAnalisis(null); setResultado(null)
    const reader = new FileReader()
    reader.onload = async ev => {
      const b64 = ev.target.result.split(',')[1]; setFileB64(b64)
      try {
        const res = await apiFetch('/excel-ia/analizar',{method:'POST',body:JSON.stringify({file:b64})})
        setAnalisis(res); setMapeo(res.mapeo||{}); setPasoImport(1)
      } catch(err) { toast.error(err.message) }
      setImportLoading(false)
    }
    reader.readAsDataURL(f)
  }

  // Import Excel - paso 2: preview
  async function handlePreviewImport() {
    setImportLoading(true)
    try {
      const res = await apiFetch('/excel-ia/importar',{method:'POST',body:JSON.stringify({file:fileB64,mapeo,opcionDuplicados:opDup,previewOnly:true})})
      setPreview(res); setPasoImport(2)
    } catch(err){ toast.error(err.message) }
    setImportLoading(false)
  }

  // Import Excel - paso 3: confirmar
  async function handleConfirmImport() {
    setImportLoading(true)
    try { 
      const res = await apiFetch('/excel-ia/importar',{method:'POST',body:JSON.stringify({file:fileB64,mapeo,opcionDuplicados:opDup})})
      setResultado(res); setPasoImport(3)
      load()
    } catch(err) { toast.error(err.message) }
    setImportLoading(false)
  }

  function resetImport() {
    setPasoImport(0); setFileB64(null); setAnalisis(null); setMapeo({}); setResultado(null); setPreview(null)
    if(fileRef.current) fileRef.current.value=''
  }

  const f = (k,v) => setForm(prev=>({...prev,[k]:v}))
  const sf = (k,v) => setSegForm(prev=>({...prev,[k]:v}))

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title"><Icons.Users /> Personas</h1>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost" onClick={()=>setImportModal(true)}>Importar Excel</button>
            <button className="btn btn-primary" onClick={()=>{setModal('new');setForm(EMPTY)}}>+ Nueva persona</button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <input type="text" placeholder="⊙ Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="form-input" style={{maxWidth:240}} />
          <select value={estadoF} onChange={e=>setEstadoF(e.target.value)} className="form-input" style={{width:140}}>
            <option value="">Todos</option>
            {ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <select value={grupoF} onChange={e=>setGrupoF(e.target.value)} className="form-input" style={{width:160}}>
            <option value="">Todos los grupos</option>
            {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setSearch('');setEstadoF('');setGrupoF('');setPage(1)}}>✕ Limpiar</button>
        </div>

        {/* Tabla */}
        <div className="table-responsive">
          <table>
            <thead><tr><th>Nombre</th><th>Contacto</th><th>Culto</th><th>Grupo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" style={{textAlign:'center',padding:40}}>Cargando...</td></tr>
                : data.length===0 ? <tr><td colSpan="6" style={{textAlign:'center',padding:40}}>Sin resultados</td></tr>
                : data.map(p => (
                  <tr key={p.id}>
                    <td onClick={()=>navigate(`/perfil/${p.id}`)} style={{cursor:'pointer',fontWeight:600}}>{p.nombre} {p.apellido}</td>
                    <td>{p.email}<br/><small>{p.telefono}</small></td>
                    <td>{p.cultoDia}</td>
                    <td><small>{p.grupoNombre||'-'}</small></td>
                    <td><span className={`badge badge-${p.estado.toLowerCase()}`}>{p.estado}</span></td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>openSeguimiento(p)}><Icons.Messages /></button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>{setModal('edit');setForm(p)}}><Icons.Settings /></button>
                      {canDelete&&<button className="btn btn-ghost btn-sm" onClick={()=>handleDelete(p.id,p.nombre)} style={{color:'var(--c-error)'}}><Icons.Settings /></button>}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pages>1&&<div style={{display:'flex',justifyContent:'center',gap:8,marginTop:20}}>
          <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹ Anterior</button>
          <span style={{padding:'6px 12px',fontSize:13}}>Página {page} de {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Siguiente ›</button>
        </div>}

        {/* Modal CRUD */}
        {modal&&<Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='edit'?'Editar persona':'Nueva persona'} size="lg"
          footer={<><button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={handleSave}>Guardar</button></>}>
          <form onSubmit={handleSave} style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
            <div className="form-group"><label>Nombre *</label><input name="input_76" type="text" required value={form.nombre} onChange={e=>f('nombre',e.target.value)}/></div>
            <div className="form-group"><label>Apellido</label><input name="input_77" type="text" value={form.apellido} onChange={e=>f('apellido',e.target.value)}/></div>
            <div className="form-group"><label>Email</label><input name="input_78" type="email" value={form.email} onChange={e=>f('email',e.target.value)}/></div>
            <div className="form-group"><label>Teléfono</label><input name="input_79" type="tel" value={form.telefono} onChange={e=>f('telefono',e.target.value)}/></div>
            <div className="form-group"><label>Fecha nacimiento</label><input name="input_80" type="date" value={form.fechaNacimiento} onChange={e=>f('fechaNacimiento',e.target.value)}/></div>
            <div className="form-group"><label>Culto</label><select name="select_21" value={form.cultoDia} onChange={e=>f('cultoDia',e.target.value)}>{CULTOS.map(c=><option key={c} value={c}>{c||'Sin asignar'}</option>)}</select></div>
            <div className="form-group"><label>Estado</label><select name="select_22" value={form.estado} onChange={e=>f('estado',e.target.value)}>{ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
            <div className="form-group"><label>Grupo</label><select name="select_23" value={form.grupoId} onChange={e=>f('grupoId',e.target.value)}><option value="">Sin grupo</option>{grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}</select></div>
            <div className="form-group" style={{gridColumn:'1/-1'}}><label>Notas</label><textarea name="textarea_1" value={form.notas} onChange={e=>f('notas',e.target.value)} rows={3}/></div>
          </form>
        </Modal>}

        {/* Modal Seguimiento */}
        {segModal&&<Modal open={!!segModal} onClose={()=>setSegModal(null)} title={`Seguimiento: ${segModal.nombre}`} size="md">
          <form onSubmit={handleAddSeg} style={{marginBottom:20}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:12}}>
              <div className="form-group"><label>Tipo</label><select name="select_24" value={segForm.tipo} onChange={e=>sf('tipo',e.target.value)}>{TIPOS_SEG.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div className="form-group"><label>Próximo contacto</label><input name="input_81" type="date" value={segForm.proximoContacto} onChange={e=>sf('proximoContacto',e.target.value)}/></div>
              <div className="form-group" style={{gridColumn:'1/-1'}}><label>Nota</label><textarea name="textarea_2" value={segForm.nota} onChange={e=>sf('nota',e.target.value)} rows={2}/></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Agregar</button>
          </form>
          {segList.length===0?<p style={{textAlign:'center',color:'var(--text-muted)',padding:20}}>Sin seguimientos</p>:segList.map(s=>(
            <div key={s.id} style={{padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <div><span className="badge badge-secondary">{s.tipo}</span><small style={{marginLeft:8,color:'var(--text-muted)'}}>{s.createdAt?.slice(0,16).replace('T',' ')}</small></div>
                <button className="btn btn-ghost btn-sm" onClick={()=>deleteSeg(s.id)}>×</button>
              </div>
              <p style={{fontSize:13,margin:'8px 0 0'}}>{s.nota}</p>
            </div>
          ))}
        </Modal>}

        {/* Modal Import Excel IA */}
        <Modal open={importModal} onClose={()=>{setImportModal(false);resetImport()}} title="Importar Excel" size="xl" hideClose={pasoImport>0&&pasoImport<3}>
          <div style={{marginBottom:20}}>
            {/* Steps */}
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {['Subir','Mapear','Confirmar'].map((s,i)=>(
                <div key={s} style={{display:'flex',alignItems:'center',gap:6,flex:i<2?1:0}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:pasoImport>i?'var(--c-success)':pasoImport===i?'var(--primary)':'var(--bg-2)',color:pasoImport>=i?'#fff':'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>{pasoImport>i?'✓':i+1}</div>
                  <span style={{fontSize:13,fontWeight:pasoImport===i?600:400}}>{s}</span>
                  {i<2&&<div style={{flex:1,height:2,background:pasoImport>i?'var(--c-success)':'var(--border)',borderRadius:2}}/>}
                </div>
              ))}
            </div>
          </div>

          {/* Paso 0: Subir */}
          {pasoImport===0&&<div style={{textAlign:'center',padding:'40px 20px',border:'2px dashed var(--border)',borderRadius:12}}>
            <div style={{fontSize:48,marginBottom:12}}><Icons.Reports /></div>
            <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>Arrastrá tu Excel</h3>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Columnas: nombre, apellido, email, telefono, etc.</p>
            <button className="btn btn-primary" onClick={()=>fileRef.current?.click()} disabled={importLoading}>{importLoading?'Analizando...':'Seleccionar archivo'}</button>
            <input name="file_upload" ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileImport} style={{display:'none'}}/>
          </div>}

          {/* Paso 1: Mapear */}
          {pasoImport===1&&analisis&&<div>
            <div style={{marginBottom:16,padding:12,background:'var(--bg)',borderRadius:8}}>
              <strong>{analisis.total} filas · {analisis.columnas?.length} columnas</strong>
              <div style={{display:'flex',gap:12,marginTop:8}}>
                {[['saltar','Saltar duplicados'],['actualizar','Actualizar']].map(([v,l])=>(
                  <label key={v} style={{display:'flex',gap:6,cursor:'pointer'}}>
                    <input name="radio_136" type="radio" checked={opDup===v} onChange={()=>setOpDup(v)}/>{l}
                  </label>
                ))}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10,marginBottom:16}}>
              {analisis.columnas?.map(col=>(
                <div key={col} style={{padding:12,border:'1px solid var(--border)',borderRadius:8}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Excel: {col}</div>
                  <select name="select_25" value={mapeo[col]||null} onChange={e=>setMapeo(m=>({...m,[col]:e.target.value}))} style={{width:'100%'}}>
                    {CAMPOS_SISTEMA.map(c=><option key={c.label} value={c.key||''}>{c.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-ghost" onClick={resetImport}>Cancelar</button>
              <button className="btn btn-primary" onClick={handlePreviewImport} disabled={importLoading}>{importLoading?'Cargando...':'Siguiente →'}</button>
            </div>
          </div>}

          {/* Paso 2: Preview */}
          {pasoImport===2&&preview&&<div>
            <div className="alert alert-info" style={{marginBottom:16}}>✓ {preview.total} filas listas. {preview.duplicados||0} duplicados detectados.</div>
            {preview.muestra?.length>0&&<div className="table-responsive"><table><thead><tr>{Object.keys(preview.muestra[0]).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{preview.muestra.map((r,i)=><tr key={i}>{Object.values(r).map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>}
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
              <button className="btn btn-ghost" onClick={()=>setPasoImport(1)}>← Volver</button>
              <button className="btn btn-primary" onClick={handleConfirmImport} disabled={importLoading}>{importLoading?'Importando...':'Confirmar importación'}</button>
            </div>
          </div>}

          {/* Paso 3: Resultado */}
          {pasoImport===3&&resultado&&<div style={{textAlign:'center',padding:40}}>
            <div style={{fontSize:56,marginBottom:16}}><Icons.Attendance /></div>
            <h3 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Importación completa</h3>
            <p style={{fontSize:14,color:'var(--text-muted)'}}>
              {resultado.importados} personas importadas · {resultado.actualizados||0} actualizadas · {resultado.duplicados||0} duplicados
            </p>
            <button className="btn btn-primary" onClick={()=>{setImportModal(false);resetImport()}} style={{marginTop:20}}>Cerrar</button>
          </div>}
        </Modal>

      </main>
    </div>
  )
}
