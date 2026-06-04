import { useEffect, useState, useCallback, useRef } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const TIPOS = ['GENERAL','URGENTE','PASTORAL','MINISTERIO','EVENTO','OTRO']
const TCOLOR = {GENERAL:'#2563EB',URGENTE:'#DC2626',PASTORAL:'#16A34A',MINISTERIO:'#7C3AED',EVENTO:'#D97706',OTRO:'#64748B'}
const TBG    = {GENERAL:'#DBEAFE',URGENTE:'#FEE2E2',PASTORAL:'#DCFCE7',MINISTERIO:'#EDE9FE',EVENTO:'#FEF3C7',OTRO:'#F3F4F6'}
const DEST_LABEL = {TODOS:'Todos',PASTOR_GENERAL:'Pastores',PASTOR_CULTO:'Pastor culto',CONSOLIDACION:'Consolidación',STAFF:'Staff',LIDER:'Líderes'}

// Variables disponibles para plantillas
const VARS = [
  { key:'{nombre}',   label:'Nombre',   ejemplo:'Juan García' },
  { key:'{fecha}',    label:'Fecha',    ejemplo:'15 de junio' },
  { key:'{evento}',   label:'Evento',   ejemplo:'Retiro anual' },
  { key:'{lugar}',    label:'Lugar',    ejemplo:'Salón principal' },
  { key:'{hora}',     label:'Hora',     ejemplo:'18:00 hs' },
  { key:'{iglesia}',  label:'Iglesia',  ejemplo:'Nombre de la iglesia' },
]

const FORM_EMPTY = { titulo:'', contenido:'', tipo:'GENERAL', destinatarios:'TODOS', fijado:0, scheduledAt:'' }

// Formatea una fecha local a datetime-local input value
function toLocalDatetimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Muestra badge de programado
function ScheduledBadge({ scheduledAt }) {
  if (!scheduledAt) return null
  const d = new Date(scheduledAt)
  return (
    <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'#FEF3C7',color:'#92400E',fontWeight:600,display:'inline-flex',alignItems:'center',gap:4}}>
      🕐 Programado: {d.toLocaleDateString('es-AR',{day:'numeric',month:'short'})} {d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}
    </span>
  )
}

export default function Comunicados() {
  const user = getUser()
  const canCreate = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(user?.rol)
  const contentRef = useRef(null)

  const [data, setData]         = useState([])
  const [programados, setProgramados] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(FORM_EMPTY)
  const [msg, setMsg]           = useState(null)
  const [expandido, setExpandido]     = useState(null)
  const [confirmArch, setConfirmArch] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [showProgramados, setShowProgramados] = useState(false)
  const [preview, setPreview]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await apiFetch(`/comunicados?page=${page}&limit=15`)
      setData(r.data||[]); setTotal(r.total||0); setPages(r.pages||1)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [page])

  const loadProgramados = useCallback(async () => {
    if (!canCreate) return
    try { setProgramados(await apiFetch('/comunicados/programados') || []) } catch {}
  }, [canCreate])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadProgramados() }, [loadProgramados])

  // Insertar variable en el textarea en la posición del cursor
  function insertarVariable(varKey) {
    const el = contentRef.current
    if (!el) return setForm(f => ({...f, contenido: f.contenido + varKey}))
    const start = el.selectionStart
    const end   = el.selectionEnd
    const nuevo = form.contenido.slice(0, start) + varKey + form.contenido.slice(end)
    setForm(f => ({...f, contenido: nuevo}))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + varKey.length, start + varKey.length) })
  }

  // Preview con variables reemplazadas por ejemplos
  function previsualizarContenido(texto) {
    return VARS.reduce((t, v) => t.replaceAll(v.key, `[${v.ejemplo}]`), texto || '')
  }

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      const body = {
        ...form,
        fijado: Number(form.fijado),
        scheduledAt: form.scheduledAt || null,
      }
      await apiFetch('/comunicados', { method:'POST', body: JSON.stringify(body) })
      const esProgramado = !!form.scheduledAt && new Date(form.scheduledAt) > new Date()
      toast.success(esProgramado ? 'Comunicado programado correctamente' : 'Comunicado publicado')
      setModal(false); setForm(FORM_EMPTY); load(); loadProgramados()
    } catch(err) { setMsg({type:'error', text:err.message}) }
  }

  async function archivar() {
    if (!confirmArch) return
    try { await apiFetch(`/comunicados/${confirmArch}`,{method:'DELETE'}); setConfirmArch(null); load(); loadProgramados() }
    catch(e) { toast.error(e.message) }
  }

  const f = (k,v) => setForm(p => ({...p,[k]:v}))
  const esProgramadoFuturo = form.scheduledAt && new Date(form.scheduledAt) > new Date()

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Comunicados /> Comunicados</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>Novedades internas del equipo</p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {canCreate && programados.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowProgramados(v => !v)}
                style={{position:'relative'}}>
                🕐 Programados
                <span style={{position:'absolute',top:-6,right:-6,background:'var(--c-warning)',color:'#fff',borderRadius:20,fontSize:10,padding:'1px 5px',fontWeight:700}}>
                  {programados.length}
                </span>
              </button>
            )}
            {canCreate && (
              <button className="btn btn-primary" onClick={() => { setModal(true); setMsg(null); setPreview(false) }}>
                + Nuevo
              </button>
            )}
          </div>
        </div>

        {/* Panel de programados */}
        {showProgramados && canCreate && (
          <div className="card" style={{marginBottom:16,border:'1px solid var(--c-warning-bg)',background:'#FFFBEB'}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:'#92400E'}}>🕐 Comunicados programados ({programados.length})</div>
            {programados.map(c => (
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(0,0,0,.05)',fontSize:13}}>
                <div>
                  <strong>{c.titulo}</strong>
                  <ScheduledBadge scheduledAt={c.scheduledAt} />
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmArch(c.id)} style={{color:'var(--text-muted)'}}>Cancelar</button>
              </div>
            ))}
          </div>
        )}

        {loading
          ? <div className="empty"><p>Cargando...</p></div>
          : error
          ? <div className="alert alert-error" style={{margin:'0 0 16px'}}>{error}</div>
          : data.length === 0
          ? <div className="empty"><div className="empty-icon"><Icons.Comunicados /></div><p>Sin comunicados publicados</p></div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {data.map(c => (
                <div key={c.id} className="card" style={{padding:'16px',borderLeft:`3px solid ${TCOLOR[c.tipo]||'#2563EB'}`}}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start',justifyContent:'space-between'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
                        {c.fijado && <span style={{fontSize:11,fontWeight:700,color:'var(--c-warning)'}}>📌 FIJADO</span>}
                        <span style={{padding:'2px 8px',borderRadius:3,fontSize:11,fontWeight:600,background:TBG[c.tipo],color:TCOLOR[c.tipo]}}>{c.tipo}</span>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{c.createdAt?.slice(0,10)} · {c.autorNombre}</span>
                        {c.destinatarios && c.destinatarios !== 'TODOS' && (
                          <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:'var(--bg-2)',color:'var(--text-muted)'}}>→ {DEST_LABEL[c.destinatarios]||c.destinatarios}</span>
                        )}
                      </div>
                      <h3 style={{fontSize:15,fontWeight:700,margin:'0 0 6px'}}>{c.titulo}</h3>
                      <p style={{fontSize:13,color:'var(--text-muted)',margin:0,lineHeight:1.6,overflow:'hidden',maxHeight:expandido===c.id?'none':'3.2em'}}>
                        {c.contenido}
                      </p>
                      {c.contenido?.length > 120 && (
                        <button onClick={() => setExpandido(expandido===c.id?null:c.id)}
                          style={{background:'none',border:'none',color:'var(--primary)',fontSize:12,cursor:'pointer',padding:'4px 0',fontWeight:600}}>
                          {expandido===c.id ? 'Ver menos ↑' : 'Ver más ↓'}
                        </button>
                      )}
                    </div>
                    {(c.userId===user?.id || user?.rol==='PASTOR_GENERAL') && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmArch(c.id)}
                        style={{flexShrink:0,color:'var(--text-muted)',minWidth:88}}>
                        Archivar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
        }

        {pages > 1 && (
          <div className="pagination">
            <span className="pag-info">Pág {page}/{pages} · {total}</span>
            <button className="pag-btn" disabled={page===1} onClick={() => setPage(p => p-1)}>←</button>
            <button className="pag-btn" disabled={page===pages} onClick={() => setPage(p => p+1)}>→</button>
          </div>
        )}

        {/* ── Modal nuevo comunicado ── */}
        {modal && (
          <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
            <div className="modal" style={{maxWidth:560}}>
              <div className="modal-header">
                <h3 className="modal-title"><Icons.Comunicados /> Nuevo comunicado</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>×</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

                  <div className="form-group" style={{margin:0}}>
                    <label>Título *</label>
                    <input name="titulo" className="form-input" value={form.titulo} onChange={e=>f('titulo',e.target.value)} required />
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div className="form-group" style={{margin:0}}>
                      <label>Tipo</label>
                      <select name="tipo" className="form-input" value={form.tipo} onChange={e=>f('tipo',e.target.value)}>
                        {TIPOS.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{margin:0}}>
                      <label>Para</label>
                      <select name="destinatarios" className="form-input" value={form.destinatarios} onChange={e=>f('destinatarios',e.target.value)}>
                        {['TODOS','PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF','LIDER'].map(d=><option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Variables dinámicas */}
                  <div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:5,fontWeight:600}}>VARIABLES — clic para insertar en el texto</div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {VARS.map(v => (
                        <button key={v.key} type="button"
                          onClick={() => insertarVariable(v.key)}
                          style={{fontSize:11,padding:'3px 9px',borderRadius:20,border:'1px solid var(--border)',background:'var(--bg-2)',color:'var(--text)',cursor:'pointer',fontFamily:'monospace'}}>
                          {v.key}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contenido + toggle preview */}
                  <div className="form-group" style={{margin:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <label style={{margin:0}}>Contenido *</label>
                      <button type="button" onClick={() => setPreview(v=>!v)}
                        style={{fontSize:11,background:'none',border:'none',color:'var(--primary)',cursor:'pointer',padding:0,fontWeight:600}}>
                        {preview ? '✏️ Editar' : '👁 Vista previa'}
                      </button>
                    </div>
                    {preview ? (
                      <div style={{minHeight:100,padding:'10px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-2)',fontSize:13,color:'var(--text)',lineHeight:1.6,whiteSpace:'pre-wrap'}}>
                        {previsualizarContenido(form.contenido) || <span style={{color:'var(--text-muted)'}}>Sin contenido</span>}
                      </div>
                    ) : (
                      <textarea ref={contentRef} name="contenido" className="form-input" rows={5}
                        value={form.contenido}
                        onChange={e => f('contenido', e.target.value)}
                        placeholder="Podés usar {nombre}, {fecha}, {evento}, {lugar}, {hora}, {iglesia} como variables..." required />
                    )}
                  </div>

                  {/* Programación */}
                  <div className="form-group" style={{margin:0}}>
                    <label>Programar publicación <span style={{fontSize:11,color:'var(--text-muted)',fontWeight:400}}>(opcional — dejar vacío para publicar ahora)</span></label>
                    <input type="datetime-local" className="form-input"
                      value={form.scheduledAt}
                      min={new Date(Date.now()+60000).toISOString().slice(0,16)}
                      onChange={e => f('scheduledAt', e.target.value)} />
                    {esProgramadoFuturo && (
                      <p style={{fontSize:11,color:'#92400E',marginTop:4,background:'#FEF3C7',padding:'5px 8px',borderRadius:6}}>
                        🕐 Se publicará el {new Date(form.scheduledAt).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})} a las {new Date(form.scheduledAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}
                      </p>
                    )}
                  </div>

                  <label style={{display:'flex',gap:10,alignItems:'center',cursor:'pointer',fontSize:13,fontWeight:400}}>
                    <input name="fijado" type="checkbox" checked={!!form.fijado} onChange={e=>f('fijado',e.target.checked?1:0)} style={{width:16,height:16,accentColor:'var(--primary)'}} />
                    Fijar comunicado al tope de la lista
                  </label>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">
                    {esProgramadoFuturo ? '🕐 Programar' : 'Publicar ahora'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      <ConfirmModal
        open={!!confirmArch} onClose={() => setConfirmArch(null)} onConfirm={archivar}
        title="¿Archivar comunicado?"
        message="El comunicado dejará de aparecer en la lista."
        confirmLabel="Archivar" cancelLabel="Cancelar"
      />
    </div>
  )
}
