import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'

const TIPOS_META = {
  ALABANZA:        { emoji:'🎸', label:'Alabanza / Música',         color:'#6B5CFF' },
  SONIDO:          { emoji:'🎚️', label:'Sonido / Audio',            color:'#10B981' },
  PROYECCION:      { emoji:'📽️', label:'Proyección / Multimedia',   color:'#3B82F6' },
  UJIERES:         { emoji:'🤝', label:'Ujieres / Bienvenida',      color:'#F59E0B' },
  NINOS:           { emoji:'🧒', label:'Niños',                     color:'#EF4444' },
  JUVENTUD:        { emoji:'⚡', label:'Juventud',                   color:'#8B5CF6' },
  EVANGELISMO:     { emoji:'🌍', label:'Evangelismo',               color:'#EC4899' },
  CONSOLIDACION_MIN:{ emoji:'🌱', label:'Consolidación',            color:'#14B8A6' },
  VOLUNTARIADO:    { emoji:'🙌', label:'Voluntariado / Staff',      color:'#F97316' },
  COMUNICACIONES:  { emoji:'📣', label:'Comunicaciones / Redes',    color:'#06B6D4' },
  ADMINISTRACION:  { emoji:'🗂️', label:'Administración',           color:'#64748B' },
  ORACION_CUIDADO: { emoji:'🙏', label:'Oración / Cuidado pastoral',color:'#A78BFA' },
  EVENTOS_CAMPANAS:{ emoji:'🎪', label:'Eventos / Campañas',        color:'#FB7185' },
  MANTENIMIENTO:   { emoji:'🔧', label:'Mantenimiento / Limpieza',  color:'#78716C' },
  SEGURIDAD:       { emoji:'🦺', label:'Seguridad / Primeros auxilios', color:'#DC2626' },
  PERSONALIZADO:   { emoji:'⚙️', label:'Ministerio personalizado',  color:'#6B7280' },
}

const MODAL_TIPOS = Object.entries(TIPOS_META).map(([k,v]) => ({ value:k, ...v }))

function ModalNuevoMinisterio({ onClose, onCreado }) {
  const [tipo, setTipo] = useState('ALABANZA')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const meta = TIPOS_META[tipo] || TIPOS_META.PERSONALIZADO

  useEffect(() => {
    if (!nombre || MODAL_TIPOS.find(t => t.label === nombre)) {
      setNombre(meta.label)
    }
  }, [tipo])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Nombre requerido')
    setLoading(true)
    try {
      const m = await apiFetch('/ministerios', {
        method:'POST',
        body: JSON.stringify({ tipo, nombre:nombre.trim(), descripcion, icono:meta.emoji, color:meta.color })
      })
      toast.success(`${meta.emoji} ${m.nombre} creado`)
      onCreado(m)
    } catch(e) {
      toast.error(e.message || 'Error al crear ministerio')
    } finally { setLoading(false) }
  }

  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <span style={{fontSize:32}}>{meta.emoji}</span>
          <div>
            <h2 style={{margin:0,color:'var(--text)',fontSize:18,fontWeight:700}}>Nuevo ministerio</h2>
            <p style={{margin:0,color:'var(--text-muted)',fontSize:13}}>Configurá el tipo y nombre</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={S.label}>Tipo de ministerio</label>
          <div style={S.tiposGrid}>
            {MODAL_TIPOS.map(t => (
              <button type="button" key={t.value}
                onClick={() => setTipo(t.value)}
                style={{
                  ...S.tipoBtn,
                  borderColor: tipo===t.value ? t.color : 'var(--border)',
                  background: tipo===t.value ? t.color+'18' : 'transparent',
                  color: tipo===t.value ? t.color : 'var(--text-2)',
                }}>
                <span style={{fontSize:20}}>{t.emoji}</span>
                <span style={{fontSize:11,fontWeight:600,lineHeight:1.2}}>{t.label.split('/')[0].trim()}</span>
              </button>
            ))}
          </div>

          <label style={S.label}>Nombre</label>
          <input value={nombre} onChange={e=>setNombre(e.target.value)} style={S.input}
            placeholder="Ej: Ministerio de Alabanza" autoFocus />

          <label style={S.label}>Descripción (opcional)</label>
          <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)}
            style={{...S.input, height:72, resize:'vertical'}}
            placeholder="Breve descripción del ministerio..." />

          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <button type="button" onClick={onClose} style={S.btnSec}>Cancelar</button>
            <button type="submit" disabled={loading} style={{
              ...S.btnPrimary, background:meta.color, opacity:loading?.7:1
            }}>
              {loading ? 'Creando...' : `Crear ${meta.emoji}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Ministerios() {
  const [ministerios, setMinisterios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const navigate = useNavigate()

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch('/ministerios')
      setMinisterios(data || [])
    } catch(e) { toast.error('Error cargando ministerios') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function handleCreado(m) {
    setModal(false)
    setMinisterios(prev => [...prev, m])
    navigate(`/ministerios/${m.id}`)
  }

  if (loading) return (
    <div style={S.page}>
      <Menu />
      <main style={S.main}><div style={S.spinner} /></main>
    </div>
  )

  return (
    <div style={S.page}>
      <Menu />
      <main style={S.main}>
        <div style={S.header}>
          <div>
            <h1 style={S.titulo}>🏛️ Ministerios</h1>
            <p style={S.subtitulo}>
              {ministerios.length === 0
                ? 'Todavía no hay ministerios — creá el primero'
                : `${ministerios.length} ministerio${ministerios.length!==1?'s':''} activos`}
            </p>
          </div>
          <button onClick={() => setModal(true)} style={S.btnPrimary}>+ Nuevo ministerio</button>
        </div>

        {ministerios.length === 0 ? (
          <div style={S.empty}>
            <span style={{fontSize:56}}>🏛️</span>
            <h2 style={{color:'var(--text)',marginBottom:8}}>Organizá tu iglesia por ministerios</h2>
            <p style={{color:'var(--text-muted)',maxWidth:480,textAlign:'center',lineHeight:1.6}}>
              Cada ministerio tiene su propio panel, tareas, miembros, checklists y reportes.
              Soporta alabanza, sonido, niños, ujieres y 12 tipos más.
            </p>
            <button onClick={() => setModal(true)} style={{...S.btnPrimary,marginTop:20,padding:'12px 28px'}}>
              Crear primer ministerio
            </button>
          </div>
        ) : (
          <div style={S.grid}>
            {ministerios.map(m => {
              const meta = TIPOS_META[m.tipo] || TIPOS_META.PERSONALIZADO
              const color = m.color || meta.color
              const icono = m.icono || meta.emoji
              return (
                <div key={m.id} style={{...S.card, borderTopColor:color}}
                  onClick={() => navigate(`/ministerios/${m.id}`)}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:12}}>
                    <div style={{...S.cardIcono, background:color+'20', border:`1.5px solid ${color}40`}}>
                      <span style={{fontSize:22}}>{icono}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <h3 style={S.cardNombre}>{m.nombre}</h3>
                      <span style={{...S.tipoBadge, color, background:color+'15'}}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  {m.descripcion && (
                    <p style={S.cardDesc}>{m.descripcion}</p>
                  )}
                  <div style={S.cardStats}>
                    <span style={S.stat}>👥 {m.totalMiembros ?? 0} miembros</span>
                    <span style={{...S.stat, color: (m.tareasPendientes??0)>0 ? 'var(--c-warning)' : 'var(--text-muted)'}}>
                      ✓ {m.tareasPendientes ?? 0} tareas
                    </span>
                  </div>
                  <div style={S.cardArrow}>Ver panel →</div>
                </div>
              )
            })}
          </div>
        )}

        {modal && (
          <ModalNuevoMinisterio
            onClose={() => setModal(false)}
            onCreado={handleCreado}
          />
        )}
      </main>
    </div>
  )
}

const S = {
  page:    { display:'flex', minHeight:'100vh', background:'var(--bg)', color:'var(--text)' },
  main:    { flex:1, padding:'32px 28px', maxWidth:1100, margin:'0 auto', width:'100%' },
  header:  { display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:28 },
  titulo:  { margin:0, fontSize:24, fontWeight:800, color:'var(--text)' },
  subtitulo:{ margin:'4px 0 0', fontSize:14, color:'var(--text-muted)' },
  grid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 },
  card:    { background:'var(--bg-2)', border:'1px solid var(--border)', borderTop:'3px solid #ccc',
             borderRadius:14, padding:18, cursor:'pointer', transition:'box-shadow .15s,transform .15s',
             '&:hover':{ boxShadow:'0 4px 20px rgba(0,0,0,.08)', transform:'translateY(-2px)' } },
  cardIcono: { width:46, height:46, borderRadius:12, display:'flex', alignItems:'center',
               justifyContent:'center', flexShrink:0 },
  cardNombre:{ margin:0, fontSize:15, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap',
               overflow:'hidden', textOverflow:'ellipsis' },
  cardDesc:  { margin:'0 0 12px', fontSize:12, color:'var(--text-muted)', lineHeight:1.5,
               display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' },
  cardStats: { display:'flex', gap:12, marginBottom:10 },
  stat:      { fontSize:12, color:'var(--text-muted)', fontWeight:500 },
  cardArrow: { fontSize:12, color:'var(--c-accent,#6B5CFF)', fontWeight:600, textAlign:'right' },
  tipoBadge: { display:'inline-block', fontSize:11, fontWeight:600, padding:'2px 8px',
               borderRadius:6, marginTop:3 },
  empty:   { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
             minHeight:400, textAlign:'center' },
  spinner: { width:36, height:36, border:'3px solid var(--border)',
             borderTopColor:'var(--c-accent,#6B5CFF)', borderRadius:'50%',
             animation:'spin 1s linear infinite', margin:'120px auto' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000,
             display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
  modal:   { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:18,
             padding:28, width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto' },
  tiposGrid:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:18 },
  tipoBtn: { display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 6px',
             border:'1.5px solid', borderRadius:10, cursor:'pointer', transition:'all .15s',
             background:'transparent', fontSize:13 },
  label:   { display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)',
             textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6 },
  input:   { width:'100%', padding:'10px 12px', fontSize:14, background:'var(--bg-2)',
             border:'1px solid var(--border)', borderRadius:10, color:'var(--text)',
             outline:'none', boxSizing:'border-box', marginBottom:14 },
  btnPrimary:{ padding:'10px 20px', background:'#6B5CFF', color:'#fff', border:'none',
               borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:14 },
  btnSec:  { padding:'10px 20px', background:'var(--bg-2)', color:'var(--text)',
             border:'1px solid var(--border)', borderRadius:10, cursor:'pointer', fontSize:14 },
}
