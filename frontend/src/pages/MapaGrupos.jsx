import { useEffect, useState, useCallback, useRef } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'

const GRUPO_COLORS = [
  '#6D5DFB','#3B82F6','#22C55E','#F59E0B','#EC4899',
  '#8B5CF6','#EF4444','#14B8A6','#F97316','#6366F1'
]
const ESTADO_COLOR = { ACTIVO:'#22C55E', VISITANTE:'#3B82F6', INACTIVO:'#94A3B8' }

export default function MapaGrupos() {
  const mapRef    = useRef(null)
  const leafletRef = useRef(null)
  const mapInst   = useRef(null)
  const [data, setData]       = useState({ personas:[], grupos:[] })
  const [loading, setLoading] = useState(true)
  const [leafletReady, setLeafletReady] = useState(false)
  const [filtro, setFiltro]   = useState('todos')   // 'todos' | 'por_grupo' | 'sin_grupo'
  const [grupoSel, setGrupoSel] = useState(null)
  const [infoPanel, setInfoPanel] = useState(null)
  const [editCoords, setEditCoords] = useState(null) // { tipo:'persona'|'grupo', id, nombre }

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await apiFetch('/grupos/mapa') || { personas:[], grupos:[] }) } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Cargar Leaflet dinámicamente
  useEffect(() => {
    if (window.__leaflet_loaded) { setLeafletReady(true); return }
    const css = document.createElement('link')
    css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(css)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => { window.__leaflet_loaded = true; setLeafletReady(true) }
    document.head.appendChild(script)
  }, [])

  // Renderizar mapa cuando todo esté listo
  useEffect(() => {
    if (!leafletReady || !mapRef.current || loading) return
    const L = window.L
    if (!L) return

    // Destruir instancia previa
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }

    const map = L.map(mapRef.current, { zoomControl: true }).setView([-34.6037, -58.3816], 11)
    mapInst.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map)

    const grupoColorMap = {}
    data.grupos.forEach((g, i) => { grupoColorMap[g.id] = GRUPO_COLORS[i % GRUPO_COLORS.length] })

    // Marcadores de sedes de grupos
    data.grupos.filter(g => g.lat && g.lng).forEach(g => {
      const color = grupoColorMap[g.id] || '#6D5DFB'
      const icon = L.divIcon({
        html: `<div style="background:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`,
        iconSize: [30, 30], iconAnchor: [15, 30], className: ''
      })
      L.marker([Number(g.lat), Number(g.lng)], { icon })
        .addTo(map)
        .bindPopup(`<strong style="color:${color}">📍 ${g.nombre}</strong><br/>Sede del grupo<br/>Miembros: ${g.miembros}${g.cultoDia ? `<br/>Día: ${g.cultoDia}` : ''}`)
        .on('click', () => setInfoPanel({ tipo:'grupo', ...g, color }))
    })

    // Filtro de personas
    let personasMostrar = data.personas
    if (filtro === 'por_grupo' && grupoSel) personasMostrar = data.personas.filter(p => p.grupoId === grupoSel)
    if (filtro === 'sin_grupo') personasMostrar = data.personas.filter(p => !p.grupoId)

    // Marcadores de personas
    personasMostrar.forEach(p => {
      const color = p.grupoId ? (grupoColorMap[p.grupoId] || '#94A3B8') : (ESTADO_COLOR[p.estado] || '#94A3B8')
      const icon = L.divIcon({
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: ''
      })
      L.marker([Number(p.lat), Number(p.lng)], { icon })
        .addTo(map)
        .bindPopup(`<strong>${p.nombre} ${p.apellido}</strong><br/>Estado: ${p.estado}${p.grupoNombre ? `<br/>Grupo: ${p.grupoNombre}` : ''}`)
    })

    // Ajustar vista a los marcadores
    const allCoords = [
      ...data.grupos.filter(g => g.lat && g.lng).map(g => [Number(g.lat), Number(g.lng)]),
      ...personasMostrar.map(p => [Number(p.lat), Number(p.lng)])
    ]
    if (allCoords.length > 1) {
      try { map.fitBounds(L.latLngBounds(allCoords), { padding: [30, 30] }) } catch {}
    } else if (allCoords.length === 1) {
      map.setView(allCoords[0], 13)
    }

  }, [leafletReady, data, loading, filtro, grupoSel])

  async function guardarCoords(lat, lng, direccion) {
    if (!editCoords) return
    try {
      const endpoint = editCoords.tipo === 'persona'
        ? `/grupos/mapa/persona/${editCoords.id}`
        : `/grupos/mapa/grupo/${editCoords.id}`
      await apiFetch(endpoint, { method:'PUT', body: JSON.stringify({ lat, lng, direccion }) })
      toast.success('Coordenadas guardadas')
      setEditCoords(null); load()
    } catch(e) { toast.error(e.message) }
  }

  return (
    <div className="layout"><Menu />
      <main className="main" style={{ padding:0, display:'flex', flexDirection:'column', height:'100vh' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div>
            <h1 style={{ fontSize:18, fontWeight:700, margin:0 }}>🗺️ Mapa de grupos</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>
              {data.personas.length} personas · {data.grupos.filter(g => g.lat).length} sedes marcadas
            </p>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {/* Filtros */}
            {['todos','por_grupo','sin_grupo'].map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{ fontSize:11, padding:'5px 12px', borderRadius:20, cursor:'pointer', fontWeight:filtro===f?700:400,
                  background: filtro===f?'var(--primary)':'var(--bg-2)', color: filtro===f?'#fff':'var(--text)',
                  border: filtro===f?'none':'1px solid var(--border)' }}>
                {f==='todos'?'Todos':f==='por_grupo'?'Por grupo':'Sin grupo'}
              </button>
            ))}
            {filtro === 'por_grupo' && (
              <select style={{ fontSize:11, padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)' }}
                value={grupoSel || ''} onChange={e => setGrupoSel(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Todos los grupos</option>
                {data.grupos.map(g => <option key={g.id} value={g.id}>{g.nombre} ({g.miembros})</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Contenedor mapa + panel */}
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          {/* Mapa */}
          <div style={{ flex:1, position:'relative' }}>
            {loading && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', zIndex:10 }}>
                <p style={{ color:'var(--text-muted)' }}>Cargando datos...</p>
              </div>
            )}
            {!loading && data.personas.length === 0 && data.grupos.filter(g=>g.lat).length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', zIndex:5, gap:12 }}>
                <span style={{ fontSize:48 }}>🗺️</span>
                <p style={{ fontWeight:700, fontSize:15 }}>Sin coordenadas cargadas</p>
                <p style={{ fontSize:13, color:'var(--text-muted)', maxWidth:360, textAlign:'center' }}>
                  Para mostrar personas en el mapa, editá un miembro y cargá sus coordenadas (lat/lng). Para las sedes de grupos, usá el botón en la lista de grupos.
                </p>
              </div>
            )}
            <div ref={mapRef} style={{ width:'100%', height:'100%' }} />
          </div>

          {/* Panel lateral info */}
          {infoPanel && (
            <div style={{ width:260, background:'var(--surface)', borderLeft:'1px solid var(--border)', padding:'16px', overflowY:'auto', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <strong style={{ fontSize:14 }}>{infoPanel.nombre || `${infoPanel.nombre} ${infoPanel.apellido}`}</strong>
                <button onClick={() => setInfoPanel(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)' }}>×</button>
              </div>
              {infoPanel.tipo === 'grupo' && (
                <>
                  <p style={{ fontSize:12, color:'var(--text-muted)' }}>Sede del grupo</p>
                  <p style={{ fontSize:12 }}>Miembros: <strong>{infoPanel.miembros}</strong></p>
                  {infoPanel.cultoDia && <p style={{ fontSize:12 }}>Día: <strong>{infoPanel.cultoDia}</strong></p>}
                  {infoPanel.direccionSede && <p style={{ fontSize:12 }}>Dirección: {infoPanel.direccionSede}</p>}
                  <button className="btn btn-ghost btn-sm" style={{ marginTop:10, width:'100%', fontSize:11 }}
                    onClick={() => setEditCoords({ tipo:'grupo', id:infoPanel.id, nombre:infoPanel.nombre })}>
                    ✏️ Editar coordenadas
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal editar coords */}
        {editCoords && (
          <EditCoordsModal item={editCoords} onClose={() => setEditCoords(null)} onSave={guardarCoords} />
        )}
      </main>
    </div>
  )
}

function EditCoordsModal({ item, onClose, onSave }) {
  const [lat, setLat]           = useState('')
  const [lng, setLng]           = useState('')
  const [direccion, setDireccion] = useState('')
  const [buscando, setBuscando] = useState(false)

  async function geocodificar() {
    if (!direccion.trim()) return toast.error('Ingresá una dirección')
    setBuscando(true)
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}&limit=1`)
      const results = await r.json()
      if (results.length) {
        setLat(results[0].lat)
        setLng(results[0].lon)
        toast.success('Coordenadas encontradas')
      } else {
        toast.error('No se encontró la dirección')
      }
    } catch { toast.error('Error al buscar dirección') }
    setBuscando(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <h3 className="modal-title">Editar coordenadas — {item.nombre}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Buscar por dirección</label>
            <div style={{ display:'flex', gap:8 }}>
              <input className="form-input" style={{ flex:1 }} placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                value={direccion} onChange={e => setDireccion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && geocodificar()} />
              <button className="btn btn-ghost btn-sm" onClick={geocodificar} disabled={buscando}>
                {buscando ? '...' : '🔍'}
              </button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Latitud</label>
              <input className="form-input" type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="-34.6037" /></div>
            <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Longitud</label>
              <input className="form-input" type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="-58.3816" /></div>
          </div>
          <p style={{ fontSize:11, color:'var(--text-muted)' }}>
            Podés buscar la dirección y el sistema la geocodifica automáticamente usando OpenStreetMap (gratuito), o ingresar las coordenadas manualmente.
          </p>
        </div>
        <div className="modal-footer" style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(lat, lng, direccion)} disabled={!lat || !lng}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
