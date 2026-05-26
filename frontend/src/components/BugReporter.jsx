import { useState } from 'react'
import Modal from './Modal.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from './Toast.jsx'

export default function BugReporter() {
  const [abierto, setAbierto] = useState(false)
  const [desc, setDesc] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    if (!desc.trim()) { toast.warning('Escribí una descripción del problema'); return }
    setEnviando(true)
    try {
      await apiFetch('/bug-report', { method: 'POST', body: JSON.stringify({ descripcion: desc, url: window.location.href, userAgent: navigator.userAgent }) })
      toast.success('Reporte enviado. ¡Gracias!')
      setAbierto(false)
      setDesc('')
    } catch (e) {
      toast.error('No se pudo enviar. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button className="bug-reporter-btn" onClick={() => setAbierto(true)} aria-label="Reportar un problema" title="Reportar un problema">?</button>
      <Modal open={abierto} onClose={() => setAbierto(false)} title="Reportar un problema" subtitle="Describí lo que pasó y te contactamos a la brevedad" size="md" footer={<><button className="btn btn-ghost" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</button><button className="btn btn-primary" onClick={enviar} disabled={enviando}>{enviando ? <span style={{display:'flex',alignItems:'center',gap:6}}><span className="spinner-xs" />Enviando…</span> : 'Enviar reporte'}</button></>}>
        <div className="form-group">
          <label htmlFor="bug-desc">¿Qué pasó?</label>
          <textarea id="bug-desc" rows={6} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ejemplo: Al guardar una persona nueva, aparece error 500 y no se guarda" style={{width:'100%',resize:'vertical'}} />
        </div>
        <p style={{fontSize:13,color:'var(--text-muted)',margin:'12px 0 0'}}>Se enviará automáticamente la URL actual y tu navegador para ayudarnos a reproducir el problema.</p>
      </Modal>
      <style>{`.bug-reporter-btn{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:var(--primary);color:#fff;border:none;font-size:24px;font-weight:700;cursor:pointer;box-shadow:var(--shadow-lg);transition:var(--t);z-index:500;display:flex;align-items:center;justify-content:center}.bug-reporter-btn:hover{transform:scale(1.08);box-shadow:0 12px 32px rgba(109,93,251,.35)}.bug-reporter-btn:active{transform:scale(.98)}@media(max-width:640px){.bug-reporter-btn{bottom:80px;right:16px;width:48px;height:48px}}`}</style>
    </>
  )
}
