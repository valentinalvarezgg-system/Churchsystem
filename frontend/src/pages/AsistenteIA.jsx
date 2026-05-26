import { useEffect, useRef, useState, useCallback } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'

const SUGERENCIAS = [
  { texto:'¿Cuál es el resumen del estado de la congregación?', tipo:'resumen' },
  { texto:'¿Qué personas necesitan atención urgente?', tipo:'alerta' },
  { texto:'Redactá un mensaje de bienvenida para visitantes', tipo:'mensaje' },
  { texto:'¿Qué grupos necesitan más atención?', tipo:'grupos' },
]

export default function AsistenteIA() {
  const [mensajes, setMensajes]     = useState([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [sugerencias, setSugerencias] = useState(SUGERENCIAS)
  const [iaConfig, setIaConfig]     = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(()=>{
    apiFetch('/ia/sugerencias').then(s=>setSugerencias(s||SUGERENCIAS)).catch(()=>{})
    apiFetch('/config').then(c=>setIaConfig(c)).catch(()=>{})
  },[])

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[mensajes])

  async function enviar(texto) {
    const q = texto||input.trim(); if (!q||loading) return
    setInput('')
    const nuevos = [...mensajes,{role:'user',content:q}]
    setMensajes(nuevos); setLoading(true)
    try {
      const res = await apiFetch('/ia/chat',{method:'POST',body:JSON.stringify({pregunta:q,historial:nuevos.slice(-6,-1).map(m=>({role:m.role,content:m.content}))})})
      setMensajes(p=>[...p,{role:'assistant',content:res.respuesta}])
    } catch(e) { setMensajes(p=>[...p,{role:'assistant',content:`❌ ${e.message}`}]) }
    setLoading(false); inputRef.current?.focus()
  }

  const sinKey = iaConfig && !iaConfig.ia_configurada

  return (
    <div className="layout">
      <Menu />
      <main className="main" style={{display:'flex',flexDirection:'column',height:'calc(100vh - 0px)',padding:0}}>
        <div style={{padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:40,height:40,borderRadius:10,background:'var(--sidebar-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🤖</div>
            <div><h1 style={{margin:0,fontSize:17,fontWeight:700}}>Asistente Pastoral IA</h1><p style={{margin:0,fontSize:12,color:'var(--text-muted)'}}>Preguntame sobre tu congregación</p></div>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            {iaConfig&&<span style={{fontSize:12,padding:'3px 10px',borderRadius:20,fontWeight:600,background:iaConfig.ia_configurada?'var(--c-success-bg)':'var(--c-danger-bg)',color:iaConfig.ia_configurada?'var(--c-green-dark)':'var(--c-danger)'}}>{iaConfig.ia_configurada?'🟢 Activa':'🔴 Sin API key'}</span>}
            {mensajes.length>0&&<button className="btn btn-ghost btn-sm" onClick={()=>setMensajes([])}>Nueva conversación</button>}
          </div>
        </div>
        {sinKey&&<div className="alert alert-warning" style={{margin:'16px 24px 0'}}>⚠️ <strong>IA no configurada.</strong> Andá a <a href="/configuracion" style={{color:'var(--c-warning)',fontWeight:600}}>Configuración → IA</a> para activarla. Groq es gratis y no necesita tarjeta.</div>}
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
          {mensajes.length===0 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:24}}>
              <div style={{textAlign:'center'}}><div style={{fontSize:56,marginBottom:12}}>🤖</div><h2 style={{fontSize:20,fontWeight:700,margin:'0 0 8px'}}>¿En qué te puedo ayudar?</h2><p style={{fontSize:14,color:'var(--text-muted)',margin:0}}>Tengo acceso a los datos reales de tu congregación.</p></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,maxWidth:560,width:'100%'}}>
                {sugerencias.map((s,i)=>(
                  <button key={i} onClick={()=>enviar(s.texto)} style={{padding:'12px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',textAlign:'left',fontSize:13,lineHeight:1.4}}>
                    {s.texto}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {mensajes.map((m,i)=>(
                <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',flexDirection:m.role==='assistant'?'row':'row-reverse',marginBottom:16}}>
                  <div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,background:m.role==='assistant'?'var(--sidebar-bg)':'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{m.role==='assistant'?'🤖':'👤'}</div>
                  <div style={{maxWidth:'75%',padding:'12px 16px',borderRadius:m.role==='assistant'?'4px 14px 14px 14px':'14px 4px 14px 14px',background:m.role==='assistant'?'var(--surface)':'var(--primary)',color:m.role==='assistant'?'var(--text)':'var(--surface)',border:m.role==='assistant'?'1px solid var(--border)':'none',fontSize:14,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{m.content}</div>
                </div>
              ))}
              {loading&&(
                <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:16}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'var(--sidebar-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🤖</div>
                  <div style={{padding:'12px 16px',borderRadius:'4px 14px 14px 14px',background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <span style={{color:'var(--text-faint)'}}>Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',background:'var(--surface)',flexShrink:0}}>
          <div style={{display:'flex',gap:10,alignItems:'flex-end',maxWidth:800,margin:'0 auto'}}>
            <textarea name="t" ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar()}}} placeholder="Preguntá... (Enter para enviar)" disabled={loading}
              style={{flex:1,padding:'12px 14px',border:'1px solid var(--border)',borderRadius:10,fontSize:14,resize:'none',minHeight:46,maxHeight:120,outline:'none',fontFamily:'inherit'}} rows={1}/>
            <button onClick={()=>enviar()} disabled={!input.trim()||loading}
              style={{padding:'12px 20px',background:input.trim()&&!loading?'var(--primary)':'var(--bg-2)',color:input.trim()&&!loading?'var(--surface)':'var(--text-faint)',border:'none',borderRadius:10,cursor:input.trim()&&!loading?'pointer':'not-allowed',fontSize:14,fontWeight:600,height:46,flexShrink:0}}>
              ↑
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
