import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'

const S = {
  bg: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'#0A0E1A', padding:'20px', fontFamily:"'Inter','Sora',sans-serif" },
  card: { width:'100%', maxWidth:420, background:'#0F1629', border:'1px solid #1E293B',
    borderRadius:20, padding:'36px 32px' },
  logoBox: { width:64, height:64, borderRadius:18, margin:'0 auto 16px',
    background:'linear-gradient(135deg,#6B5CFF,#4845D2)', display:'flex',
    alignItems:'center', justifyContent:'center' },
  h1: { fontSize:22, fontWeight:800, color:'#F1F5F9', textAlign:'center', margin:'0 0 6px' },
  sub: { fontSize:14, color:'#94A3B8', textAlign:'center', margin:'0 0 24px', lineHeight:1.5 },
  label: { fontSize:12, fontWeight:600, color:'#94A3B8', textTransform:'uppercase',
    letterSpacing:'.04em', display:'block', marginBottom:6 },
  input: { width:'100%', padding:'12px 14px', fontSize:15, background:'#0A0E1A',
    border:'1px solid #1E293B', borderRadius:10, color:'#F1F5F9', outline:'none',
    boxSizing:'border-box', marginBottom:16 },
  inputCode: { width:'100%', padding:'14px', fontSize:24, letterSpacing:'8px',
    textAlign:'center', background:'#0A0E1A', border:'1px solid #1E293B', borderRadius:10,
    color:'#F1F5F9', outline:'none', boxSizing:'border-box', marginBottom:16, fontWeight:700 },
  btn: { width:'100%', padding:'14px', fontSize:15, fontWeight:700, border:'none',
    borderRadius:12, cursor:'pointer', background:'linear-gradient(135deg,#6B5CFF,#4845D2)',
    color:'#fff', marginBottom:12 },
  link: { color:'#A78BFA', textDecoration:'none', fontSize:14, cursor:'pointer' },
  back: { textAlign:'center', marginTop:8 },
}

export default function RecuperarPassword() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)        // 1 = pedir email, 2 = código + nueva pass
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)

  async function pedirCodigo(e) {
    e?.preventDefault()
    if (!email.trim()) return toast.error('Ingresá tu email')
    setLoading(true)
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
        skipAuthRedirect: true,
      })
      toast.success('Si el email está registrado, te enviamos un código')
      setPaso(2)
    } catch {
      // Respuesta neutra igual: avanzamos al paso 2 para no revelar si existe
      toast.success('Si el email está registrado, te enviamos un código')
      setPaso(2)
    } finally {
      setLoading(false)
    }
  }

  async function resetear(e) {
    e?.preventDefault()
    if (codigo.trim().length !== 6) return toast.error('El código tiene 6 dígitos')
    if (password.length < 8) return toast.error('La contraseña debe tener al menos 8 caracteres')
    if (password !== password2) return toast.error('Las contraseñas no coinciden')
    setLoading(true)
    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), codigo: codigo.trim(), password }),
        skipAuthRedirect: true,
      })
      if (res?.ok) {
        toast.success('Contraseña actualizada. Ya podés iniciar sesión.')
        setTimeout(() => navigate('/login'), 1200)
      } else {
        toast.error(res?.error || 'No se pudo cambiar la contraseña')
      }
    } catch (err) {
      toast.error(err?.message || 'Código incorrecto o expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.bg}>
      <div style={S.card}>
        <div style={S.logoBox}>
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
            <path d="M28 18 Q18 18 18 28 L18 72 Q18 82 28 82 L42 82 Q52 82 52 72 L52 28 Q52 18 42 18 Z" fill="white"/>
            <path d="M58 18 Q48 18 48 28 L48 52 Q48 62 58 62 L72 62 Q82 62 82 52 L82 28 Q82 18 72 18 Z" fill="white" opacity="0.85"/>
          </svg>
        </div>

        {paso === 1 ? (
          <>
            <h1 style={S.h1}>Recuperar contraseña</h1>
            <p style={S.sub}>Ingresá tu email y te enviamos un código de 6 dígitos para restablecerla.</p>
            <form onSubmit={pedirCodigo}>
              <label style={S.label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vos@iglesia.com" style={S.input} autoFocus />
              <button type="submit" disabled={loading} style={{...S.btn, opacity: loading ? .7 : 1}}>
                {loading ? 'Enviando...' : 'Enviar código'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 style={S.h1}>Ingresá el código</h1>
            <p style={S.sub}>Revisá tu email <strong style={{color:'#CBD5E1'}}>{email}</strong> y pegá el código. Expira en 15 minutos.</p>
            <form onSubmit={resetear}>
              <label style={S.label}>Código de 6 dígitos</label>
              <input type="text" inputMode="numeric" maxLength={6} value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••" style={S.inputCode} autoFocus />
              <label style={S.label}>Nueva contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres" style={S.input} />
              <label style={S.label}>Repetir contraseña</label>
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
                placeholder="Repetí la contraseña" style={S.input} />
              <button type="submit" disabled={loading} style={{...S.btn, opacity: loading ? .7 : 1}}>
                {loading ? 'Cambiando...' : 'Cambiar contraseña'}
              </button>
            </form>
            <p style={S.back}>
              <span style={S.link} onClick={() => setPaso(1)}>← Usar otro email</span>
            </p>
          </>
        )}

        <p style={S.back}>
          <a href="/app/login" style={S.link}>Volver al inicio de sesión</a>
        </p>
      </div>
    </div>
  )
}
