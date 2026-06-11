import { useEffect, useState, useCallback, useRef } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import { ConfirmModal } from '../components/Modal.jsx'

const ETAPAS     = ['NUEVO_CREYENTE','CONSOLIDADO','DISCIPULO','LIDER','MINISTRO']
const MATERIALES = ['BIBLIA_BASICA','CONSOLIDACION_1','CONSOLIDACION_2','DISCIPULADO_1','DISCIPULADO_2','MINISTERIO']
const ETAPA_COLOR = { NUEVO_CREYENTE:'var(--c-info)',CONSOLIDADO:'var(--c-warning)',DISCIPULO:'var(--c-success)',LIDER:'var(--c-purple)',MINISTRO:'var(--c-danger)' }
const ETAPA_BG    = { NUEVO_CREYENTE:'var(--c-info-bg)',CONSOLIDADO:'var(--c-warning-bg)',DISCIPULO:'var(--c-success-bg)',LIDER:'var(--c-purple-bg)',MINISTRO:'var(--c-danger-bg)' }
const MAT_LABEL   = { BIBLIA_BASICA:'Biblia básica',CONSOLIDACION_1:'Consolidación 1',CONSOLIDACION_2:'Consolidación 2',DISCIPULADO_1:'Discipulado 1',DISCIPULADO_2:'Discipulado 2',MINISTERIO:'Plan Ministerio' }

// ── Colores del árbol por etapa ──────────────────────────────
const TREE_COLORS = {
  NUEVO_CREYENTE: { fill:'#EFF6FF', stroke:'#3B82F6', text:'#1D4ED8' },
  CONSOLIDADO:    { fill:'#FFFBEB', stroke:'#F59E0B', text:'#92400E' },
  DISCIPULO:      { fill:'#F0FDF4', stroke:'#22C55E', text:'#166534' },
  LIDER:          { fill:'#F5F3FF', stroke:'#8B5CF6', text:'#5B21B6' },
  MINISTRO:       { fill:'#FFF1F2', stroke:'#F43F5E', text:'#9F1239' },
  DEFAULT:        { fill:'#F8FAFC', stroke:'#94A3B8', text:'#334155' },
}

// ── Árbol visual con D3 (carga dinámica) ────────────────────
function ArbolDiscipulado({ nodos, links, raices, onSelectNodo, selectedId }) {
  const svgRef = useRef(null)
  const [d3Loaded, setD3Loaded] = useState(false)

  useEffect(() => {
    if (window.__d3_loaded) { setD3Loaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'
    script.onload = () => { window.__d3_loaded = true; setD3Loaded(true) }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!d3Loaded || !svgRef.current || nodos.length === 0) return
    const d3 = window.d3
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const W = svgRef.current.clientWidth || 800
    const H = Math.max(500, nodos.length * 80)
    svg.attr('viewBox', `0 0 ${W} ${H}`)

    // Construir mapa de nodos y children
    const nodeMap = {}
    nodos.forEach(n => { nodeMap[n.id] = { ...n, children: [] } })

    // Agregar todos los nodos (incluso si no tienen relaciones aún)
    // para que el grafo siempre muestre algo
    const activeLinks = links.filter(l => l.activo)
    activeLinks.forEach(l => {
      if (nodeMap[l.discipuladorId] && nodeMap[l.discipuladoId]) {
        nodeMap[l.discipuladorId].children.push(nodeMap[l.discipuladoId])
      }
    })

    // Si no hay raíces reales, usar todos los que tengan discípulos
    let roots = raices.map(id => nodeMap[id]).filter(Boolean)
    if (roots.length === 0) roots = Object.values(nodeMap).slice(0, 5)

    // Un super-root virtual si hay múltiples raíces
    const treeRoot = roots.length === 1
      ? roots[0]
      : { id: '__root__', nombre: '', apellido: '', children: roots, _virtual: true }

    const hierarchy = d3.hierarchy(treeRoot, d => d.children?.length ? d.children : null)
    const nodeW = 160, nodeH = 52, hGap = 40, vGap = 30
    const treeLayout = d3.tree()
      .nodeSize([nodeW + hGap, nodeH + vGap])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.2)

    const root = treeLayout(hierarchy)

    // Centrar horizontalmente
    let minX = Infinity, maxX = -Infinity
    root.each(d => { if (!d.data._virtual) { minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x) } })
    const offsetX = W / 2 - (minX + maxX) / 2

    const g = svg.append('g').attr('transform', `translate(${offsetX},40)`)

    // Zoom
    const zoom = d3.zoom().scaleExtent([0.3, 2]).on('zoom', e => g.attr('transform', e.transform))
    svg.call(zoom)

    // Links — curvas suaves
    g.selectAll('.link')
      .data(root.links().filter(l => !l.source.data._virtual && !l.target.data._virtual))
      .enter().append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y + nodeH / 2))

    // Nodos
    const node = g.selectAll('.node')
      .data(root.descendants().filter(d => !d.data._virtual))
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x - nodeW / 2},${d.y})`)
      .attr('cursor', 'pointer')
      .on('click', (e, d) => onSelectNodo && onSelectNodo(d.data))

    // Fondo del nodo
    node.append('rect')
      .attr('width', nodeW)
      .attr('height', nodeH)
      .attr('rx', 10)
      .attr('fill', d => {
        const c = TREE_COLORS[d.data.estadoEspiritual] || TREE_COLORS.DEFAULT
        return d.data.id === selectedId ? c.stroke : c.fill
      })
      .attr('stroke', d => (TREE_COLORS[d.data.estadoEspiritual] || TREE_COLORS.DEFAULT).stroke)
      .attr('stroke-width', d => d.data.id === selectedId ? 2.5 : 1.5)

    // Nombre
    node.append('text')
      .attr('x', nodeW / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', d => {
        const c = TREE_COLORS[d.data.estadoEspiritual] || TREE_COLORS.DEFAULT
        return d.data.id === selectedId ? '#fff' : c.text
      })
      .text(d => `${d.data.nombre} ${d.data.apellido || ''}`.trim().slice(0, 20))

    // Etapa
    node.append('text')
      .attr('x', nodeW / 2)
      .attr('y', 38)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', d => {
        const c = TREE_COLORS[d.data.estadoEspiritual] || TREE_COLORS.DEFAULT
        return d.data.id === selectedId ? 'rgba(255,255,255,.8)' : c.stroke
      })
      .text(d => (d.data.estadoEspiritual || '').replace(/_/g, ' '))

    // Número de discípulos
    node.filter(d => d.children?.length > 0)
      .append('circle')
      .attr('cx', nodeW - 8)
      .attr('cy', 8)
      .attr('r', 9)
      .attr('fill', d => (TREE_COLORS[d.data.estadoEspiritual] || TREE_COLORS.DEFAULT).stroke)

    node.filter(d => d.children?.length > 0)
      .append('text')
      .attr('x', nodeW - 8)
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-weight', 700)
      .attr('fill', '#fff')
      .text(d => d.children.length)

  }, [d3Loaded, nodos, links, raices, selectedId, onSelectNodo])

  if (nodos.length === 0) {
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',gap:12,color:'var(--text-muted)',textAlign:'center'}}>
        <svg width="64" height="64" fill="none" viewBox="0 0 64 64"><circle cx="32" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="48" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="52" cy="48" r="10" stroke="currentColor" strokeWidth="2"/><line x1="32" y1="22" x2="12" y2="38" stroke="currentColor" strokeWidth="2"/><line x1="32" y1="22" x2="52" y2="38" stroke="currentColor" strokeWidth="2"/></svg>
        <p style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>El árbol está vacío</p>
        <p style={{fontSize:13,maxWidth:320}}>Usá el botón <strong>+ Agregar relación</strong> para registrar quién discipuló a quién y el árbol se va a construir solo.</p>
      </div>
    )
  }

  return (
    <div style={{width:'100%',overflowX:'auto',borderRadius:12,border:'1px solid var(--border)',background:'var(--surface)'}}>
      <svg ref={svgRef} style={{width:'100%',display:'block',minHeight:400}} />
    </div>
  )
}

// ── Panel lateral de nodo seleccionado ──────────────────────
function NodoPanel({ nodo, links, onClose, onEliminarLink }) {
  if (!nodo) return null
  const discipulos = links.filter(l => l.activo && l.discipuladorId === nodo.id)
  const mentor = links.find(l => l.activo && l.discipuladoId === nodo.id)
  const cols = TREE_COLORS[nodo.estadoEspiritual] || TREE_COLORS.DEFAULT

  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',minWidth:220,maxWidth:280}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{nodo.nombre} {nodo.apellido}</div>
          <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:cols.fill,color:cols.text,border:`1px solid ${cols.stroke}`,fontWeight:600}}>
            {(nodo.estadoEspiritual||'').replace(/_/g,' ')}
          </span>
        </div>
        <button style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--text-muted)',padding:0}} onClick={onClose}>×</button>
      </div>

      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>Indicadores</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
        {nodo.bautizadoAgua && <span style={{fontSize:11,background:'var(--c-info-bg)',color:'var(--c-info)',padding:'2px 7px',borderRadius:20}}>Bautizado agua</span>}
        {nodo.bautizadoEspiritu && <span style={{fontSize:11,background:'var(--c-purple-bg)',color:'var(--c-purple)',padding:'2px 7px',borderRadius:20}}>Bautizado espíritu</span>}
        {nodo.discipuladoCompletado && <span style={{fontSize:11,background:'var(--c-success-bg)',color:'var(--c-success)',padding:'2px 7px',borderRadius:20}}>Discipulado completo</span>}
      </div>

      {mentor && (
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>Fue discipulado por</div>
          <div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>ID #{mentor.discipuladorId}</div>
          <div style={{marginTop:4,fontSize:11,color:'var(--c-danger)',cursor:'pointer'}} onClick={() => onEliminarLink(mentor.id)}>× Eliminar relación</div>
        </div>
      )}

      {discipulos.length > 0 && (
        <div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4}}>Discipula a ({discipulos.length})</div>
          {discipulos.map(l => (
            <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
              <span>ID #{l.discipuladoId}</span>
              <span style={{color:'var(--c-danger)',cursor:'pointer',fontSize:11}} onClick={() => onEliminarLink(l.id)}>× Quitar</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal agregar relación ───────────────────────────────────
function ModalAgregarRelacion({ onClose, onGuardar }) {
  const [personas, setPersonas] = useState([])
  const [discipulador, setDiscipulador] = useState('')
  const [discipulado, setDiscipulado]   = useState('')
  const [fechaInicio, setFechaInicio]   = useState('')
  const [notas, setNotas]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')

  useEffect(() => {
    apiFetch(`/discipulado/arbol/personas${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then(setPersonas).catch(() => {})
  }, [search])

  async function guardar() {
    if (!discipulador || !discipulado) return toast.error('Seleccioná discipulador y discipulado')
    if (discipulador === discipulado) return toast.error('No puede ser la misma persona')
    setLoading(true)
    try {
      await apiFetch('/discipulado/arbol', { method:'POST', body: JSON.stringify({ discipuladorId: Number(discipulador), discipuladoId: Number(discipulado), fechaInicio: fechaInicio || undefined, notas: notas || undefined }) })
      toast.success('Relación registrada')
      onGuardar()
    } catch(e) { toast.error(e.message) }
    setLoading(false)
  }

  const pSelect = { padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, width:'100%' }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Agregar relación de discipulado</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,display:'block'}}>Buscar persona</label>
            <input className="input" placeholder="Filtrar por nombre..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:10}}/>
          </div>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,display:'block'}}>Discipulador (quien discipula)</label>
            <select style={pSelect} value={discipulador} onChange={e=>setDiscipulador(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido} — {(p.estadoEspiritual||'').replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,display:'block'}}>Discipulado (quien es discipulado)</label>
            <select style={pSelect} value={discipulado} onChange={e=>setDiscipulado(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {personas.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido} — {(p.estadoEspiritual||'').replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,display:'block'}}>Fecha de inicio</label>
              <input type="date" className="input" value={fechaInicio} onChange={e=>setFechaInicio(e.target.value)}/>
            </div>
            <div>
              <label style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,display:'block'}}>Notas</label>
              <input className="input" placeholder="Opcional..." value={notas} onChange={e=>setNotas(e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{display:'flex',justifyContent:'flex-end',gap:8,padding:'12px 20px'}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={loading}>{loading ? 'Guardando...' : 'Guardar relación'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function Discipulado({ title = 'Discipulado' }) {
  const navigate = useNavigate()
  const [tab, setTab]           = useState('lista')      // 'lista' | 'arbol'
  const [data, setData]         = useState([])
  const [stats, setStats]       = useState(null)
  const [total, setTotal]       = useState(0)
  const [pages, setPages]       = useState(1)
  const [page, setPage]         = useState(1)
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)
  const [materiales, setMateriales] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // Árbol
  const [arbolData, setArbolData]   = useState({ nodos:[], links:[], raices:[] })
  const [arbolLoading, setArbolLoading] = useState(false)
  const [arbolError, setArbolError]     = useState(null)
  const [selectedNodo, setSelectedNodo] = useState(null)
  const [modalRelacion, setModalRelacion] = useState(false)
  const [confirmLinkId, setConfirmLinkId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const p = new URLSearchParams({page,limit:20})
    if (filtroEtapa) p.set('etapa',filtroEtapa)
    if (search) p.set('search',search)
    try { const res = await apiFetch(`/discipulado?${p}`); setData(res.data||[]); setTotal(res.total||0); setPages(res.pages||1) }
    catch(e) { setError(e.message) }
    setLoading(false)
  }, [page,filtroEtapa,search])

  const loadArbol = useCallback(async () => {
    setArbolLoading(true); setArbolError(null)
    try { const res = await apiFetch('/discipulado/arbol'); setArbolData(res) }
    catch(e) { setArbolError(e.message) }
    setArbolLoading(false)
  }, [])

  useEffect(()=>{load()},[load])
  useEffect(()=>{ apiFetch('/discipulado/stats').then(s=>setStats(s)).catch(()=>{}) },[])
  useEffect(()=>{ if(tab==='arbol') loadArbol() },[tab,loadArbol])

  const totalPorEtapa = ETAPAS.reduce((acc,e)=>({...acc,[e]:0}),{})
  stats?.porEtapa?.forEach(r=>{ if(r.estadoEspiritual) totalPorEtapa[r.estadoEspiritual]=Number(r.total) })

  async function abrirModal(p) {
    setModal(p); try { setMateriales(await apiFetch(`/discipulado/${p.id}/materiales`)||[]) } catch {}
  }
  async function cambiarEtapa(id, etapa) {
    try { await apiFetch(`/discipulado/${id}`,{method:'PUT',body:JSON.stringify({estadoEspiritual:etapa})}); load() } catch(e){toast.error(e.message)}
  }
  async function toggleCheck(campo, valor, id) {
    try { await apiFetch(`/discipulado/${id}`,{method:'PUT',body:JSON.stringify({[campo]:valor?0:1})}); load() } catch(e){toast.error(e.message)}
  }
  async function toggleMaterial(material, completado) {
    try { await apiFetch(`/discipulado/${modal.id}/materiales/${material}`,{method:'PUT',body:JSON.stringify({completado:completado?0:1})}); setMateriales(await apiFetch(`/discipulado/${modal.id}/materiales`)||[]); load() } catch(e){toast.error(e.message)}
  }
  function eliminarLink(id) {
    setConfirmLinkId(id)
  }

  async function doEliminarLink() {
    const id = confirmLinkId
    setConfirmLinkId(null)
    try { await apiFetch(`/discipulado/arbol/${id}`,{method:'DELETE'}); toast.success('Relación eliminada'); loadArbol(); setSelectedNodo(null) } catch(e){toast.error(e.message)}
  }

  const TAB_STYLE = (active) => ({
    padding:'8px 20px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    transition:'all .15s'
  })

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">{title}</h1>
          <div style={{display:'flex',gap:4,background:'var(--bg-2)',borderRadius:10,padding:3}}>
            <button style={TAB_STYLE(tab==='lista')} onClick={()=>setTab('lista')}>Lista</button>
            <button style={TAB_STYLE(tab==='arbol')} onClick={()=>setTab('arbol')}>Árbol</button>
          </div>
        </div>

        {/* ── TAB LISTA ── */}
        {tab==='lista' && <>
          <div style={{display:'flex',overflowX:'auto',gap:10,paddingBottom:4,marginBottom:20}}>
            {ETAPAS.map(e=>(
              <div key={e} onClick={()=>setFiltroEtapa(filtroEtapa===e?'':e)}
                style={{padding:'14px 12px',borderRadius:10,border:filtroEtapa===e?`2px solid ${ETAPA_COLOR[e]}`:'1px solid var(--border)',background:filtroEtapa===e?ETAPA_BG[e]:'var(--surface)',cursor:'pointer',textAlign:'center',transition:'all .2s',minWidth:100}}>
                <div style={{fontSize:28,fontWeight:800,color:ETAPA_COLOR[e]}}>{totalPorEtapa[e]||0}</div>
                <div style={{fontSize:10,fontWeight:600,color:ETAPA_COLOR[e],textTransform:'uppercase',letterSpacing:.4,marginTop:2}}>{e.replace(/_/g,' ')}</div>
              </div>
            ))}
          </div>
          {stats?.bautizados&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:16}}>
              {[['',stats.bautizados.agua||0,'Bautizados agua'],['',stats.bautizados.espiritu||0,'Bautizados espíritu'],['',stats.bautizados.discipulado||0,'Discipulado completo']].map(([ic,v,l])=>(
                <div key={l} className="card" style={{display:'flex',gap:12,alignItems:'center',padding:'12px 16px'}}>
                  <span style={{fontSize:28}}>{ic}</span>
                  <div><div style={{fontSize:24,fontWeight:800,color:'var(--primary)'}}>{v}</div><div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div></div>
                </div>
              ))}
            </div>
          )}
          <div className="toolbar">
            <input name="h" className="input input-search" placeholder="Buscar..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
            <button className="btn btn-ghost" onClick={()=>{setFiltroEtapa('');setSearch('');setPage(1)}}>Limpiar</button>
          </div>
          <div className="card" style={{padding:0}}>
            {loading ? <div className="empty"><p>Cargando...</p></div>
            : error ? <div className="alert alert-error" style={{margin:16}}>{error}</div>
            : data.length===0 ? <div className="empty"><div className="empty-icon"><Icons.Discipleship /></div><p>Sin resultados</p></div>
            : <>
                <div className="mobile-list">
                  {data.map(p=>(
                    <div key={p.id} className="mobile-person-card">
                      <div className="mobile-person-main">
                        <strong className="persona-link" onClick={()=>navigate(`/personas/${p.id}`)}>{p.nombre} {p.apellido}</strong>
                        <span style={{padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700,background:ETAPA_BG[p.estadoEspiritual]||'var(--c-info-bg)',color:ETAPA_COLOR[p.estadoEspiritual]||'var(--c-info)'}}>{(p.estadoEspiritual||'NUEVO_CREYENTE').replace(/_/g,' ')}</span>
                      </div>
                      <div className="mobile-person-meta">
                        {p.liderNombre && <span style={{fontSize:11,color:'var(--text-muted)'}}><Icons.Profile /> {p.liderNombre}</span>}
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{p.materialesCompletados||0}/{MATERIALES.length} materiales</span>
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{marginTop:6,width:'100%'}} onClick={()=>abrirModal(p)}>Ver progreso</button>
                    </div>
                  ))}
                </div>
                <div className="table-responsive">
                  <table style={{minWidth:500}}>
                    <thead><tr><th>Persona</th><th>Etapa</th><th>Bautismos</th><th>Materiales</th><th>Acciones</th></tr></thead>
                    <tbody>{data.map(p=>(
                      <tr key={p.id}>
                        <td><strong className="persona-link" onClick={()=>navigate(`/personas/${p.id}`)}>{p.nombre} {p.apellido}</strong>{p.liderNombre&&<div style={{fontSize:11,color:'var(--text-muted)'}}>{p.liderNombre}</div>}</td>
                        <td>
                          <select name="estadoEspiritual" value={p.estadoEspiritual||'NUEVO_CREYENTE'} onChange={e=>cambiarEtapa(p.id,e.target.value)}
                            style={{padding:'3px 8px',border:`1.5px solid ${ETAPA_COLOR[p.estadoEspiritual]||'var(--c-info)'}`,borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',outline:'none',background:ETAPA_BG[p.estadoEspiritual]||'var(--c-info-bg)',color:ETAPA_COLOR[p.estadoEspiritual]||'var(--c-info)'}}>
                            {ETAPAS.map(e=><option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
                          </select>
                        </td>
                        <td>
                          <div style={{display:'flex',gap:8}}>
                            <label style={{display:'flex',gap:4,alignItems:'center',fontSize:12,cursor:'pointer',fontWeight:400,color:'var(--text)'}}>
                              <input name="bautizadoAgua" type="checkbox" checked={!!p.bautizadoAgua} onChange={()=>toggleCheck('bautizadoAgua',p.bautizadoAgua,p.id)} style={{accentColor:'var(--primary)'}}/>
                            </label>
                            <label style={{display:'flex',gap:4,alignItems:'center',fontSize:12,cursor:'pointer',fontWeight:400,color:'var(--text)'}}>
                              <input name="bautizadoEspiritu" type="checkbox" checked={!!p.bautizadoEspiritu} onChange={()=>toggleCheck('bautizadoEspiritu',p.bautizadoEspiritu,p.id)} style={{accentColor:'var(--c-purple)'}}/>
                            </label>
                          </div>
                        </td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div style={{width:60,height:6,background:'var(--bg-2)',borderRadius:3,overflow:'hidden'}}><div style={{width:`${(Number(p.materialesCompletados)||0)/MATERIALES.length*100}%`,height:'100%',background:'var(--c-success)'}}/></div>
                            <span style={{fontSize:11,color:'var(--text-muted)'}}>{p.materialesCompletados||0}/{MATERIALES.length}</span>
                          </div>
                        </td>
                        <td><button className="btn btn-ghost btn-sm" onClick={()=>abrirModal(p)}>Ver progreso</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            }
          </div>
          {pages>1&&<div className="pagination"><span className="pag-info">Pág {page}/{pages} · {total}</span><button className="pag-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>←</button><button className="pag-btn" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>→</button></div>}
        </>}

        {/* ── TAB ÁRBOL ── */}
        {tab==='arbol' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div style={{fontSize:13,color:'var(--text-muted)'}}>
                {arbolData.nodos.length} personas · {arbolData.links.filter(l=>l.activo).length} relaciones activas
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button className="btn btn-ghost btn-sm" onClick={loadArbol}>Actualizar</button>
                <button className="btn btn-primary btn-sm" onClick={()=>setModalRelacion(true)}>+ Agregar relación</button>
              </div>
            </div>

            {/* Leyenda de etapas */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
              {ETAPAS.map(e => {
                const c = TREE_COLORS[e]
                return (
                  <span key={e} style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:c.fill,color:c.text,border:`1px solid ${c.stroke}`,fontWeight:500}}>
                    {e.replace(/_/g,' ')}
                  </span>
                )
              })}
            </div>

            {arbolLoading ? (
              <div className="empty"><p>Cargando árbol...</p></div>
            ) : arbolError ? (
              <div className="alert alert-error">{arbolError}</div>
            ) : (
              <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
                <div style={{flex:1,minWidth:0}}>
                  <ArbolDiscipulado
                    nodos={arbolData.nodos}
                    links={arbolData.links}
                    raices={arbolData.raices}
                    selectedId={selectedNodo?.id}
                    onSelectNodo={setSelectedNodo}
                  />
                  <p style={{fontSize:11,color:'var(--text-muted)',marginTop:8,textAlign:'center'}}>
                    Hacé scroll con la rueda para hacer zoom · Arrastrá para mover · Clic en un nodo para ver detalles
                  </p>
                </div>
                {selectedNodo && (
                  <NodoPanel
                    nodo={selectedNodo}
                    links={arbolData.links}
                    onClose={()=>setSelectedNodo(null)}
                    onEliminarLink={eliminarLink}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Modal progreso materiales ── */}
        {modal&&(
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-header"><h3 className="modal-title"><Icons.Discipleship /> {modal.nombre} {modal.apellido}</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>×</button></div>
              <div className="modal-body">
                {materiales.map(m=>(
                  <div key={m.material} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                      <input name="completado" type="checkbox" checked={!!m.completado} onChange={()=>toggleMaterial(m.material,m.completado)} style={{width:18,height:18,accentColor:'var(--c-success)',cursor:'pointer'}}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:m.completado?600:400}}>{MAT_LABEL[m.material]||m.material}</div>
                        {m.fecha&&<div style={{fontSize:11,color:'var(--c-success)'}}>{m.fecha}</div>}
                      </div>
                    </div>
                    {!!m.completado&&<span className="badge badge-activo">Completado</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Modal agregar relación ── */}
        {modalRelacion && (
          <ModalAgregarRelacion
            onClose={() => setModalRelacion(false)}
            onGuardar={() => { setModalRelacion(false); loadArbol() }}
          />
        )}
        <ConfirmModal
          open={confirmLinkId !== null}
          onClose={() => setConfirmLinkId(null)}
          onConfirm={doEliminarLink}
          title="¿Eliminar relación de discipulado?"
          message="Esta acción no se puede deshacer."
          danger
        />
      </main>
    </div>
  )
}
