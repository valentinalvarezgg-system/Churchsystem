import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../services/api.js'

export default function BusquedaGlobal({ onClose }) {
  const navigate  = useNavigate()
  const inputRef  = useRef(null)
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(0)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await apiFetch(`/busqueda?q=${encodeURIComponent(query)}&limit=8`)
        setResults(Array.isArray(r) ? r : [])
        setSelected(0)
      } catch { setResults([]) }
      setLoading(false)
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s+1, results.length-1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s-1, 0)) }
      if (e.key === 'Enter' && results[selected]) handleSelect(results[selected])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [results, selected])

  function handleSelect(item) {
    if (item.tipo === 'persona') navigate(`/personas/${item.id}`)
    else if (item.tipo === 'grupo') navigate('/grupos')
    else if (item.tipo === 'culto') navigate('/asistencia')
    onClose()
  }

  const TIPO_ICON  = { persona:'', grupo:'', culto:'', usuario:'' }
  const TIPO_LABEL = { persona:'Persona', grupo:'Grupo', culto:'Culto', usuario:'Usuario' }

  const overlay = (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh', zIndex: 9999,
        animation: 'fadeIn .15s ease',
      }}>
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--surface)',
        border: '1px solid var(--border-med)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        animation: 'slideUp .18s ease',
      }}>
        {/* Input */}
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'14px 16px', borderBottom:'1px solid var(--border)'
        }}>
          <span style={{display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',flexShrink:0}}>
            <Icons.Search />
          </span>
          <input
            name="search" id="busqueda-global"
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar personas, grupos, cultos..."
            style={{
              flex:1, border:'none', outline:'none', fontSize:15,
              background:'transparent', color:'var(--text)', fontFamily:'inherit'
            }}
          />
          {loading && <span style={{fontSize:12, color:'var(--text-muted)'}}>…</span>}
          <kbd onClick={onClose} style={{
            fontSize:11, padding:'2px 7px', borderRadius:4, cursor:'pointer',
            background:'var(--bg)', border:'1px solid var(--border-med)',
            color:'var(--text-muted)'
          }}>Esc</kbd>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div style={{maxHeight:360, overflowY:'auto'}}>
            {results.map((item, i) => (
              <div
                key={`${item.tipo}-${item.id}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'11px 16px', cursor:'pointer',
                  background: i === selected ? 'var(--primary-soft)' : 'transparent',
                  borderBottom:'1px solid var(--border)',
                  transition:'background .1s',
                }}
              >
                <span style={{
                  width:32, height:32, borderRadius:'var(--r)',
                  background: i === selected ? 'var(--primary)' : 'var(--bg)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:15, flexShrink:0, transition:'background .1s',
                  color: i === selected ? 'var(--surface)' : 'inherit',
                }}>
                  {TIPO_ICON[item.tipo] || ''}
                </span>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{
                    fontSize:14, fontWeight:600, color:'var(--text)',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'
                  }}>
                    {item.nombre}{item.apellido ? ` ${item.apellido}` : ''}
                  </div>
                  {item.detalle && (
                    <div style={{fontSize:11, color:'var(--text-muted)', marginTop:1}}>
                      {item.detalle}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:3,
                  background:'var(--bg)', color:'var(--text-muted)',
                  border:'1px solid var(--border)', flexShrink:0,
                }}>
                  {TIPO_LABEL[item.tipo] || item.tipo}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Sin resultados */}
        {query.length >= 2 && !loading && results.length === 0 && (
          <div style={{padding:'28px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13}}>
            Sin resultados para <strong>"{query}"</strong>
          </div>
        )}

        {/* Hint */}
        {query.length < 2 && (
          <div style={{padding:'14px 16px', display:'flex', gap:16, flexWrap:'wrap'}}>
            {[['↑↓','Navegar'],['↵','Abrir'],['Esc','Cerrar']].map(([key, label]) => (
              <div key={key} style={{display:'flex', gap:6, alignItems:'center', fontSize:12, color:'var(--text-muted)'}}>
                <kbd style={{padding:'2px 7px', borderRadius:3, background:'var(--bg)', border:'1px solid var(--border)', fontSize:11}}>{key}</kbd>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
