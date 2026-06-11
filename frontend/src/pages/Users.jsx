import { useEffect, useState } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import { useOrientation } from '../hooks/useOrientation.js'

const ROLES  = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF','LIDER']
const CULTOS = ['','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const EMPTY  = {email:'',password:'',nombre:'',rol:'LIDER',cultoDia:'',cultoTurno:0}

export default function Users() {
  const { isPhone } = useOrientation()
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState(EMPTY)
  const [msg, setMsg]     = useState(null)

  async function load() { try { setUsers(await apiFetch('/users')||[]) } catch {} }
  useEffect(() => { load() }, [])

  function openModal(u=null) {
    setForm(u ? {...EMPTY,...u,password:''} : EMPTY)
    setModal(u?'edit':'new'); setMsg(null)
  }

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      const body = {...form,cultoTurno:Number(form.cultoTurno)||0}
      if (modal==='edit') { if (!body.password) delete body.password
        await apiFetch(`/users/${form.id}`,{method:'PUT',body:JSON.stringify(body)}) }
      else await apiFetch('/users',{method:'POST',body:JSON.stringify(body)})
      setModal(null); load()
    } catch (e) { setMsg({type:'error',text:e.message}) }
  }

  async function toggle(u) {
    try { await apiFetch(`/users/${u.id}`,{method:'PUT',body:JSON.stringify({activo:u.activo?0:1})}); load() }
    catch (e) { toast.error(e.message) }
  }

  const f = (k,v) => setForm(prev=>({...prev,[k]:v}))

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">Usuarios del sistema</h1>
          <button className="btn btn-primary" onClick={()=>openModal()}>+ Nuevo usuario</button>
        </div>
        <div className="card" style={{padding:0, overflowX:'auto'}}>
          {isPhone
            ? <UsersPhone users={users} openModal={openModal} toggle={toggle} />
            : <UsersDesktop users={users} openModal={openModal} toggle={toggle} />
          }
        </div>
        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{modal==='edit'?'Editar usuario':'Nuevo usuario'}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>×</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group"><label>Nombre</label><input name="nombre" className="form-input" value={form.nombre} onChange={e=>f('nombre',e.target.value)} /></div>
                    <div className="form-group"><label>Email *</label><input name="email" className="form-input" type="email" value={form.email} onChange={e=>f('email',e.target.value)} required disabled={modal==='edit'} /></div>
                    <div className="form-group"><label>{modal==='edit'?'Nueva contraseña':'Contraseña *'}</label>
                      <input name="password" className="form-input" type="password" value={form.password} onChange={e=>f('password',e.target.value)} required={modal==='new'} placeholder={modal==='edit'?'Dejar vacío para no cambiar':''} /></div>
                    <div className="form-group"><label>Rol</label>
                      <select name="rol" className="form-input" value={form.rol} onChange={e=>f('rol',e.target.value)}>
                        {ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
                    <div className="form-group"><label>Culto</label>
                      <select name="cultoDia" className="form-input" value={form.cultoDia} onChange={e=>f('cultoDia',e.target.value)}>
                        {CULTOS.map(c=><option key={c} value={c}>{c||'Sin asignar'}</option>)}</select></div>
                    <div className="form-group"><label>Turno</label>
                      <select name="cultoTurno" className="form-input" value={form.cultoTurno} onChange={e=>f('cultoTurno',e.target.value)}>
                        {[0,1,2,3].map(t=><option key={t} value={t}>Turno {t}</option>)}</select></div>
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
      </main>
    </div>
  )
}

function UsersPhone({ users, openModal, toggle }) {
  return (
    <div className="mobile-list">
      {users.map(u => (
        <article key={u.id} className="mobile-person-card">
          <div className="mobile-person-main">
            <div className="mobile-person-info">
              <strong>{u.nombre || '—'}</strong>
              <span style={{fontSize:11,color:'var(--text-muted)'}}>{u.email}</span>
            </div>
            <span className={`badge ${u.activo ? 'badge-activo' : 'badge-inactivo'}`} style={{flexShrink:0}}>
              {u.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div className="mobile-person-meta">
            <span className={`rol-badge rol-${u.rol}`}>{u.rol}</span>
            <span>{u.cultoDia || 'Sin culto'}</span>
          </div>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button className="btn btn-ghost btn-sm" onClick={() => openModal(u)}>Editar</button>
            <button className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggle(u)}>
              {u.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function UsersDesktop({ users, openModal, toggle }) {
  return (
    <div className="table-responsive">
      <table style={{minWidth:500}}>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Culto</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{users.map(u=>(
          <tr key={u.id}>
            <td><strong>{u.nombre||'—'}</strong></td>
            <td style={{color:'var(--text-muted)'}}>{u.email}</td>
            <td><span className={`rol-badge rol-${u.rol}`}>{u.rol}</span></td>
            <td style={{fontSize:12}}>{u.cultoDia||'—'}</td>
            <td><span className={`badge ${u.activo?'badge-activo':'badge-inactivo'}`}>{u.activo?'Activo':'Inactivo'}</span></td>
            <td style={{display:'flex',gap:6}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>openModal(u)}>Editar</button>
              <button className={`btn btn-sm ${u.activo?'btn-danger':'btn-primary'}`} onClick={()=>toggle(u)}>{u.activo?'Desactivar':'Activar'}</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
