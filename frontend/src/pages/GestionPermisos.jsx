import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'

const MODULOS = [
  { key:'personas',      label:'Personas',       desc:'Ver y editar miembros' },
  { key:'grupos',        label:'Grupos',          desc:'Gestionar células' },
  { key:'asistencia',    label:'Asistencia',      desc:'Tomar asistencia' },
  { key:'calendario',    label:'Calendario',      desc:'Ver y crear eventos' },
  { key:'mensajes',      label:'Mensajería',      desc:'Enviar mensajes' },
  { key:'alertas',       label:'Alertas',         desc:'Ver alertas pastorales' },
  { key:'reportes',      label:'Reportes',        desc:'Generar reportes' },
  { key:'discipulado',   label:'Discipulado',     desc:'Seguimiento espiritual' },
  { key:'seguimiento',   label:'Seguimiento',     desc:'Notas pastorales' },
  { key:'historial',     label:'Historial',       desc:'Auditoría' },
  { key:'consolidacion', label:'Consolidación',   desc:'Nuevos miembros' },
  { key:'comunicados',   label:'Comunicados',     desc:'Novedades internas' },
]

const NIVELES = [
  { val:0, label:'Sin acceso',  color:'var(--c-danger)', bg:'var(--c-danger-bg)', icon:'✗' },
  { val:1, label:'Solo ver',    color:'var(--c-warning)', bg:'var(--c-warning-bg)', icon:'◎' },
  { val:2, label:'Ver+editar',  color:'var(--c-info)', bg:'var(--c-info-bg)', icon:'✎' },
  { val:3, label:'Total',       color:'var(--c-success)', bg:'var(--c-success-bg)', icon:'✓' },
]

export default function GestionPermisos() {
  const [usuarios, setUsuarios]   = useState([])
  const [selUser, setSelUser]     = useState(null)
  const [permisos, setPermisos]   = useState({})
  const [original, setOriginal]   = useState({})
  const [cambios, setCambios]     = useState(false)
  const [msg, setMsg]             = useState(null)
  const [loading, setLoading]     = useState(false)

  useEffect(()=>{
    apiFetch('/users').then(u=>setUsuarios((u||[]).filter(u=>u.rol!=='PASTOR_GENERAL'))).catch(()=>{})
  },[])

  async function seleccionar(user) {
    setSelUser(user); setMsg(null); setCambios(false)
    try { const p = await apiFetch(`/permisos/${user.id}`); setPermisos({...p}); setOriginal({...p}) } catch {}
  }

  function setNivel(modulo, val) {
    const nuevo = {...permisos,[modulo]:val}
    setPermisos(nuevo); setCambios(JSON.stringify(nuevo)!==JSON.stringify(original))
  }

  async function guardar() {
    setLoading(true); setMsg(null)
    try { await apiFetch(`/permisos/${selUser.id}`,{method:'PUT',body:JSON.stringify(permisos)}); setOriginal({...permisos}); setCambios(false); setMsg({type:'success',text:'Permisos guardados'}) }
    catch(e) { setMsg({type:'error',text:e.message}) }
    setLoading(false)
  }

  async function resetear() {
    if (!confirm(`¿Resetear permisos de ${selUser.nombre||selUser.email} a los defaults de su rol?`)) return
    setLoading(true)
    try { await apiFetch(`/permisos/${selUser.id}/reset`,{method:'POST'}); await seleccionar(selUser); setMsg({type:'success',text:'Reseteado al rol'}) }
    catch(e) { setMsg({type:'error',text:e.message}) }
    setLoading(false)
  }

  const ROL_COLOR = { PASTOR_CULTO:'var(--c-info)',CONSOLIDACION:'var(--c-green-dark)',STAFF:'var(--c-warning)',LIDER:'var(--text-muted)' }
  const ROL_BG    = { PASTOR_CULTO:'var(--c-info-bg)',CONSOLIDACION:'var(--c-success-bg)',STAFF:'var(--c-warning-bg)',LIDER:'var(--bg-2)' }

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <div><h1 className="page-title"><Icons.Shield /> Gestión de permisos</h1><p style={{fontSize:13,color:'var(--text-muted)',marginTop:2}}>Asigná qué puede ver y editar cada integrante</p></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:16,alignItems:'start'}}>
          <div className="card" style={{padding:0, overflowX:'auto'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4}}>Equipo ({usuarios.length})</div>
            {usuarios.length===0 ? <div className="empty" style={{padding:24}}><p>Sin usuarios</p></div>
              : usuarios.map(u=>(
                <div key={u.id} onClick={()=>seleccionar(u)}
                  style={{padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid var(--border)',background:selUser?.id===u.id?'#eff6ff':'transparent',borderLeft:selUser?.id===u.id?'3px solid var(--primary)':'3px solid transparent'}}>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{u.nombre||u.email}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>{u.email}</div>
                  <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:700,background:ROL_BG[u.rol]||'var(--bg-2)',color:ROL_COLOR[u.rol]||'var(--text-muted)'}}>{u.rol}</span>
                  {!u.activo&&<span style={{marginLeft:6,fontSize:10,color:'var(--c-danger)'}}>inactivo</span>}
                </div>
              ))
            }
          </div>
          {!selUser
            ? <div className="card empty"><div className="empty-icon"><Icons.Shield /></div><p>Seleccioná un usuario</p></div>
            : <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
                  <div><h2 style={{fontSize:17,fontWeight:700,margin:0}}>{selUser.nombre||selUser.email}</h2><p style={{fontSize:12,color:'var(--text-muted)',margin:'4px 0 0'}}>Rol: <strong style={{color:ROL_COLOR[selUser.rol]||'var(--text-muted)'}}>{selUser.rol}</strong></p></div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-ghost btn-sm" data-tip="Resetear permisos al nivel por defecto del rol" onClick={resetear} disabled={loading}>↩ Resetear</button>
                    <button className="btn btn-primary" onClick={guardar} disabled={!cambios||loading}>{loading?'Guardando...':cambios?'💾 Guardar':'Sin cambios'}</button>
                  </div>
                </div>
                {msg&&<div className={`alert alert-${msg.type}`} style={{marginBottom:16}}>{msg.text}</div>}
                <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                  {NIVELES.map(n=><span key={n.val} style={{fontSize:11,padding:'3px 10px',borderRadius:10,background:n.bg,color:n.color,fontWeight:600}}>{n.icon} {n.label}</span>)}
                </div>
                <div style={{display:'grid',gap:8}}>
                  {MODULOS.map(m=>{
                    const nivelActual = Number(permisos[m.key]??0)
                    const nivelInfo   = NIVELES[nivelActual]
                    const cambiado    = permisos[m.key]!==original[m.key]
                    return (
                      <div key={m.key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,border:`1px solid ${cambiado?'var(--primary)':'var(--border)'}`,background:cambiado?'#f0f6ff':'transparent'}}>
                        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{m.label}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{m.desc}</div></div>
                        <div style={{display:'flex',gap:4}}>
                          {NIVELES.map(n=>(
                            <button key={n.val} onClick={()=>setNivel(m.key,n.val)} title={n.label}
                              style={{width:32,height:32,borderRadius:8,border:'none',cursor:'pointer',fontSize:14,background:nivelActual===n.val?n.color:'#f1f5f9',color:nivelActual===n.val?'var(--surface)':'var(--text-faint)',transform:nivelActual===n.val?'scale(1.1)':'scale(1)',transition:'all .15s'}}>
                              {n.icon}
                            </button>
                          ))}
                        </div>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:700,background:nivelInfo.bg,color:nivelInfo.color,minWidth:80,textAlign:'center'}}>{nivelInfo.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
          }
        </div>
      </main>
    </div>
  )
}
