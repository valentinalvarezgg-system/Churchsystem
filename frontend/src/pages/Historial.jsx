import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { makeI18n } from '../lib/i18n.js'
import { useOrientation } from '../hooks/useOrientation.js'

const HIST_I18N = {
  es: { title:'Historial', allEntities:'Todas las entidades', allActions:'Todas las acciones',
        col_id:'#', col_action:'Acción', col_entity:'Entidad', col_user:'Usuario',
        col_role:'Rol', col_detail:'Detalle', col_date:'Fecha', noData:'Sin registros' },
  pt: { title:'Histórico', allEntities:'Todas as entidades', allActions:'Todas as ações',
        col_id:'#', col_action:'Ação', col_entity:'Entidade', col_user:'Usuário',
        col_role:'Perfil', col_detail:'Detalhe', col_date:'Data', noData:'Sem registros' },
  en: { title:'History', allEntities:'All entities', allActions:'All actions',
        col_id:'#', col_action:'Action', col_entity:'Entity', col_user:'User',
        col_role:'Role', col_detail:'Detail', col_date:'Date', noData:'No records' },
}

const ENTIDADES = ['PERSONA','GRUPO','USER']
const ACCIONES  = ['LOGIN','CREAR','EDITAR','ELIMINAR','REASIGNAR','DESACTIVAR']
const COLOR = {CREAR:'badge-activo',EDITAR:'badge-nuevo',ELIMINAR:'badge-inactivo',LOGIN:'badge-visitante',REASIGNAR:'badge-nuevo',DESACTIVAR:'badge-inactivo'}

export default function Historial() {
  const t = makeI18n(HIST_I18N)
  const { isPhone } = useOrientation()
  const [data, setData]       = useState([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [entidad, setEntidad] = useState('')
  const [accion, setAccion]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const p = new URLSearchParams({page,limit:50})
      if (entidad) p.set('entidad',entidad)
      if (accion)  p.set('accion',accion)
      const res = await apiFetch(`/historial?${p}`)
      setData(res.data||[]); setTotal(res.total||0); setPages(res.pages||1)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [page,entidad,accion])

  useEffect(() => { load() }, [load])

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title"><Icons.History /> {t('title')} <span style={{fontSize:15,fontWeight:400,color:'var(--text-muted)'}}>({total})</span></h1>
        </div>
        <div className="toolbar">
          <select name="d" className="input" value={entidad} onChange={e=>{setEntidad(e.target.value);setPage(1)}}>
            <option value="">{t('allEntities')}</option>
            {ENTIDADES.map(e=><option key={e}>{e}</option>)}
          </select>
          <select name="n" className="input" value={accion} onChange={e=>{setAccion(e.target.value);setPage(1)}}>
            <option value="">{t('allActions')}</option>
            {ACCIONES.map(a=><option key={a}>{a}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={()=>{setEntidad('');setAccion('');setPage(1)}}>{t('clear')}</button>
        </div>
        {error && (
          <div className="alert alert-error" style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={load}>{t('retry')}</button>
          </div>
        )}
        <div className="card" style={{padding:0, overflowX:'auto'}}>
          {loading
            ? <div className="empty"><div className="spinner-sm" /></div>
            : data.length===0
            ? <div className="empty"><div className="empty-icon"><Icons.History /></div><p>{t('noData')}</p></div>
            : isPhone
              ? <HistorialPhone data={data} t={t} />
              : <HistorialDesktop data={data} t={t} />
          }
        </div>
        {pages>1 && (
          <div className="pagination">
            <span className="pag-info">{t('page')} {page} {t('of')} {pages}</span>
            <button className="pag-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>{t('prev')}</button>
            <button className="pag-btn" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>{t('next')}</button>
          </div>
        )}
      </main>
    </div>
  )
}

function HistorialPhone({ data, t }) {
  return (
    <div className="mobile-list">
      {data.map(r => (
        <article key={r.id} className="mobile-person-card">
          <div className="mobile-person-main">
            <div className="mobile-person-info">
              <strong>#{r.id} · {r.entidad}{r.entidadId ? ` #${r.entidadId}` : ''}</strong>
              <span style={{fontSize:11,color:'var(--text-muted)'}}>{r.fecha?.slice(0,16).replace('T',' ')}</span>
            </div>
            <span className={`badge ${COLOR[r.accion] || 'badge-visitante'}`} style={{flexShrink:0}}>{r.accion}</span>
          </div>
          <div className="mobile-person-meta">
            <span>{r.email}</span>
            <span className={`rol-badge rol-${r.rol}`}>{r.rol}</span>
          </div>
          {r.detalle && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:6}}>{r.detalle}</div>}
        </article>
      ))}
    </div>
  )
}

function HistorialDesktop({ data, t }) {
  return (
    <div className="table-responsive">
      <table style={{minWidth:500}}>
        <thead><tr><th>{t('col_id')}</th><th>{t('col_action')}</th><th>{t('col_entity')}</th><th>{t('col_user')}</th><th>{t('col_role')}</th><th>{t('col_detail')}</th><th>{t('col_date')}</th></tr></thead>
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
    </div>
  )
}
