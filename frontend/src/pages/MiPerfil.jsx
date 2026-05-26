import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getApiUrl } from '../services/api.js'

export default function MiPerfil() {
  const navigate = useNavigate()
  const [perfil, setPerfil]   = useState(null)
  const [form, setForm]       = useState({nombre:'',passwordActual:'',passwordNuevo:'',passwordConf:''})
  const [msg, setMsg]         = useState(null)
  const [tab, setTab]         = useState('datos')
  const [backupInfo, setBackupInfo] = useState(null)

  useEffect(()=>{
    apiFetch('/mi-perfil').then(p=>{ setPerfil(p); setForm(f=>({...f,nombre:p.nombre||''})) }).catch(()=>{})
    apiFetch('/backup/info').then(b=>setBackupInfo(b)).catch(()=>{})
  },[])

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    if (form.passwordNuevo && form.passwordNuevo!==form.passwordConf) return setMsg({type:'error',text:'Las contraseñas no coinciden'})
    try {
      await apiFetch('/mi-perfil',{method:'PUT',body:JSON.stringify({nombre:form.nombre,passwordActual:form.passwordActual||undefined,passwordNuevo:form.passwordNuevo||undefined})})
      setMsg({type:'success',text:'Perfil actualizado'})
      setForm(f=>({...f,passwordActual:'',passwordNuevo:'',passwordConf:''}))
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
              {[['⊕',perfil.stats?.totalPersonas,'Personas a cargo'],['≡',perfil.stats?.totalSeguimientos,'Seguimientos'],['✉',perfil.stats?.totalMensajes,'Mensajes']].map(([ic,v,l])=>(
                <div key={l} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:20}}>{ic}</span>
                  <div><div style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{v||0}</div><div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div></div>
                </div>
              ))}
            </div>
            {perfil.rol==='PASTOR_GENERAL'&&backupInfo&&(
              <div className="card">
                <h3 style={{fontSize:12,fontWeight:600,marginBottom:10,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>💾 Backup</h3>
                <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>Tamaño: <strong>{backupInfo.tamano}</strong></p>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12}}>
                  {Object.entries(backupInfo.totales||{}).map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'2px 0'}}><span>{k}</span><strong>{v}</strong></div>
                  ))}
                </div>
                <a href={`${getApiUrl()}/backup/download?token=${localStorage.getItem("token")}`} style={{display:'block',textAlign:'center',padding:'8px',background:'var(--primary)',color:'var(--surface)',borderRadius:8,fontSize:13,fontWeight:600,textDecoration:'none'}}>⬇️ Descargar backup</a>
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
                </div>
              )}
              <div style={{marginTop:16}}><button type="submit" className="btn btn-primary" data-tip="Guardar la configuración">Guardar cambios</button></div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
