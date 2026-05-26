import { useState, useCallback, useEffect, useRef } from 'react'

let _listeners = []
let _idSeq = 0

function emit(toast) {
  _listeners.forEach(fn => fn(toast))
}

export const toast = {
  success: (msg, opts) => emit({ id: ++_idSeq, type: 'success', msg, ...opts }),
  error:   (msg, opts) => emit({ id: ++_idSeq, type: 'error',   msg, ...opts }),
  warning: (msg, opts) => emit({ id: ++_idSeq, type: 'warning', msg, ...opts }),
  info:    (msg, opts) => emit({ id: ++_idSeq, type: 'info',    msg, ...opts }),
}

export function useToast() {
  return toast
}

const ICONS = {
  success: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>),
  error: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>),
  warning: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
  info: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>),
}

const STYLES = {
  success: { bg: 'var(--c-success-bg, #EAFBF1)', border: 'var(--c-success-brd, rgba(34,197,94,.25))', icon: 'var(--c-success, #15803D)', bar: '#22C55E' },
  error:   { bg: 'var(--c-error-bg, #FEF2F2)', border: 'var(--c-error-brd, rgba(239,68,68,.25))', icon: 'var(--c-error, #B91C1C)', bar: '#EF4444' },
  warning: { bg: 'var(--c-warning-bg, #FFFBEB)', border: 'var(--c-warning-brd, rgba(245,158,11,.25))', icon: 'var(--c-warning, #92400E)', bar: '#F59E0B' },
  info:    { bg: 'var(--c-info-bg, #EFF6FF)', border: 'var(--c-info-brd, rgba(59,130,246,.25))', icon: 'var(--c-info, #1D4ED8)', bar: '#3B82F6' },
}

const DURATION = 4000

function ToastItem({ item, onRemove }) {
  const s = STYLES[item.type] || STYLES.info
  const [prog, setP] = useState(100)
  const pauseRef = useRef(false)
  const startRef = useRef(Date.now())
  const remainRef = useRef(DURATION)
  const rafRef = useRef(null)
  const [leaving, setLeaving] = useState(false)

  const dismiss = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setLeaving(true)
    setTimeout(() => onRemove(item.id), 280)
  }, [item.id, onRemove])

  useEffect(() => {
    function tick() {
      if (pauseRef.current) { rafRef.current = requestAnimationFrame(tick); return }
      const elapsed = Date.now() - startRef.current
      const left = remainRef.current - elapsed
      if (left <= 0) { dismiss(); return }
      setP((left / DURATION) * 100)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [dismiss])

  const pause = () => {
    pauseRef.current = true
    remainRef.current -= Date.now() - startRef.current
  }
  const resume = () => {
    pauseRef.current = false
    startRef.current = Date.now()
  }

  return (
    <div onMouseEnter={pause} onMouseLeave={resume} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--r, 12px)', boxShadow: 'var(--shadow-md)', minWidth: 280, maxWidth: 360, overflow: 'hidden', transform: leaving ? 'translateX(110%)' : 'translateX(0)', opacity: leaving ? 0 : 1, transition: 'transform 280ms, opacity 280ms', animationName: leaving ? 'none' : 'toast-in', animationDuration: '220ms', animationFillMode: 'both', cursor: 'default' }}>
      <span style={{ color: s.icon, flexShrink: 0, marginTop: 1 }}>{ICONS[item.type]}</span>
      <span style={{ flex: 1, fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)', lineHeight: 1.45, paddingRight: 4 }}>{item.msg}</span>
      <button onClick={dismiss} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, flexShrink: 0, borderRadius: 4, transition: 'color .15s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>×</button>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${prog}%`, background: s.bar, borderRadius: '0 0 0 var(--r, 12px)', transition: 'width 100ms linear' }} />
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = t => setToasts(prev => [...prev, t])
    _listeners.push(handler)
    return () => { _listeners = _listeners.filter(l => l !== handler) }
  }, [])

  const remove = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  return (
    <>
      <style>{`@keyframes toast-in { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @media (max-width: 480px) { .cs-toast-portal { bottom: 16px !important; right: 12px !important; left: 12px !important; width: auto !important; } .cs-toast-portal > div { min-width: unset !important; max-width: unset !important; width: 100% !important; } }`}</style>
      <div className="cs-toast-portal" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, width: 360, pointerEvents: 'none' }}>
        {toasts.map(t => (<div key={t.id} style={{ pointerEvents: 'all' }}><ToastItem item={t} onRemove={remove} /></div>))}
      </div>
    </>
  )
}

export default toast
