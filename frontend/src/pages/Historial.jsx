import { useEffect, useState, useCallback } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'

const ENTIDADES = ['PERSONA','GRUPO','USER']
const ACCIONES  = ['LOGIN','CREAR','EDITAR','ELIMINAR','REASIGNAR','DESACTIVAR']
const COLOR = {CREAR:'badge-activo',EDITAR:'badge-nuevo',ELIMINAR:'badge-inactivo',LOGIN:'badge-visitante',REASIGNAR:'badge-nuevo',DESACTIVAR:'badge-inactivo'}

export default function Historial() {
  const [data, setData]       = useState([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [entidad, setEntidad] = useState('')
  const [accion, setAccion]   = useState('')

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({page,limit:50})
      if (entidad) p.set('entidad',entidad)
      if (accion)  p.set('accion',accion)
      const res = await apiFetch(`/historial?${p}`)
      setData(res.data||[]); setTotal(res.total||0); setPages(res.pages||1)
    } catch {}
  }, [page,entidad,accion])

  useEffect(() => { load() }, [load])

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">🕓 Historial <span style={{fontSize:15,fontWeight:400,color:'var(--text-muted)'}}>({total})</span></h1>
        </div>
        <div className="toolbar">
          <select name="d" className="input" value={entidad} onChange={e=>{setEntidad(e.target.value);setPage(1)}}>
            <option value="">Todas las entidades</option>
            {ENTIDADES.map(e=><option key={e}>{e}</option>)}
          </select>
          <select name="n" className="input" value={accion} onChange={e=>{setAccion(e.target.value);setPage(1)}}>
            <option value="">Todas las acciones</option>
            {ACCIONES.map(a=><option key={a}>{a}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={()=>{setEntidad('');setAccion('');setPage(1)}}>Limpiar</button>
        </div>
        <div className="card" style={{padding:0, overflowX:'auto'}}>
          {data.length===0
            ? <div className="empty"><div className="empty-icon">🕓</div><p>Sin registros</p></div>
            : <table style={{minWidth:500}}>
                <thead><tr><th>#</th><th>Acción</th><th>Entidad</th><th>Usuario</th><th>Rol</th><th>Detalle</th><th>Fecha</th></tr></thead>
                <tbody>{data.map(r=>(
                  <tr key={r.id}>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>{r.id}</td>
                    <td><span className={`badge ${COLOR[r.accion]||'badge-visitante'}`}>{r.accion}</span></td>
                    <td style={{fontSize:12}}>{r.entidad}{r.entidadId?` #${r.entidadId}`:''}</td>
                    <td style={{fontSize:12}}>{r.email}</td>
                    <td><span className={`rol-badge rol-${r.rol}`}>{r.rol}</span></td>
                    <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12}}>{r.detalle||'—'}</td>
                    <td style={{color:'var(--text-muted)',fontSize:11,whiteSpace:'nowrap'}}>{r.fecha?.slice(0,16).replace('T',' ')}</td>
                  </tr>
                ))}</tbody>
              </table>
          }
        </div>
        {pages>1 && (
          <div className="pagination">
            <span className="pag-info">Página {page} de {pages}</span>
            <button className="pag-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Anterior</button>
            <button className="pag-btn" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Siguiente →</button>
          </div>
        )}
      </main>
    </div>
  )
}
