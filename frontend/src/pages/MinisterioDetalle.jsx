import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'

const TABS_POR_TIPO = {
  ALABANZA:        ['panel','tareas','miembros','canciones','setlists','checklists'],
  SONIDO:          ['panel','tareas','miembros','equipos','checklists'],
  PROYECCION:      ['panel','tareas','miembros','equipos','checklists'],
  NINOS:           ['panel','tareas','miembros','salas','checkin','checklists'],
  MANTENIMIENTO:   ['panel','tareas','miembros','equipos','checklists'],
  SEGURIDAD:       ['panel','tareas','miembros','equipos','checklists'],
  default:         ['panel','tareas','miembros','checklists'],
}

const TAB_LABELS = {
  panel:'Panel', tareas:'Tareas', miembros:'Miembros', canciones:'Repertorio',
  setlists:'Setlists', checklists:'Checklists', equipos:'Equipos',
  salas:'Salas', checkin:'Check-in Niños',
}

// ─── TAB PANEL (KPIs) ─────────────────────────────────────────────────────────
function TabPanel({ ministerio }) {
  const kpis = [
    { label:'Miembros activos', valor:ministerio.totalMiembros ?? 0, icono:'👥' },
    { label:'Tareas pendientes', valor:ministerio.tareasPendientes ?? 0, icono:'✅', warn:true },
  ]
  return (
    <div>
      <div style={S.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={S.kpiCard}>
            <span style={{fontSize:28}}>{k.icono}</span>
            <span style={{fontSize:30,fontWeight:800,color:k.warn&&k.valor>0?'var(--c-warning)':'var(--text)'}}>{k.valor}</span>
            <span style={{fontSize:12,color:'var(--text-muted)'}}>{k.label}</span>
          </div>
        ))}
      </div>
      <div style={S.infoBox}>
        <p style={{margin:0,color:'var(--text-2)',fontSize:14,lineHeight:1.7}}>
          {ministerio.descripcion || 'Sin descripción. Editá el ministerio para agregar una.'}
        </p>
      </div>
    </div>
  )
}

// ─── TAB TAREAS ───────────────────────────────────────────────────────────────
function TabTareas({ ministerioId }) {
  const [tareas, setTareas] = useState([])
  const [nueva, setNueva] = useState(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    try { setTareas(await apiFetch(`/ministerios/${ministerioId}/tareas`) || []) }
    finally { setLoading(false) }
  }, [ministerioId])

  useEffect(() => { cargar() }, [cargar])

  async function crearTarea(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = { titulo:fd.get('titulo'), prioridad:fd.get('prioridad'), fechaVence:fd.get('fechaVence')||undefined }
    try {
      const t = await apiFetch(`/ministerios/${ministerioId}/tareas`, { method:'POST', body:JSON.stringify(body) })
      setTareas(prev => [t, ...prev])
      setNueva(null)
      toast.success('Tarea creada')
    } catch(e) { toast.error(e.message) }
  }

  async function cambiarEstado(id, estado) {
    try {
      const t = await apiFetch(`/ministerios/${ministerioId}/tareas/${id}`, { method:'PUT', body:JSON.stringify({ estado }) })
      setTareas(prev => prev.map(x => x.id===id ? t : x))
    } catch(e) { toast.error(e.message) }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar tarea?')) return
    await apiFetch(`/ministerios/${ministerioId}/tareas/${id}`, { method:'DELETE' })
    setTareas(prev => prev.filter(x => x.id!==id))
    toast.success('Tarea eliminada')
  }

  const PRIORIDAD_COLOR = { URGENTE:'#DC2626', ALTA:'#F59E0B', MEDIA:'#3B82F6', BAJA:'#6B7280' }
  const ESTADO_COLOR    = { PENDIENTE:'var(--text-muted)', EN_PROGRESO:'#3B82F6', COMPLETADA:'#15803D', CANCELADA:'#DC2626' }

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button onClick={() => setNueva(true)} style={S.btnPrimary}>+ Nueva tarea</button>
      </div>

      {nueva && (
        <form onSubmit={crearTarea} style={S.formCard}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:10,alignItems:'end'}}>
            <div>
              <label style={S.label}>Título *</label>
              <input name="titulo" style={S.input} placeholder="Qué hay que hacer..." autoFocus required />
            </div>
            <div>
              <label style={S.label}>Prioridad</label>
              <select name="prioridad" style={S.input}>
                <option value="BAJA">Baja</option>
                <option value="MEDIA" selected>Media</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Vence</label>
              <input name="fechaVence" type="date" style={S.input} />
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button type="submit" style={S.btnPrimary}>Guardar</button>
            <button type="button" onClick={() => setNueva(null)} style={S.btnSec}>Cancelar</button>
          </div>
        </form>
      )}

      {tareas.length===0 && !nueva ? (
        <div style={S.empty}>
          <span style={{fontSize:36}}>✅</span>
          <p>Sin tareas todavía. ¡Todo al día!</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {tareas.map(t => (
            <div key={t.id} style={{...S.tareaRow, opacity:t.estado==='COMPLETADA'?.6:1}}>
              <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
                <input type="checkbox" checked={t.estado==='COMPLETADA'}
                  onChange={() => cambiarEstado(t.id, t.estado==='COMPLETADA'?'PENDIENTE':'COMPLETADA')} />
                <div style={{minWidth:0}}>
                  <span style={{fontSize:14,fontWeight:600,color:'var(--text)',
                    textDecoration:t.estado==='COMPLETADA'?'line-through':'none'}}>
                    {t.titulo}
                  </span>
                  {t.fechaVence && (
                    <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>
                      📅 {new Date(t.fechaVence).toLocaleDateString('es-AR')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                <span style={{fontSize:11,fontWeight:700,color:PRIORIDAD_COLOR[t.prioridad],
                  background:PRIORIDAD_COLOR[t.prioridad]+'18',padding:'2px 7px',borderRadius:6}}>
                  {t.prioridad}
                </span>
                <span style={{fontSize:11,color:ESTADO_COLOR[t.estado]}}>{t.estado.replace('_',' ')}</span>
                <button onClick={() => eliminar(t.id)} style={S.btnIcon}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB MIEMBROS ─────────────────────────────────────────────────────────────
function TabMiembros({ ministerioId }) {
  const [miembros, setMiembros] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/miembros`)
      .then(d => setMiembros(d||[]))
      .finally(() => setLoading(false))
  }, [ministerioId])

  const ROL_COLOR = { COORDINADOR:'#6B5CFF', LIDER:'#10B981', SERVIDOR:'#3B82F6', LECTURA:'#6B7280' }

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      {miembros.length===0 ? (
        <div style={S.empty}><span style={{fontSize:36}}>👥</span><p>Sin miembros asignados</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {miembros.map(m => (
            <div key={m.id} style={S.memberRow}>
              <div style={{...S.avatar, background:ROL_COLOR[m.rol]+'20', color:ROL_COLOR[m.rol]}}>
                {(m.userName||'U').slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:'var(--text)',fontSize:14}}>{m.userName}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>{m.email}</div>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:ROL_COLOR[m.rol],
                background:ROL_COLOR[m.rol]+'18',padding:'3px 10px',borderRadius:8}}>
                {m.rol}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB CANCIONES (Alabanza) ─────────────────────────────────────────────────
function TabCanciones({ ministerioId }) {
  const [canciones, setCanciones] = useState([])
  const [nueva, setNueva] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/canciones`)
      .then(d => setCanciones(d||[]))
      .finally(() => setLoading(false))
  }, [ministerioId])

  async function crear(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = { titulo:fd.get('titulo'), artista:fd.get('artista'), tonalidad:fd.get('tonalidad'), bpm:fd.get('bpm')||undefined }
    const c = await apiFetch(`/ministerios/${ministerioId}/canciones`, { method:'POST', body:JSON.stringify(body) })
    setCanciones(prev => [...prev, c])
    setNueva(false)
    toast.success('Canción agregada')
  }

  const NOTAS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B',
                 'Cm','Dm','Em','Fm','Gm','Am','Bm']

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <span style={{fontSize:13,color:'var(--text-muted)'}}>{canciones.length} canciones en el repertorio</span>
        <button onClick={() => setNueva(true)} style={S.btnPrimary}>+ Agregar canción</button>
      </div>

      {nueva && (
        <form onSubmit={crear} style={S.formCard}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={S.label}>Título *</label>
              <input name="titulo" style={S.input} placeholder="Nombre de la canción" autoFocus required />
            </div>
            <div>
              <label style={S.label}>Artista</label>
              <input name="artista" style={S.input} placeholder="Chris Tomlin, Hillsong..." />
            </div>
            <div>
              <label style={S.label}>Tonalidad</label>
              <select name="tonalidad" style={S.input}>
                <option value="">Sin asignar</option>
                {NOTAS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>BPM</label>
              <input name="bpm" type="number" style={S.input} placeholder="76" min="40" max="220" />
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button type="submit" style={S.btnPrimary}>Guardar</button>
            <button type="button" onClick={() => setNueva(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </form>
      )}

      {canciones.length===0 && !nueva ? (
        <div style={S.empty}><span style={{fontSize:36}}>🎵</span><p>El repertorio está vacío</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {canciones.map(c => (
            <div key={c.id} style={S.cancionRow}>
              <div style={{flex:1}}>
                <span style={{fontWeight:600,color:'var(--text)',fontSize:14}}>{c.titulo}</span>
                {c.artista && <span style={{fontSize:12,color:'var(--text-muted)',marginLeft:8}}>— {c.artista}</span>}
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {c.tonalidad && <span style={S.badge}>{c.tonalidad}</span>}
                {c.bpm && <span style={{...S.badge,background:'var(--bg)'}}>{c.bpm} BPM</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB EQUIPOS (Sonido / Proyección) ───────────────────────────────────────
function TabEquipos({ ministerioId }) {
  const [equipos, setEquipos] = useState([])
  const [nuevo, setNuevo] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/equipos`)
      .then(d => setEquipos(d||[]))
      .finally(() => setLoading(false))
  }, [ministerioId])

  async function crear(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = { nombre:fd.get('nombre'), tipo:fd.get('tipo'), marca:fd.get('marca'),
                   modelo:fd.get('modelo'), ubicacion:fd.get('ubicacion') }
    const eq = await apiFetch(`/ministerios/${ministerioId}/equipos`, { method:'POST', body:JSON.stringify(body) })
    setEquipos(prev => [...prev, eq])
    setNuevo(false)
    toast.success('Equipo agregado al inventario')
  }

  async function cambiarEstado(id, estado) {
    const eq = await apiFetch(`/ministerios/${ministerioId}/equipos/${id}`, { method:'PUT', body:JSON.stringify({ estado }) })
    setEquipos(prev => prev.map(x => x.id===id ? eq : x))
  }

  const ESTADO_COLOR = { OPERATIVO:'#15803D', FALLA:'#DC2626', MANTENIMIENTO:'#F59E0B', BAJA:'#6B7280' }

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button onClick={() => setNuevo(true)} style={S.btnPrimary}>+ Agregar equipo</button>
      </div>

      {nuevo && (
        <form onSubmit={crear} style={S.formCard}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input name="nombre" style={S.input} placeholder="Consola Yamaha QL5" autoFocus required />
            </div>
            <div>
              <label style={S.label}>Tipo</label>
              <input name="tipo" style={S.input} placeholder="consola, micrófono, cámara..." />
            </div>
            <div>
              <label style={S.label}>Marca</label>
              <input name="marca" style={S.input} placeholder="Yamaha, Shure, Sony..." />
            </div>
            <div>
              <label style={S.label}>Modelo</label>
              <input name="modelo" style={S.input} placeholder="QL5, SM58..." />
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={S.label}>Ubicación</label>
              <input name="ubicacion" style={S.input} placeholder="Sala principal, bodega..." />
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button type="submit" style={S.btnPrimary}>Guardar</button>
            <button type="button" onClick={() => setNuevo(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </form>
      )}

      {equipos.length===0 && !nuevo ? (
        <div style={S.empty}><span style={{fontSize:36}}>🎚️</span><p>Sin equipos en el inventario</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {equipos.map(eq => (
            <div key={eq.id} style={S.equipoRow}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:'var(--text)',fontSize:14}}>{eq.nombre}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>
                  {[eq.tipo, eq.marca, eq.modelo].filter(Boolean).join(' · ')}
                  {eq.ubicacion && ` — 📍 ${eq.ubicacion}`}
                </div>
              </div>
              <select value={eq.estado} onChange={e => cambiarEstado(eq.id, e.target.value)}
                style={{...S.input, width:'auto', marginBottom:0, fontSize:12, fontWeight:700,
                  color:ESTADO_COLOR[eq.estado], borderColor:ESTADO_COLOR[eq.estado]+'40' }}>
                {['OPERATIVO','FALLA','MANTENIMIENTO','BAJA'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB CHECKLISTS ───────────────────────────────────────────────────────────
function TabChecklists({ ministerioId }) {
  const [checklists, setChecklists] = useState([])
  const [nuevo, setNuevo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [itemsTexto, setItemsTexto] = useState('')

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/checklists`)
      .then(d => setChecklists(d||[]))
      .finally(() => setLoading(false))
  }, [ministerioId])

  async function crear(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const items = itemsTexto.split('\n').map(s=>s.trim()).filter(Boolean)
    const cl = await apiFetch(`/ministerios/${ministerioId}/checklists`, {
      method:'POST',
      body: JSON.stringify({ nombre:fd.get('nombre'), tipo:fd.get('tipo'), items })
    })
    setChecklists(prev => [cl, ...prev])
    setNuevo(false)
    setItemsTexto('')
    toast.success('Checklist creado')
  }

  async function toggleItem(clId, itemId, completado) {
    await apiFetch(`/ministerios/${ministerioId}/checklists/${clId}/items/${itemId}`, {
      method:'PUT', body:JSON.stringify({ completado })
    })
    setChecklists(prev => prev.map(cl => {
      if (cl.id!==clId) return cl
      return { ...cl, items:(cl.items||[]).map(i => i.id===itemId ? {...i, completado} : i) }
    }))
  }

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
        <button onClick={() => setNuevo(true)} style={S.btnPrimary}>+ Nueva checklist</button>
      </div>

      {nuevo && (
        <div style={S.formCard}>
          <form onSubmit={crear}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:10}}>
              <div>
                <label style={S.label}>Nombre *</label>
                <input name="nombre" style={S.input} placeholder="Ej: Checklist pre-culto sonido" autoFocus required />
              </div>
              <div>
                <label style={S.label}>Tipo</label>
                <select name="tipo" style={S.input}>
                  <option value="CULTO">Por culto</option>
                  <option value="EVENTO">Por evento</option>
                  <option value="SEMANAL">Semanal</option>
                </select>
              </div>
            </div>
            <label style={S.label}>Ítems (uno por línea)</label>
            <textarea value={itemsTexto} onChange={e => setItemsTexto(e.target.value)}
              style={{...S.input, height:100, resize:'vertical', fontFamily:'monospace', fontSize:13}}
              placeholder={"Verificar consola\nProbar micrófonos\nChequear monitors"} />
            <div style={{display:'flex',gap:8}}>
              <button type="submit" style={S.btnPrimary}>Crear</button>
              <button type="button" onClick={() => setNuevo(false)} style={S.btnSec}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {checklists.length===0 && !nuevo ? (
        <div style={S.empty}><span style={{fontSize:36}}>☑️</span><p>Sin checklists todavía</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {checklists.map(cl => {
            const items = cl.items || []
            const done = items.filter(i => i.completado).length
            const pct = items.length ? Math.round(done/items.length*100) : 0
            return (
              <div key={cl.id} style={S.clCard}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <div style={{flex:1}}>
                    <span style={{fontWeight:700,color:'var(--text)',fontSize:14}}>{cl.nombre}</span>
                    <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>{cl.tipo}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:pct===100?'#15803D':'var(--text-muted)'}}>
                    {done}/{items.length} ({pct}%)
                  </span>
                </div>
                <div style={{height:4,background:'var(--border)',borderRadius:2,marginBottom:12}}>
                  <div style={{height:'100%',width:pct+'%',background:pct===100?'#15803D':'#6B5CFF',
                    borderRadius:2,transition:'width .3s'}} />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {items.map(item => (
                    <label key={item.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',
                      fontSize:13,color:item.completado?'var(--text-muted)':'var(--text)',
                      textDecoration:item.completado?'line-through':'none'}}>
                      <input type="checkbox" checked={item.completado}
                        onChange={e => toggleItem(cl.id, item.id, e.target.checked)} />
                      {item.texto}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function MinisterioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ministerio, setMinisterio] = useState(null)
  const [tab, setTab] = useState('panel')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${id}`)
      .then(m => { setMinisterio(m); })
      .catch(() => { toast.error('Ministerio no encontrado'); navigate('/ministerios') })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={S.page}><Menu /><main style={S.main}><div style={S.spinner} /></main></div>
  )
  if (!ministerio) return null

  const tabs = TABS_POR_TIPO[ministerio.tipo] || TABS_POR_TIPO.default
  const color = ministerio.color || '#6B5CFF'
  const icono = ministerio.icono || '🏛️'

  return (
    <div style={S.page}>
      <Menu />
      <main style={S.main}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:24}}>
          <button onClick={() => navigate('/ministerios')}
            style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:20,padding:4}}>←</button>
          <div style={{width:48,height:48,borderRadius:14,background:color+'20',border:`2px solid ${color}40`,
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
            {icono}
          </div>
          <div>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:'var(--text)'}}>{ministerio.nombre}</h1>
            <span style={{fontSize:12,color,fontWeight:600}}>
              {ministerio.tipo?.replace('_',' ')}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{...S.tabBtn, borderBottomColor:tab===t?color:'transparent',
                color:tab===t?color:'var(--text-muted)', fontWeight:tab===t?700:500}}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={S.tabContent}>
          {tab==='panel'     && <TabPanel ministerio={ministerio} />}
          {tab==='tareas'    && <TabTareas ministerioId={id} />}
          {tab==='miembros'  && <TabMiembros ministerioId={id} />}
          {tab==='canciones' && <TabCanciones ministerioId={id} />}
          {tab==='equipos'   && <TabEquipos ministerioId={id} />}
          {tab==='checklists'&& <TabChecklists ministerioId={id} />}
          {tab==='setlists'  && <div style={S.empty}><span style={{fontSize:36}}>📋</span><p>Setlists — próximamente en Sprint 2</p></div>}
          {tab==='salas'     && <div style={S.empty}><span style={{fontSize:36}}>🏫</span><p>Salas — próximamente en Sprint 2</p></div>}
          {tab==='checkin'   && <div style={S.empty}><span style={{fontSize:36}}>🧒</span><p>Check-in Niños — próximamente en Sprint 2</p></div>}
        </div>
      </main>
    </div>
  )
}

const S = {
  page:      { display:'flex', minHeight:'100vh', background:'var(--bg)', color:'var(--text)' },
  main:      { flex:1, padding:'28px 24px', maxWidth:960, margin:'0 auto', width:'100%' },
  spinner:   { width:32, height:32, border:'3px solid var(--border)', borderTopColor:'#6B5CFF',
               borderRadius:'50%', animation:'spin 1s linear infinite', margin:'80px auto' },
  kpiGrid:   { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:20 },
  kpiCard:   { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:12,
               padding:16, display:'flex', flexDirection:'column', alignItems:'center', gap:4 },
  infoBox:   { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:16 },
  tabBar:    { display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:20, overflowX:'auto' },
  tabBtn:    { padding:'10px 16px', background:'none', border:'none', borderBottom:'2px solid',
               cursor:'pointer', fontSize:13, transition:'all .15s', whiteSpace:'nowrap' },
  tabContent:{ minHeight:300 },
  formCard:  { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:16 },
  label:     { display:'block', fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
               letterSpacing:'.04em', marginBottom:5 },
  input:     { width:'100%', padding:'9px 12px', fontSize:13, background:'var(--bg)',
               border:'1px solid var(--border)', borderRadius:8, color:'var(--text)',
               outline:'none', boxSizing:'border-box', marginBottom:0 },
  btnPrimary:{ padding:'9px 18px', background:'#6B5CFF', color:'#fff', border:'none',
               borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:13 },
  btnSec:    { padding:'9px 18px', background:'var(--bg-2)', color:'var(--text)',
               border:'1px solid var(--border)', borderRadius:9, cursor:'pointer', fontSize:13 },
  btnIcon:   { background:'none', border:'none', cursor:'pointer', fontSize:14, padding:'2px 6px',
               color:'var(--text-muted)', borderRadius:6 },
  empty:     { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
               minHeight:200, gap:8, color:'var(--text-muted)', fontSize:14 },
  tareaRow:  { display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
               background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10 },
  memberRow: { display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
               background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10 },
  avatar:    { width:38, height:38, borderRadius:10, display:'flex', alignItems:'center',
               justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 },
  cancionRow:{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
               background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10 },
  equipoRow: { display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
               background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10 },
  clCard:    { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:12, padding:16 },
  badge:     { fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6,
               background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)' },
}
