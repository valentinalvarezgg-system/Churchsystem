import { useEffect, useState, useCallback } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import { ConfirmModal } from '../components/Modal.jsx'

const ETAPAS = ['IDENTIFICADO','EN_FORMACION','APRENDIZ','ASISTENTE','LIDER']
const ETAPA_COLOR = {
  IDENTIFICADO:'#3B82F6', EN_FORMACION:'#F59E0B', APRENDIZ:'#8B5CF6',
  ASISTENTE:'#EC4899', LIDER:'#22C55E'
}
const ETAPA_LABEL = {
  IDENTIFICADO:'Identificado', EN_FORMACION:'En formación',
  APRENDIZ:'Aprendiz', ASISTENTE:'Asistente', LIDER:'Líder'
}

function ProgressBar({ value, color }) {
  return (
    <div style={{ height:6, background:'var(--bg-2)', borderRadius:3, overflow:'hidden', marginTop:6 }}>
      <div style={{ width:`${value}%`, height:'100%', background:color, borderRadius:3, transition:'width .3s' }} />
    </div>
  )
}

function PipelineCard({ item, onUpdate, onDelete, personas }) {
  const [expanded, setExpanded] = useState(false)
  const color = ETAPA_COLOR[item.etapa] || '#94A3B8'
  const etapaIdx = ETAPAS.indexOf(item.etapa)

  async function toggleCheck(check) {
    try {
      const r = await apiFetch(`/grupos/liderazgo/${item.id}/check/${check.id}`, { method:'PUT' })
      onUpdate()
    } catch(e) { toast.error(e.message) }
  }

  async function avanzarEtapa() {
    if (etapaIdx >= ETAPAS.length - 1) return
    try {
      await apiFetch(`/grupos/liderazgo/${item.id}`, { method:'PUT', body: JSON.stringify({ etapa: ETAPAS[etapaIdx + 1] }) })
      toast.success(`Avanzado a ${ETAPA_LABEL[ETAPAS[etapaIdx + 1]]}`)
      onUpdate()
    } catch(e) { toast.error(e.message) }
  }

  async function cambiarMentor(mentorId) {
    try {
      await apiFetch(`/grupos/liderazgo/${item.id}`, { method:'PUT', body: JSON.stringify({ mentorId: mentorId || null }) })
      onUpdate()
    } catch(e) { toast.error(e.message) }
  }

  return (
    <div style={{ background:'var(--surface)', border:`1px solid var(--border)`, borderTop:`3px solid ${color}`,
      borderRadius:10, padding:'14px', marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>{item.nombre} {item.apellido}</div>
          <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:color+'22', color, fontWeight:700 }}>
              {ETAPA_LABEL[item.etapa]}
            </span>
            {item.grupoNombre && <span style={{ fontSize:11, color:'var(--text-muted)' }}>📍 {item.grupoNombre}</span>}
            {item.mentorNombre && <span style={{ fontSize:11, color:'var(--text-muted)' }}>👤 Mentor: {item.mentorNombre}</span>}
          </div>
          <ProgressBar value={item.progreso} color={color} />
          <span style={{ fontSize:11, color:'var(--text-muted)', marginTop:3, display:'block' }}>{item.progreso}% completado</span>
        </div>
        <div style={{ display:'flex', gap:6, marginLeft:8 }}>
          <button onClick={() => setExpanded(v => !v)}
            style={{ fontSize:11, padding:'4px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-2)', cursor:'pointer', color:'var(--text)' }}>
            {expanded ? '▲ Cerrar' : '▼ Detalle'}
          </button>
          {etapaIdx < ETAPAS.length - 1 && (
            <button onClick={avanzarEtapa}
              style={{ fontSize:11, padding:'4px 10px', borderRadius:8, border:'none', background:color, color:'#fff', cursor:'pointer', fontWeight:600 }}>
              → {ETAPA_LABEL[ETAPAS[etapaIdx + 1]]}
            </button>
          )}
          <button onClick={() => onDelete(item.id)}
            style={{ fontSize:14, padding:'4px 8px', borderRadius:8, border:'1px solid var(--border)', background:'none', cursor:'pointer', color:'var(--c-danger)' }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:12 }}>
          {/* Checklist */}
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:.3 }}>Checklist de madurez</div>
          {(item.checklist || []).map(c => (
            <label key={c.id} style={{ display:'flex', gap:10, alignItems:'center', padding:'5px 0', cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={!!c.completado} onChange={() => toggleCheck(c)}
                style={{ width:16, height:16, accentColor:color, cursor:'pointer' }} />
              <span style={{ textDecoration: c.completado ? 'line-through' : 'none', color: c.completado ? 'var(--text-muted)' : 'var(--text)' }}>
                {c.item}
              </span>
            </label>
          ))}

          {/* Cambiar mentor */}
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Cambiar mentor</div>
            <select style={{ fontSize:12, padding:'5px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', width:'100%' }}
              value={item.mentorId || ''} onChange={e => cambiarMentor(e.target.value)}>
              <option value="">Sin mentor</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
            </select>
          </div>

          {item.notas && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:8, fontStyle:'italic' }}>"{item.notas}"</p>}
        </div>
      )}
    </div>
  )
}

export default function Liderazgo() {
  const [data, setData]         = useState({ rows:[], etapas:[] })
  const [personas, setPersonas] = useState([])
  const [grupos, setGrupos]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [modal, setModal]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [form, setForm]         = useState({ personaId:'', mentorId:'', grupoId:'', etapa:'IDENTIFICADO', notas:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await apiFetch('/grupos/liderazgo') || { rows:[], etapas:[] }) } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch('/personas?limit=200').then(r => setPersonas(r?.data || [])).catch(() => {})
    apiFetch('/grupos').then(g => setGrupos(g||[])).catch(() => {})
  }, [])

  async function guardar() {
    if (!form.personaId) return toast.error('Seleccioná una persona')
    try {
      await apiFetch('/grupos/liderazgo', { method:'POST', body: JSON.stringify(form) })
      toast.success('Agregado al pipeline'); setModal(false)
      setForm({ personaId:'', mentorId:'', grupoId:'', etapa:'IDENTIFICADO', notas:'' })
      load()
    } catch(e) { toast.error(e.message) }
  }

  async function eliminar() {
    if (!confirmDel) return
    try { await apiFetch(`/grupos/liderazgo/${confirmDel}`, { method:'DELETE' }); setConfirmDel(null); load() }
    catch(e) { toast.error(e.message) }
  }

  const rows = filtroEtapa ? data.rows.filter(r => r.etapa === filtroEtapa) : data.rows

  // Stats por etapa
  const porEtapa = ETAPAS.reduce((acc, e) => ({ ...acc, [e]: data.rows.filter(r => r.etapa === e).length }), {})

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title">🌱 Pipeline de liderazgo</h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>Desarrollo y rotación de futuros líderes</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Agregar al pipeline</button>
        </div>

        {/* Kanban header */}
        <div style={{ display:'flex', gap:10, overflowX:'auto', marginBottom:20, paddingBottom:4 }}>
          {ETAPAS.map(e => (
            <div key={e} onClick={() => setFiltroEtapa(filtroEtapa === e ? '' : e)}
              style={{ minWidth:120, padding:'12px 14px', borderRadius:10, cursor:'pointer', textAlign:'center',
                border: filtroEtapa===e ? `2px solid ${ETAPA_COLOR[e]}` : '1px solid var(--border)',
                background: filtroEtapa===e ? ETAPA_COLOR[e]+'15' : 'var(--surface)', transition:'all .2s' }}>
              <div style={{ fontSize:26, fontWeight:800, color:ETAPA_COLOR[e] }}>{porEtapa[e]}</div>
              <div style={{ fontSize:10, fontWeight:700, color:ETAPA_COLOR[e], textTransform:'uppercase', letterSpacing:.3 }}>
                {ETAPA_LABEL[e]}
              </div>
            </div>
          ))}
        </div>

        {loading ? <div className="empty"><p>Cargando...</p></div>
        : rows.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize:48 }}>🌱</div>
            <p>{filtroEtapa ? `Sin personas en etapa ${ETAPA_LABEL[filtroEtapa]}` : 'El pipeline está vacío. Agregá futuros líderes.'}</p>
          </div>
        ) : rows.map(item => (
          <PipelineCard key={item.id} item={item} personas={personas}
            onUpdate={load} onDelete={id => setConfirmDel(id)} />
        ))}

        {/* Modal */}
        {modal && (
          <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">Agregar al pipeline de liderazgo</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>×</button>
              </div>
              <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Persona *</label>
                  <select className="form-input" value={form.personaId} onChange={e => setForm(f=>({...f,personaId:e.target.value}))}>
                    <option value="">— Seleccionar —</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Etapa inicial</label>
                    <select className="form-input" value={form.etapa} onChange={e => setForm(f=>({...f,etapa:e.target.value}))}>
                      {ETAPAS.map(e => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
                    </select>
                  </div>
                  <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Grupo</label>
                    <select className="form-input" value={form.grupoId} onChange={e => setForm(f=>({...f,grupoId:e.target.value}))}>
                      <option value="">Sin grupo</option>
                      {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Mentor</label>
                  <select className="form-input" value={form.mentorId} onChange={e => setForm(f=>({...f,mentorId:e.target.value}))}>
                    <option value="">Sin mentor</option>
                    {personas.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                  </select>
                </div>
                <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Notas</label>
                  <textarea className="form-input" rows={2} value={form.notas} onChange={e => setForm(f=>({...f,notas:e.target.value}))} />
                </div>
              </div>
              <div className="modal-footer" style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px' }}>
                <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardar}>Agregar</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <ConfirmModal open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={eliminar}
        title="¿Eliminar del pipeline?" danger message="Esta persona será removida del pipeline de liderazgo."
        confirmLabel="Eliminar" cancelLabel="Cancelar" />
    </div>
  )
}
