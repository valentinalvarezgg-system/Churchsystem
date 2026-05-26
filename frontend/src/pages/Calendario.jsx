import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'

const TIPOS  = ['CULTO','REUNION','EVENTO','CAPACITACION','RETIRO','OTRO']
const TCOLOR = { CULTO:'#2563EB', REUNION:'#7C3AED', EVENTO:'#059669', CAPACITACION:'#D97706', RETIRO:'#DB2777', OTRO:'#64748B' }
const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const EMPTY  = { titulo:'', tipo:'CULTO', fecha: new Date().toISOString().slice(0,10), hora:'', lugar:'', descripcion:'' }

export default function Calendario() {
  const user    = getUser()
  const canEdit = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(user?.rol)
  const hoy     = new Date()

  const [año, setAño]       = useState(hoy.getFullYear())
  const [mes, setMes]       = useState(hoy.getMonth())
  const [eventos, setEventos]   = useState([])
  const [proximos, setProximos] = useState([])
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(EMPTY)
  const [selEv, setSelEv]   = useState(null)
  const [view, setView]     = useState('mes') // mes | lista

  async function load() {
    const desde = new Date(año, mes, 1).toISOString().slice(0,10)
    const hasta = new Date(año, mes+1, 0).toISOString().slice(0,10)
    try {
      const [ev, prox] = await Promise.all([
        apiFetch(`/eventos?desde=${desde}&hasta=${hasta}`),
        apiFetch('/eventos/proximos')
      ])
      setEventos(ev||[]); setProximos(prox||[])
    } catch {}
  }
  useEffect(() => { load() }, [año, mes])

  const primerDia = new Date(año, mes, 1).getDay()
  const diasMes   = new Date(año, mes+1, 0).getDate()
  const semanas   = Math.ceil((primerDia + diasMes) / 7)
  const celdas    = Array.from({ length: semanas*7 }, (_, i) => {
    const d = i - primerDia + 1
    return (d >= 1 && d <= diasMes) ? d : null
  })

  const evsDia = d => {
    if (!d) return []
    const fecha = `${año}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return eventos.filter(e => e.fecha === fecha)
  }

  const esHoy = d => d && año===hoy.getFullYear() && mes===hoy.getMonth() && d===hoy.getDate()

  async function handleSave(e) {
    e.preventDefault()
    try {
      await apiFetch('/eventos', { method:'POST', body: JSON.stringify(form) })
      setModal(false); setForm(EMPTY); load()
    } catch(e) { alert(e.message) }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar evento?')) return
    try { await apiFetch(`/eventos/${id}`, { method:'DELETE' }); setSelEv(null); load() }
    catch(e) { alert(e.message) }
  }

  const f = (k, v) => setForm(p => ({...p, [k]:v}))

  function navMes(dir) {
    if (dir > 0) { if (mes===11) { setMes(0); setAño(a=>a+1) } else setMes(m=>m+1) }
    else         { if (mes===0)  { setMes(11); setAño(a=>a-1) } else setMes(m=>m-1) }
  }

  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Calendar /> Calendario</h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
              {eventos.length} eventos este mes
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ display:'flex', background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)', overflowX:'auto' }}>
              {[['mes','▦'],['lista','≡']].map(([k,ic]) => (
                <button key={k} onClick={() => setView(k)}
                  style={{
                    padding:'7px 14px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                    background: view===k ? 'var(--primary)' : 'transparent',
                    color: view===k ? 'var(--surface)' : 'var(--text-muted)',
                    transition:'all .15s',
                  }}>
                  {ic}
                </button>
              ))}
            </div>
            {canEdit && (
              <button className="btn btn-primary" data-tip="Agregar nuevo evento"
                onClick={() => { setForm({...EMPTY, fecha:hoyStr}); setModal(true) }}>
                + Evento
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, alignItems:'start' }}>

          {/* Columna izquierda — calendario o lista */}
          <div>
            {/* Navegación de mes */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              marginBottom:16, padding:'10px 0',
            }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navMes(-1)}>← Anterior</button>
              <div style={{ textAlign:'center' }}>
                <h2 style={{ margin:0, fontSize:18, fontWeight:800, letterSpacing:'-0.5px' }}>
                  {MESES[mes]} {año}
                </h2>
                <button style={{ fontSize:11, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', padding:0, marginTop:2 }}
                  onClick={() => { setAño(hoy.getFullYear()); setMes(hoy.getMonth()) }}>
                  Hoy
                </button>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navMes(1)}>Siguiente →</button>
            </div>

            {/* Vista mes */}
            {view === 'mes' && (
              <div className="card" style={{ padding:0, overflowX:'auto' }}>
                {/* Cabecera días */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)' }}>
                  {DIAS.map(d => (
                    <div key={d} style={{
                      padding:'8px 4px', textAlign:'center',
                      fontSize:11, fontWeight:700, color:'var(--text-muted)',
                      background:'var(--bg)',
                    }}>{d}</div>
                  ))}
                </div>
                {/* Celdas */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                  {celdas.map((d, i) => {
                    const evs = evsDia(d)
                    const today = esHoy(d)
                    return (
                      <div key={i}
                        onClick={() => {
                          if (!d) return
                          if (canEdit && evs.length === 0) {
                            const fecha = `${año}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                            setForm({...EMPTY, fecha}); setModal(true)
                          } else if (evs.length > 0) {
                            setSelEv(evs[0])
                          }
                        }}
                        style={{
                          minHeight: 80, padding:'6px 4px',
                          borderRight:'1px solid var(--border)',
                          borderBottom:'1px solid var(--border)',
                          background: today ? 'var(--primary-soft)' : d ? 'var(--surface)' : 'var(--bg)',
                          cursor: d ? 'pointer' : 'default',
                          transition:'background .1s',
                          position:'relative',
                        }}
                        onMouseEnter={e2 => { if(d) e2.currentTarget.style.background = today ? 'var(--primary-soft)' : 'var(--bg)' }}
                        onMouseLeave={e2 => { if(d) e2.currentTarget.style.background = today ? 'var(--primary-soft)' : 'var(--surface)' }}>
                        {d && (
                          <>
                            <div style={{
                              width:24, height:24, borderRadius:'50%',
                              background: today ? 'var(--primary)' : 'transparent',
                              color: today ? 'var(--surface)' : 'var(--text)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:12, fontWeight: today ? 800 : 500,
                              marginBottom:3,
                            }}>
                              {d}
                            </div>
                            {evs.slice(0,2).map((ev, j) => (
                              <div key={j}
                                onClick={e2 => { e2.stopPropagation(); setSelEv(ev) }}
                                style={{
                                  fontSize:10, fontWeight:600, padding:'2px 5px', borderRadius:3,
                                  marginBottom:2, whiteSpace:'nowrap', overflowX:'auto', textOverflow:'ellipsis',
                                  background: (TCOLOR[ev.tipo]||'#64748B')+'20',
                                  color: TCOLOR[ev.tipo]||'#64748B',
                                  borderLeft:`2px solid ${TCOLOR[ev.tipo]||'#64748B'}`,
                                }}>
                                {ev.hora && <span style={{ marginRight:3 }}>{ev.hora.slice(0,5)}</span>}
                                {ev.titulo}
                              </div>
                            ))}
                            {evs.length > 2 && (
                              <div style={{ fontSize:10, color:'var(--text-muted)', paddingLeft:5 }}>+{evs.length-2} más</div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Vista lista */}
            {view === 'lista' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {eventos.length === 0
                  ? <div className="empty"><div className="empty-icon"><Icons.Calendar /></div><p>Sin eventos este mes</p></div>
                  : eventos.sort((a,b) => a.fecha.localeCompare(b.fecha)).map(ev => (
                    <div key={ev.id} className="card"
                      onClick={() => setSelEv(ev)}
                      style={{
                        padding:'14px 18px', cursor:'pointer', transition:'box-shadow .15s',
                        borderLeft:`4px solid ${TCOLOR[ev.tipo]||'#64748B'}`,
                        display:'flex', gap:14, alignItems:'center',
                      }}
                      onMouseEnter={e2 => e2.currentTarget.style.boxShadow='var(--shadow-md)'}
                      onMouseLeave={e2 => e2.currentTarget.style.boxShadow='none'}>
                      <div style={{
                        width:44, height:44, borderRadius:'var(--r)', flexShrink:0,
                        background: (TCOLOR[ev.tipo]||'#64748B')+'15',
                        border:`1px solid ${TCOLOR[ev.tipo]||'#64748B'}30`,
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        color: TCOLOR[ev.tipo]||'#64748B',
                      }}>
                        <div style={{ fontSize:13, fontWeight:800 }}>{ev.fecha.slice(8)}</div>
                        <div style={{ fontSize:10 }}>{MESES[Number(ev.fecha.slice(5,7))-1]?.slice(0,3)}</div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{ev.titulo}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', gap:10 }}>
                          {ev.hora && <span>🕐 {ev.hora}</span>}
                          {ev.lugar && <span>📍 {ev.lugar}</span>}
                          <span style={{ background:(TCOLOR[ev.tipo]||'#64748B')+'15', color:TCOLOR[ev.tipo]||'#64748B', padding:'0 6px', borderRadius:3, fontWeight:600, fontSize:10 }}>
                            {ev.tipo}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Columna derecha — próximos eventos */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="card">
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:14, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)' }}>
                Próximos eventos
              </h3>
              {proximos.length === 0
                ? <p style={{ fontSize:13, color:'var(--text-muted)' }}>Sin eventos próximos</p>
                : proximos.map(ev => {
                    const fecha = new Date(ev.fecha+'T12:00:00')
                    const dias  = Math.round((fecha - new Date()) / 86400000)
                    return (
                      <div key={ev.id}
                        onClick={() => setSelEv(ev)}
                        style={{
                          display:'flex', gap:10, alignItems:'center',
                          padding:'9px 0', borderBottom:'1px solid var(--border)', cursor:'pointer',
                        }}>
                        <div style={{
                          width:36, height:36, borderRadius:'var(--r)', flexShrink:0,
                          background: (TCOLOR[ev.tipo]||'#64748B')+'15',
                          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        }}>
                          <div style={{ fontSize:11, fontWeight:800, color:TCOLOR[ev.tipo]||'#64748B', lineHeight:1 }}>
                            {String(ev.fecha.slice(8)).padStart(2,'0')}
                          </div>
                          <div style={{ fontSize:9, color:'var(--text-muted)', lineHeight:1 }}>
                            {MESES[Number(ev.fecha.slice(5,7))-1]?.slice(0,3)}
                          </div>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, whiteSpace:'nowrap', overflowX:'auto', textOverflow:'ellipsis' }}>
                            {ev.titulo}
                          </div>
                          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{ev.hora||''}</div>
                        </div>
                        <span style={{
                          fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, flexShrink:0,
                          background: dias === 0 ? 'var(--c-success-bg)' : dias <= 3 ? 'var(--c-warning-bg)' : 'var(--bg)',
                          color: dias === 0 ? 'var(--c-success)' : dias <= 3 ? 'var(--c-warning)' : 'var(--text-muted)',
                        }}>
                          {dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${dias}d`}
                        </span>
                      </div>
                    )
                  })
              }
            </div>

            {/* Leyenda de tipos */}
            <div className="card">
              <h3 style={{ fontSize:11, fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)' }}>
                Tipos
              </h3>
              {TIPOS.map(t => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', fontSize:12 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:TCOLOR[t], flexShrink:0 }}/>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal detalle evento */}
        {selEv && (
          <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setSelEv(null)}>
            <div className="modal" style={{ maxWidth:440 }}>
              <div className="modal-header" style={{ borderLeft:`4px solid ${TCOLOR[selEv.tipo]||'#64748B'}` }}>
                <div>
                  <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:TCOLOR[selEv.tipo]||'#64748B' }}>
                    {selEv.tipo}
                  </span>
                  <h3 className="modal-title" style={{ marginTop:2 }}>{selEv.titulo}</h3>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelEv(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
                    <span><Icons.Attendance /></span>
                    <span style={{ fontWeight:600 }}>{selEv.fecha}</span>
                  </div>
                  {selEv.hora && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
                      <span>🕐</span>
                      <span>{selEv.hora}</span>
                    </div>
                  )}
                  {selEv.lugar && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
                      <span>📍</span>
                      <span>{selEv.lugar}</span>
                    </div>
                  )}
                </div>
                {selEv.descripcion && (
                  <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, margin:0 }}>
                    {selEv.descripcion}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="modal-footer" style={{display:'flex',gap:8,justifyContent:'space-between'}}>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(selEv.id)}>
                    Eliminar
                  </button>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      const d = selEv.fecha?.replace(/-/g,'')
                      const h = (selEv.hora||'10:00').replace(':','') + '00'
                      const ics = [
                        'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ChurchSystem//ES',
                        'BEGIN:VEVENT',
                        `DTSTART:${d}T${h}`,
                        `SUMMARY:${selEv.titulo}`,
                        selEv.lugar ? `LOCATION:${selEv.lugar}` : '',
                        selEv.descripcion ? `DESCRIPTION:${selEv.descripcion}` : '',
                        'END:VEVENT','END:VCALENDAR'
                      ].filter(Boolean).join('\r\n')
                      const blob = new Blob([ics], {type:'text/calendar'})
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = `${selEv.titulo}.ics`
                      a.click()
                    }}>
                      <Icons.Calendar /> Agregar al calendario
                    </button>
                    <button className="btn btn-ghost" onClick={() => setSelEv(null)}>Cerrar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal nuevo evento */}
        {modal && (
          <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title"><Icons.Calendar /> Nuevo evento</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div className="form-grid">
                    <div className="form-group full">
                      <label>Título *</label>
                      <input name="titulo" className="form-input" required
                        value={form.titulo} onChange={e => f('titulo', e.target.value)}
                        placeholder="Nombre del evento"/>
                    </div>
                    <div className="form-group">
                      <label>Tipo</label>
                      <select name="tipo" className="form-input" value={form.tipo} onChange={e => f('tipo', e.target.value)}>
                        {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Fecha *</label>
                      <input name="fecha" className="form-input" type="date" required
                        value={form.fecha} onChange={e => f('fecha', e.target.value)}/>
                    </div>
                    <div className="form-group">
                      <label>Hora</label>
                      <input name="hora" className="form-input" type="time"
                        value={form.hora} onChange={e => f('hora', e.target.value)}/>
                    </div>
                    <div className="form-group">
                      <label>Lugar</label>
                      <input name="lugar" className="form-input"
                        value={form.lugar} onChange={e => f('lugar', e.target.value)}
                        placeholder="Salón principal, zoom..."/>
                    </div>
                    <div className="form-group full">
                      <label>Descripción</label>
                      <textarea name="descripcion" className="form-input" rows={3}
                        value={form.descripcion} onChange={e => f('descripcion', e.target.value)}/>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar evento</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
