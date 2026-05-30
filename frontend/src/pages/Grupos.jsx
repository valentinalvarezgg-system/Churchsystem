import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { makeI18n } from '../lib/i18n.js'

const GRUP_I18N = {
  es: { title:'Grupos', newGroup:'+ Nuevo grupo', noGroups:'No hay grupos',
        editModal:'Editar grupo', newModal:'Nuevo grupo',
        nameLabel:'Nombre *', serviceLabel:'Culto', shiftLabel:'Turno', noLeader:'Sin líder', noAssign:'Sin asignar',
        members:'miembro(s)', noMembers:'Sin miembros asignados',
        specialCulto:'Sin culto', nameCol:'Nombre', phoneCol:'Teléfono', statusCol:'Estado',
        delTitle:'¿Eliminar grupo?', delSuffix:'será eliminado. Sus miembros quedarán sin grupo.',
        groupDeleted:'Grupo eliminado' },
  pt: { title:'Grupos', newGroup:'+ Novo grupo', noGroups:'Sem grupos',
        editModal:'Editar grupo', newModal:'Novo grupo',
        nameLabel:'Nome *', serviceLabel:'Culto', shiftLabel:'Turno', noLeader:'Sem líder', noAssign:'Sem atribuição',
        members:'membro(s)', noMembers:'Sem membros atribuídos',
        specialCulto:'Sem culto', nameCol:'Nome', phoneCol:'Telefone', statusCol:'Estado',
        delTitle:'Excluir grupo?', delSuffix:'será excluído. Seus membros ficarão sem grupo.',
        groupDeleted:'Grupo excluído' },
  en: { title:'Groups', newGroup:'+ New group', noGroups:'No groups',
        editModal:'Edit group', newModal:'New group',
        nameLabel:'Name *', serviceLabel:'Service', shiftLabel:'Shift', noLeader:'No leader', noAssign:'Not assigned',
        members:'member(s)', noMembers:'No assigned members',
        specialCulto:'No service', nameCol:'Name', phoneCol:'Phone', statusCol:'Status',
        delTitle:'Delete group?', delSuffix:'will be deleted. Its members will have no group.',
        groupDeleted:'Group deleted' },
}

const CULTOS = ['','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const EMPTY  = {nombre:'',cultoDia:'',cultoTurno:0,liderId:'',descripcion:''}

export default function Grupos() {
  const t = makeI18n(GRUP_I18N)
  const user = getUser()
  const canDelete = user?.rol === 'PASTOR_GENERAL'
  const navigate = useNavigate()
  const [grupos, setGrupos]   = useState([])
  const [users, setUsers]     = useState([])
  const [modal, setModal]     = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [msg, setMsg]         = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // {id, nombre}
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

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

  async function openDetalle(g) { try { setDetalle(await apiFetch(`/grupos/${g.id}`)) } catch {} }

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

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title"><Icons.Groups /> {t('title')} <span style={{fontSize:15,fontWeight:400,color:'var(--text-muted)'}}>({grupos.length})</span></h1>
          <button className="btn btn-primary" data-tip="Crear un nuevo grupo pastoral" onClick={()=>openModal()}>{t('newGroup')}</button>
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
                <button className="btn btn-ghost btn-sm" data-tip="Editar nombre, día y líder del grupo" onClick={()=>openModal(g)}>{t('edit')}</button>
                {canDelete && <button className="btn btn-danger btn-sm" data-tip="Eliminar este grupo permanentemente" onClick={()=>setConfirmDel({id:g.id,nombre:g.nombre})}>Eliminar</button>}
              </div>
            </div>
          ))}
        </div>
        }
        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{modal==='edit'?t('editModal'):t('newModal')}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>✕</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group full"><label>{t('nameLabel')}</label><input name="nombre" className="form-input" value={form.nombre} onChange={e=>f('nombre',e.target.value)} required /></div>
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
                  <button type="submit" className="btn btn-primary" data-tip="Guardar cambios">{t('save')}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {detalle && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetalle(null)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{detalle.nombre}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setDetalle(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p style={{marginBottom:14,color:'var(--text-muted)',fontSize:13}}>{detalle.miembros?.length||0} {t('members')}</p>
                {detalle.miembros?.length>0 ? <>
                  {/* Vista desktop: tabla */}
                  <div className="table-responsive-mobile-hide table-responsive"><table style={{minWidth:500}}><thead><tr><th>{t('nameCol')}</th><th>{t('phoneCol')}</th><th>{t('statusCol')}</th></tr></thead>
                    <tbody>{(detalle?.miembros || []).map(m=>(
                      <tr key={m.id}><td><span className="persona-link" onClick={()=>navigate(`/personas/${m.id}`)}>{m.nombre} {m.apellido}</span></td><td>{m.telefono||'—'}</td>
                        <td><span className={`badge badge-${m.estado?.toLowerCase()}`}>{m.estado}</span></td>
                      </tr>))}</tbody></table></div>
                  {/* Vista mobile: cards */}
                  <div className="members-mobile-list">
                    {(detalle?.miembros || []).map(m=>(
                      <div key={m.id} className="member-card-mobile">
                        <div style={{flex:1}}>
                          <div className="member-name persona-link" onClick={()=>navigate(`/personas/${m.id}`)}>{m.nombre} {m.apellido}</div>
                          <div className="member-meta">{m.telefono||'Sin teléfono'}</div>
                        </div>
                        <span className={`badge badge-${m.estado?.toLowerCase()}`}>{m.estado}</span>
                      </div>
                    ))}
                  </div>
                </> : <div className="empty"><p>{t('noMembers')}</p></div>}
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
