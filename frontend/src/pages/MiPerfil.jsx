import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

export default function MiPerfil() {
  const navigate = useNavigate()
  const [perfil, setPerfil]   = useState(null)
  const [form, setForm]       = useState({nombre:'',passwordActual:'',passwordNuevo:'',passwordConf:'',codigo:''})
  const [msg, setMsg]         = useState(null)
  const [tab, setTab]         = useState('datos')
  const [backupInfo, setBackupInfo] = useState(null)
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deletePass, setDeletePass]   = useState('')
  const [deleting, setDeleting]       = useState(false)

  useEffect(()=>{
    apiFetch('/mi-perfil').then(p=>{ setPerfil(p); setForm(f=>({...f,nombre:p.nombre||''})) }).catch(()=>{})
    apiFetch('/backup/info').then(b=>setBackupInfo(b)).catch(()=>{})
  },[])

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    if (form.passwordNuevo && form.passwordNuevo!==form.passwordConf) return setMsg({type:'error',text:'Las contraseñas no coinciden'})
    try {
      const result = await apiFetch('/mi-perfil',{method:'PUT',body:JSON.stringify({
        nombre:form.nombre,
        passwordActual:form.passwordActual||undefined,
        passwordNuevo:form.passwordNuevo||undefined,
        codigo:form.codigo||undefined,
      })})
      if (result.requiresCode) {
        setAwaitingCode(true)
        setMsg({type:'success',text:'Te enviamos un código de 6 dígitos para confirmar el cambio.'})
        return
      }
      setMsg({type:'success',text:'Perfil actualizado'})
      setAwaitingCode(false)
      setForm(f=>({...f,passwordActual:'',passwordNuevo:'',passwordConf:'',codigo:''}))
      const user = JSON.parse(localStorage.getItem('user')||'{}')
      localStorage.setItem('user', JSON.stringify({...user,nombre:form.nombre}))
    } catch(err) { setMsg({type:'error',text:err.message}) }
  }

  if (!perfil) return <div className="layout"><Menu /><main className="main"><div className="empty"><p>Cargando...</p></div></main></div>

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate(-1)}>← Volver</button>
          <h1 className="page-title" style={{margin:0}}>Mi perfil</h1>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:16,alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card" style={{textAlign:'center'}}>
              <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#3B6CF4,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,fontWeight:800,color:'var(--surface)',margin:'0 auto 12px'}}>
                {(perfil.nombre||perfil.email).slice(0,1).toUpperCase()}
              </div>
              <h2 style={{fontSize:16,fontWeight:700,margin:'0 0 4px'}}>{perfil.nombre||'Sin nombre'}</h2>
              <p style={{fontSize:12,color:'var(--text-muted)',margin:'0 0 8px'}}>{perfil.email}</p>
              <span className={`rol-badge rol-${perfil.rol}`}>{perfil.rol}</span>
            </div>
            <div className="card">
              <h3 style={{fontSize:12,fontWeight:600,marginBottom:10,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Mi actividad</h3>
              {[['Totales',perfil.stats?.totalPersonas,'Personas a cargo'],['Historial',perfil.stats?.totalSeguimientos,'Seguimientos'],['Email',perfil.stats?.totalMensajes,'Mensajes']].map(([ic,v,l])=>(
                <div key={l} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:20}}>{ic}</span>
                  <div><div style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{v||0}</div><div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div></div>
                </div>
              ))}
            </div>
            {perfil.rol==='PASTOR_GENERAL'&&backupInfo&&(
              <div className="card">
                <h3 style={{fontSize:12,fontWeight:600,marginBottom:10,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}> Backup</h3>
                <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>Motor: <strong>PostgreSQL</strong></p>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>
                  {Object.entries(backupInfo.totales||{}).map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'2px 0'}}><span>{k}</span><strong>{v}</strong></div>
                  ))}
                </div>
                <p style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',margin:0,lineHeight:1.5}}>Respaldos vía <strong>Neon</strong> · <code>pg_dump</code></p>
              </div>
            )}
          </div>
          <div className="card">
            <div style={{display:'flex',gap:4,marginBottom:20}}>
              {[['datos','Mis datos'],['password','Contraseña']].map(([k,l])=>(
                <button key={k} onClick={()=>{setTab(k);setMsg(null)}} style={{padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:tab===k?600:400,background:tab===k?'var(--primary)':'transparent',color:tab===k?'var(--surface)':'var(--text-muted)'}}>{l}</button>
              ))}
            </div>
            {msg&&<div className={`alert alert-${msg.type}`} style={{marginBottom:16}}>{msg.text}</div>}
            <form onSubmit={handleSave}>
              {tab==='datos'&&(
                <div className="form-grid">
                  <div className="form-group full"><label>Nombre</label><input name="nombre" className="form-input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
                  <div className="form-group full"><label>Email</label><input name="email" className="form-input" value={perfil.email} disabled style={{opacity:.6}}/></div>
                  <div className="form-group full"><label>Rol</label><input name="rol" className="form-input" value={perfil.rol} disabled style={{opacity:.6}}/></div>
                </div>
              )}
              {tab==='password'&&(
                <div className="form-grid">
                  <div className="form-group full"><label>Contraseña actual *</label><input name="passwordActual" className="form-input" type="password" value={form.passwordActual} onChange={e=>setForm(f=>({...f,passwordActual:e.target.value}))} required/></div>
                  <div className="form-group"><label>Nueva *</label><input name="passwordNuevo" className="form-input" type="password" value={form.passwordNuevo} onChange={e=>setForm(f=>({...f,passwordNuevo:e.target.value}))} required minLength={6}/></div>
                  <div className="form-group"><label>Confirmar *</label><input name="passwordConf" className="form-input" type="password" value={form.passwordConf} onChange={e=>setForm(f=>({...f,passwordConf:e.target.value}))} required/></div>
                  {awaitingCode&&(
                    <div className="form-group full">
                      <label>Código de 6 dígitos *</label>
                      <input name="codigo" className="form-input" inputMode="numeric" maxLength={6} value={form.codigo} onChange={e=>setForm(f=>({...f,codigo:e.target.value.replace(/\D/g,'').slice(0,6)}))} required/>
                    </div>
                  )}
                </div>
              )}
              <div style={{marginTop:16}}><button type="submit" className="btn btn-primary" data-tip="Guardar la configuración">Guardar cambios</button></div>
            </form>
          </div>

          {/* Zona de peligro — requerido por Apple App Store guideline 5.1.1 */}
          <div className="card" style={{marginTop:16,border:'1px solid var(--c-danger,#DC2626)',borderRadius:'var(--r)'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--c-danger,#DC2626)'}}>
              <span style={{fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,color:'var(--c-danger,#DC2626)'}}>Zona de peligro</span>
            </div>
            <div style={{padding:'16px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Eliminar cuenta</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>Esta acción es permanente. Tus datos se eliminarán en 30 días.</div>
              </div>
              <button className="btn btn-sm" style={{flexShrink:0,color:'var(--c-danger,#DC2626)',border:'1px solid var(--c-danger,#DC2626)',background:'transparent'}} onClick={()=>setDeleteModal(true)}>
                Eliminar mi cuenta
              </button>
            </div>
          </div>
        </div>
      </main>

      <ConfirmModal
        open={deleteModal}
        onClose={()=>{setDeleteModal(false);setDeletePass('')}}
        onConfirm={async()=>{
          if (!deletePass) return
          setDeleting(true)
          try {
            await apiFetch('/mi-perfil/cuenta',{method:'DELETE',body:JSON.stringify({password:deletePass})})
            localStorage.clear()
            window.location.href='/login'
          } catch(e) { toast.error(e.message) }
          setDeleting(false)
        }}
        title="Eliminar cuenta permanentemente"
        message=""
        confirmLabel={deleting?'Eliminando…':'Eliminar cuenta'}
        cancelLabel="Cancelar"
        danger
        loading={deleting}
      >
        <p style={{fontSize:14,color:'var(--text-2)',marginBottom:12,lineHeight:1.5}}>
          Esta acción <strong>no se puede deshacer</strong>. Tus datos, historial y configuración serán eliminados.
        </p>
        <label style={{fontSize:13,color:'var(--text-muted)',display:'block',marginBottom:6}}>Ingresá tu contraseña para confirmar:</label>
        <input
          className="form-input"
          type="password"
          placeholder="Tu contraseña actual"
          value={deletePass}
          onChange={e=>setDeletePass(e.target.value)}
          autoComplete="current-password"
        />
      </ConfirmModal>
    </div>
  )
}
