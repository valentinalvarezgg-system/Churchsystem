import { useState, useRef, useEffect } from 'react'
import { apiFetch } from '../services/api.js'
import { toast } from './Toast.jsx'

export default function EmailVerificacion({ email, nombre, onVerificado }) {
  const [codigos, setCodigos] = useState(['','','','','',''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(60)
  const inputs = useRef([])

  useEffect(() => { enviarCodigo() }, [])
  useEffect(() => { if(timer<=0)return; const t=setTimeout(()=>setTimer(t=>t-1),1000); return()=>clearTimeout(t) }, [timer])

  async function enviarCodigo() {
    try { const r = await apiFetch('/verificacion/enviar',{method:'POST',body:JSON.stringify({email,nombre})}); setTimer(60); if(r.codigoDev) { toast.info('DEV: '+r.codigoDev); setCodigos(r.codigoDev.split('')) } }
    catch(e) { setError(e.message) }
  }
  function handleDigit(i,val) {
    const v=val.replace(/\D/g,'').slice(-1); const next=[...codigos]; next[i]=v; setCodigos(next)
    if(v&&i<5) inputs.current[i+1]?.focus()
    if(v&&i===5) { const c=[...next].join(''); if(c.length===6) verificar(c) }
  }
  function handleKeyDown(i,e) { if(e.key==='Backspace'&&!codigos[i]&&i>0)inputs.current[i-1]?.focus() }
  function handlePaste(e) { e.preventDefault(); const t=e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6); if(t.length===6){setCodigos(t.split(''));inputs.current[5]?.focus();verificar(t)} }
  async function verificar(codigo) {
    setLoading(true); setError('')
    try { await apiFetch('/verificacion/verificar',{method:'POST',body:JSON.stringify({email,codigo})}); onVerificado() }
    catch(e) { setError(e.message); setCodigos(['','','','','','']); inputs.current[0]?.focus() }
    setLoading(false)
  }
  const completo = codigos.every(d=>d!=='')
  return (
    <div style={{textAlign:'center'}}>
      <h2 style={{fontSize:20,fontWeight:800,color:'#F1F5F9',margin:'0 0 8px'}}>Verificá tu email</h2>
      <p style={{fontSize:13,color:'#94A3B8',margin:'0 0 28px'}}>Código de 6 dígitos enviado a <strong style={{color:'#CBD5E1'}}>{email}</strong></p>
      <form onSubmit={e=>{e.preventDefault();if(completo)verificar(codigos.join(''))}}>
        <div style={{display:'flex',gap:10,justifyContent:'center',marginBottom:24}}>
          {codigos.map((d,i)=><input key={i} ref={el=>inputs.current[i]=el} type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e=>handleDigit(i,e.target.value)} onKeyDown={e=>handleKeyDown(i,e)} onPaste={i===0?handlePaste:undefined} disabled={loading}
            style={{width:48,height:56,textAlign:'center',fontSize:24,fontWeight:800,fontFamily:'monospace',background:d?'#6B5CFF18':'rgba(15,23,42,0.6)',border:`2px solid ${d?'#6B5CFF':error?'#ef4444':'rgba(255,255,255,0.1)'}`,borderRadius:12,color:'#F1F5F9',outline:'none'}}/>)}
        </div>
        {error&&<p style={{fontSize:13,color:'#ef4444',marginBottom:16}}>{error}</p>}
        <button type="submit" disabled={loading||!completo} style={{width:'100%',padding:'14px',fontSize:15,fontWeight:700,background:completo?'linear-gradient(135deg,#6B5CFF,#4845D2)':'rgba(107,92,255,0.3)',color:'white',border:'none',borderRadius:12,cursor:completo?'pointer':'not-allowed',marginBottom:20}}>
          {loading?'Verificando...':'Verificar cuenta'}</button>
      </form>
      <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:20}}>
        {timer>0?<p style={{fontSize:13,color:'#64748B'}}>Reenviar en <strong>{timer}s</strong></p>:
        <button onClick={enviarCodigo} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#6B5CFF',fontWeight:600,textDecoration:'underline'}}>Reenviar código</button>}
      </div>
    </div>
  )
}
