import { useState } from 'react'
import { getApiUrl } from '../services/api.js'

export default function LoginMiembro({ onLogin }) {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [iglesiaToken, setIglesia] = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [mostrarToken, setMostrarToken] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const r = await fetch(`${getApiUrl()}/miembro/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, iglesiaToken: iglesiaToken.trim().toUpperCase() || undefined })
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error || 'Error al iniciar sesión'); setLoading(false); return }
      localStorage.setItem('miembro_token', data.token)
      localStorage.setItem('miembro_persona', JSON.stringify(data.persona))
      onLogin(data.token, data.persona)
    } catch { setError('Error de conexión. Verificá tu red.') }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)', padding: '20px'
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,.3)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#6D5DFB,#8B5CF6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, marginBottom: 12, boxShadow: '0 8px 24px rgba(109,93,251,.35)'
          }}>⛪</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>Portal del Miembro</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Ingresá con tu cuenta personal</p>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 20
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, boxSizing: 'border-box',
                border: '1.5px solid #E2E8F0', outline: 'none', color: '#0F172A', background: '#F8FAFC',
                transition: 'border-color .15s'
              }}
              onFocus={e => e.target.style.borderColor = '#6D5DFB'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Contraseña</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, boxSizing: 'border-box',
                border: '1.5px solid #E2E8F0', outline: 'none', color: '#0F172A', background: '#F8FAFC'
              }}
              onFocus={e => e.target.style.borderColor = '#6D5DFB'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          {/* Token de iglesia — opcional, colapsable */}
          <div>
            <button type="button" onClick={() => setMostrarToken(v => !v)}
              style={{ background: 'none', border: 'none', fontSize: 12, color: '#6D5DFB', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
              {mostrarToken ? '▼' : '▶'} ¿Pertenecés a varias iglesias?
            </button>
            {mostrarToken && (
              <input
                type="text" value={iglesiaToken} onChange={e => setIglesia(e.target.value)}
                placeholder="Código de iglesia (ej: ABC123)"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, marginTop: 6, boxSizing: 'border-box',
                  border: '1.5px solid #E2E8F0', outline: 'none', color: '#0F172A', background: '#F8FAFC',
                  textTransform: 'uppercase', letterSpacing: '1px'
                }}
              />
            )}
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, padding: '13px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 15, fontWeight: 700, color: '#fff',
              background: loading ? '#94A3B8' : 'linear-gradient(135deg,#6D5DFB,#8B5CF6)',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(109,93,251,.4)',
              transition: 'all .2s'
            }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
          Si no tenés cuenta, pedile a tu líder o encargado que active tu acceso.
        </p>
      </div>
    </div>
  )
}
