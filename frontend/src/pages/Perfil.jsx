import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useParams, useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import CamaraFoto from '../components/CamaraFoto.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const TIPOS_SEG    = ['CONTACTO','VISITA','LLAMADA','REUNION','ORACION','MENSAJE','OTRO']
const ESTADOS      = ['ACTIVO','INACTIVO','VISITANTE','NUEVO']
const RELACIONES   = [
  { v:'conyuge',  l:'💑 Cónyuge' },
  { v:'pareja',   l:'💑 Pareja' },
  { v:'hijo',     l:'• Hijo' },
  { v:'hija',     l:'• Hija' },
  { v:'padre',    l:'• Padre' },
  { v:'madre',    l:'• Madre' },
  { v:'hermano',  l:'• Hermano' },
  { v:'hermana',  l:'• Hermana' },
  { v:'abuelo',   l:'• Abuelo' },
  { v:'abuela',   l:'• Abuela' },
  { v:'nieto',    l:'• Nieto' },
  { v:'nieta',    l:'• Nieta' },
  { v:'tio',      l:'• Tío' },
  { v:'tia',      l:'• Tía' },
  { v:'primo',    l:'• Primo' },
  { v:'prima',    l:'Prima' },
  { v:'cuñado',   l:'Cuñado' },
  { v:'cuñada',   l:'Cuñada' },
  { v:'otro',     l:'Otro' },
]
const TIPOS_CONTACTO = [
  { v:'WHATSAPP_ALT', l:'WhatsApp alternativo', ph:'+54 11...' },
  { v:'INSTAGRAM',    l:'Instagram',             ph:'@usuario' },
  { v:'FACEBOOK',     l:'Facebook',              ph:'nombre o URL' },
  { v:'TELEGRAM',     l:'Telegram',              ph:'@usuario' },
  { v:'EMAIL_ALT',    l:'• Email alternativo',     ph:'otro@mail.com' },
  { v:'DOMICILIO',    l:'• Domicilio',             ph:'Calle 1234, Localidad' },
  { v:'OTRO',         l:'• Otro',                  ph:'descripción' },
]

function Avatar({ nombre, apellido, fotoUrl, size = 56 }) {
  const ini = ((nombre||'?').slice(0,1) + (apellido||'').slice(0,1)).toUpperCase()
  if (fotoUrl) return (
    <img src={fotoUrl} alt={`${nombre} ${apellido}`}
      style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
  )
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:'linear-gradient(135deg,#3B82F6,#7C3AED)',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'var(--surface)', fontSize:size*0.35, fontWeight:700 }}>
      {ini}
    </div>
  )
}

export default function Perfil() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = getUser()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('info')
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [showCamara, setShowCamara] = useState(false)
  const [msg, setMsg]           = useState(null)

  // Seguimiento
  const [segForm, setSegForm] = useState({ tipo:'CONTACTO', nota:'', proximoContacto:'' })
  // Familiar
  const [famModal, setFamModal]   = useState(false)
  const [famSearch, setFamSearch] = useState('')
  const [famResults, setFamResults] = useState([])
  const [famRelacion, setFamRelacion] = useState('otro')
  // Contacto extra
  const [ctModal, setCtModal]   = useState(false)
  const [ctForm, setCtForm]     = useState({ tipo:'WHATSAPP_ALT', valor:'', descripcion:'', principal:0 })
  const [confirmRemoveFam, setConfirmRemoveFam] = useState(null)
  const [confirmRemoveCt, setConfirmRemoveCt]   = useState(null)
  const [confirmElimFoto, setConfirmElimFoto]   = useState(false)
  // Origen
  const [origenEdit, setOrigenEdit] = useState(false)
  const [origenForm, setOrigenForm] = useState({ traidoPorId:'', traidoPorNombre:'', cultoNombre:'', fecha:'', notas:'' })
  const [origenSearch, setOrigenSearch] = useState('')
  const [origenResults, setOrigenResults] = useState([])
  // Personas para búsqueda
  const [personas, setPersonas] = useState([])

  async function load() {
    try {
      const res = await apiFetch(`/perfil/${id}`)
      setData(res)
      setEditForm({
        nombre: res.persona.nombre, apellido: res.persona.apellido,
        email: res.persona.email, telefono: res.persona.telefono,
        estado: res.persona.estado, notas: res.persona.notas,
        fechaNacimiento: res.persona.fechaNacimiento || '',
        ocupacion: res.persona.ocupacion || '',
        direccion: res.persona.direccion || '',
        localidad: res.persona.localidad || '',
        fotoUrl: res.persona.fotoUrl || '',
        comoLlego: res.persona.comoLlego || '',
      })
      setOrigenForm({
        traidoPorId:     res.origen?.traidoPorId     || '',
        traidoPorNombre: res.origen?.traidoPorNombre || (res.origen?.traidoPorNombre2 ? `${res.origen.traidoPorNombre2} ${res.origen.traidoPorApellido||''}`.trim() : ''),
        cultoNombre:     res.origen?.cultoNombre     || '',
        fecha:           res.origen?.fecha           || '',
        notas:           res.origen?.notas           || '',
      })
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Búsqueda de familiares y personas origen
  useEffect(() => {
    if (famSearch.length < 2) { setFamResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch(`/busqueda?q=${encodeURIComponent(famSearch)}&limit=8`)
        setFamResults((r || []).filter(p => p.tipo === 'persona' && String(p.id) !== String(id)))
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [famSearch])

  useEffect(() => {
    if (origenSearch.length < 2) { setOrigenResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch(`/busqueda?q=${encodeURIComponent(origenSearch)}&limit=6`)
        setOrigenResults((r || []).filter(p => p.tipo === 'persona'))
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [origenSearch])

  async function handleSaveEdit(e) {
    e.preventDefault(); setMsg(null)
    try { await apiFetch(`/personas/${id}`, { method:'PUT', body:JSON.stringify(editForm) }); setEditando(false); load() }
    catch(e) { setMsg({ type:'error', text:e.message }) }
  }

  async function handleAddSeg(e) {
    e.preventDefault(); setMsg(null)
    try {
      await apiFetch('/seguimiento', { method:'POST', body:JSON.stringify({ personaId:Number(id), ...segForm, proximoContacto:segForm.proximoContacto||null }) })
      setSegForm({ tipo:'CONTACTO', nota:'', proximoContacto:'' }); load()
    } catch(e) { setMsg({ type:'error', text:e.message }) }
  }

  async function addFamiliar(familiarId) {
    try {
      await apiFetch(`/perfil/${id}/familiar`, { method:'POST', body:JSON.stringify({ familiarId, relacion:famRelacion }) })
      setFamModal(false); setFamSearch(''); setFamResults([]); load()
    } catch(e) { toast.error(e.message) }
  }

  async function removeFamiliar() {
    if (!confirmRemoveFam) return
    try { await apiFetch(`/perfil/${id}/familiar/${confirmRemoveFam}`, { method:'DELETE' }); load() } catch(e) { toast.error(e.message) }
    setConfirmRemoveFam(null)
  }

  async function addContacto(e) {
    e.preventDefault()
    try { await apiFetch(`/perfil/${id}/contacto`, { method:'POST', body:JSON.stringify(ctForm) }); setCtModal(false); setCtForm({ tipo:'WHATSAPP_ALT', valor:'', descripcion:'', principal:0 }); load() }
    catch(e) { toast.error(e.message) }
  }

  async function removeContacto() {
    if (!confirmRemoveCt) return
    try { await apiFetch(`/perfil/${id}/contacto/${confirmRemoveCt}`, { method:'DELETE' }); load() } catch(e) { toast.error(e.message) }
    setConfirmRemoveCt(null)
  }

  async function saveOrigen(e) {
    e.preventDefault()
    try { await apiFetch(`/perfil/${id}/origen`, { method:'POST', body:JSON.stringify(origenForm) }); setOrigenEdit(false); load() }
    catch(e) { toast.error(e.message) }
  }

  async function subirFoto(base64) {
    try {
      const r = await apiFetch(`/perfil/${id}/foto`, { method: 'POST', body: JSON.stringify({ base64 }) })
      setShowCamara(false)
      load()
      setMsg({ type: 'success', text: 'Foto guardada — disponible para reconocimiento facial' })
    } catch(e) { toast.error(e.message) }
  }

  async function eliminarFoto() {
    setConfirmElimFoto(false)
    try { await apiFetch(`/perfil/${id}/foto`, { method: 'DELETE' }); load(); setMsg({ type: 'success', text: 'Foto eliminada' }) }
    catch(e) { toast.error(e.message) }
  }

  if (loading) return <div className="layout"><Menu /><main className="main"><div className="empty"><p>Cargando...</p></div></main></div>
  if (!data)   return <div className="layout"><Menu /><main className="main"><div className="empty"><p>No encontrada</p></div></main></div>

  const { persona, seguimientos, asistencias, mensajes, familiares, contactosExtra, origen, stats } = data
  const asistPct = stats.totalCultos > 0 ? Math.round(stats.presencias / stats.totalCultos * 100) : 0

  const TABS = [
    { k:'info',      l:'Datos' },
    { k:'familia',   l:`Familia ${familiares?.length > 0 ? `(${familiares.length})` : ''}` },
    { k:'contactos', l:'Contactos' },
    { k:'origen',    l:'Origen' },
    { k:'seguimiento', l:`Seguimiento (${stats.totalSeguimientos})` },
    { k:'asistencia',  l:`Asistencia (${stats.totalCultos})` },
    { k:'timeline',   l:'≡ Timeline' },
    { k:'mensajes',    l:'Mensajes' },
  ]

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/personas')}>← Volver</button>
          <h1 className="page-title" style={{ margin:0 }}>{persona.nombre} {persona.apellido}</h1>
          <span className={`badge badge-${persona.estado?.toLowerCase()}`}>{persona.estado}</span>
        </div>

        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, alignItems:'start' }}>

          {/* Columna izquierda — card de persona */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="card" style={{ textAlign:'center', padding:'24px 20px' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                  <Avatar nombre={persona.nombre} apellido={persona.apellido} fotoUrl={persona.fotoUrl} size={72} />
                  <button
                    onClick={() => setShowCamara(true)}
                    data-tip={persona.fotoUrl ? 'Cambiar foto de referencia facial' : 'Agregar foto para reconocimiento facial'}
                    style={{
                      position: 'absolute', bottom: -4, right: -4,
                      width: 24, height: 24, borderRadius: '50%',
                      background: persona.fotoUrl ? 'var(--primary)' : 'var(--c-warning)',
                      border: '2px solid var(--surface)',
                      color: 'var(--surface)', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    📷
                  </button>
                  {persona.fotoUrl && (
                    <button
                      onClick={() => setConfirmElimFoto(true)}
                      data-tip="Eliminar foto de referencia"
                      style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--danger)', border: '2px solid var(--surface)',
                        color: 'var(--surface)', fontSize: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <h2 style={{ fontSize:17, fontWeight:800, margin:'0 0 2px', letterSpacing:'-0.3px' }}>{persona.nombre} {persona.apellido}</h2>
              <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 10px' }}>{persona.email || 'Sin email'}</p>
              <div style={{ display:'flex', justifyContent:'center', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                <span className={`badge badge-${persona.estado?.toLowerCase()}`}>{persona.estado}</span>
                {persona.estadoEspiritual && <span className="badge badge-nuevo">{persona.estadoEspiritual?.replace(/_/g,' ')}</span>}
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width:'100%' }} onClick={() => setEditando(!editando)}>
                {editando ? '✕ Cancelar edición' : 'Editar datos'}
              </button>
            </div>

            {/* Stats rápidas */}
            <div className="card" style={{ padding:'14px 16px' }}>
              <p style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)', marginBottom:10 }}>Estadísticas</p>
              {[
                [stats.totalSeguimientos, '≡', 'Seguimientos'],
                [stats.totalCultos,       '' , 'Cultos'],
                [`${asistPct}%`,          '' , 'Asistencia'],
                [stats.totalFamiliares,   '👨‍👩‍👧', 'Familiares vinc.'],
                [contactosExtra?.length || 0, '📲', 'Contactos extra'],
              ].map(([v, ic, l]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:16, width:22, textAlign:'center' }}>{ic}</span>
                  <span style={{ flex:1, fontSize:13, color:'var(--text-muted)' }}>{l}</span>
                  <strong style={{ fontSize:15, color:'var(--primary)' }}>{v}</strong>
                </div>
              ))}
              {stats.proximoContacto && (
                <div style={{ marginTop:10, padding:'8px 10px', background:'var(--c-warning-bg)', borderRadius:'var(--r)', fontSize:12 }}>
                  <Icons.Attendance /> Próximo contacto: <strong>{stats.proximoContacto}</strong>
                </div>
              )}
            </div>

            {/* Datos básicos siempre visibles */}
            <div className="card" style={{ padding:'14px 16px' }}>
              <p style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)', marginBottom:10 }}>Datos rápidos</p>
              {[
                ['' , persona.telefono || 'Sin teléfono'],
                ['' , persona.fechaNacimiento ? `Nació: ${persona.fechaNacimiento}` : 'Sin fecha de nacimiento'],
                ['' , `Ingresó: ${persona.fechaIngreso || '—'}`],
                ['' , persona.grupoNombre || 'Sin grupo'],
                ['' , `Líder: ${persona.liderNombre || 'Sin asignar'}`],
                ...(persona.ocupacion ? [['💼', persona.ocupacion]] : []),
                ...(persona.localidad ? [['📍', persona.localidad]] : []),
                ...(persona.direccion ? [['🏠', persona.direccion]] : []),
              ].map(([ic, v], i) => (
                <div key={i} style={{ display:'flex', gap:8, fontSize:13, padding:'3px 0', color:v.startsWith('Sin') || v.includes('—') ? 'var(--text-muted)' : 'var(--text)' }}>
                  <span>{ic}</span><span>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Columna derecha — tabs */}
          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)', overflowX:'auto' }}>
              {TABS.map(t => (
                <button key={t.k} onClick={() => { setTab(t.k); setMsg(null) }}
                  style={{ padding:'12px 14px', border:'none', background:'transparent', cursor:'pointer',
                    fontSize:12, fontWeight:tab===t.k ? 700 : 400, whiteSpace:'nowrap',
                    color:tab===t.k ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom:tab===t.k ? '2px solid var(--primary)' : '2px solid transparent',
                    transition:'var(--t)' }}>
                  {t.l}
                </button>
              ))}
            </div>

            <div style={{ padding:20 }}>

              {/* ── DATOS / EDICIÓN ────────────────────────────────────── */}
              {tab === 'info' && (
                editando ? (
                  <form onSubmit={handleSaveEdit}>
                    <div className="form-grid">
                      <div className="form-group"><label>Nombre</label><input name="nombre" className="form-input" value={editForm.nombre} onChange={e=>setEditForm(f=>({...f,nombre:e.target.value}))}/></div>
                      <div className="form-group"><label>Apellido</label><input name="apellido" className="form-input" value={editForm.apellido} onChange={e=>setEditForm(f=>({...f,apellido:e.target.value}))}/></div>
                      <div className="form-group"><label>Email</label><input name="email" className="form-input" type="email" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}/></div>
                      <div className="form-group"><label>Teléfono</label><input name="telefono" className="form-input" value={editForm.telefono} onChange={e=>setEditForm(f=>({...f,telefono:e.target.value}))}/></div>
                      <div className="form-group"><label>Fecha nacimiento</label><input name="fechaNacimiento" className="form-input" type="date" value={editForm.fechaNacimiento} onChange={e=>setEditForm(f=>({...f,fechaNacimiento:e.target.value}))}/></div>
                      <div className="form-group"><label>Estado</label><select name="estado" className="form-input" value={editForm.estado} onChange={e=>setEditForm(f=>({...f,estado:e.target.value}))}>{ESTADOS.map(s=><option key={s}>{s}</option>)}</select></div>
                      <div className="form-group"><label>Ocupación</label><input name="ocupacion" className="form-input" value={editForm.ocupacion} onChange={e=>setEditForm(f=>({...f,ocupacion:e.target.value}))} placeholder="Trabajo o rol"/></div>
                      <div className="form-group"><label>Localidad</label><input name="localidad" className="form-input" value={editForm.localidad} onChange={e=>setEditForm(f=>({...f,localidad:e.target.value}))} placeholder="Quilmes, Wilde..."/></div>
                      <div className="form-group full"><label>Dirección</label><input name="direccion" className="form-input" value={editForm.direccion} onChange={e=>setEditForm(f=>({...f,direccion:e.target.value}))} placeholder="Calle 1234 piso 2"/></div>
                      <div className="form-group full"><label>URL de foto</label><input name="fotoUrl" className="form-input" value={editForm.fotoUrl} onChange={e=>setEditForm(f=>({...f,fotoUrl:e.target.value}))} placeholder="https://..."/></div>
                      <div className="form-group full"><label>Notas pastorales</label><textarea name="notas" className="form-input" value={editForm.notas} onChange={e=>setEditForm(f=>({...f,notas:e.target.value}))} rows={3}/></div>
                    </div>
                    <div style={{ marginTop:16, display:'flex', gap:8 }}>
                      <button type="submit" className="btn btn-primary" data-tip="Guardar la configuración">Guardar cambios</button>
                      <button type="button" className="btn btn-ghost" onClick={()=>setEditando(false)}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14 }}>
                      {[
                        ['Nombre completo', `${persona.nombre} ${persona.apellido}`],
                        ['Email', persona.email || '—'],
                        ['Teléfono', persona.telefono || '—'],
                        ['Nacimiento', persona.fechaNacimiento || '—'],
                        ['Ocupación', persona.ocupacion || '—'],
                        ['Estado', persona.estado],
                        ['Estado espiritual', persona.estadoEspiritual?.replace(/_/g,' ') || '—'],
                        ['Bautismo agua', persona.bautizadoAgua ? 'Sí' : '✗ No'],
                        ['Bautismo espíritu', persona.bautizadoEspiritu ? 'Sí' : '✗ No'],
                        ['Dirección', persona.direccion || '—'],
                        ['Localidad', persona.localidad || '—'],
                        ['Grupo', persona.grupoNombre || '—'],
                        ['Líder asignado', persona.liderNombre || '—'],
                        ['Fecha ingreso', persona.fechaIngreso || '—'],
                      ].map(([l, v]) => (
                        <div key={l} style={{ padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)', marginBottom:2 }}>{l}</div>
                          <div style={{ fontSize:13, color:v==='—'?'var(--text-muted)':'var(--text)' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {persona.notas && (
                      <div style={{ marginTop:14, padding:'12px 14px', background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                        <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)', marginBottom:6 }}>Notas pastorales</div>
                        <p style={{ fontSize:13, lineHeight:1.6, margin:0 }}>{persona.notas}</p>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* ── FAMILIA ────────────────────────────────────────────── */}
              {tab === 'familia' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                    <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Grupo familiar</h3>
                    <button className="btn btn-primary btn-sm" onClick={() => setFamModal(true)}>+ Vincular familiar</button>
                  </div>
                  {(!familiares || familiares.length === 0) ? (
                    <div className="empty" style={{ padding:40 }}>
                      <div className="empty-icon">👨‍👩‍👧</div>
                      <p>Sin familiares vinculados</p>
                      <p style={{ fontSize:12, marginTop:4 }}>Vinculá cónyuges, hijos, padres y otros familiares</p>
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
                      {familiares.map(f => (
                        <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                          <Avatar nombre={f.nombre} apellido={f.apellido} fotoUrl={f.fotoUrl} size={36} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--primary)', overflowX:'auto', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                              onClick={() => navigate(`/personas/${f.familiarId}`)}>
                              {f.nombre} {f.apellido}
                            </div>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                              {RELACIONES.find(r => r.v === f.relacion)?.l || f.relacion}
                              {f.estado && <span className={`badge badge-${f.estado.toLowerCase()}`} style={{ marginLeft:6 }}>{f.estado}</span>}
                            </div>
                          </div>
                          <button onClick={() => setConfirmRemoveFam(f.id)}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--text-muted)', padding:'2px 4px', borderRadius:'var(--r)', flexShrink:0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modal vincular familiar */}
                  {famModal && (
                    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setFamModal(false)}>
                      <div className="modal">
                        <div className="modal-header">
                          <h3 className="modal-title">👨‍👩‍• Vincular familiar</h3>
                          <button className="btn btn-ghost btn-sm" onClick={() => setFamModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                          <div className="form-group" style={{ marginBottom:12 }}>
                            <label>Relación</label>
                            <select name="n" className="form-input" value={famRelacion} onChange={e => setFamRelacion(e.target.value)}>
                              {RELACIONES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom:8 }}>
                            <label>Buscar persona</label>
                            <input name="h" className="form-input" value={famSearch} onChange={e => setFamSearch(e.target.value)} placeholder="Nombre o apellido..." autoFocus />
                          </div>
                          {famResults.length > 0 && (
                            <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r)', overflowX:'auto' }}>
                              {famResults.map(p => (
                                <div key={p.id} onClick={() => addFamiliar(p.id)}
                                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', transition:'background .1s' }}
                                  onMouseEnter={e => e.currentTarget.style.background='var(--primary-soft)'}
                                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                  <Avatar nombre={p.nombre} apellido={p.apellido} size={32} />
                                  <div>
                                    <div style={{ fontSize:13, fontWeight:600 }}>{p.nombre} {p.apellido}</div>
                                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.detalle}</div>
                                  </div>
                                  <span style={{ marginLeft:'auto', fontSize:12, color:'var(--primary)', fontWeight:600 }}>Vincular →</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {famSearch.length >= 2 && famResults.length === 0 && (
                            <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', marginTop:10 }}>Sin resultados para "{famSearch}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── CONTACTOS EXTRA ────────────────────────────────────── */}
              {tab === 'contactos' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                    <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Medios de contacto</h3>
                    <button className="btn btn-primary btn-sm" onClick={() => setCtModal(true)}>+ Agregar</button>
                  </div>

                  {/* Contacto principal siempre visible */}
                  <div style={{ marginBottom:12, padding:'12px 14px', background:'var(--bg)', borderRadius:'var(--r)', border:'2px solid var(--primary)', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                    <span style={{ fontSize:20 }}><Icons.CheckIn /></span>
                    <div>
                      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.4, color:'var(--primary)' }}>WhatsApp principal</div>
                      <div style={{ fontSize:14, fontWeight:600 }}>{persona.telefono || 'Sin teléfono'}</div>
                    </div>
                    {persona.telefono && (
                      <a href={`https://wa.me/${persona.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                        style={{ marginLeft:'auto', padding:'5px 10px', background:'#25D366', color:'var(--surface)', borderRadius:'var(--r)', fontSize:12, fontWeight:600, textDecoration:'none' }}>
                        Abrir WA
                      </a>
                    )}
                  </div>

                  {(contactosExtra || []).map(c => {
                    const tipoInfo = TIPOS_CONTACTO.find(t => t.v === c.tipo) || { l: c.tipo, v: c.tipo }
                    return (
                      <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:8, background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                        <span style={{ fontSize:18, width:24, textAlign:'center' }}>{tipoInfo.l.split(' ')[0]}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.3 }}>{tipoInfo.l.split(' ').slice(1).join(' ')}</div>
                          <div style={{ fontSize:13, fontWeight:600 }}>{c.valor}</div>
                          {c.descripcion && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.descripcion}</div>}
                        </div>
                        {c.principal ? <span style={{ fontSize:10, padding:'2px 6px', background:'var(--c-info-bg)', color:'var(--c-info)', borderRadius:3, fontWeight:600 }}>Principal</span> : null}
                        <button onClick={() => setConfirmRemoveCt(c.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:14, flexShrink:0 }}>✕</button>
                      </div>
                    )
                  })}

                  {(!contactosExtra || contactosExtra.length === 0) && (
                    <div className="empty" style={{ padding:30 }}><div className="empty-icon">📲</div><p>Sin contactos alternativos</p></div>
                  )}

                  {/* Modal nuevo contacto */}
                  {ctModal && (
                    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setCtModal(false)}>
                      <div className="modal">
                        <div className="modal-header">
                          <h3 className="modal-title">📲 Nuevo medio de contacto</h3>
                          <button className="btn btn-ghost btn-sm" onClick={() => setCtModal(false)}>✕</button>
                        </div>
                        <form onSubmit={addContacto}>
                          <div className="modal-body">
                            <div className="form-group" style={{ marginBottom:12 }}>
                              <label>Tipo</label>
                              <select name="tipo" className="form-input" value={ctForm.tipo} onChange={e => setCtForm(f=>({...f,tipo:e.target.value}))}>
                                {TIPOS_CONTACTO.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom:12 }}>
                              <label>Valor</label>
                              <input name="valor" className="form-input" required value={ctForm.valor} onChange={e => setCtForm(f=>({...f,valor:e.target.value}))}
                                placeholder={TIPOS_CONTACTO.find(t=>t.v===ctForm.tipo)?.ph || ''} />
                            </div>
                            <div className="form-group" style={{ marginBottom:12 }}>
                              <label>Descripción (opcional)</label>
                              <input name="descripcion" className="form-input" value={ctForm.descripcion} onChange={e => setCtForm(f=>({...f,descripcion:e.target.value}))} placeholder="Ej: WhatsApp del trabajo"/>
                            </div>
                          </div>
                          <div className="modal-footer">
                            <button type="button" className="btn btn-ghost" onClick={() => setCtModal(false)}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" data-tip="Guardar cambios">Guardar</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ORIGEN ─────────────────────────────────────────────── */}
              {tab === 'origen' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                    <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Primera visita y origen</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOrigenEdit(!origenEdit)}>
                      {origenEdit ? 'Cancelar' : 'Editar'}
                    </button>
                  </div>

                  {origenEdit ? (
                    <form onSubmit={saveOrigen}>
                      <div className="form-grid">
                        <div className="form-group full">
                          <label>¿Quién lo/la trajo? (buscar en el sistema)</label>
                          <input name="traidoPorNombre" className="form-input" value={origenSearch || origenForm.traidoPorNombre}
                            onChange={e => { setOrigenSearch(e.target.value); setOrigenForm(f=>({...f,traidoPorNombre:e.target.value,traidoPorId:''})) }}
                            placeholder="Nombre de quien lo trajo..."/>
                          {origenResults.length > 0 && (
                            <div style={{ border:'1px solid var(--border)', borderRadius:'var(--r)', marginTop:4, overflowX:'auto' }}>
                              {origenResults.map(p => (
                                <div key={p.id} onClick={() => { setOrigenForm(f=>({...f,traidoPorId:p.id,traidoPorNombre:`${p.nombre} ${p.apellido}`.trim()})); setOrigenSearch(''); setOrigenResults([]) }}
                                  style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid var(--border)' }}
                                  onMouseEnter={e=>e.currentTarget.style.background='var(--primary-soft)'}
                                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                  {p.nombre} {p.apellido}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label>Nombre del culto donde llegó</label>
                          <input name="cultoNombre" className="form-input" value={origenForm.cultoNombre} onChange={e=>setOrigenForm(f=>({...f,cultoNombre:e.target.value}))} placeholder="DOMINGO 10:30"/>
                        </div>
                        <div className="form-group">
                          <label>Fecha de la primera visita</label>
                          <input name="fecha" className="form-input" type="date" value={origenForm.fecha} onChange={e=>setOrigenForm(f=>({...f,fecha:e.target.value}))}/>
                        </div>
                        <div className="form-group full">
                          <label>Notas adicionales</label>
                          <textarea name="notas" className="form-input" value={origenForm.notas} onChange={e=>setOrigenForm(f=>({...f,notas:e.target.value}))} placeholder="Ej: Llegó junto a su esposa, conoció la iglesia por Instagram..." rows={3}/>
                        </div>
                      </div>
                      <div style={{ marginTop:14, display:'flex', gap:8 }}>
                        <button type="submit" className="btn btn-primary" data-tip="Guardar cambios">Guardar</button>
                        <button type="button" className="btn btn-ghost" onClick={() => setOrigenEdit(false)}>Cancelar</button>
                      </div>
                    </form>
                  ) : origen ? (
                    <div style={{ display:'grid', gap:12 }}>
                      {[
                        ['Traído/a por', origen.traidoPorNombre2 ? `${origen.traidoPorNombre2} ${origen.traidoPorApellido||''}`.trim() : (origen.traidoPorNombre || '—'), origen.traidoPorId],
                        ['Primera visita', origen.fecha || '—', null],
                        ['Culto de llegada', origen.cultoNombre || '—', null],
                        ['Notas', origen.notas || '—', null],
                      ].map(([l, v, linkId]) => (
                        <div key={l} style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)', marginBottom:4 }}>{l}</div>
                          {linkId ? (
                            <span style={{ fontSize:14, fontWeight:600, color:'var(--primary)', cursor:'pointer' }} onClick={() => navigate(`/personas/${linkId}`)}>{v} →</span>
                          ) : (
                            <div style={{ fontSize:14, color: v==='—' ? 'var(--text-muted)' : 'var(--text)' }}>{v}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty" style={{ padding:40 }}>
                      <div className="empty-icon"><Icons.Users /></div>
                      <p>Sin información de origen registrada</p>
                      <p style={{ fontSize:12, marginTop:4 }}>Registrá cómo llegó, quién la trajo y cuándo</p>
                      <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={() => setOrigenEdit(true)}>Registrar origen</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── SEGUIMIENTO ────────────────────────────────────────── */}
              {tab === 'seguimiento' && (
                <div>
                  <form onSubmit={handleAddSeg} style={{ marginBottom:20, padding:14, background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
                    <div className="form-grid">
                      <div className="form-group"><label>Tipo</label><select name="tipo" className="form-input" value={segForm.tipo} onChange={e=>setSegForm(f=>({...f,tipo:e.target.value}))}>{TIPOS_SEG.map(t=><option key={t}>{t}</option>)}</select></div>
                      <div className="form-group"><label>Próx. contacto</label><input name="proximoContacto" className="form-input" type="date" value={segForm.proximoContacto} onChange={e=>setSegForm(f=>({...f,proximoContacto:e.target.value}))}/></div>
                      <div className="form-group full"><label>Nota</label><textarea name="nota" className="form-input" value={segForm.nota} onChange={e=>setSegForm(f=>({...f,nota:e.target.value}))} placeholder="Descripción del seguimiento..." rows={2}/></div>
                    </div>
                    <div style={{ textAlign:'right', marginTop:8 }}><button type="submit" className="btn btn-primary btn-sm">Agregar</button></div>
                  </form>
                  {seguimientos.length === 0 ? <div className="empty"><div className="empty-icon">≡</div><p>Sin notas de seguimiento</p></div>
                    : seguimientos.map(s => (
                      <div key={s.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                          <span className="badge badge-nuevo">{s.tipo}</span>
                          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{s.createdAt?.slice(0,16).replace('T',' ')} · {s.autorNombre}</span>
                          {s.proximoContacto && <span style={{ fontSize:11, color:'var(--c-purple)', background:'var(--c-purple-bg)', padding:'1px 6px', borderRadius:10 }}><Icons.Attendance /> {s.proximoContacto}</span>}
                        </div>
                        {s.nota && <p style={{ fontSize:13, margin:0, lineHeight:1.5 }}>{s.nota}</p>}
                      </div>
                    ))
                  }
                </div>
              )}

              {/* ── ASISTENCIA ─────────────────────────────────────────── */}
              {tab === 'asistencia' && (
                asistencias.length === 0 ? <div className="empty"><div className="empty-icon"><Icons.Attendance /></div><p>Sin registros de asistencia</p></div>
                : <>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:16 }}>
                      {[[stats.presencias,'#DCFCE7','#15803D','Presencias'],[stats.totalCultos-stats.presencias,'#FEE2E2','#DC2626','Ausencias'],[`${asistPct}%`,'#DBEAFE','#1D4ED8','Asistencia']].map(([v,bg,c,l])=>(
                        <div key={l} style={{ background:bg, borderRadius:'var(--r)', padding:'10px 14px', textAlign:'center' }}>
                          <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
                          <div style={{ fontSize:11, color:c }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <table style={{minWidth:500}}><thead><tr><th>Culto</th><th>Fecha</th><th>Asistencia</th></tr></thead>
                      <tbody>{asistencias.map((a,i)=><tr key={i}><td>{a.nombre}</td><td style={{fontSize:12,color:'var(--text-muted)'}}>{a.fecha}</td><td><span className={`badge ${a.presente?'badge-activo':'badge-inactivo'}`}>{a.presente?'Presente':'Ausente'}</span></td></tr>)}</tbody>
                    </table>
                  </>
              )}


              {/* ── TIMELINE ───────────────────────────────────────────── */}
              {tab === 'timeline' && (() => {
                // Combinar todos los eventos en un timeline cronológico
                const eventos = [
                  ...(asistencias||[]).map(a => ({
                    tipo: 'asistencia', fecha: a.fecha,
                    icon: a.presente ? ''  : '✗',
                    color: a.presente ? 'var(--c-success)' : 'var(--c-danger)',
                    bg: a.presente ? 'var(--c-success-bg)' : 'var(--c-danger-bg)',
                    titulo: a.nombre,
                    sub: a.presente ? 'Presente' : 'Ausente',
                  })),
                  ...(seguimientos||[]).map(s => ({
                    tipo: 'seguimiento', fecha: s.createdAt?.slice(0,10) || s.fecha,
                    icon: '≡', color: 'var(--c-purple)', bg: 'var(--c-purple-bg)',
                    titulo: s.tipo || 'Seguimiento',
                    sub: s.nota?.slice(0,80) || '',
                  })),
                  ...(mensajes||[]).map(m => ({
                    tipo: 'mensaje', fecha: m.createdAt?.slice(0,10),
                    icon: m.tipo === 'WHATSAPP' ? ''  : '📧',
                    color: m.tipo === 'WHATSAPP' ? 'var(--c-success)' : 'var(--c-info)',
                    bg: m.tipo === 'WHATSAPP' ? 'var(--c-success-bg)' : 'var(--c-info-bg)',
                    titulo: m.tipo,
                    sub: m.mensaje?.slice(0,80) || '',
                    enviado: m.enviado,
                  })),
                ].sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''))

                if (!eventos.length) return <div className="empty"><div className="empty-icon">≡</div><p>Sin actividad registrada</p></div>

                // Barra de calor por mes
                const porMes = {}
                asistencias.forEach(a => {
                  const mes = a.fecha?.slice(0,7)
                  if (mes) { if (!porMes[mes]) porMes[mes] = { total:0, presentes:0 }; porMes[mes].total++; if(a.presente) porMes[mes].presentes++ }
                })
                const meses = Object.entries(porMes).sort().slice(-6)

                return (
                  <div>
                    {/* Mini gráfico de asistencia por mes */}
                    {meses.length > 1 && (
                      <div style={{ marginBottom:20 }}>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
                          Asistencia últimos 6 meses
                        </div>
                        <div style={{ display:'flex', gap:8, alignItems:'flex-end', height:60 }}>
                          {meses.map(([mes, d]) => {
                            const pct = d.total > 0 ? Math.round(d.presentes/d.total*100) : 0
                            const col = pct >= 80 ? 'var(--c-success)' : pct >= 50 ? 'var(--c-warning)' : 'var(--c-danger)'
                            return (
                              <div key={mes} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                                <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{pct}%</span>
                                <div style={{ width:'100%', height: Math.max(8, pct*0.44)+'px', background:col, borderRadius:'3px 3px 0 0', minHeight:8 }} title={`${mes}: ${d.presentes}/${d.total}`} />
                                <span style={{ fontSize:9, color:'var(--text-faint)' }}>{mes.slice(5)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                      {eventos.map((ev, i) => (
                        <div key={i} style={{ display:'flex', gap:12, paddingBottom:14, position:'relative' }}>
                          {/* Línea vertical */}
                          {i < eventos.length-1 && (
                            <div style={{ position:'absolute', left:17, top:34, bottom:0, width:2, background:'var(--border)' }} />
                          )}
                          {/* Ícono */}
                          <div style={{
                            width:34, height:34, borderRadius:'50%', flexShrink:0,
                            background:ev.bg, display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:15, border:`2px solid ${ev.color}`, zIndex:1,
                          }}>
                            {ev.icon}
                          </div>
                          {/* Contenido */}
                          <div style={{ flex:1, paddingTop:4 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                              <span style={{ fontSize:13, fontWeight:600, color:ev.color }}>{ev.titulo}</span>
                              <span style={{ fontSize:11, color:'var(--text-faint)', flexShrink:0 }}>{ev.fecha}</span>
                            </div>
                            {ev.sub && <p style={{ fontSize:12, color:'var(--text-muted)', margin:'2px 0 0', lineHeight:1.4 }}>{ev.sub}</p>}
                            {ev.tipo === 'mensaje' && (
                              <span className={`badge ${ev.enviado ? 'badge-activo' : 'badge-inactivo'}`} style={{ marginTop:4, display:'inline-block' }}>
                                {ev.enviado ? 'Enviado' : 'Error'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* ── MENSAJES ───────────────────────────────────────────── */}
              {tab === 'mensajes' && (
                mensajes.length === 0 ? <div className="empty"><div className="empty-icon"><Icons.Messages /></div><p>Sin mensajes enviados</p></div>
                : mensajes.map((m,i)=>(
                  <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:11, padding:'1px 6px', borderRadius:10, fontWeight:600, background:m.tipo==='WHATSAPP'?'#DCFCE7':'#DBEAFE', color:m.tipo==='WHATSAPP'?'#15803D':'#1D4ED8' }}>{m.tipo}</span>
                      <span style={{ fontSize:12, color:'var(--text-muted)' }}>{m.createdAt?.slice(0,16).replace('T',' ')}</span>
                      <span className={`badge ${m.enviado?'badge-activo':'badge-inactivo'}`}>{m.enviado?'Enviado':'Error'}</span>
                    </div>
                    <p style={{ fontSize:13, margin:0 }}>{m.mensaje}</p>
                  </div>
                ))
              )}

            </div>
          </div>
        </div>
      </main>
      {showCamara && (
        <CamaraFoto
          nombre={`${persona.nombre} ${persona.apellido}`}
          onFoto={subirFoto}
          onCerrar={() => setShowCamara(false)}
        />
      )}
      <ConfirmModal
        open={!!confirmRemoveFam} onClose={()=>setConfirmRemoveFam(null)} onConfirm={removeFamiliar}
        title="¿Quitar familiar?" message="Se quitará el vínculo familiar. No elimina el perfil de la persona."
        confirmLabel="Quitar" cancelLabel="Cancelar"
      />
      <ConfirmModal
        open={!!confirmRemoveCt} onClose={()=>setConfirmRemoveCt(null)} onConfirm={removeContacto}
        title="¿Eliminar contacto?" message="Se eliminará este medio de contacto del perfil."
        confirmLabel="Eliminar" cancelLabel="Cancelar" danger
      />
      <ConfirmModal
        open={confirmElimFoto} onClose={()=>setConfirmElimFoto(false)} onConfirm={eliminarFoto}
        title="¿Eliminar foto?" message="Se eliminará la foto de referencia facial de esta persona."
        confirmLabel="Eliminar" cancelLabel="Cancelar" danger
      />
    </div>
  )
}
