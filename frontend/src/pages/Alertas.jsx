import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'

export default function Alertas() {
  const navigate   = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('sinAsistir')
  const [enviando, setEnviando] = useState(null)
  const [msgEnvio, setMsgEnvio] = useState({})
  const [enviandoMasivo, setEnviandoMasivo] = useState(false)
  const [msgMasivo, setMsgMasivo] = useState(null)
  const [seleccionados, setSeleccionados] = useState([])

  useEffect(() => {
    apiFetch('/alertas')
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { setSeleccionados([]) }, [tab])

  async function enviarWA(personaId, nombre) {
    setEnviando(personaId)
    try {
      const r = await apiFetch('/mensajes/enviar', {
        method:'POST',
        body: JSON.stringify({ personaId, tipo:'WHATSAPP',
          mensaje: `Hola ${nombre}! <Icons.Prayer /> Estuvimos pensando en vos. ¿Cómo estás? Cuándo podemos conectar?` })
      })
      setMsgEnvio(p => ({...p, [personaId]: r.enviado ? '✓' : r.demo ? '≡' : '✗'}))
      setTimeout(() => setMsgEnvio(p => { const n={...p}; delete n[personaId]; return n }), 4000)
    } catch { setMsgEnvio(p => ({...p, [personaId]: '✗'})) }
    setEnviando(null)
  }

  async function enviarMasivo() {
    const personas = current.filter(p => seleccionados.includes(p.personaId||p.id))
    if (!personas.length) return alert('Seleccioná al menos una persona')
    if (!confirm(`¿Enviar WhatsApp a ${personas.length} personas?`)) return
    setEnviandoMasivo(true); setMsgMasivo(null)
    let ok=0, err=0
    for (const p of personas) {
      try {
        const r = await apiFetch('/mensajes/enviar', {
          method:'POST',
          body: JSON.stringify({ personaId: p.personaId||p.id, tipo:'WHATSAPP',
            mensaje: `Hola ${p.nombre}! <Icons.Prayer /> Te contactamos desde la iglesia. ¡Te esperamos!` })
        })
        r.enviado || r.demo ? ok++ : err++
      } catch { err++ }
    }
    setEnviandoMasivo(false)
    setMsgMasivo(`<Icons.Attendance /> ${ok} enviados${err?` · ✗ ${err} fallaron`:''}`)
    setSeleccionados([])
  }

  function toggleSeleccion(id) {
    setSeleccionados(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id])
  }
  function seleccionarTodos() {
    const ids = current.map(p => p.personaId||p.id)
    setSeleccionados(ids.every(id => seleccionados.includes(id)) ? [] : ids)
  }

  if (loading) return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="empty"><div className="empty-icon"><Icons.Comunicados /></div><p>Analizando la congregación...</p></div>
      </main>
    </div>
  )

  const TABS = [
    { key:'sinAsistir',             icon:'🚨', label:'Sin asistir',     count:data?.sinAsistir?.total||0,              color:'var(--c-danger)',  bg:'var(--c-danger-bg)' },
    { key:'sinSeguimiento',         icon:'⚠', label:'Sin seguimiento', count:data?.sinSeguimiento?.total||0,          color:'var(--c-warning)', bg:'var(--c-warning-bg)' },
    { key:'visitantesSinConsolidar',icon:'⊕', label:'Visitantes',      count:data?.visitantesSinConsolidar?.total||0, color:'var(--c-info)',    bg:'var(--c-info-bg)' },
    { key:'contactosVencidos',      icon:'✓', label:'Vencidos',        count:data?.contactosVencidos?.total||0,       color:'var(--c-purple)',  bg:'var(--c-purple-bg)' },
    { key:'cumpleanosSemana',       icon:'🎂', label:'Cumpleaños',      count:data?.cumpleanosSemana?.total||0,        color:'var(--c-pink)',    bg:'var(--c-pink-bg)' },
  ]
  const current  = data?.[tab]?.data || []
  const tabInfo  = TABS.find(t => t.key === tab)
  const criticas = (data?.resumen?.critico||0)
  const totalAlertas = data?.resumen?.total||0

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Comunicados /> Alertas pastorales</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>
              Personas que necesitan atención
            </p>
          </div>
          <div className="page-actions">
            {criticas > 0 && (
              <span style={{background:'var(--c-danger-bg)',color:'var(--c-danger)',padding:'5px 14px',borderRadius:20,fontSize:13,fontWeight:700,border:'1px solid rgba(220,38,38,0.2)'}}>
                🚨 {criticas} críticas
              </span>
            )}
            <span style={{background:'var(--bg-2)',color:'var(--text-muted)',padding:'5px 12px',borderRadius:20,fontSize:13,border:'1px solid var(--border)'}}>
              {totalAlertas} total
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="alerts-tabs-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginBottom:20}}>
          {TABS.map(t => (
            <div key={t.key} onClick={() => setTab(t.key)}
              style={{
                background: tab===t.key ? t.color : 'var(--surface)',
                borderRadius:10, padding:'14px 12px', textAlign:'center',
                border: tab===t.key ? `2px solid ${t.color}` : '1px solid var(--border)',
                cursor:'pointer', transition:'all .2s',
                boxShadow: tab===t.key ? `0 4px 12px ${t.color}40` : 'none',
              }}>
              <div style={{fontSize:22,marginBottom:4}}>{t.icon}</div>
              <div style={{fontSize:26,fontWeight:800,color:tab===t.key?'var(--surface)':t.color,lineHeight:1}}>
                {t.count}
              </div>
              <div style={{fontSize:10,color:tab===t.key?'rgba(255,255,255,.75)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,marginTop:3}}>
                {t.label}
              </div>
            </div>
          ))}
        </div>

        {/* Acciones masivas */}
        {current.length > 0 && (
          <div className="bulk-actions-bar" style={{display:'flex',gap:10,alignItems:'center',marginBottom:12,padding:'10px 14px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',flexWrap:'wrap'}}>
            <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontSize:13,fontWeight:500,color:'var(--text)',textTransform:'none',letterSpacing:0}}>
              <input type="checkbox" name="seleccionarTodos"
                checked={current.every(p => seleccionados.includes(p.personaId||p.id))}
                onChange={seleccionarTodos}
                style={{width:16,height:16,cursor:'pointer',accentColor:'var(--primary)'}}/>
              {seleccionados.length > 0 ? `${seleccionados.length} seleccionados` : 'Seleccionar todos'}
            </label>
            {seleccionados.length > 0 && (
              <>
                <button className="btn btn-ghost btn-sm" style={{color:'var(--c-success)',borderColor:'rgba(22,163,74,.3)'}}
                  onClick={enviarMasivo} disabled={enviandoMasivo}>
                  {enviandoMasivo ? '… Enviando...' : `<Icons.Messages /> WA masivo (${seleccionados.length})`}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSeleccionados([])}>
                  ✕ Limpiar
                </button>
              </>
            )}
            {msgMasivo && (
              <span style={{fontSize:13,color:'var(--c-success)',fontWeight:600,marginLeft:4}}>{msgMasivo}</span>
            )}
          </div>
        )}

        {/* Tabla */}
        <div className="card alerts-card" style={{padding:0, overflowX:'auto'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,background:tabInfo?.bg}}>
            <span style={{fontSize:20}}>{tabInfo?.icon}</span>
            <h3 style={{margin:0,fontSize:14,fontWeight:700,color:tabInfo?.color}}>{tabInfo?.label}</h3>
            <span style={{fontSize:12,color:'var(--text-muted)',marginLeft:4}}>— {current.length} personas</span>
          </div>

          {current.length === 0
            ? <div className="empty"><div className="empty-icon"><Icons.Attendance /></div><p>¡Sin alertas en esta categoría!</p></div>
            : <>
              <div className="alerts-mobile-list">
                {current.map((p, i) => {
                  const pid = p.personaId||p.id
                  const sel = seleccionados.includes(pid)
                  const title = `${p.nombre || ''} ${p.apellido || ''}`.trim()
                  const meta = tab==='sinAsistir'
                    ? `Líder: ${p.liderNombre || 'sin asignar'}`
                    : tab==='sinSeguimiento'
                      ? `Último contacto: ${p.ultimoSeguimiento ? p.ultimoSeguimiento.slice(0,10) : 'nunca'}`
                      : tab==='visitantesSinConsolidar'
                        ? `Ingreso: ${p.fechaIngreso || 'sin fecha'}`
                        : tab==='contactosVencidos'
                          ? `${p.tipo || 'Contacto'} · vencía ${p.proximoContacto || 'sin fecha'}`
                          : `Cumpleaños: ${p.fechaNacimiento?.slice(5)?.replace('-','/') || 'sin fecha'}`
                  return (
                    <article key={`${pid}-${i}`} className={`alert-mobile-card${sel ? ' selected' : ''}`}>
                      <label className="alert-mobile-check">
                        <input type="checkbox" name={`mobile_sel_${pid}`} checked={sel} onChange={() => toggleSeleccion(pid)} />
                        <span>{sel ? 'Seleccionado' : 'Seleccionar'}</span>
                      </label>
                      <button type="button" className="alert-mobile-main" onClick={() => navigate(`/personas/${pid}`)}>
                        <strong>{title || 'Sin nombre'}</strong>
                        <span>{p.telefono || 'Sin teléfono'}</span>
                        <small>{meta}</small>
                      </button>
                      <div className="alert-mobile-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/personas/${pid}`)}>Perfil</button>
                        {p.telefono && (
                          <button className="btn btn-sm"
                            style={{background:'rgba(22,163,74,.08)',color:'var(--c-success)',border:'1px solid rgba(22,163,74,.2)',fontWeight:600}}
                            disabled={enviando===pid}
                            onClick={() => enviarWA(pid, p.nombre)}>
                            {enviando===pid ? 'Enviando...' : 'WhatsApp'}
                            {msgEnvio[pid] && <span style={{marginLeft:4}}>{msgEnvio[pid]}</span>}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
              <table className="alerts-table" style={{minWidth:500}}>
                <thead>
                  <tr>
                    <th style={{width:32}}></th>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    {tab==='sinAsistir'            && <><th>Líder</th></>}
                    {tab==='sinSeguimiento'         && <><th>Último contacto</th><th>Líder</th></>}
                    {tab==='visitantesSinConsolidar'&& <><th>Ingresó</th><th>Líder</th></>}
                    {tab==='contactosVencidos'      && <><th>Tipo</th><th>Vencía</th></>}
                    {tab==='cumpleanosSemana'        && <th>Cumpleaños</th>}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((p, i) => {
                    const pid = p.personaId||p.id
                    const sel = seleccionados.includes(pid)
                    return (
                      <tr key={i} style={{background: sel ? 'var(--primary-soft)' : undefined}}>
                        <td style={{textAlign:'center'}}>
                          <input type="checkbox" name={`sel_${pid}`} checked={sel} onChange={() => toggleSeleccion(pid)}
                            style={{width:15,height:15,accentColor:'var(--primary)',cursor:'pointer'}}/>
                        </td>
                        <td>
                          <strong className="persona-link" data-tip="Ver perfil"
                            onClick={() => navigate(`/personas/${pid}`)}>
                            {p.nombre} {p.apellido}
                          </strong>
                          {p.liderNombre && tab!=='sinSeguimiento' && tab!=='sinAsistir' && (
                            <div style={{fontSize:10,color:'var(--text-muted)'}}><Icons.Profile /> {p.liderNombre}</div>
                          )}
                        </td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.telefono||'—'}</td>
                        {tab==='sinAsistir' && <td style={{fontSize:12}}>{p.liderNombre||'—'}</td>}
                        {tab==='sinSeguimiento' && (
                          <>
                            <td style={{fontSize:12,color:p.ultimoSeguimiento?'var(--text-muted)':'var(--c-danger)'}}>
                              {p.ultimoSeguimiento ? p.ultimoSeguimiento.slice(0,10) : '🚨 Nunca'}
                            </td>
                            <td style={{fontSize:12}}>{p.liderNombre||'—'}</td>
                          </>
                        )}
                        {tab==='visitantesSinConsolidar' && (
                          <>
                            <td style={{fontSize:12}}>
                              {p.fechaIngreso && (() => {
                                const dias = Math.round((new Date()-new Date(p.fechaIngreso))/86400000)
                                return <span style={{color: dias>30?'var(--c-danger)':'var(--text-muted)'}}>{p.fechaIngreso} ({dias}d)</span>
                              })()}
                            </td>
                            <td style={{fontSize:12}}>{p.liderNombre||'—'}</td>
                          </>
                        )}
                        {tab==='contactosVencidos' && (
                          <>
                            <td><span className="badge badge-nuevo">{p.tipo}</span></td>
                            <td style={{fontSize:12,color:'var(--c-danger)',fontWeight:600}}>
                              {p.proximoContacto}
                            </td>
                          </>
                        )}
                        {tab==='cumpleanosSemana' && (
                          <td style={{fontSize:12,fontWeight:600}}>
                            🎂 {p.fechaNacimiento?.slice(5)?.replace('-','/')}
                            {(() => {
                              const [m,d] = (p.cumDia||'').split('-').map(Number)
                              const f = new Date(new Date().getFullYear(),m-1,d)
                              if(f<new Date())f.setFullYear(f.getFullYear()+1)
                              const dias = Math.round((f-new Date())/86400000)
                              return <span style={{color:dias===0?'var(--c-success)':'var(--text-muted)',marginLeft:6}}>{dias===0?'¡Hoy!':'en '+dias+'d'}</span>
                            })()}
                          </td>
                        )}
                        <td>
                          <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
                            <button className="btn btn-ghost btn-xs" data-tip="Ver perfil"
                              onClick={() => navigate(`/personas/${pid}`)}>Perfil</button>
                            {p.telefono && (
                              <button className="btn btn-xs"
                                style={{background:'rgba(22,163,74,.08)',color:'var(--c-success)',border:'1px solid rgba(22,163,74,.2)',fontWeight:600}}
                                data-tip="Enviar WhatsApp rápido"
                                disabled={enviando===pid}
                                onClick={() => enviarWA(pid, p.nombre)}>
                                {enviando===pid ? '…' : '✉'}
                                {msgEnvio[pid] && <span style={{marginLeft:4}}>{msgEnvio[pid]}</span>}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          }
        </div>
      </main>
    </div>
  )
}
