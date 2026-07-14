import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { apiFetch, getStoredContext } from '../services/api.js'
import { toast } from './Toast.jsx'

const COPY = {
  es: {
    title:'Reportar un problema', subtitle:'Describí lo que pasó y te contactamos a la brevedad',
    required:'Escribí una descripción del problema', sent:'Reporte enviado. ¡Gracias!',
    failed:'No se pudo enviar. Intentá de nuevo.', cancel:'Cancelar', sending:'Enviando…',
    send:'Enviar reporte', what:'¿Qué pasó?', placeholder:'Ejemplo: Al guardar una persona nueva, aparece error 500 y no se guarda',
    note:'Se enviará automáticamente la URL actual y tu navegador para ayudarnos a reproducir el problema.',
  },
  pt: {
    title:'Reportar um problema', subtitle:'Descreva o que aconteceu e entraremos em contato em breve',
    required:'Escreva uma descrição do problema', sent:'Relatório enviado. Obrigado!',
    failed:'Não foi possível enviar. Tente novamente.', cancel:'Cancelar', sending:'Enviando…',
    send:'Enviar relatório', what:'O que aconteceu?', placeholder:'Exemplo: Ao salvar uma nova pessoa, aparece erro 500 e nada é salvo',
    note:'A URL atual e o seu navegador serão enviados automaticamente para nos ajudar a reproduzir o problema.',
  },
  en: {
    title:'Report a problem', subtitle:'Describe what happened and we will contact you shortly',
    required:'Write a description of the problem', sent:'Report sent. Thank you!',
    failed:'Could not send it. Try again.', cancel:'Cancel', sending:'Sending…',
    send:'Send report', what:'What happened?', placeholder:'Example: When saving a new person, error 500 appears and nothing is saved',
    note:'The current URL and your browser will be sent automatically to help us reproduce the problem.',
  },
}

export default function BugReporter() {
  const [abierto, setAbierto] = useState(false)
  const [desc, setDesc] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [lang, setLang] = useState(() => (getStoredContext().lang || 'es').slice(0, 2))
  const t = key => COPY[lang]?.[key] || COPY.es[key] || key

  useEffect(() => {
    const syncLang = () => setLang((getStoredContext().lang || 'es').slice(0, 2))
    window.addEventListener('church:data-changed', syncLang)
    window.addEventListener('storage', syncLang)
    return () => {
      window.removeEventListener('church:data-changed', syncLang)
      window.removeEventListener('storage', syncLang)
    }
  }, [])

  const enviar = async () => {
    if (!desc.trim()) { toast.warning(t('required')); return }
    setEnviando(true)
    try {
      await apiFetch('/bug-report', { method: 'POST', body: JSON.stringify({ descripcion: desc, url: window.location.href, userAgent: navigator.userAgent }) })
      toast.success(t('sent'))
      setAbierto(false)
      setDesc('')
    } catch (e) {
      toast.error(t('failed'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button className="bug-reporter-btn" onClick={() => setAbierto(true)} aria-label={t('title')} title={t('title')}>?</button>
      <Modal open={abierto} onClose={() => setAbierto(false)} title={t('title')} subtitle={t('subtitle')} size="md" footer={<><button className="btn btn-ghost" onClick={() => setAbierto(false)} disabled={enviando}>{t('cancel')}</button><button className="btn btn-primary" onClick={enviar} disabled={enviando}>{enviando ? <span style={{display:'flex',alignItems:'center',gap:6}}><span className="spinner-xs" />{t('sending')}</span> : t('send')}</button></>}>
        <div className="form-group">
          <label htmlFor="bug-desc">{t('what')}</label>
          <textarea id="bug-desc" rows={6} value={desc} onChange={e=>setDesc(e.target.value)} placeholder={t('placeholder')} style={{width:'100%',resize:'vertical'}} />
        </div>
        <p style={{fontSize:13,color:'var(--text-muted)',margin:'12px 0 0'}}>{t('note')}</p>
      </Modal>
      <style>{`.bug-reporter-btn{position:fixed;bottom:14px;right:14px;width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;border:2px solid var(--surface);font-size:18px;font-weight:700;cursor:pointer;box-shadow:var(--shadow-lg);transition:var(--t);z-index:500;display:flex;align-items:center;justify-content:center}.bug-reporter-btn:hover{transform:scale(1.06);box-shadow:0 10px 26px rgba(109,93,251,.3)}.bug-reporter-btn:active{transform:scale(.98)}@media(max-width:640px){.bug-reporter-btn{bottom:78px;right:12px;width:40px;height:40px}}`}</style>
    </>
  )
}
