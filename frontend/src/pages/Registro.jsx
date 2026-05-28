import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import EmailVerificacion from '../components/EmailVerificacion.jsx'
import { TokenIglesiaInput } from '../components/TokenIglesia.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const S = {
  bg: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'#0A0E1A', padding:'24px 20px', position:'relative', overflow:'hidden',
    fontFamily:"'Inter', 'Sora', sans-serif" },
  orb1: { position:'fixed', width:500, height:500, borderRadius:'50%',
    background:'#6B5CFF', filter:'blur(120px)', opacity:.1,
    top:-150, right:-100, pointerEvents:'none' },
  orb2: { position:'fixed', width:350, height:350, borderRadius:'50%',
    background:'#06B6D4', filter:'blur(120px)', opacity:.08,
    bottom:'10%', left:-80, pointerEvents:'none' },
  card: (maxW=460) => ({ position:'relative', width:'100%', maxWidth:maxW,
    background:'rgba(30,41,59,0.85)', backdropFilter:'blur(24px)',
    borderRadius:24, padding:'40px 36px',
    border:'1px solid rgba(255,255,255,0.09)',
    boxShadow:'0 30px 60px -12px rgba(0,0,0,0.6)' }),
  logoBox: { width:56, height:56, margin:'0 auto 14px',
    background:'linear-gradient(135deg,#7C6FFF,#4845D2)',
    borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center' },
  h1: { fontSize:24, fontWeight:800, color:'#F1F5F9', margin:'0 0 4px',
    fontFamily:"'Sora', sans-serif" },
  sub: { fontSize:13, color:'#64748B' },
  label: { display:'block', fontSize:11, fontWeight:700, color:'#94A3B8',
    marginBottom:6, textTransform:'uppercase', letterSpacing:'0.8px' },
  input: { width:'100%', padding:'12px 14px', fontSize:14,
    background:'rgba(15,23,42,0.7)', border:'1.5px solid rgba(255,255,255,0.08)',
    borderRadius:12, color:'#F1F5F9', outline:'none', transition:'border-color .2s',
    boxSizing:'border-box', fontFamily:'inherit' },
  btnPrimary: { width:'100%', padding:'14px', fontSize:15, fontWeight:700,
    background:'linear-gradient(135deg,#6B5CFF,#4845D2)',
    color:'white', border:'none', borderRadius:12, cursor:'pointer',
    transition:'all .2s', letterSpacing:.3 },
  divider: { display:'flex', alignItems:'center', gap:12, margin:'20px 0' },
  divLine: { flex:1, height:1, background:'rgba(255,255,255,0.07)' },
  divText: { fontSize:12, color:'#475569', fontWeight:500 },
  oauthGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 },
  oauthBtn: { padding:'11px 10px',
    background:'rgba(15,23,42,0.6)', border:'1.5px solid rgba(255,255,255,0.08)',
    borderRadius:12, color:'#F1F5F9', fontSize:14, fontWeight:600,
    cursor:'pointer', transition:'all .2s', display:'flex',
    alignItems:'center', justifyContent:'center', gap:8, fontFamily:'inherit' },
  link: { color:'#7C6FFF', fontWeight:600, textDecoration:'none' },
  footerLinks: { display:'flex', justifyContent:'center', gap:16,
    paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.05)' },
  footerLink: { fontSize:12, color:'#475569', textDecoration:'none' },
}

// Paso progress indicator
function Steps({ paso }) {
  const labels = ['Cuenta', 'Verificar', 'Listo']
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:28}}>
      {labels.map((l, i) => {
        const done = paso > i, active = paso === i
        return (
          <div key={i} style={{display:'flex', alignItems:'center', gap:8, flex: i < 2 ? 1 : 0}}>
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <div style={{width:26, height:26, borderRadius:'50%', fontSize:12, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                background: done ? '#22c55e' : active ? '#6B5CFF' : 'rgba(255,255,255,0.08)',
                color: done||active ? '#fff' : '#64748B'}}>
                {done ? '✓' : i+1}
              </div>
              <span style={{fontSize:12, fontWeight: active?700:400,
                color: active?'#F1F5F9': done?'#22c55e':'#64748B'}}>{l}</span>
            </div>
            {i < 2 && <div style={{flex:1, height:2, borderRadius:2,
              background: done ? '#22c55e' : 'rgba(255,255,255,0.07)'}}/>}
          </div>
        )
      })}
    </div>
  )
}

export default function Registro() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planInicial = searchParams.get('plan') || ''

  const [paso, setPaso]           = useState(0)
  const [loading, setLoading]     = useState(false)
  const [emailReg, setEmailReg]   = useState('')
  const [nombreReg, setNombreReg] = useState('')
  const [iglesiaJoin, setIglesiaJoin] = useState(null)
  const [showPass, setShowPass]   = useState(false)
  const [showPass2, setShowPass2] = useState(false)
  const [hoverGoogle, setHG]      = useState(false)
  const [hoverApple, setHA]       = useState(false)
  const [form, setForm]           = useState({
    nombre:'', apellido:'', email:'', password:'', confirmar:'', iglesiaToken:''
  })
  const f = (k,v) => setForm(p => ({...p, [k]:v}))

  // OAuth quick register
  function handleGoogle() { window.location.href = `${API_BASE}/oauth/google` }
  function handleApple()  { toast.info('OAuth Apple próximamente') }

  async function handleRegistro(e) {
    e.preventDefault()
    if (form.password !== form.confirmar) { toast.error('Las contraseñas no coinciden'); return }
    if (form.password.length < 8) { toast.error('Mínimo 8 caracteres'); return }
    setLoading(true)
    try {
      await apiFetch('/auth/registro', { method:'POST', body:JSON.stringify({
        nombre: form.nombre, apellido: form.apellido,
        email: form.email.toLowerCase(), password: form.password,
        iglesiaToken: form.iglesiaToken || undefined,
      })})
      setEmailReg(form.email.toLowerCase())
      setNombreReg(form.nombre)
      setPaso(1)
    } catch(e) { toast.error(e.message || 'Error al crear la cuenta') }
    finally { setLoading(false) }
  }

  return (
    <div style={S.bg}>
      <div style={S.orb1}/>
      <div style={S.orb2}/>

      <div style={S.card(paso===0 ? 480 : 440)}>

        {/* ── Paso 0: Formulario ── */}
        {paso === 0 && (
          <>
            <div style={{textAlign:'center', marginBottom:24}}>
              <div style={S.logoBox}>
                <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
                  <path d="M28 18 Q18 18 18 28 L18 72 Q18 82 28 82 L42 82 Q52 82 52 72 L52 28 Q52 18 42 18 Z" fill="white"/>
                  <path d="M58 18 Q48 18 48 28 L48 52 Q48 62 58 62 L72 62 Q82 62 82 52 L82 28 Q82 18 72 18 Z" fill="white" opacity="0.85"/>
                </svg>
              </div>
              <h1 style={S.h1}>Crear cuenta</h1>
              <p style={S.sub}>Church System · Gestión Pastoral Inteligente</p>
            </div>

            {/* OAuth rápido */}
            <div style={S.oauthGrid}>
              <button onClick={handleGoogle} style={{...S.oauthBtn, ...(hoverGoogle?{background:'rgba(66,133,244,.12)',borderColor:'rgba(66,133,244,.4)'}:{})}}
                onMouseEnter={()=>setHG(true)} onMouseLeave={()=>setHG(false)}>
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button onClick={handleApple} style={{...S.oauthBtn, ...(hoverApple?{background:'rgba(255,255,255,.06)',borderColor:'rgba(255,255,255,.2)'}:{})}}
                onMouseEnter={()=>setHA(true)} onMouseLeave={()=>setHA(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zm-3.02-17c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Apple
              </button>
            </div>

            <div style={S.divider}>
              <div style={S.divLine}/><span style={S.divText}>o registrate con email</span><div style={S.divLine}/>
            </div>

            <form onSubmit={handleRegistro} style={{display:'flex', flexDirection:'column', gap:13}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div>
                  <label style={S.label}>Nombre *</label>
                  <input type="text" required value={form.nombre} onChange={e=>f('nombre',e.target.value)}
                    placeholder="Juan" style={S.input}
                    onFocus={e=>e.target.style.borderColor='#6B5CFF'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
                </div>
                <div>
                  <label style={S.label}>Apellido</label>
                  <input type="text" value={form.apellido} onChange={e=>f('apellido',e.target.value)}
                    placeholder="Pérez" style={S.input}
                    onFocus={e=>e.target.style.borderColor='#6B5CFF'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
                </div>
              </div>

              <div>
                <label style={S.label}>Email *</label>
                <input type="email" required value={form.email} onChange={e=>f('email',e.target.value)}
                  placeholder="vos@iglesia.com" style={S.input}
                  onFocus={e=>e.target.style.borderColor='#6B5CFF'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
              </div>

              <div style={{position:'relative'}}>
                <label style={S.label}>Contraseña * (mín. 8)</label>
                <div style={{position:'relative'}}>
                  <input type={showPass?'text':'password'} required minLength={8} value={form.password}
                    onChange={e=>f('password',e.target.value)} placeholder="••••••••"
                    style={{...S.input, paddingRight:40}}
                    onFocus={e=>e.target.style.borderColor='#6B5CFF'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.08)'}/>
                  <button type="button" onClick={()=>setShowPass(!showPass)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#64748B',display:'flex',padding:4}}>
                    {showPass ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
              </div>

              <div style={{position:'relative'}}>
                <label style={S.label}>Confirmar contraseña *</label>
                <div style={{position:'relative'}}>
                  <input type={showPass2?'text':'password'} required value={form.confirmar}
                    onChange={e=>f('confirmar',e.target.value)} placeholder="••••••••"
                    style={{...S.input, paddingRight:40,
                      borderColor: form.confirmar && form.confirmar!==form.password ? '#ef4444' : 'rgba(255,255,255,0.08)'}}
                    onFocus={e=>e.target.style.borderColor='#6B5CFF'} onBlur={e=>e.target.style.borderColor= form.confirmar && form.confirmar!==form.password ? '#ef4444':'rgba(255,255,255,0.08)'}/>
                  <button type="button" onClick={()=>setShowPass2(!showPass2)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#64748B',display:'flex',padding:4}}>
                    {showPass2 ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
                {form.confirmar && form.confirmar!==form.password &&
                  <p style={{fontSize:11,color:'#ef4444',marginTop:4}}>Las contraseñas no coinciden</p>}
              </div>

              {/* Token iglesia */}
              <div style={{background:'rgba(107,92,255,.06)', border:'1px solid rgba(107,92,255,.15)',
                borderRadius:12, padding:'14px 16px'}}>
                <TokenIglesiaInput
                  label="Código de iglesia (opcional)"
                  onSuccess={res => { setIglesiaJoin(res); f('iglesiaToken', res?.token||'') }}
                />
                <p style={{fontSize:11,color:'#475569',marginTop:6}}>
                  Pedíselo al pastor. Podés agregarlo después desde Mi Perfil.
                </p>
              </div>

              <button type="submit" disabled={loading || (form.confirmar && form.confirmar!==form.password)}
                style={{...S.btnPrimary, marginTop:4, opacity:loading?.7:1}}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
              </button>
            </form>

            <p style={{textAlign:'center',fontSize:13,color:'#64748B',marginTop:20}}>
              ¿Ya tenés cuenta?{' '}<a href="/login" style={S.link}>Ingresar</a>
            </p>
            <div style={S.footerLinks}>
              <a href="/faq" style={S.footerLink}>FAQ</a>
              <span style={{color:'#1E293B'}}>·</span>
              <a href="/terminos" style={S.footerLink}>Términos</a>
              <span style={{color:'#1E293B'}}>·</span>
              <a href="/privacidad" style={S.footerLink}>Privacidad</a>
            </div>
          </>
        )}

        {/* ── Paso 1: Verificación ── */}
        {paso === 1 && (
          <>
            <Steps paso={1}/>
            <EmailVerificacion email={emailReg} nombre={nombreReg} onVerificado={()=>setPaso(2)}/>
          </>
        )}

        {/* ── Paso 2: Éxito ── */}
        {paso === 2 && (
          <div style={{textAlign:'center', padding:'20px 0'}}>
            <Steps paso={2}/>
            <div style={{width:72,height:72,borderRadius:20,margin:'0 auto 24px',
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>
              ✓
            </div>
            <h2 style={{fontSize:22,fontWeight:800,color:'#F1F5F9',margin:'0 0 8px',fontFamily:"'Sora',sans-serif"}}>
              ¡Cuenta verificada!
            </h2>
            <p style={{fontSize:14,color:'#94A3B8',margin:'0 0 8px',lineHeight:1.6}}>
              Te enviamos un email de bienvenida a<br/>
              <strong style={{color:'#CBD5E1'}}>{emailReg}</strong>
            </p>
            {iglesiaJoin && (
              <p style={{fontSize:13,color:'#22c55e',margin:'0 0 28px'}}>
                ✓ Conectado a {iglesiaJoin.iglesia?.nombre || iglesiaJoin.nombre}
              </p>
            )}
            <button onClick={()=>navigate('/login')}
              style={{...S.btnPrimary, marginTop: iglesiaJoin ? 0 : 28}}>
              Ingresar ahora →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
