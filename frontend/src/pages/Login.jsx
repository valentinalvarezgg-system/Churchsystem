import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')
    
    if (token) {
      localStorage.setItem('token', token)
      toast.success('Sesión iniciada con Google')
      navigate('/')
    } else if (error) {
      const errors = {
        no_code: 'No se recibió código de autorización',
        no_token: 'No se pudo obtener token de acceso',
        oauth_failed: 'Error en autenticación con Google'
      }
      toast.error(errors[error] || 'Error de autenticación')
    }
  }, [searchParams, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider) {
    if (provider === 'Google') {
      window.location.href = 'http://localhost:4000/oauth/google'
    } else if (provider === 'Apple') {
      toast.info('OAuth Apple próximamente')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Noise texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.4,
        pointerEvents: 'none'
      }} />

      {/* Card */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 420,
        background: 'rgba(30, 41, 59, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: 24,
        padding: '48px 40px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72,
            height: 72,
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6B5CFF, #4845D2)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="40" height="40" viewBox="0 0 200 200" fill="none">
              <path d="M60 40 Q40 40 40 60 L40 140 Q40 160 60 160 L80 160 Q100 160 100 140 L100 60 Q100 40 80 40 Z" fill="white"/>
              <path d="M120 40 Q100 40 100 60 L100 100 Q100 120 120 120 L140 120 Q160 120 160 100 L160 60 Q160 40 140 40 Z" fill="white"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#F1F5F9', marginBottom: 4 }}>Church System</h1>
          <p style={{ fontSize: 14, color: '#94A3B8' }}>Beta 2.6.0 · Gestión pastoral integral</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 15,
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                color: '#F1F5F9',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = '#6B5CFF'}
              onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: 15,
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  color: '#F1F5F9',
                  outline: 'none',
                  transition: 'all 0.2s',
                  paddingRight: 48
                }}
                onFocus={e => e.target.style.borderColor = '#6B5CFF'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  color: '#94A3B8',
                  fontSize: 18
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              background: loading ? '#8B7FE8' : 'linear-gradient(135deg, #6B5CFF, #4845D2)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ fontSize: 13, color: '#64748B' }}>o continuar con</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* OAuth */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          <button
            onClick={() => handleOAuth('Google')}
            disabled={loading}
            style={{
              padding: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              color: '#F1F5F9',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(15, 23, 42, 0.9)'}
            onMouseLeave={e => e.target.style.background = 'rgba(15, 23, 42, 0.6)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </button>

          <button
            onClick={() => handleOAuth('Apple')}
            disabled={loading}
            style={{
              padding: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              color: '#F1F5F9',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(15, 23, 42, 0.9)'}
            onMouseLeave={e => e.target.style.background = 'rgba(15, 23, 42, 0.6)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Apple
          </button>
        </div>

        {/* Sign up */}
        <p style={{ textAlign: 'center', fontSize: 14, color: '#94A3B8', marginBottom: 20 }}>
          ¿No tenés cuenta?{' '}
          <a href="/registro" style={{ color: '#6B5CFF', fontWeight: 600, textDecoration: 'none' }}>
            Registrate
          </a>
        </p>

        {/* Footer links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <a href="/faq" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none' }}>FAQ</a>
          <span style={{ color: '#334155' }}>·</span>
          <a href="/terminos" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none' }}>Términos</a>
          <span style={{ color: '#334155' }}>·</span>
          <a href="/privacidad" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none' }}>Privacidad</a>
        </div>
      </div>
    </div>
  )
}
