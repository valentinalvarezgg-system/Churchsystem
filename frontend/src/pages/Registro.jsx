import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import EmailVerificacion from '../components/EmailVerificacion.jsx'
import { TokenIglesiaInput } from '../components/TokenIglesia.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// ── Planes ────────────────────────────────────────────────────────────────────
const PLANES = [
  {
    key: 'LIDER', nombre: 'Líder', precio: 15, popular: false,
    desc: 'Para líderes de célula',
    features: ['Dashboard', 'Personas', 'Grupos', 'Check-in QR', 'Mi perfil'],
  },
  {
    key: 'CULTO', nombre: 'Culto', precio: 30, popular: false,
    desc: 'Para equipos de culto',
    features: ['Todo lo de Líder', 'Asistencia', 'Calendario', 'Comunicados'],
  },
  {
    key: 'CONSOLIDACION', nombre: 'Consolidación', precio: 50, popular: true,
    desc: 'Para equipos pastorales',
    features: ['Todo lo de Culto', 'Seguimiento pastoral', 'Consolidación', 'Alertas', 'Mensajería'],
  },
  {
    key: 'ADMINISTRACION', nombre: 'Administración', precio: 80, popular: false,
    desc: 'Para secretaría',
    features: ['Todo lo anterior', 'Reportes completos', 'Gestión usuarios', 'Permisos', 'Excel + IA'],
  },
  {
    key: 'GENERAL', nombre: 'General', precio: 120, popular: false,
    desc: 'Para pastor general',
    features: ['Acceso completo', 'Vista ejecutiva IA', 'Asistente IA', 'Multi-iglesia', 'Soporte prioritario'],
  },
]

// ── Estilos base ──────────────────────────────────────────────────────────────
const c = {
  bg:     '#0A0E1A',
  surf:   'rgba(30,41,59,0.88)',
  border: 'rgba(255,255,255,0.09)',
  input:  'rgba(15,23,42,0.7)',
  text:   '#F1F5F9',
  text2:  '#CBD5E1',
  muted:  '#64748B',
  pri:    '#6B5CFF',
  priD:   '#4845D2',
  priL:   '#A78BFA',
  ok:     '#22c55e',
}

const inp = {
  width:'100%', padding:'12px 14px', fontSize:14,
  background:c.input, border:`1.5px solid ${c.border}`,
  borderRadius:12, color:c.text, outline:'none',
  transition:'border-color .2s', boxSizing:'border-box',
  fontFamily:'inherit',
}
const btnPri = {
  width:'100%', padding:'14px', fontSize:15, fontWeight:700,
  background:`linear-gradient(135deg,${c.pri},${c.priD})`,
  color:'white', border:'none', borderRadius:12,
  cursor:'pointer', transition:'all .2s', letterSpacing:.3,
}
const label = {
  display:'block', fontSize:11, fontWeight:700, color:'#94A3B8',
  marginBottom:6, textTransform:'uppercase', letterSpacing:'0.8px',
}

// ── Stepper ───────────────────────────────────────────────────────────────────
const STEPS = ['Plan', 'Cuenta', 'Verificar', 'Listo']
function Stepper({ paso }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:32}}>
      {STEPS.map((l, i) => {
        const done = paso > i, active = paso === i
        return (
          <div key={i} style={{display:'flex', alignItems:'center', flex: i<3?1:0, gap:6}}>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <div style={{
                width:28, height:28, borderRadius:'50%', fontSize:12, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: done?c.ok : active?c.pri : 'rgba(255,255,255,0.07)',
                color: done||active ? '#fff' : c.muted,
                transition:'all .3s',
              }}>{done ? '✓' : i+1}</div>
              <span style={{
                fontSize:12, fontWeight: active?700:400,
                color: done?c.ok : active?c.text : c.muted,
                whiteSpace:'nowrap',
              }}>{l}</span>
            </div>
            {i < 3 && (
              <div style={{flex:1, height:2, borderRadius:2, minWidth:8,
                background: done ? c.ok : 'rgba(255,255,255,0.07)',
                transition:'background .3s',
              }}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{display:'flex', alignItems:'center', gap:10, justifyContent:'center', marginBottom:8}}>
      <div style={{
        width:40, height:40, borderRadius:12,
        background:`linear-gradient(135deg,#7C6FFF,${c.priD})`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <svg width="22" height="22" viewBox="0 0 100 100" fill="none">
          <path d="M28 18 Q18 18 18 28 L18 72 Q18 82 28 82 L42 82 Q52 82 52 72 L52 28 Q52 18 42 18 Z" fill="white"/>
          <path d="M58 18 Q48 18 48 28 L48 52 Q48 62 58 62 L72 62 Q82 62 82 52 L82 28 Q82 18 72 18 Z" fill="white" opacity="0.85"/>
        </svg>
      </div>
      <span style={{fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, color:c.text}}>
        Church System
      </span>
    </div>
  )
}

// ── OAuth botones ─────────────────────────────────────────────────────────────
function OAuthButtons({ label='Registrate' }) {
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
      <button onClick={()=>{ window.location.href=`${API_BASE}/oauth/google` }}
        style={{
          padding:'12px 10px', background:'rgba(66,133,244,.10)',
          border:'1.5px solid rgba(66,133,244,.3)', borderRadius:12,
          color:c.text, fontSize:14, fontWeight:600, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          fontFamily:'inherit', transition:'all .2s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(66,133,244,.18)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(66,133,244,.10)'}>
        <svg width="17" height="17" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google
      </button>
      <button onClick={()=>toast.info('Apple Sign-In próximamente')}
        style={{
          padding:'12px 10px', background:'rgba(255,255,255,.05)',
          border:`1.5px solid ${c.border}`, borderRadius:12,
          color:c.text, fontSize:14, fontWeight:600, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          fontFamily:'inherit', transition:'all .2s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zm-3.02-17c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        Apple
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Registro() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()

  const [paso, setPaso]           = useState(0)
  const [planSel, setPlanSel]     = useState(searchParams.get('plan')?.toUpperCase() || '')
  const [loading, setLoading]     = useState(false)
  const [emailReg, setEmailReg]   = useState('')
  const [nombreReg, setNombreReg] = useState('')
  const [iglesiaJoin, setIglesiaJoin] = useState(null)
  const [showPass, setShowPass]   = useState(false)
  const [showPass2, setShowPass2] = useState(false)
  const [form, setForm]           = useState({ nombre:'', apellido:'', email:'', password:'', confirmar:'', iglesiaToken:'' })
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  // Si viene con token OAuth (redirect de vuelta)
  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')
    if (token) {
      localStorage.setItem('token', token)
      toast.success('Cuenta creada con Google')
      navigate('/')
    } else if (error === 'oauth_not_configured') {
      toast.error('OAuth no configurado aún')
    }
  }, [searchParams, navigate])

  async function handleRegistro(e) {
    e.preventDefault()
    if (form.password !== form.confirmar) { toast.error('Las contraseñas no coinciden'); return }
    if (form.password.length < 8) { toast.error('Mínimo 8 caracteres'); return }
    setLoading(true)
    try {
      await apiFetch('/auth/registro', { method:'POST', body:JSON.stringify({
        nombre:form.nombre, apellido:form.apellido,
        email:form.email.toLowerCase(), password:form.password,
        plan: planSel || 'CONSOLIDACION',
        iglesiaToken: form.iglesiaToken || undefined,
      })})
      setEmailReg(form.email.toLowerCase())
      setNombreReg(form.nombre)
      setPaso(2)
    } catch(e) { toast.error(e.message || 'Error al crear la cuenta') }
    finally { setLoading(false) }
  }

  const planActual = PLANES.find(p=>p.key === planSel) || PLANES[2]

  // ── Card wrapper ──────────────────────────────────────────────────────────
  const cardW = paso===0 ? 920 : paso===1 ? 500 : 440
  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:c.bg, padding:'24px 16px', position:'relative', overflow:'hidden',
      fontFamily:"'Inter','Sora',sans-serif",
    }}>
      {/* Orbs */}
      <div style={{position:'fixed', width:500, height:500, borderRadius:'50%',
        background:c.pri, filter:'blur(120px)', opacity:.09, top:-150, right:-100, pointerEvents:'none'}}/>
      <div style={{position:'fixed', width:350, height:350, borderRadius:'50%',
        background:'#06B6D4', filter:'blur(120px)', opacity:.07, bottom:'10%', left:-80, pointerEvents:'none'}}/>

      {/* Logo top */}
      <div style={{marginBottom:20}}><Logo/></div>

      <div style={{
        width:'100%', maxWidth:cardW,
        background:c.surf, backdropFilter:'blur(24px)',
        borderRadius:24, padding: paso===0 ? '36px 36px' : '40px 36px',
        border:`1px solid ${c.border}`,
        boxShadow:'0 30px 60px -12px rgba(0,0,0,0.6)',
        transition:'max-width .4s ease',
      }}>

        {/* Stepper (pasos 1-3) */}
        {paso > 0 && <Stepper paso={paso}/>}

        {/* ══ PASO 0: ELEGIR PLAN ══════════════════════════════════════════════ */}
        {paso === 0 && (
          <>
            <div style={{textAlign:'center', marginBottom:32}}>
              <div style={{fontSize:12, fontWeight:700, textTransform:'uppercase',
                letterSpacing:2, color:c.pri, marginBottom:8}}>Paso 1 de 3</div>
              <h2 style={{fontFamily:"'Sora',sans-serif", fontSize:26, fontWeight:800,
                color:c.text, margin:'0 0 6px'}}>Elegí tu plan</h2>
              <p style={{fontSize:14, color:c.muted}}>
                Podés cambiarlo cuando quieras · Todos incluyen 14 días de prueba gratis
              </p>
            </div>

            {/* Grid de planes */}
            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',
              gap:12, marginBottom:28,
            }}>
              {PLANES.map(plan => {
                const sel = planSel === plan.key
                return (
                  <div key={plan.key}
                    onClick={()=>setPlanSel(plan.key)}
                    style={{
                      border:`2px solid ${sel ? c.pri : plan.popular ? 'rgba(107,92,255,.3)' : c.border}`,
                      borderRadius:16, padding:'20px 16px', cursor:'pointer',
                      background: sel ? `rgba(107,92,255,.12)` : plan.popular ? 'rgba(107,92,255,.05)' : 'rgba(255,255,255,.02)',
                      position:'relative', transition:'all .2s',
                    }}>
                    {plan.popular && !sel && (
                      <div style={{
                        position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)',
                        background:`linear-gradient(135deg,${c.pri},${c.priD})`,
                        color:'white', fontSize:10, fontWeight:700,
                        padding:'2px 10px', borderRadius:100, whiteSpace:'nowrap',
                      }}>Más popular</div>
                    )}
                    {sel && (
                      <div style={{
                        position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)',
                        background:`linear-gradient(135deg,${c.pri},${c.priD})`,
                        color:'white', fontSize:10, fontWeight:700,
                        padding:'2px 10px', borderRadius:100,
                      }}>✓ Seleccionado</div>
                    )}
                    <div style={{fontFamily:"'Sora',sans-serif", fontSize:15, fontWeight:800,
                      color: sel ? c.priL : c.text, marginBottom:4}}>{plan.nombre}</div>
                    <div style={{
                      fontFamily:"'Sora',sans-serif", fontSize:26, fontWeight:800,
                      color: sel ? c.pri : c.text2, marginBottom:4,
                    }}>
                      ${plan.precio}<span style={{fontSize:12, fontWeight:400, color:c.muted}}>/mes</span>
                    </div>
                    <div style={{fontSize:11, color:c.muted, marginBottom:12}}>{plan.desc}</div>
                    <ul style={{listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:5}}>
                      {plan.features.map(f => (
                        <li key={f} style={{fontSize:12, color: sel ? c.text2 : c.muted,
                          display:'flex', alignItems:'flex-start', gap:6}}>
                          <span style={{color: sel ? c.ok : '#374151', flexShrink:0, fontSize:11, marginTop:1}}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            {/* Info 14 días */}
            <div style={{
              background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.2)',
              borderRadius:12, padding:'12px 16px', marginBottom:24,
              display:'flex', alignItems:'center', gap:10, fontSize:13,
            }}>
              <span style={{fontSize:20}}>🎁</span>
              <div>
                <strong style={{color:c.ok}}>14 días gratis</strong>
                <span style={{color:c.muted}}> — No se cobra nada hasta que termine el período de prueba. Cancelá cuando quieras.</span>
              </div>
            </div>

            <button
              onClick={()=>{ if(!planSel) { toast.error('Elegí un plan para continuar'); return } setPaso(1) }}
              style={{...btnPri, opacity: planSel ? 1 : .5}}>
              Continuar con {planSel ? planActual.nombre : 'un plan'} →
            </button>

            <p style={{textAlign:'center', fontSize:13, color:c.muted, marginTop:16}}>
              ¿Ya tenés cuenta?{' '}
              <a href="/app/login" style={{color:c.pri, fontWeight:600, textDecoration:'none'}}>Ingresar</a>
            </p>
          </>
        )}

        {/* ══ PASO 1: CREAR CUENTA ═════════════════════════════════════════════ */}
        {paso === 1 && (
          <>
            {/* Plan badge */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'rgba(107,92,255,.1)', border:'1px solid rgba(107,92,255,.2)',
              borderRadius:12, padding:'10px 14px', marginBottom:24,
            }}>
              <div>
                <span style={{fontSize:12, color:c.muted}}>Plan seleccionado · </span>
                <strong style={{fontSize:13, color:c.priL}}>{planActual.nombre}</strong>
                <span style={{fontSize:12, color:c.muted}}> · ${planActual.precio}/mes</span>
              </div>
              <button onClick={()=>setPaso(0)}
                style={{background:'none', border:'none', cursor:'pointer',
                  fontSize:12, color:c.pri, fontWeight:600, padding:0}}>
                Cambiar
              </button>
            </div>

            {/* OAuth */}
            <div style={{marginBottom:20}}>
              <p style={{fontSize:13, color:c.muted, marginBottom:12, textAlign:'center'}}>
                Registrate rápido con
              </p>
              <OAuthButtons label="Registrate"/>
            </div>

            {/* Divider */}
            <div style={{display:'flex', alignItems:'center', gap:12, margin:'20px 0'}}>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,.07)'}}/>
              <span style={{fontSize:12, color:'#475569'}}>o con email</span>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,.07)'}}/>
            </div>

            {/* Form */}
            <form onSubmit={handleRegistro} style={{display:'flex', flexDirection:'column', gap:13}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div>
                  <label style={label}>Nombre *</label>
                  <input type="text" required value={form.nombre} placeholder="Juan"
                    style={inp} onChange={e=>f('nombre',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor=c.border}/>
                </div>
                <div>
                  <label style={label}>Apellido</label>
                  <input type="text" value={form.apellido} placeholder="Pérez"
                    style={inp} onChange={e=>f('apellido',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor=c.border}/>
                </div>
              </div>
              <div>
                <label style={label}>Email *</label>
                <input type="email" required value={form.email} placeholder="vos@iglesia.com"
                  style={inp} onChange={e=>f('email',e.target.value)}
                  onFocus={e=>e.target.style.borderColor=c.pri}
                  onBlur={e=>e.target.style.borderColor=c.border}/>
              </div>
              <div>
                <label style={label}>Contraseña * (mín. 8)</label>
                <div style={{position:'relative'}}>
                  <input type={showPass?'text':'password'} required minLength={8}
                    value={form.password} placeholder="••••••••"
                    style={{...inp, paddingRight:40}} onChange={e=>f('password',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor=c.border}/>
                  <button type="button" onClick={()=>setShowPass(!showPass)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',color:c.muted,display:'flex',padding:4}}>
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
              </div>
              <div>
                <label style={label}>Confirmar contraseña *</label>
                <div style={{position:'relative'}}>
                  <input type={showPass2?'text':'password'} required
                    value={form.confirmar} placeholder="••••••••"
                    style={{...inp, paddingRight:40,
                      borderColor: form.confirmar && form.confirmar!==form.password ? '#ef4444' : c.border}}
                    onChange={e=>f('confirmar',e.target.value)}
                    onFocus={e=>e.target.style.borderColor=c.pri}
                    onBlur={e=>e.target.style.borderColor= form.confirmar&&form.confirmar!==form.password?'#ef4444':c.border}/>
                  <button type="button" onClick={()=>setShowPass2(!showPass2)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',color:c.muted,display:'flex',padding:4}}>
                    {showPass2
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>
                </div>
                {form.confirmar && form.confirmar!==form.password &&
                  <p style={{fontSize:11,color:'#ef4444',marginTop:4}}>Las contraseñas no coinciden</p>}
              </div>

              {/* Token iglesia */}
              <div style={{
                background:'rgba(107,92,255,.06)',
                border:`1px solid rgba(107,92,255,.15)`,
                borderRadius:12, padding:'14px 16px',
              }}>
                <TokenIglesiaInput
                  label="Código de iglesia (opcional)"
                  onSuccess={res=>{ setIglesiaJoin(res); f('iglesiaToken', res?.token||'') }}
                />
                <p style={{fontSize:11,color:c.muted,marginTop:6}}>
                  Pedíselo al pastor. Lo podés agregar después desde Mi Perfil.
                </p>
              </div>

              {/* Info pago */}
              <div style={{
                background:'rgba(15,23,42,.6)', border:`1px solid ${c.border}`,
                borderRadius:12, padding:'14px 16px',
                display:'flex', gap:12, alignItems:'flex-start',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="#22c55e" strokeWidth="2" style={{flexShrink:0, marginTop:1}}>
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <div>
                  <p style={{fontSize:13, color:c.text2, margin:'0 0 4px', fontWeight:600}}>
                    Sin cobro durante 14 días
                  </p>
                  <p style={{fontSize:12, color:c.muted, margin:0, lineHeight:1.5}}>
                    Después del período de prueba se cobra <strong style={{color:c.text2}}>${planActual.precio}/mes</strong>.
                    Cancelá antes si no querés continuar.
                    El pago se gestiona por MercadoPago.
                  </p>
                </div>
              </div>

              <div style={{display:'flex', gap:10}}>
                <button type="button" onClick={()=>setPaso(0)}
                  style={{flex:1, padding:'13px', fontSize:14, fontWeight:600,
                    background:'rgba(255,255,255,.06)', color:c.text2,
                    border:`1px solid ${c.border}`, borderRadius:12, cursor:'pointer'}}>
                  ← Volver
                </button>
                <button type="submit" disabled={loading||(form.confirmar&&form.confirmar!==form.password)}
                  style={{...btnPri, flex:2, opacity:loading?.7:1}}>
                  {loading ? 'Creando...' : 'Crear cuenta gratis →'}
                </button>
              </div>

              <p style={{fontSize:11, color:c.muted, textAlign:'center', lineHeight:1.5}}>
                Al registrarte aceptás los{' '}
                <a href="/app/terminos" style={{color:c.pri, textDecoration:'none'}}>Términos de servicio</a>
                {' '}y la{' '}
                <a href="/app/privacidad" style={{color:c.pri, textDecoration:'none'}}>Política de privacidad</a>.
              </p>
            </form>
          </>
        )}

        {/* ══ PASO 2: VERIFICACIÓN EMAIL ═══════════════════════════════════════ */}
        {paso === 2 && (
          <EmailVerificacion
            email={emailReg}
            nombre={nombreReg}
            onVerificado={()=>setPaso(3)}
          />
        )}

        {/* ══ PASO 3: LISTO ════════════════════════════════════════════════════ */}
        {paso === 3 && (
          <div style={{textAlign:'center', padding:'12px 0'}}>
            <div style={{
              width:80, height:80, borderRadius:24, margin:'0 auto 24px',
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:40,
            }}>✓</div>
            <h2 style={{fontFamily:"'Sora',sans-serif", fontSize:24, fontWeight:800,
              color:c.text, margin:'0 0 8px'}}>
              ¡Cuenta creada!
            </h2>
            <p style={{fontSize:14, color:c.muted, margin:'0 0 6px', lineHeight:1.6}}>
              Verificación exitosa para<br/>
              <strong style={{color:c.text2}}>{emailReg}</strong>
            </p>
            <div style={{
              display:'flex', flexDirection:'column', gap:10, margin:'24px 0',
              background:'rgba(255,255,255,.03)', borderRadius:14, padding:'16px',
            }}>
              {[
                { icon:'✓', text:`Plan ${planActual.nombre} activado`, color:c.ok },
                { icon:'🎁', text:'14 días de prueba gratis', color:'#f59e0b' },
                iglesiaJoin && { icon:'✓', text:`Conectado a ${iglesiaJoin.iglesia?.nombre||iglesiaJoin.nombre||'tu iglesia'}`, color:c.ok },
              ].filter(Boolean).map((item,i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10,
                  fontSize:13, color:item.color, fontWeight:600}}>
                  <span style={{fontSize:16}}>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
            <button onClick={()=>navigate('/login')} style={btnPri}>
              Ingresar a Church System →
            </button>
          </div>
        )}

      </div>

      {/* Footer links */}
      <div style={{display:'flex', gap:16, marginTop:20}}>
        {['FAQ:/app/faq','Términos:/app/terminos','Privacidad:/app/privacidad'].map(x => {
          const [label, href] = x.split(':')
          return <a key={label} href={href}
            style={{fontSize:12, color:c.muted, textDecoration:'none'}}>{label}</a>
        })}
      </div>
    </div>
  )
}
