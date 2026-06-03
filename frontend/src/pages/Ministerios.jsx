import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import MinIcons, { MINISTERIO_ICONS } from './MinIcons.jsx'

const TIPOS_META = {
  ALABANZA:          { label:'Alabanza / Música', color:'#6B5CFF', Icon: MinIcons.MusicNote },
  SONIDO:            { label:'Sonido / Audio', color:'#10B981', Icon: MinIcons.Mixer },
  PROYECCION:        { label:'Proyección / Multimedia', color:'#3B82F6', Icon: MinIcons.Monitor },
  UJIERES:           { label:'Ujieres / Bienvenida', color:'#F59E0B', Icon: MinIcons.DoorOpen },
  NINOS:             { label:'Niños', color:'#EF4444', Icon: MinIcons.Child },
  JUVENTUD:          { label:'Juventud', color:'#8B5CF6', Icon: MinIcons.Zap },
  EVANGELISMO:       { label:'Evangelismo', color:'#EC4899', Icon: MinIcons.Globe },
  CONSOLIDACION_MIN: { label:'Consolidación', color:'#14B8A6', Icon: MinIcons.Sprout },
  VOLUNTARIADO:      { label:'Voluntariado / Staff', color:'#F97316', Icon: MinIcons.Handshake },
  COMUNICACIONES:    { label:'Comunicaciones / Redes', color:'#06B6D4', Icon: MinIcons.Megaphone },
  ADMINISTRACION:    { label:'Administración', color:'#64748B', Icon: MinIcons.FolderOpen },
  ORACION_CUIDADO:   { label:'Oración / Cuidado pastoral', color:'#A78BFA', Icon: MinIcons.HandsPraying },
  EVENTOS_CAMPANAS:  { label:'Eventos / Campañas', color:'#FB7185', Icon: MinIcons.Flag },
  MANTENIMIENTO:     { label:'Mantenimiento / Limpieza', color:'#78716C', Icon: MinIcons.Wrench },
  SEGURIDAD:         { label:'Seguridad / Primeros auxilios', color:'#DC2626', Icon: MinIcons.ShieldCross },
  PERSONALIZADO:     { label:'Ministerio personalizado', color:'#6B7280', Icon: MinIcons.Settings2 },
}

const TIPO_LISTA = Object.entries(TIPOS_META).map(([value, meta]) => ({ value, ...meta }))

function ModalNuevo({ onClose, onCreado }) {
  const [tipo, setTipo] = useState('ALABANZA')
  const [nombre, setNombre] = useState(TIPOS_META.ALABANZA.label)
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoNombre, setAutoNombre] = useState(true)

  const meta = TIPOS_META[tipo] || TIPOS_META.PERSONALIZADO
  const IconSel = meta.Icon

  function handleTipo(nextTipo) {
    setTipo(nextTipo)
    if (autoNombre) setNombre(TIPOS_META[nextTipo].label)
  }

  function handleNombre(value) {
    setNombre(value)
    setAutoNombre(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Nombre requerido')
    setLoading(true)
    try {
      const ministerio = await apiFetch('/ministerios', {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          nombre: nombre.trim(),
          descripcion,
          color: meta.color,
        }),
      })
      toast.success(`${nombre.trim()} creado`)
      onCreado(ministerio)
    } catch (err) {
      toast.error(err.message || 'Error al crear ministerio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div style={{ ...S.iconBox, background: `${meta.color}20`, border: `1.5px solid ${meta.color}40` }}>
            <IconSel size={24} color={meta.color} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 18, fontWeight: 800 }}>Nuevo ministerio</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Elegí el tipo y ponele nombre</p>
          </div>
          <button onClick={onClose} style={S.btnClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={S.label}>Tipo de ministerio</label>
          <div style={S.tiposGrid}>
            {TIPO_LISTA.map(tipoItem => {
              const TIcon = tipoItem.Icon
              const selected = tipoItem.value === tipo
              return (
                <button
                  type="button"
                  key={tipoItem.value}
                  onClick={() => handleTipo(tipoItem.value)}
                  style={{
                    ...S.tipoBtn,
                    borderColor: selected ? tipoItem.color : 'var(--border)',
                    background: selected ? `${tipoItem.color}18` : 'transparent',
                    color: selected ? tipoItem.color : 'var(--text-muted)',
                  }}
                >
                  <TIcon size={22} color={selected ? tipoItem.color : 'var(--text-faint)'} />
                  <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>
                    {tipoItem.label.split('/')[0].trim()}
                  </span>
                </button>
              )
            })}
          </div>

          <label style={S.label}>Nombre</label>
          <input
            value={nombre}
            onChange={e => handleNombre(e.target.value)}
            style={S.input}
            placeholder="Ej: Ministerio de Alabanza"
          />

          <label style={S.label}>Descripción (opcional)</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            style={{ ...S.input, height: 72, resize: 'vertical' }}
            placeholder="Breve descripción del ministerio..."
          />

          <div style={S.modalFooter}>
            <button type="button" onClick={onClose} style={S.btnSec}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ ...S.btnPrimary, background: meta.color, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creando...' : 'Crear ministerio'}
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
    } catch {
      toast.error('Error cargando ministerios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function handleCreado(ministerio) {
    setModal(false)
    setMinisterios(prev => [...prev, ministerio])
    navigate(`/ministerios/${ministerio.id}`)
  }

  if (loading) {
    return (
      <div style={S.page}>
        <Menu />
        <main style={S.main}><div style={S.spinner} /></main>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <Menu />
      <main style={S.main}>
        <div style={S.pageHeader}>
          <div>
            <h1 style={S.titulo}>Ministerios</h1>
            <p style={S.subtitulo}>
              {ministerios.length === 0
                ? 'Todavía no hay ministerios. Creá el primero.'
                : `${ministerios.length} ministerio${ministerios.length !== 1 ? 's' : ''} activos`}
            </p>
          </div>
          <button onClick={() => setModal(true)} style={S.btnPrimary}>
            <MinIcons.Plus size={16} color="#fff" style={{ marginRight: 6 }} />
            Nuevo
          </button>
        </div>

        {ministerios.length === 0 ? (
          <div style={S.emptyState}>
            <MinIcons.Building size={56} color="var(--text-faint)" />
            <h2 style={{ color: 'var(--text)', marginBottom: 8, fontSize: 18 }}>Organizá tu iglesia por ministerios</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6, margin: '0 0 20px' }}>
              Cada ministerio tiene su propio panel, tareas, miembros, checklists y reportes.
            </p>
            <button onClick={() => setModal(true)} style={{ ...S.btnPrimary, padding: '12px 28px' }}>
              <MinIcons.Plus size={18} color="#fff" style={{ marginRight: 8 }} />
              Crear primer ministerio
            </button>
          </div>
        ) : (
          <div style={S.grid}>
            {ministerios.map(ministerio => {
              const meta = TIPOS_META[ministerio.tipo] || TIPOS_META.PERSONALIZADO
              const color = ministerio.color || meta.color
              const IconComp = MINISTERIO_ICONS[ministerio.tipo] || MinIcons.Building
              const hasPendingTasks = (ministerio.tareasPendientes ?? 0) > 0
              return (
                <div
                  key={ministerio.id}
                  style={{ ...S.card, borderTopColor: color }}
                  onClick={() => navigate(`/ministerios/${ministerio.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/ministerios/${ministerio.id}`)}
                >
                  <div style={S.cardTop}>
                    <div style={{ ...S.cardIcono, background: `${color}20`, border: `1.5px solid ${color}40` }}>
                      <IconComp size={22} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={S.cardNombre}>{ministerio.nombre}</h3>
                      <span style={{ ...S.tipoBadge, color, background: `${color}15` }}>{meta.label}</span>
                    </div>
                  </div>

                  {ministerio.descripcion && <p style={S.cardDesc}>{ministerio.descripcion}</p>}

                  <div style={S.cardFooter}>
                    <div style={S.cardStats}>
                      <span style={S.statItem}>
                        <MinIcons.Users size={13} color="var(--text-muted)" />
                        {ministerio.totalMiembros ?? 0}
                      </span>
                      <span style={{ ...S.statItem, color: hasPendingTasks ? 'var(--c-warning)' : 'var(--text-muted)' }}>
                        <MinIcons.CheckSquare size={13} color={hasPendingTasks ? 'var(--c-warning)' : 'var(--text-muted)'} />
                        {ministerio.tareasPendientes ?? 0} tareas
                      </span>
                    </div>
                    <span style={{ ...S.cardLink, color }}>
                      Ver panel
                      <MinIcons.ArrowRight size={14} color={color} style={{ marginLeft: 4 }} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {modal && <ModalNuevo onClose={() => setModal(false)} onCreado={handleCreado} />}
      </main>
    </div>
  )
}

const S = {
  page: { display:'flex', minHeight:'100vh', background:'var(--bg)', color:'var(--text)' },
  main: { flex:1, padding:'20px 16px 80px', maxWidth:1100, margin:'0 auto', width:'100%', boxSizing:'border-box' },
  pageHeader: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:24 },
  titulo: { margin:0, fontSize:22, fontWeight:800, color:'var(--text)' },
  subtitulo: { margin:'4px 0 0', fontSize:13, color:'var(--text-muted)' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(260px,100%),1fr))', gap:14 },
  card: {
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderTop:'3px solid',
    borderRadius:14,
    padding:16,
    cursor:'pointer',
    transition:'box-shadow .15s',
    display:'flex',
    flexDirection:'column',
    gap:10,
    WebkitTapHighlightColor:'transparent',
  },
  cardTop: { display:'flex', alignItems:'flex-start', gap:12 },
  cardIcono: { width:44, height:44, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  cardNombre: { margin:0, fontSize:14, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  cardDesc: {
    margin:0,
    fontSize:12,
    color:'var(--text-muted)',
    lineHeight:1.5,
    display:'-webkit-box',
    WebkitLineClamp:2,
    WebkitBoxOrient:'vertical',
    overflow:'hidden',
  },
  cardFooter: { display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', gap:8 },
  cardStats: { display:'flex', gap:12, flexWrap:'wrap' },
  statItem: { display:'inline-flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text-muted)', fontWeight:500 },
  cardLink: { display:'inline-flex', alignItems:'center', fontSize:12, fontWeight:700, flexShrink:0 },
  tipoBadge: { display:'inline-block', fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:6 },
  emptyState: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:380, textAlign:'center' },
  spinner: { width:32, height:32, border:'3px solid var(--border)', borderTopColor:'#6B5CFF', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'100px auto' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:'env(safe-area-inset-bottom,0px)' },
  modal: { background:'var(--bg)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:600, maxHeight:'88dvh', overflowY:'auto', padding:24, paddingBottom:'calc(24px + env(safe-area-inset-bottom,0px))', boxSizing:'border-box' },
  modalHeader: { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  iconBox: { width:44, height:44, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  modalFooter: { display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 },
  btnClose: { marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, borderRadius:6 },
  tiposGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))', gap:8, marginBottom:18 },
  tipoBtn: {
    display:'flex',
    flexDirection:'column',
    alignItems:'center',
    gap:5,
    padding:'10px 4px',
    border:'1.5px solid',
    borderRadius:10,
    cursor:'pointer',
    transition:'all .12s',
    background:'transparent',
    WebkitTapHighlightColor:'transparent',
  },
  label: { display:'block', fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6 },
  input: {
    width:'100%',
    padding:'10px 12px',
    fontSize:14,
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderRadius:10,
    color:'var(--text)',
    outline:'none',
    boxSizing:'border-box',
    marginBottom:14,
    WebkitAppearance:'none',
  },
  btnPrimary: {
    display:'inline-flex',
    alignItems:'center',
    padding:'10px 18px',
    background:'#6B5CFF',
    color:'#fff',
    border:'none',
    borderRadius:10,
    cursor:'pointer',
    fontWeight:700,
    fontSize:14,
    WebkitTapHighlightColor:'transparent',
  },
  btnSec: {
    display:'inline-flex',
    alignItems:'center',
    padding:'10px 18px',
    background:'var(--bg-2)',
    color:'var(--text)',
    border:'1px solid var(--border)',
    borderRadius:10,
    cursor:'pointer',
    fontSize:14,
    WebkitTapHighlightColor:'transparent',
  },
}
