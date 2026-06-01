import { useState, useEffect } from 'react'
import { apiFetch, getUser } from '../services/api.js'
import { toast } from './Toast.jsx'

export function TokenIglesiaAdmin() {
  const user = getUser()
  const isAdmin = user?.rol === 'PASTOR_GENERAL'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    apiFetch('/iglesia/token').then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  async function regenerar() {
    if (!confirm) { setConfirm(true); return }
    setLoading(true)
    try { const r = await apiFetch('/iglesia/token/regenerar',{method:'POST'}); setData(d=>({...d,token:r.token})); toast.info('Token regenerado.'); setConfirm(false) }
    catch(e) { toast.error(e.message) }
    setLoading(false)
  }
  function copiar() { navigator.clipboard.writeText(data?.token||''); setCopiado(true); toast.success('Token copiado'); setTimeout(()=>setCopiado(false),2500) }

  if (!isAdmin) return null
  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:24,marginBottom:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div><h3 style={{fontSize:15,fontWeight:700,margin:0}}>Token de la iglesia</h3>
        <p style={{fontSize:13,color:'var(--text-muted)',margin:'4px 0 0'}}>Compartí este código con tu equipo para que se unan.</p></div>
        {data?.miembros!==undefined&&<span style={{fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:20,background:'var(--primary-bg,#6B5CFF22)',color:'var(--primary)'}}>{data.miembros} miembros</span>}
      </div>
      {loading?<div className="skeleton" style={{height:56,borderRadius:12}}/>:
      <div style={{display:'flex',alignItems:'center',gap:12,background:'var(--bg)',border:'2px solid var(--primary)',borderRadius:12,padding:'12px 16px',fontFamily:'monospace',fontSize:22,fontWeight:800,letterSpacing:4,color:'var(--primary)'}}>
        <span style={{flex:1}}>{data?.token||'—'}</span>
        <button onClick={copiar} className="btn btn-primary btn-sm" style={{fontFamily:'inherit',letterSpacing:0,fontSize:13}}>{copiado?'OK Copiado':'Copiar'}</button>
      </div>}
      <div style={{marginTop:12,display:'flex',justifyContent:'flex-end',gap:8}}>
        <button onClick={regenerar} className="btn btn-ghost btn-sm" style={{fontSize:12,color:confirm?'var(--c-error)':'var(--text-muted)'}}>{confirm?'Confirmar regenerar':'Regenerar token'}</button>
        {confirm&&<button onClick={()=>setConfirm(false)} className="btn btn-ghost btn-sm" style={{fontSize:12}}>Cancelar</button>}
      </div>
      <p style={{fontSize:12,color:'var(--text-muted)',marginTop:12}}>Al regenerar, el token anterior deja de funcionar. Miembros ya unidos no se afectan.</p>
    </div>
  )
}

export function TokenIglesiaInput({ onSuccess, label='Código de iglesia' }) {
  const [token, setToken] = useState('')
  const [estado, setEstado] = useState(null)
  const [iglesia, setIglesia] = useState(null)
  const [loading, setLoading] = useState(false)

  async function validar(val) {
    const t = val.trim().toUpperCase(); setToken(t)
    if (t.length<10) { setEstado(null); setIglesia(null); return }
    setEstado('validando')
    try { const r = await apiFetch('/iglesia/validar-token',{method:'POST',body:JSON.stringify({token:t})}); if(r.valido){setEstado('valido');setIglesia(r.iglesia)}else{setEstado('error');setIglesia(null)} }
    catch { setEstado('error'); setIglesia(null) }
  }
  async function unirse() {
    setLoading(true)
    try { const r = await apiFetch('/iglesia/unirse',{method:'POST',body:JSON.stringify({token})}); toast.success(r.mensaje); if(onSuccess) onSuccess(r) }
    catch(e) { toast.error(e.message) }
    setLoading(false)
  }
  const bc = {null:'var(--border)',validando:'var(--primary)',valido:'var(--c-success)',error:'var(--c-error)'}[estado]
  return (
    <div>
      <label style={{display:'block',fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text-2)'}}>{label}</label>
      <div style={{display:'flex',gap:8}}>
        <input type="text" value={token} onChange={e=>validar(e.target.value)} placeholder="IGL-XXXX-XXXX" maxLength={12}
          style={{flex:1,padding:'12px 14px',fontFamily:'monospace',fontSize:16,fontWeight:700,letterSpacing:3,textTransform:'uppercase',border:`2px solid ${bc}`,borderRadius:12,background:'var(--bg)',color:'var(--text)',outline:'none'}}/>
        {estado==='valido'&&<button onClick={unirse} disabled={loading} className="btn btn-primary" style={{whiteSpace:'nowrap'}}>{loading?'Uniéndose...':'Unirse'}</button>}
      </div>
      {estado==='validando'&&<p style={{fontSize:12,color:'var(--primary)',marginTop:6}}>Verificando...</p>}
      {estado==='valido'&&iglesia&&<p style={{fontSize:12,color:'var(--c-success)',marginTop:6,fontWeight:600}}>OK Iglesia encontrada: {iglesia}</p>}
      {estado==='error'&&<p style={{fontSize:12,color:'var(--c-error)',marginTop:6}}>Token inválido.</p>}
    </div>
  )
}
