import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../services/api.js'

export default function GodModeLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const r = await apiFetch('/godmode/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuthRedirect: true,
      })
      localStorage.setItem('token', r.token)
      localStorage.setItem('user', JSON.stringify(r.user))
      navigate('/vault')
    } catch (e2) { setErr(e2.message) }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 380, padding: 20 }}>
        <h2 style={{ marginBottom: 10 }}>Secure Access</h2>
        <input className="form-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="form-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ marginTop: 10 }} />
        {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  )
}
