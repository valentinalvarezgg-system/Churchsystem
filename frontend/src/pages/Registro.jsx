import { useState } from 'react'
import { apiFetch } from '../services/api.js'
import { Link } from 'react-router-dom'

function Registro() {
  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')
  const [telefono, setTelefono]   = useState('')
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [iglesia, setIglesia]     = useState('')
  const [promo, setPromo]         = useState('')
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)

    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch('/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, telefono, password, iglesia, promo }),
      })
      
      if (res.token) {
        localStorage.setItem('token', res.token)
        window.location.href = '/dashboard'
      }
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Crear una cuenta</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
        Completá tus datos para empezar
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-group">
          <label htmlFor="nombre">Nombre completo</label>
          <input 
            type="text" 
            id="nombre" 
            value={nombre} 
            onChange={e => setNombre(e.target.value)} 
            required 
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
        </div>

        <div className="form-group">
          <label htmlFor="telefono">Teléfono</label>
          <input type="tel" id="telefono" value={telefono} onChange={e => setTelefono(e.target.value)} required disabled={loading} />
        </div>

        <div className="form-group">
          <label htmlFor="iglesia">Nombre de tu iglesia</label>
          <input type="text" id="iglesia" value={iglesia} onChange={e => setIglesia(e.target.value)} required disabled={loading} />
        </div>

        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} />
          </div>
          <div className="form-group">
            <label htmlFor="password2">Repetir contraseña</label>
            <input type="password" id="password2" value={password2} onChange={e => setPassword2(e.target.value)} required disabled={loading} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="promo">Código promocional (opcional)</label>
          <input type="text" id="promo" value={promo} onChange={e => setPromo(e.target.value.toUpperCase())} placeholder="Ej: PROMO2026" disabled={loading} />
          <small style={{ color: 'var(--text-muted)', fontSize: 13 }}>Si tenés un código, ingresalo para extender tu período de prueba</small>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 24 }}>
        Al crear una cuenta, aceptás nuestros <Link to="/terminos" style={{ color: 'var(--primary)' }}>Términos y Condiciones</Link>
        {' '}y <Link to="/privacidad" style={{ color: 'var(--primary)' }}>Política de Privacidad</Link>.
      </p>

      <p style={{ textAlign: 'center', marginTop: 24 }}>
        ¿Ya tenés cuenta? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Ingresá acá</Link>
      </p>
    </div>
  )
}

export default Registro
