import { useEffect, useState, useCallback, useRef } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import Modal, { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { makeI18n } from '../lib/i18n.js'

const PERS_I18N = {
  es: { title:'Personas', importExcel:'Importar Excel', newPerson:'+ Nueva persona',
        allStates:'Todos', allGroups:'Todos los grupos',
        colName:'Nombre', colContact:'Contacto', colService:'Culto', colGroup:'Grupo',
        loadingPeople:'Cargando personas...', noResults:'Sin resultados',
        editPerson:'Editar persona', newPersonModal:'Nueva persona',
        personCreated:'Persona creada', personUpdated:'Persona actualizada',
        noEmail:'Sin email', noPhone:'Sin teléfono',
        addTracking:'Agregar', trackingAdded:'Seguimiento agregado',
        noTracking:'Sin seguimientos', noteDeleted:'Nota eliminada',
        quickView:'Ficha rápida', openProfile:'Abrir perfil',
        followUpTitle:'Seguimiento:', nextContact:'Próximo contacto', typeLabel:'Tipo', noteLabel:'Nota',
        delPersonTitle:'¿Eliminar persona?', delPersonMsg:'será eliminado permanentemente del sistema.',
        delNoteTitle:'¿Eliminar nota?', delNoteMsg:'Esta nota de seguimiento será eliminada permanentemente.',
        birthdayLabel:'Nacimiento', joinDateLabel:'Fecha de ingreso', notesLabel:'Notas', noDateVal:'Sin dato',
        dragExcel:'Arrastrá tu Excel', dragHint:'Columnas: nombre, apellido, email, telefono, etc.',
        analyzing:'Analizando...', selectFile:'Seleccionar archivo',
        skipDup:'Saltar duplicados', updateDup:'Actualizar',
        importComplete:'Importación completa', importedPeople:'personas importadas',
        updated:'actualizadas', duplicates:'duplicados', detected:'detectados.',
        stepUpload:'Subir', stepMap:'Mapear', stepConfirm:'Confirmar',
        confirmImport:'Confirmar importación', importing:'Importando...',
        nextStep:'Siguiente →', prevStep:'← Volver',
  },
  pt: { title:'Pessoas', importExcel:'Importar Excel', newPerson:'+ Nova pessoa',
        allStates:'Todos', allGroups:'Todos os grupos',
        colName:'Nome', colContact:'Contato', colService:'Culto', colGroup:'Grupo',
        loadingPeople:'Carregando pessoas...', noResults:'Sem resultados',
        editPerson:'Editar pessoa', newPersonModal:'Nova pessoa',
        personCreated:'Pessoa criada', personUpdated:'Pessoa atualizada',
        noEmail:'Sem email', noPhone:'Sem telefone',
        addTracking:'Adicionar', trackingAdded:'Acompanhamento adicionado',
        noTracking:'Sem acompanhamentos', noteDeleted:'Nota excluída',
        quickView:'Ficha rápida', openProfile:'Abrir perfil',
        followUpTitle:'Acompanhamento:', nextContact:'Próximo contato', typeLabel:'Tipo', noteLabel:'Nota',
        delPersonTitle:'Excluir pessoa?', delPersonMsg:'será excluído permanentemente do sistema.',
        delNoteTitle:'Excluir nota?', delNoteMsg:'Esta nota de acompanhamento será excluída permanentemente.',
        birthdayLabel:'Aniversário', joinDateLabel:'Data de ingresso', notesLabel:'Notas', noDateVal:'Sem dado',
        dragExcel:'Arraste seu Excel', dragHint:'Colunas: nome, sobrenome, email, telefone, etc.',
        analyzing:'Analisando...', selectFile:'Selecionar arquivo',
        skipDup:'Pular duplicados', updateDup:'Atualizar',
        importComplete:'Importação concluída', importedPeople:'pessoas importadas',
        updated:'atualizadas', duplicates:'duplicados', detected:'detectados.',
        stepUpload:'Enviar', stepMap:'Mapear', stepConfirm:'Confirmar',
        confirmImport:'Confirmar importação', importing:'Importando...',
        nextStep:'Próximo →', prevStep:'← Voltar',
  },
  en: { title:'People', importExcel:'Import Excel', newPerson:'+ New person',
        allStates:'All', allGroups:'All groups',
        colName:'Name', colContact:'Contact', colService:'Service', colGroup:'Group',
        loadingPeople:'Loading people...', noResults:'No results',
        editPerson:'Edit person', newPersonModal:'New person',
        personCreated:'Person created', personUpdated:'Person updated',
        noEmail:'No email', noPhone:'No phone',
        addTracking:'Add', trackingAdded:'Follow-up added',
        noTracking:'No follow-ups', noteDeleted:'Note deleted',
        quickView:'Quick view', openProfile:'Open profile',
        followUpTitle:'Follow-up:', nextContact:'Next contact', typeLabel:'Type', noteLabel:'Note',
        delPersonTitle:'Delete person?', delPersonMsg:'will be permanently deleted from the system.',
        delNoteTitle:'Delete note?', delNoteMsg:'This follow-up note will be permanently deleted.',
        birthdayLabel:'Birthday', joinDateLabel:'Join date', notesLabel:'Notes', noDateVal:'No data',
        dragExcel:'Drag your Excel', dragHint:'Columns: name, last name, email, phone, etc.',
        analyzing:'Analyzing...', selectFile:'Select file',
        skipDup:'Skip duplicates', updateDup:'Update',
        importComplete:'Import complete', importedPeople:'people imported',
        updated:'updated', duplicates:'duplicates', detected:'detected.',
        stepUpload:'Upload', stepMap:'Map', stepConfirm:'Confirm',
        confirmImport:'Confirm import', importing:'Importing...',
        nextStep:'Next →', prevStep:'← Back',
  },
}

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
  const t = makeI18n(PERS_I18N)
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
  const [error, setError]       = useState(null)
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
  const [confirmDel, setConfirmDel] = useState(null) // {id, nombre}
  const [confirmDelSeg, setConfirmDelSeg] = useState(null) // id de seguimiento
  const [personaPreview, setPersonaPreview] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const p = new URLSearchParams({page, limit:20})
      if (search) p.set('search', search)
      if (estadoF) p.set('estado', estadoF)
      if (grupoF)  p.set('grupoId', grupoF)
      const res = await apiFetch(`/personas?${p}`)
      setData(res.data||[]); setTotal(res.total||0); setPages(res.pages||1)
    } catch (e) { setError(e.message); toast.error(e.message) }
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
      toast.success(modal === 'edit' ? t('personUpdated') : t('personCreated'))
      setModal(null); load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleDelete() {
    if (!confirmDel) return
    try {
      await apiFetch(`/personas/${confirmDel.id}`,{method:'DELETE'})
      toast.success(`${confirmDel.nombre} ${t('delete').toLowerCase()}`)
      setConfirmDel(null); load()
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
      toast.success(t('trackingAdded'))
    } catch (e) { toast.error(e.message) }
  }

  async function deleteSeg() {
    if (!confirmDelSeg) return
    try {
      await apiFetch(`/seguimiento/${confirmDelSeg}`,{method:'DELETE'})
      setSegList(await apiFetch(`/seguimiento/${segModal.id}`) || [])
      toast.success(t('noteDeleted'))
    } catch (e) { toast.error(e.message) }
    setConfirmDelSeg(null)
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
          <h1 className="page-title"><Icons.Users /> {t('title')}</h1>
          <div className="page-actions">
            <button className="btn btn-ghost" onClick={()=>setImportModal(true)}>{t('importExcel')}</button>
            <button className="btn btn-primary" onClick={()=>{setModal('new');setForm(EMPTY)}}>{t('newPerson')}</button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mobile-filter-bar" style={{display:'grid',gap:10,marginBottom:16,gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))'}}>
          <input type="text" placeholder="⊙ Buscar..." value={search} onChange={e=>setSearch(e.target.value)} className="form-input" style={{maxWidth:'100%'}} />
          <select value={estadoF} onChange={e=>setEstadoF(e.target.value)} className="form-input" style={{width:'100%'}}>
            <option value="">{t('allStates')}</option>
            {ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <select value={grupoF} onChange={e=>setGrupoF(e.target.value)} className="form-input" style={{width:'100%'}}>
            <option value="">{t('allGroups')}</option>
            {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setSearch('');setEstadoF('');setGrupoF('');setPage(1)}}>✕ {t('clear')}</button>
        </div>

        {error && (
          <div className="alert alert-error" style={{marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={load}>{t('retry')}</button>
          </div>
        )}

        <div className="mobile-list">
          {loading ? (
            <div className="mobile-empty">{t('loadingPeople')}</div>
          ) : data.length === 0 ? (
            <div className="mobile-empty">{t('noResults')}</div>
          ) : data.map(p => (
            <article className="mobile-person-card" key={p.id}>
              <button className="mobile-person-main" onClick={() => setPersonaPreview(p)}>
                <div className="mobile-person-avatar">{(p.nombre || '?').slice(0,1).toUpperCase()}</div>
                <div className="mobile-person-info">
                  <strong>{p.nombre} {p.apellido}</strong>
                  <span>{p.email || p.telefono || t('noContact')}</span>
                </div>
                <span className={`badge badge-${String(p.estado || '').toLowerCase()}`}>{p.estado}</span>
              </button>
              <div className="mobile-person-meta">
                <span>{p.grupoNombre || t('noGroup')}</span>
                <span>{p.cultoDia || t('noService')}</span>
              </div>
              <div className="mobile-person-actions">
                <button className="btn btn-ghost btn-sm" onClick={()=>openSeguimiento(p)}><Icons.Messages /> {t('followUpTitle').replace(':','')}</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>{setModal('edit');setForm(p)}}><Icons.Edit /> {t('edit')}</button>
                {canDelete&&<button className="btn btn-ghost btn-sm danger-action" onClick={()=>setConfirmDel({id:p.id,nombre:`${p.nombre} ${p.apellido||''}`.trim()})}><Icons.Delete /></button>}
              </div>
            </article>
          ))}
        </div>

        {/* Tabla */}
        <div className="table-responsive">
          <table>
            <thead><tr><th>{t('colName')}</th><th>{t('colContact')}</th><th>{t('colService')}</th><th>{t('colGroup')}</th><th>{t('status')}</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" style={{textAlign:'center',padding:40}}>{t('loading')}</td></tr>
                : data.length===0 ? <tr><td colSpan="6" style={{textAlign:'center',padding:40}}>{t('noResults')}</td></tr>
                : data.map(p => (
                  <tr key={p.id}>
                    <td onClick={()=>setPersonaPreview(p)} style={{cursor:'pointer',fontWeight:600}}>{p.nombre} {p.apellido}</td>
                    <td>{p.email}<br/><small>{p.telefono}</small></td>
                    <td>{p.cultoDia}</td>
                    <td><small>{p.grupoNombre||'-'}</small></td>
                    <td><span className={`badge badge-${p.estado.toLowerCase()}`}>{p.estado}</span></td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>openSeguimiento(p)}><Icons.Messages /></button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>{setModal('edit');setForm(p)}}><Icons.Edit /></button>
                      {canDelete&&<button className="btn btn-ghost btn-sm" onClick={()=>setConfirmDel({id:p.id,nombre:`${p.nombre} ${p.apellido||''}`.trim()})} style={{color:'var(--c-error)'}}><Icons.Delete /></button>}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pages>1&&<div className="mobile-pagination" style={{display:'flex',justifyContent:'center',gap:8,marginTop:20}}>
          <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹ {t('prev').replace('← ','')}</button>
          <span style={{padding:'6px 12px',fontSize:13}}>{t('page')} {page} {t('of')} {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>{t('next').replace(' →','')} ›</button>
        </div>}

        {/* Vista rápida de persona */}
        <Modal
          open={!!personaPreview}
          onClose={() => setPersonaPreview(null)}
          title={personaPreview ? `${personaPreview.nombre || ''} ${personaPreview.apellido || ''}`.trim() || t('title') : t('title')}
          subtitle={t('quickView')}
          size="md"
          footer={personaPreview && <>
            <button className="btn btn-ghost" onClick={() => setPersonaPreview(null)}>{t('close')}</button>
            <button className="btn btn-ghost" onClick={() => { setForm(personaPreview); setModal('edit'); setPersonaPreview(null) }}>{t('edit')}</button>
            <button className="btn btn-primary" onClick={() => navigate(`/personas/${personaPreview.id}`)}>{t('openProfile')}</button>
          </>}
        >
          {personaPreview && (
            <div style={{display:'grid',gap:16}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{
                  width:58,height:58,borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',
                  background:'var(--primary-soft)',color:'var(--primary)',fontWeight:800,fontSize:22,flexShrink:0,
                }}>
                  {(personaPreview.nombre || '?').slice(0,1).toUpperCase()}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    <strong style={{fontSize:17,color:'var(--text)'}}>{personaPreview.nombre} {personaPreview.apellido}</strong>
                    {personaPreview.estado && <span className={`badge badge-${String(personaPreview.estado).toLowerCase()}`}>{personaPreview.estado}</span>}
                  </div>
                  <p style={{margin:'4px 0 0',fontSize:13,color:'var(--text-muted)'}}>
                    {personaPreview.grupoNombre || t('noGroup')} · {personaPreview.cultoDia || t('noService')}
                  </p>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
                {[
                  [t('colContact').split('/')[0] || 'Email', personaPreview.email || t('noEmail')],
                  [t('phone'), personaPreview.telefono || t('noPhone')],
                  [t('joinDateLabel'), personaPreview.fechaIngreso || personaPreview.createdAt?.slice?.(0,10) || t('noDateVal')],
                  [t('birthdayLabel'), personaPreview.fechaNacimiento || t('noDateVal')],
                ].map(([label, value]) => (
                  <div key={label} style={{padding:12,border:'1px solid var(--border)',borderRadius:'var(--r)',background:'var(--bg)'}}>
                    <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:.3,color:'var(--text-faint)',fontWeight:700,marginBottom:4}}>{label}</div>
                    <div style={{fontSize:13,color:'var(--text-2)',wordBreak:'break-word'}}>{value}</div>
                  </div>
                ))}
              </div>

              {personaPreview.notas && (
                <div style={{padding:12,border:'1px solid var(--border)',borderRadius:'var(--r)',background:'var(--bg)'}}>
                  <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:.3,color:'var(--text-faint)',fontWeight:700,marginBottom:6}}>{t('notesLabel')}</div>
                  <p style={{margin:0,fontSize:13,lineHeight:1.6,color:'var(--text-2)'}}>{personaPreview.notas}</p>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Modal CRUD */}
        {modal&&<Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='edit'?t('editPerson'):t('newPersonModal')} size="lg"
          footer={<><button className="btn btn-ghost" onClick={()=>setModal(null)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave}>{t('save')}</button></>}>
          <form onSubmit={handleSave} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
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
        {segModal&&<Modal open={!!segModal} onClose={()=>setSegModal(null)} title={`${t('followUpTitle')} ${segModal.nombre}`} size="md">
          <form onSubmit={handleAddSeg} style={{marginBottom:20}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginBottom:12}}>
              <div className="form-group"><label>{t('typeLabel')}</label><select name="select_24" value={segForm.tipo} onChange={e=>sf('tipo',e.target.value)}>{TIPOS_SEG.map(tp=><option key={tp} value={tp}>{tp}</option>)}</select></div>
              <div className="form-group"><label>{t('nextContact')}</label><input name="input_81" type="date" value={segForm.proximoContacto} onChange={e=>sf('proximoContacto',e.target.value)}/></div>
              <div className="form-group" style={{gridColumn:'1/-1'}}><label>{t('noteLabel')}</label><textarea name="textarea_2" value={segForm.nota} onChange={e=>sf('nota',e.target.value)} rows={2}/></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">{t('addTracking')}</button>
          </form>
          {segList.length===0?<p style={{textAlign:'center',color:'var(--text-muted)',padding:20}}>{t('noTracking')}</p>:segList.map(s=>(
            <div key={s.id} style={{padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <div><span className="badge badge-secondary">{s.tipo}</span><small style={{marginLeft:8,color:'var(--text-muted)'}}>{s.createdAt?.slice(0,16).replace('T',' ')}</small></div>
                <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmDelSeg(s.id)}>×</button>
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
            <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>{t('dragExcel')}</h3>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>{t('dragHint')}</p>
            <button className="btn btn-primary" onClick={()=>fileRef.current?.click()} disabled={importLoading}>{importLoading?t('analyzing'):t('selectFile')}</button>
            <input name="file_upload" ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileImport} style={{display:'none'}}/>
          </div>}

          {/* Paso 1: Mapear */}
          {pasoImport===1&&analisis&&<div>
            <div style={{marginBottom:16,padding:12,background:'var(--bg)',borderRadius:8}}>
              <strong>{analisis.total} filas · {analisis.columnas?.length} columnas</strong>
              <div style={{display:'flex',gap:12,marginTop:8}}>
                {[['saltar',t('skipDup')],['actualizar',t('updateDup')]].map(([v,l])=>(
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
              <button className="btn btn-ghost" onClick={resetImport}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handlePreviewImport} disabled={importLoading}>{importLoading?t('loading'):t('nextStep')}</button>
            </div>
          </div>}

          {/* Paso 2: Preview */}
          {pasoImport===2&&preview&&<div>
            <div className="alert alert-info" style={{marginBottom:16}}>✓ {preview.total} filas listas. {preview.duplicados||0} duplicados detectados.</div>
            {preview.muestra?.length>0&&<div className="table-responsive"><table><thead><tr>{Object.keys(preview.muestra[0]).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{preview.muestra.map((r,i)=><tr key={i}>{Object.values(r).map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>}
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
              <button className="btn btn-ghost" onClick={()=>setPasoImport(1)}>{t('prevStep')}</button>
              <button className="btn btn-primary" onClick={handleConfirmImport} disabled={importLoading}>{importLoading?t('importing'):t('confirmImport')}</button>
            </div>
          </div>}

          {/* Paso 3: Resultado */}
          {pasoImport===3&&resultado&&<div style={{textAlign:'center',padding:40}}>
            <div style={{fontSize:56,marginBottom:16}}><Icons.Attendance /></div>
            <h3 style={{fontSize:20,fontWeight:700,marginBottom:8}}>{t('importComplete')}</h3>
            <p style={{fontSize:14,color:'var(--text-muted)'}}>
              {resultado.importados} {t('importedPeople')} · {resultado.actualizados||0} {t('updated')} · {resultado.duplicados||0} {t('duplicates')}
            </p>
            <button className="btn btn-primary" onClick={()=>{setImportModal(false);resetImport()}} style={{marginTop:20}}>{t('close')}</button>
          </div>}
        </Modal>
        <ConfirmModal
          open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={handleDelete}
          title={t('delPersonTitle')} danger
          message={confirmDel ? `${confirmDel.nombre} ${t('delPersonMsg')}` : ''}
          confirmLabel={t('delete')} cancelLabel={t('cancel')}
        />
        <ConfirmModal
          open={!!confirmDelSeg} onClose={()=>setConfirmDelSeg(null)} onConfirm={deleteSeg}
          title={t('delNoteTitle')} danger
          message={t('delNoteMsg')}
          confirmLabel={t('delete')} cancelLabel={t('cancel')}
        />
      </main>
    </div>
  )
}
