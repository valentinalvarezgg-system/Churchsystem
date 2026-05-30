import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'

const ETAPAS = ['NUEVO_CREYENTE','CONSOLIDADO','DISCIPULO','LIDER','MINISTRO']
const MATERIALES = ['BIBLIA_BASICA','CONSOLIDACION_1','CONSOLIDACION_2','DISCIPULADO_1','DISCIPULADO_2','MINISTERIO']
const ETAPA_COLOR = { NUEVO_CREYENTE:'var(--c-info)',CONSOLIDADO:'var(--c-warning)',DISCIPULO:'var(--c-success)',LIDER:'var(--c-purple)',MINISTRO:'var(--c-danger)' }
const ETAPA_BG    = { NUEVO_CREYENTE:'var(--c-info-bg)',CONSOLIDADO:'var(--c-warning-bg)',DISCIPULO:'var(--c-success-bg)',LIDER:'var(--c-purple-bg)',MINISTRO:'var(--c-danger-bg)' }
const MAT_LABEL   = { BIBLIA_BASICA:'▤ Biblia básica',CONSOLIDACION_1:'Consolidación 1',CONSOLIDACION_2:'◇ Consolidación 2',DISCIPULADO_1:'Discipulado 1',DISCIPULADO_2:'Discipulado 2',MINISTERIO:'★ Ministerio' }

export default function Discipulado() {
  const navigate = useNavigate()
  const [data, setData]     = useState([])
  const [stats, setStats]   = useState(null)
  const [total, setTotal]   = useState(0)
  const [pages, setPages]   = useState(1)
  const [page, setPage]     = useState(1)
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [materiales, setMateriales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const p = new URLSearchParams({page,limit:20})
    if (filtroEtapa) p.set('etapa',filtroEtapa)
    if (search) p.set('search',search)
    try { const res = await apiFetch(`/discipulado?${p}`); setData(res.data||[]); setTotal(res.total||0); setPages(res.pages||1) }
    catch(e) { setError(e.message) }
    setLoading(false)
  }, [page,filtroEtapa,search])

  useEffect(()=>{load()},[load])
  useEffect(()=>{ apiFetch('/discipulado/stats').then(s=>setStats(s)).catch(()=>{}) },[])

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

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header"><h1 className="page-title">Discipulado</h1></div>
        <div style={{display:'flex',overflowX:'auto',gap:10,paddingBottom:4,marginBottom:20}}>
          {ETAPAS.map(e=>(
            <div key={e} onClick={()=>setFiltroEtapa(filtroEtapa===e?'':e)}
              style={{padding:'14px 12px',borderRadius:10,border:filtroEtapa===e?`2px solid ${ETAPA_COLOR[e]}`:'1px solid var(--border)',background:filtroEtapa===e?ETAPA_BG[e]:'var(--surface)',cursor:'pointer',textAlign:'center',transition:'all .2s'}}>
              <div style={{fontSize:28,fontWeight:800,color:ETAPA_COLOR[e]}}>{totalPorEtapa[e]||0}</div>
              <div style={{fontSize:10,fontWeight:600,color:ETAPA_COLOR[e],textTransform:'uppercase',letterSpacing:.4,marginTop:2}}>{e.replace(/_/g,' ')}</div>
            </div>
          ))}
        </div>
        {stats?.bautizados&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:16}}>
            {[['💧',stats.bautizados.agua||0,'Bautizados agua'],['🕊️',stats.bautizados.espiritu||0,'Bautizados espíritu'],['📚',stats.bautizados.discipulado||0,'Discipulado completo']].map(([ic,v,l])=>(
              <div key={l} className="card" style={{display:'flex',gap:12,alignItems:'center',padding:'12px 16px'}}>
                <span style={{fontSize:28}}>{ic}</span>
                <div><div style={{fontSize:24,fontWeight:800,color:'var(--primary)'}}>{v}</div><div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.3}}>{l}</div></div>
              </div>
            ))}
          </div>
        )}
        <div className="toolbar">
          <input name="h" className="input input-search" placeholder="Buscar..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
          <button className="btn btn-ghost" data-tip="Quitar todos los filtros activos" onClick={()=>{setFiltroEtapa('');setSearch('');setPage(1)}}>Limpiar</button>
        </div>
        <div className="card" style={{padding:0}}>
          {loading
            ? <div className="empty"><p>Cargando...</p></div>
            : error
            ? <div className="alert alert-error" style={{margin:16}}>{error}</div>
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
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>
                          {p.bautizadoAgua?'💧 ':''}{p.bautizadoEspiritu?'🕊️ ':''}{p.materialesCompletados||0}/{MATERIALES.length} materiales
                        </span>
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
                        <td><strong className="persona-link" data-tip="Ver perfil completo" onClick={()=>navigate(`/personas/${p.id}`)}>{p.nombre} {p.apellido}</strong>{p.liderNombre&&<div style={{fontSize:11,color:'var(--text-muted)'}}><Icons.Profile /> {p.liderNombre}</div>}</td>
                        <td>
                          <select name="estadoEspiritual" value={p.estadoEspiritual||'NUEVO_CREYENTE'} onChange={e=>cambiarEtapa(p.id,e.target.value)}
                            style={{padding:'3px 8px',border:`1.5px solid ${ETAPA_COLOR[p.estadoEspiritual]||'var(--c-info)'}`,borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',outline:'none',background:ETAPA_BG[p.estadoEspiritual]||'var(--c-info-bg)',color:ETAPA_COLOR[p.estadoEspiritual]||'var(--c-info)'}}>
                            {ETAPAS.map(e=><option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
                          </select>
                        </td>
                        <td>
                          <div style={{display:'flex',gap:8}}>
                            <label style={{display:'flex',gap:4,alignItems:'center',fontSize:12,cursor:'pointer',textTransform:'none',letterSpacing:0,fontWeight:400,color:'var(--text)'}}>
                              <input name="bautizadoAgua" type="checkbox" checked={!!p.bautizadoAgua} onChange={()=>toggleCheck('bautizadoAgua',p.bautizadoAgua,p.id)} style={{accentColor:'var(--primary)'}}/> 💧
                            </label>
                            <label style={{display:'flex',gap:4,alignItems:'center',fontSize:12,cursor:'pointer',textTransform:'none',letterSpacing:0,fontWeight:400,color:'var(--text)'}}>
                              <input name="bautizadoEspiritu" type="checkbox" checked={!!p.bautizadoEspiritu} onChange={()=>toggleCheck('bautizadoEspiritu',p.bautizadoEspiritu,p.id)} style={{accentColor:'var(--c-purple)'}}/> 🕊️
                            </label>
                          </div>
                        </td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <div style={{width:60,height:6,background:'var(--bg-2)',borderRadius:3,overflow:'hidden'}}><div style={{width:`${(Number(p.materialesCompletados)||0)/MATERIALES.length*100}%`,height:'100%',background:'var(--c-success)'}}/></div>
                            <span style={{fontSize:11,color:'var(--text-muted)'}}>{p.materialesCompletados||0}/{MATERIALES.length}</span>
                          </div>
                        </td>
                        <td><button className="btn btn-ghost btn-sm" data-tip="Ver y actualizar el progreso de discipulado" onClick={()=>abrirModal(p)}>Ver progreso</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
          }
        </div>
        {pages>1&&<div className="pagination"><span className="pag-info">Pág {page}/{pages} · {total}</span><button className="pag-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>←</button><button className="pag-btn" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>→</button></div>}
        {modal&&(
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-header"><h3 className="modal-title"><Icons.Discipleship /> {modal.nombre} {modal.apellido}</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>✕</button></div>
              <div className="modal-body">
                {materiales.map(m=>(
                  <div key={m.material} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                      <input name="completado" type="checkbox" checked={!!m.completado} onChange={()=>toggleMaterial(m.material,m.completado)} style={{width:18,height:18,accentColor:'var(--c-success)',cursor:'pointer'}}/>
                      <div>
                        <div style={{fontSize:14,fontWeight:m.completado?600:400}}>{MAT_LABEL[m.material]||m.material}</div>
                        {m.fecha&&<div style={{fontSize:11,color:'var(--c-success)'}}><Icons.Attendance /> {m.fecha}</div>}
                      </div>
                    </div>
                    {!!m.completado&&<span className="badge badge-activo">Completado</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
