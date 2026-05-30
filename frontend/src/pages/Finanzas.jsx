import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser, getApiUrl, getStoredContext } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'

const TIPOS = ['DIEZMO','OFRENDA','ESPECIAL','PRIMER_FRUTOS','MISION','OTRO']
const TIPO_COLOR = {
  DIEZMO:'#16A34A', OFRENDA:'#2563EB', ESPECIAL:'#7C3AED',
  PRIMER_FRUTOS:'#D97706', MISION:'#DC2626', OTRO:'#64748B'
}
const TIPO_ICON = {
  DIEZMO:'💚', OFRENDA:'💙', ESPECIAL:'💜',
  PRIMER_FRUTOS:'🌾', MISION:'🌍', OTRO:'✉'
}
const EMPTY = {
  monto:'', tipo:'OFRENDA',
  fecha: new Date().toISOString().slice(0,10),
  cultoId:'', descripcion:''
}
const fmtMoney = (n, currency = 'ARS') => Number(n||0).toLocaleString('es-AR',{style:'currency',currency,minimumFractionDigits:0})

// Mini gráfico de barras horizontales
function BarChart({ data, total, currency }) {
  if (!data?.length) return null
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {data.map(t => {
        const pct = total > 0 ? Math.round(Number(t.subtotal||0)/total*100) : 0
        return (
          <div key={t.tipo}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <span style={{fontSize:12,fontWeight:600,display:'flex',gap:5,alignItems:'center'}}>
                <span>{TIPO_ICON[t.tipo]}</span> {t.tipo}
                <span style={{fontSize:10,color:'var(--text-muted)'}}>({t.qty})</span>
              </span>
              <span style={{fontSize:12,fontWeight:700,color:TIPO_COLOR[t.tipo]}}>{fmtMoney(t.subtotal, currency)}</span>
            </div>
            <div style={{height:6,background:'var(--bg-2)',borderRadius:3,overflow:'hidden'}}>
              <div style={{
                height:'100%', width:pct+'%', borderRadius:3,
                background:TIPO_COLOR[t.tipo], transition:'width .5s ease'
              }}/>
            </div>
            <div style={{fontSize:10,color:'var(--text-muted)',marginTop:1}}>{pct}% del total</div>
          </div>
        )
      })}
    </div>
  )
}

export default function Finanzas() {
  const user    = getUser()
  const isAdmin = user?.rol === 'PASTOR_GENERAL'

  const [data, setData]       = useState([])
  const [porTipo, setPorTipo] = useState([])
  const [tendencia, setTendencia] = useState([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [filtros, setFiltros] = useState({ desde:'', hasta:'', tipo:'' })
  const [cultos, setCultos]   = useState([])
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [msg, setMsg]         = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [view, setView]       = useState('tabla')  // tabla | graficos
  const [currency, setCurrency] = useState(getStoredContext().currency || 'ARS')

  const load = useCallback(async () => {
    const p = new URLSearchParams({page, limit:30})
    if (filtros.desde) p.set('desde', filtros.desde)
    if (filtros.hasta) p.set('hasta', filtros.hasta)
    if (filtros.tipo)  p.set('tipo',  filtros.tipo)
    try {
      const res = await apiFetch(`/finanzas?${p}`)
      setData(res.data||[]); setTotal(res.total||0)
      setPages(res.pages||1); setPorTipo(res.porTipo||[])
      setTendencia(res.tendencia||[])
      if (res.currency) setCurrency(res.currency)
    } catch {}
  }, [page, filtros])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onChange = event => {
      const path = event.detail?.path || ''
      if (!path || path.startsWith('/finanzas') || path.startsWith('/config')) load()
    }
    window.addEventListener('church:data-changed', onChange)
    const timer = window.setInterval(load, 10000)
    return () => {
      window.removeEventListener('church:data-changed', onChange)
      window.clearInterval(timer)
    }
  }, [load])
  useEffect(() => { apiFetch('/cultos').then(c => setCultos(c||[])).catch(()=>{}) }, [])

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      await apiFetch('/finanzas', {
        method:'POST',
        body: JSON.stringify({...form, monto: Number(form.monto), cultoId: form.cultoId||null})
      })
      setModal(false); setForm(EMPTY); load()
    } catch(err) { setMsg({type:'error', text: err.message}) }
  }

  async function eliminar() {
    if (!confirmDel) return
    try { await apiFetch(`/finanzas/${confirmDel}`, {method:'DELETE'}); setConfirmDel(null); load(); toast.success('Registro eliminado') }
    catch(e) { toast.error(e.message) }
  }

  const totalGeneral = porTipo.reduce((a,b) => a + Number(b.subtotal||0), 0)
  const f = (k,v) => setForm(p => ({...p, [k]:v}))

  // Tendencia mensual — calcular max para las barras
  const maxTend = Math.max(...tendencia.map(t => Number(t.total||0)), 1)

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Finance /> Finanzas</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>
              Registro de ofrendas, diezmos y movimientos
            </p>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <div style={{display:'flex',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',overflow:'hidden'}}>
              {[['tabla','≡'],['graficos','▤']].map(([k,ic]) => (
                <button key={k} onClick={() => setView(k)}
                  style={{padding:'7px 14px',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
                    background: view===k ? 'var(--primary)' : 'transparent',
                    color: view===k ? 'var(--surface)' : 'var(--text-muted)',
                    transition:'all .15s'}}>
                  {ic}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button className="btn btn-ghost" data-tip="Exportar finanzas a Excel"
                onClick={() => window.open(`${getApiUrl()}/finanzas/export?token=${localStorage.getItem('token')}`, '_blank')}>
                ↑ Excel
              </button>
            )}
            <button className="btn btn-primary" data-tip="Registrar nuevo movimiento"
              onClick={() => { setModal(true); setMsg(null) }}>
              + Registrar
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="stats-grid" style={{marginBottom:20}}>
          <div className="stat-card" onClick={() => setFiltros({desde:'',hasta:'',tipo:''})} style={{cursor:'pointer'}}>
            <div style={{fontSize:18,marginBottom:4}}><Icons.Finance /></div>
            <div className="stat-val" style={{fontSize:20,color:'var(--c-green-dark)'}}>{fmtMoney(totalGeneral, currency)}</div>
            <div className="stat-lbl">Total general</div>
          </div>
          {porTipo.slice(0,4).map(t => (
            <div key={t.tipo} className="stat-card" onClick={() => setFiltros(f => ({...f, tipo: t.tipo}))} style={{cursor:'pointer'}}>
              <div style={{fontSize:18,marginBottom:4}}>{TIPO_ICON[t.tipo]}</div>
              <div className="stat-val" style={{fontSize:18, color: TIPO_COLOR[t.tipo]}}>{fmtMoney(t.subtotal, currency)}</div>
              <div className="stat-lbl">{t.tipo} · {t.qty}</div>
            </div>
          ))}
        </div>

        {/* Vista gráficos */}
        {view === 'graficos' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,marginBottom:16}}>
            {/* Por tipo */}
            <div className="card">
              <h3 style={{fontSize:13,fontWeight:700,marginBottom:16}}><Icons.Reports /> Por tipo</h3>
              <BarChart data={porTipo} total={totalGeneral} currency={currency} />
            </div>
            {/* Tendencia mensual */}
            <div className="card">
              <h3 style={{fontSize:13,fontWeight:700,marginBottom:16}}><Icons.Reports /> Tendencia mensual</h3>
              {tendencia.length === 0
                ? <div className="empty" style={{padding:'20px 0'}}><p>Sin datos suficientes</p></div>
                : (
                  <div style={{display:'flex',alignItems:'flex-end',gap:6,height:100}}>
                    {tendencia.slice(-8).map((m,i,arr) => {
                      const val = Number(m.total||0)
                      const h   = Math.max(Math.round(val/maxTend*100), 4)
                      const es  = i === arr.length-1
                      return (
                        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                          {val>0&&<span style={{fontSize:8,color:es?'var(--c-green-dark)':'var(--text-faint)',fontWeight:600,writingMode:'vertical-rl',transform:'rotate(180deg)',maxHeight:40,overflow:'hidden'}}>
                            {Math.round(val/1000)}k
                          </span>}
                          <div style={{
                            width:'100%', height:h+'%', minHeight:4,
                            background: es ? 'var(--c-green-dark)' : 'var(--primary-soft)',
                            borderRadius:'3px 3px 0 0', transition:'height .4s'
                          }}/>
                          <span style={{fontSize:9,color:'var(--text-faint)'}}>{(m.mes||'').slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="toolbar">
          <input name="desde" type="date" className="input" value={filtros.desde}
            onChange={e => setFiltros(f=>({...f, desde:e.target.value}))} style={{width:140}}/>
          <input name="hasta" type="date" className="input" value={filtros.hasta}
            onChange={e => setFiltros(f=>({...f, hasta:e.target.value}))} style={{width:140}}/>
          <select name="tipo" className="input" value={filtros.tipo}
            onChange={e => setFiltros(f=>({...f, tipo:e.target.value}))}>
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_ICON[t]} {t}</option>)}
          </select>
          <button className="btn btn-ghost" data-tip="Limpiar filtros"
            onClick={() => { setFiltros({desde:'',hasta:'',tipo:''}); setPage(1) }}>
            Limpiar
          </button>
          <span style={{fontSize:12,color:'var(--text-muted)',marginLeft:'auto'}}>
            {total} registros
          </span>
        </div>

        {/* Tabla */}
        <div className="card" style={{padding:0, overflowX:'auto'}}>
          {data.length === 0
            ? <div className="empty"><div className="empty-icon"><Icons.Finance /></div><p>Sin registros para los filtros seleccionados</p></div>
            : <table style={{minWidth:500}}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Culto</th>
                    <th>Descripción</th>
                    <th>Registrado por</th>
                    {isAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map(r => (
                    <tr key={r.id}>
                      <td style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{r.fecha}</td>
                      <td>
                        <span style={{
                          padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700,
                          background: TIPO_COLOR[r.tipo]+'18',
                          color: TIPO_COLOR[r.tipo]
                        }}>
                          {TIPO_ICON[r.tipo]} {r.tipo}
                        </span>
                      </td>
                      <td style={{fontWeight:800, color:'var(--c-green-dark)', fontSize:14}}>
                        {fmtMoney(r.monto, currency)}
                      </td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{r.cultoNombre||'—'}</td>
                      <td style={{fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {r.descripcion||'—'}
                      </td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.autorNombre||'—'}</td>
                      {isAdmin && (
                        <td>
                          <button className="btn btn-danger btn-xs" data-tip="Eliminar registro"
                            onClick={() => setConfirmDel(r.id)}>✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div className="pagination">
            <span className="pag-info">Pág {page}/{pages} · {total}</span>
            <button className="pag-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>←</button>
            {Array.from({length: Math.min(pages,5)}, (_,i) => {
              const n = page <= 3 ? i+1 : page + i - 2
              if (n < 1 || n > pages) return null
              return <button key={n} className={`pag-btn${n===page?' active':''}`} onClick={() => setPage(n)}>{n}</button>
            })}
            <button className="pag-btn" disabled={page===pages} onClick={() => setPage(p=>p+1)}>→</button>
          </div>
        )}

        {/* Modal nuevo registro */}
        {modal && (
          <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title"><Icons.Finance /> Nuevo registro</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Monto *</label>
                      <input name="monto" className="form-input" type="number" min="0" step="1"
                        value={form.monto} onChange={e => f('monto', e.target.value)} required
                        placeholder="Ej: 5000"/>
                    </div>
                    <div className="form-group">
                      <label>Tipo</label>
                      <select name="tipo" className="form-input" value={form.tipo} onChange={e => f('tipo', e.target.value)}>
                        {TIPOS.map(t => <option key={t} value={t}>{TIPO_ICON[t]} {t}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Fecha *</label>
                      <input name="fecha" className="form-input" type="date"
                        value={form.fecha} onChange={e => f('fecha', e.target.value)} required/>
                    </div>
                    <div className="form-group">
                      <label>Culto (opcional)</label>
                      <select name="cultoId" className="form-input" value={form.cultoId} onChange={e => f('cultoId', e.target.value)}>
                        <option value="">Sin culto asociado</option>
                        {cultos.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.fecha}</option>)}
                      </select>
                    </div>
                    <div className="form-group full">
                      <label>Descripción</label>
                      <input name="descripcion" className="form-input"
                        value={form.descripcion} onChange={e => f('descripcion', e.target.value)}
                        placeholder="Ej: Ofrenda culto del domingo"/>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar registro</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
      <ConfirmModal
        open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={eliminar}
        title="¿Eliminar registro?" danger
        message="Este movimiento financiero será eliminado permanentemente."
        confirmLabel="Eliminar" cancelLabel="Cancelar"
      />
    </div>
  )
}
