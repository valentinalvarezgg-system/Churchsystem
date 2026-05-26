import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../services/api.js'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password })
      })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/')
    } catch (err) {
      setError(err.message || 'Email o contraseña incorrectos')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      {/* Partículas decorativas */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {[
          [120, 180, 0.06], [550, 100, 0.04], [300, 400, 0.05],
          [80,  500, 0.03], [600, 350, 0.04], [420, 220, 0.035],
        ].map(([x, y, o], i) => (
          <div key={i} style={{
            position:'absolute', left:x, top:y,
            width: 280+i*60, height: 280+i*60,
            borderRadius:'50%',
            background:`radial-gradient(circle, rgba(59,130,246,${o}) 0%, transparent 70%)`,
            transform:'translate(-50%,-50%)',
          }}/>
        ))}
      </div>

      <div className="login-card" style={{ position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:56, height:56, borderRadius:14, margin:'0 auto 16px',
            background:'linear-gradient(135deg,#2563EB,#7C3AED)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, boxShadow:'0 8px 24px rgba(37,99,235,0.4)',
          }}>⛪</div>
          <h1 style={{ color:'var(--surface)', fontSize:22, fontWeight:800, margin:'0 0 6px', letterSpacing:'-0.5px' }}>
            Church System
          </h1>
          <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13, margin:0 }}>
            Beta 2.4.1 · Gestión pastoral integral
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom:16, padding:'10px 14px', borderRadius:8,
            background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.25)',
            color:'#FCA5A5', fontSize:13, display:'flex', alignItems:'center', gap:8,
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, color:'rgba(255,255,255,0.38)', marginBottom:6 }}>
              Email
            </label>
            <input name="email" id="email" type="email" required autoFocus autoComplete="email"
              className="form-input"
              placeholder="admin@iglesia.com"
              value={form.email}
              onChange={e => f('email', e.target.value)}
              style={{ background:'rgba(255,255,255,0.06)', borderColor:'rgba(255,255,255,0.1)', color:'var(--surface)' }}
            />
          </div>

          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, color:'rgba(255,255,255,0.38)' }}>
                Contraseña
              </label>
            </div>
            <div style={{ position:'relative' }}>
              <input name="password" id="password" required autoComplete="current-password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => f('password', e.target.value)}
                style={{ background:'rgba(255,255,255,0.06)', borderColor:'rgba(255,255,255,0.1)', color:'var(--surface)', paddingRight:44 }}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{
                  position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', fontSize:16,
                  color:'rgba(255,255,255,0.3)', padding:4, lineHeight:1,
                }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="btn btn-primary"
            style={{
              width:'100%', justifyContent:'center', padding:'13px',
              fontSize:15, fontWeight:700,
              background:'linear-gradient(135deg,#2563EB,#7C3AED)',
              boxShadow:'0 4px 16px rgba(37,99,235,0.4)',
              border:'none',
            }}>
            {loading ? '⏳ Ingresando...' : 'Ingresar →'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.18)', margin:0 }}>
            Church System Beta 2.4.1
          </p>
        </div>
      </div>
    </div>
  )
}
