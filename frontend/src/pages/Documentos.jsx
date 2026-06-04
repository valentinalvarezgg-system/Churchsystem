import { useEffect, useState, useCallback } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const TIPOS_DOC = ['ESTATUTO','ACTA','CONTRATO','LICENCIA','CERTIFICADO','POLIZA','INFORME','OTRO']
const TIPO_COLOR = {
  ESTATUTO:'#6D5DFB', ACTA:'#3B82F6', CONTRATO:'#F59E0B', LICENCIA:'#22C55E',
  CERTIFICADO:'#EC4899', POLIZA:'#EF4444', INFORME:'#8B5CF6', OTRO:'#94A3B8'
}
const TIPO_ICON = {
  ESTATUTO:'📜', ACTA:'📋', CONTRATO:'🤝', LICENCIA:'🎫',
  CERTIFICADO:'🏅', POLIZA:'🛡️', INFORME:'📊', OTRO:'📄'
}

const fmt = iso => iso ? new Date(iso+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}) : '—'
const fmtBytes = b => !b ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`

const FORM0 = { nombre:'', tipo:'OTRO', descripcion:'', fechaVencimiento:'', alerta:false }

export default function Documentos() {
  const user = getUser()
  const canEdit = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(user?.rol)
  const apiBase = (typeof window !== 'undefined' ? window.location.origin : '').replace('/app','') + '/api'

  const [docs, setDocs]           = useState([])
  const [alertas, setAlertas]     = useState(0)
  const [loading, setLoading]     = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(false)
  const [editando, setEditando]   = useState(null)
  const [form, setForm]           = useState(FORM0)
  const [archivo, setArchivo]     = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (filtroTipo) p.set('tipo', filtroTipo)
      if (search)     p.set('search', search)
      const r = await apiFetch(`/documentos?${p}`)
      setDocs(r.documentos || [])
      setAlertas(r.alertasVencimiento || 0)
    } catch(e) { toast.error(e.message) }
    setLoading(false)
  }, [filtroTipo, search])

  useEffect(() => { load() }, [load])

  function openModal(doc = null) {
    setEditando(doc)
    setForm(doc ? { nombre:doc.nombre, tipo:doc.tipo, descripcion:doc.descripcion||'', fechaVencimiento:doc.fechaVencimiento?.slice(0,10)||'', alerta:!!doc.alerta } : FORM0)
    setArchivo(null)
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre?.trim()) return toast.error('El nombre es requerido')
    setGuardando(true)
    try {
      if (editando) {
        await apiFetch(`/documentos/${editando.id}`, { method:'PUT', body: JSON.stringify(form) })
        toast.success('Documento actualizado')
      } else {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
        if (archivo) fd.append('archivo', archivo)
        await fetch(`${apiBase}/documentos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: fd
        }).then(r => { if (!r.ok) throw new Error('Error al subir'); return r.json() })
        toast.success('Documento guardado')
      }
      setModal(false); load()
    } catch(e) { toast.error(e.message) }
    setGuardando(false)
  }

  async function eliminar() {
    if (!confirmDel) return
    try { await apiFetch(`/documentos/${confirmDel.id}`, { method:'DELETE' }); toast.success('Eliminado'); setConfirmDel(null); load() }
    catch(e) { toast.error(e.message) }
  }

  const hoy = new Date(); hoy.setHours(0,0,0,0)
  function diasVencimiento(fechaVencimiento) {
    if (!fechaVencimiento) return null
    const d = new Date(fechaVencimiento + 'T12:00:00')
    return Math.ceil((d - hoy) / 86400000)
  }

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title">📁 Documentos</h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>Estatutos, actas, contratos y archivos institucionales</p>
          </div>
          {canEdit && <button className="btn btn-primary" onClick={() => openModal()}>+ Nuevo documento</button>}
        </div>

        {alertas > 0 && (
          <div style={{ background:'var(--c-warning-bg)', borderRadius:10, padding:'10px 16px', marginBottom:14, fontSize:13, color:'#92400E', display:'flex', gap:8, alignItems:'center' }}>
            ⚠️ <strong>{alertas} documento(s)</strong> con vencimiento en los próximos 30 días.
          </div>
        )}

        {/* Filtros */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <input className="input input-search" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:200 }} />
          <select className="form-input" style={{ width:'auto' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
          </select>
          {(filtroTipo||search) && <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroTipo(''); setSearch('') }}>Limpiar</button>}
        </div>

        {/* Grid de documentos */}
        {loading ? <div className="empty"><p>Cargando...</p></div>
        : docs.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize:48 }}>📁</div>
            <p>Sin documentos. {canEdit ? 'Subí el primero con "+ Nuevo documento".' : ''}</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
            {docs.map(doc => {
              const dias = diasVencimiento(doc.fechaVencimiento)
              const venceBadge = dias === null ? null
                : dias < 0 ? { label:'Vencido', color:'var(--c-danger)', bg:'var(--c-danger-bg)' }
                : dias === 0 ? { label:'Vence hoy', color:'var(--c-danger)', bg:'var(--c-danger-bg)' }
                : dias <= 7 ? { label:`Vence en ${dias}d`, color:'var(--c-warning)', bg:'var(--c-warning-bg)' }
                : dias <= 30 ? { label:`Vence en ${dias}d`, color:'#92400E', bg:'#FEF3C7' }
                : { label:fmt(doc.fechaVencimiento), color:'var(--text-muted)', bg:'var(--bg-2)' }

              return (
                <div key={doc.id} className="card" style={{ padding:'16px', borderTop:`3px solid ${TIPO_COLOR[doc.tipo]||'#94A3B8'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ fontSize:24 }}>{TIPO_ICON[doc.tipo]||'📄'}</span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, lineHeight:1.3 }}>{doc.nombre}</div>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, background:TIPO_COLOR[doc.tipo]+'20', color:TIPO_COLOR[doc.tipo], fontWeight:600 }}>{doc.tipo}</span>
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => openModal(doc)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px', fontSize:11, color:'var(--c-danger)' }} onClick={() => setConfirmDel(doc)}>×</button>
                      </div>
                    )}
                  </div>

                  {doc.descripcion && <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 8px', lineHeight:1.4 }}>{doc.descripcion}</p>}

                  <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                    {venceBadge && (
                      <span style={{ padding:'2px 8px', borderRadius:20, background:venceBadge.bg, color:venceBadge.color, fontWeight:600, width:'fit-content' }}>
                        📅 {venceBadge.label}
                      </span>
                    )}
                    {doc.archivo && <span>📎 {fmtBytes(doc.tamanio)}</span>}
                    <span>Subido por {doc.subioPor || '—'} · {fmt(doc.createdAt)}</span>
                  </div>

                  {doc.archivo && (
                    <a href={`${apiBase}/documentos/${doc.id}/descargar`}
                      style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:10, fontSize:12, fontWeight:600, color:'var(--primary)', textDecoration:'none' }}>
                      ⬇️ Descargar
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
            <div className="modal" style={{ maxWidth:480 }}>
              <div className="modal-header">
                <h3 className="modal-title">{editando ? 'Editar documento' : 'Nuevo documento'}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>×</button>
              </div>
              <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="form-group" style={{ margin:0 }}><label>Nombre *</label><input className="form-input" value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))}/></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="form-group" style={{ margin:0 }}><label>Tipo</label>
                    <select className="form-input" value={form.tipo} onChange={e => setForm(f=>({...f,tipo:e.target.value}))}>
                      {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin:0 }}><label>Fecha de vencimiento</label>
                    <input type="date" className="form-input" value={form.fechaVencimiento} onChange={e => setForm(f=>({...f,fechaVencimiento:e.target.value}))}/>
                  </div>
                </div>
                <div className="form-group" style={{ margin:0 }}><label>Descripción</label>
                  <textarea className="form-input" rows={2} value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))}/>
                </div>
                {!editando && (
                  <div className="form-group" style={{ margin:0 }}><label>Archivo (PDF, imagen, Word — máx. 20MB)</label>
                    <input type="file" onChange={e => setArchivo(e.target.files[0])}
                      style={{ padding:'6px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', width:'100%', fontSize:13 }}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"/>
                  </div>
                )}
                <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.alerta} onChange={e => setForm(f=>({...f,alerta:e.target.checked}))} style={{ accentColor:'var(--primary)', width:16, height:16 }}/>
                  Activar alerta de vencimiento
                </label>
              </div>
              <div className="modal-footer" style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px' }}>
                <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Subir documento'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <ConfirmModal
        open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={eliminar}
        title="¿Eliminar documento?" danger
        message={`"${confirmDel?.nombre}" será eliminado permanentemente.`}
        confirmLabel="Eliminar" cancelLabel="Cancelar"
      />
    </div>
  )
}
