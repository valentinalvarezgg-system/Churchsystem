import { useEffect, useState, useRef, useCallback } from 'react'
import { apiFetch, getUser } from '../services/api.js'
import { toast } from '../components/Toast.jsx'

const API_BASE = typeof window !== 'undefined'
  ? window.location.origin.replace(/:\d+/, ':4000')
  : 'http://localhost:4000'

export default function ChatGrupo({ grupoId, grupoNombre }) {
  const user = getUser()
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef(null)
  const sseRef    = useRef(null)

  const loadHistorial = useCallback(async () => {
    setLoading(true)
    try { setMensajes(await apiFetch(`/chat/${grupoId}/mensajes`) || []) } catch {}
    setLoading(false)
  }, [grupoId])

  // Conectar SSE
  useEffect(() => {
    loadHistorial()
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : ''
    const evtSource = new EventSource(
      `${API_BASE}/api/chat/${grupoId}/stream?token=${token}`
    )
    sseRef.current = evtSource

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.tipo === 'MENSAJE') {
          setMensajes(prev => [...prev, data.mensaje])
        }
      } catch {}
    }

    evtSource.onerror = () => {} // Reconecta automáticamente

    return () => { evtSource.close() }
  }, [grupoId, loadHistorial])

  // Auto-scroll al fondo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [mensajes])

  async function enviar(e) {
    e.preventDefault()
    if (!texto.trim() || enviando) return
    const textoGuardado = texto.trim()
    setTexto('')
    setEnviando(true)
    try {
      await apiFetch(`/chat/${grupoId}/mensajes`, {
        method: 'POST',
        body: JSON.stringify({ texto: textoGuardado })
      })
    } catch(err) {
      toast.error(err.message)
      setTexto(textoGuardado) // restaurar si falló
    }
    setEnviando(false)
  }

  function formatHora(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const hoy = new Date()
    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
    }
    return d.toLocaleDateString('es-AR', { day:'numeric', month:'short' }) + ' ' +
           d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
  }

  const miId = user?.id

  return (
    <div style={{ display:'flex', flexDirection:'column', height:420 }}>
      {/* Header */}
      <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text-muted)', display:'flex', justifyContent:'space-between' }}>
        <span>💬 Chat — {grupoNombre}</span>
        <span>{mensajes.length} mensajes</span>
      </div>

      {/* Mensajes */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px', display:'flex', flexDirection:'column', gap:8 }}>
        {loading ? (
          <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Cargando...</p>
        ) : mensajes.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
            <p>Nadie escribió aún. ¡Sé el primero!</p>
          </div>
        ) : mensajes.map((m, i) => {
          const esPropio = Number(m.userId) === Number(miId)
          const prevMsg = mensajes[i - 1]
          const mismoDia = prevMsg && new Date(m.createdAt).toDateString() === new Date(prevMsg.createdAt).toDateString()
          const mismoAutor = prevMsg && prevMsg.userId === m.userId && mismoDia

          return (
            <div key={m.id}>
              {/* Separador de día */}
              {(!mismoDia || i === 0) && (
                <div style={{ textAlign:'center', fontSize:10, color:'var(--text-muted)', margin:'8px 0', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:'var(--border)' }} />
                  {new Date(m.createdAt).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}
                  <div style={{ flex:1, height:1, background:'var(--border)' }} />
                </div>
              )}
              <div style={{ display:'flex', justifyContent: esPropio ? 'flex-end' : 'flex-start', marginBottom:2 }}>
                <div style={{ maxWidth:'75%' }}>
                  {/* Nombre autor (solo si cambia) */}
                  {!esPropio && !mismoAutor && (
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--primary)', marginBottom:2, paddingLeft:4 }}>
                      {m.autorNombre || 'Usuario'}
                    </div>
                  )}
                  <div style={{
                    padding:'8px 12px', borderRadius: esPropio ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: esPropio ? 'var(--primary)' : 'var(--bg-2)',
                    color: esPropio ? '#fff' : 'var(--text)',
                    fontSize:13, lineHeight:1.5, wordBreak:'break-word'
                  }}>
                    {m.texto}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2, textAlign: esPropio ? 'right' : 'left', paddingLeft: esPropio ? 0 : 4 }}>
                    {formatHora(m.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={enviar} style={{ padding:'10px 12px', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribí un mensaje..."
          style={{ flex:1, padding:'8px 12px', borderRadius:20, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:13, outline:'none' }}
          disabled={enviando}
          maxLength={1000}
        />
        <button type="submit" disabled={!texto.trim() || enviando}
          style={{ padding:'8px 16px', borderRadius:20, border:'none', background:'var(--primary)', color:'#fff', fontSize:13, cursor:'pointer', fontWeight:600, opacity: texto.trim() ? 1 : 0.5 }}>
          ↑
        </button>
      </form>
    </div>
  )
}
