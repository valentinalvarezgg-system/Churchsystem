import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser, getApiUrl } from '../services/api.js'
import Modal, { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { makeI18n } from '../lib/i18n.js'
import { useOrientation } from '../hooks/useOrientation.js'

const ASIS_I18N = {
  es: { title:'Asistencia a cultos', newService:'+ Nuevo culto', loadingServices:'Cargando cultos...',
        noServices:'Sin cultos cargados', present:'presentes', openAttend:'Abrir asistencia',
        loadingList:'Cargando listado...', saving:'Guardando...', export:'Exportar',
        markAll:'Marcar todos', unmarkAll:'Desmarcar todos',
        newServiceModal:'Nuevo culto', nameLabel:'Nombre *', dateLabel:'Fecha *',
        typeLabel:'Tipo', regular:'Culto regular', special:'Culto especial',
        dayLabel:'Día', timeLabel:'Horario', selectLabel:'Seleccioná...',
        create:'Crear', delServiceTitle:'¿Eliminar culto?',
        delServiceMsg:'Se eliminará el culto y todo su registro de asistencia. Esta acción es permanente.',
        attendSaved:'Asistencia guardada:',
        showStats:'Estadísticas', noStats:'Sin datos todavía',
        attendanceTrend:'Tendencia de asistencia', byDay:'Promedio por día',
        avgPresent:'prom.', cultosLabel:'cultos',
  },
  pt: { title:'Presença aos cultos', newService:'+ Novo culto', loadingServices:'Carregando cultos...',
        noServices:'Sem cultos carregados', present:'presentes', openAttend:'Abrir presença',
        loadingList:'Carregando lista...', saving:'Salvando...', export:'Exportar',
        markAll:'Marcar todos', unmarkAll:'Desmarcar todos',
        newServiceModal:'Novo culto', nameLabel:'Nome *', dateLabel:'Data *',
        typeLabel:'Tipo', regular:'Culto regular', special:'Culto especial',
        dayLabel:'Dia', timeLabel:'Horário', selectLabel:'Selecione...',
        create:'Criar', delServiceTitle:'Excluir culto?',
        delServiceMsg:'O culto e todo o seu registro de presença serão excluídos. Esta ação é permanente.',
        attendSaved:'Presença salva:',
        showStats:'Estatísticas', noStats:'Sem dados ainda',
        attendanceTrend:'Tendência de presença', byDay:'Média por dia',
        avgPresent:'méd.', cultosLabel:'cultos',
  },
  en: { title:'Service attendance', newService:'+ New service', loadingServices:'Loading services...',
        noServices:'No services loaded', present:'present', openAttend:'Open attendance',
        loadingList:'Loading list...', saving:'Saving...', export:'Export',
        markAll:'Mark all', unmarkAll:'Unmark all',
        newServiceModal:'New service', nameLabel:'Name *', dateLabel:'Date *',
        typeLabel:'Type', regular:'Regular service', special:'Special service',
        dayLabel:'Day', timeLabel:'Time', selectLabel:'Select...',
        create:'Create', delServiceTitle:'Delete service?',
        delServiceMsg:'The service and all its attendance records will be deleted. This action is permanent.',
        attendSaved:'Attendance saved:',
        showStats:'Statistics', noStats:'No data yet',
        attendanceTrend:'Attendance trend', byDay:'Average by day',
        avgPresent:'avg.', cultosLabel:'services',
  },
}

const DIAS_REGULARES = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO']
const CULTOS_ESPECIALES = ['Oración','Mujeres','Sanos por la Palabra','Pre-Adolescentes','Adolescentes','Jóvenes','Jóvenes Adultos','Escuelita']
const HORARIOS = ['8:45','10hs','18hs','19hs','20hs','21hs']

function dayRank(dia) {
  const i = DIAS_REGULARES.indexOf(String(dia || '').toUpperCase())
  return i === -1 ? 99 : i
}

function fechaCorta(fecha) {
  if (!fecha) return 'Sin fecha'
  const [year, month, day] = String(fecha).slice(0, 10).split('-')
  return day && month && year ? `${day}/${month}/${year}` : fecha
}

export default function Asistencia() {
  const t = makeI18n(ASIS_I18N)
  const { isPhone } = useOrientation()
  const user = getUser()
  const canManage = ['PASTOR_GENERAL','PASTOR_CULTO'].includes(user?.rol)
  const [cultos, setCultos]       = useState([])
  const [selected, setSelected]   = useState(null)
  const [detalle, setDetalle]     = useState(null)
  const [search, setSearch]       = useState('')
  const [presentes, setPresentes] = useState(new Set())
  const [saving, setSaving]       = useState(false)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ nombre:'', fecha:new Date().toISOString().slice(0,10), cultoDia:'DOMINGO', cultoTurno:0, observaciones:'', esEspecial:false, nombreEspecial:'', horario:'18hs' })
  const [msg, setMsg]             = useState(null)
  const [confirmDelCulto, setConfirmDelCulto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [showStats, setShowStats]       = useState(false)
  const [stats, setStats]               = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  async function loadStats() {
    setStatsLoading(true)
    try { setStats(await apiFetch('/cultos/stats?limit=12')) } catch {}
    setStatsLoading(false)
  }

  async function loadCultos() {
    setLoading(true); setError(null)
    try { setCultos(await apiFetch('/cultos') || []) } catch(e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { loadCultos() }, [])

  const loadDetalle = useCallback(async () => {
    if (!selected) return
    try {
      const p = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await apiFetch(`/cultos/${selected}/asistencia${p}`)
      setDetalle(res)
      setPresentes(new Set(res.personas.filter(p=>p.presente).map(p=>Number(p.id))))
    } catch {}
  }, [selected, search])

  useEffect(() => { loadDetalle() }, [loadDetalle])

  function togglePresente(id) {
    setPresentes(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function guardar() {
    setSaving(true); setMsg(null)
    try {
      const res = await apiFetch(`/cultos/${selected}/asistencia`, { method:'POST', body:JSON.stringify({ presentes:[...presentes] }) })
      setMsg({ type:'success', text:`${t('attendSaved')} ${res.presentes} ${t('present')}` })
      loadCultos()
    } catch(e) { setMsg({ type:'error', text:e.message }) }
    setSaving(false)
  }

  async function crearCulto(e) {
    e.preventDefault()
    try {
      await apiFetch('/cultos', { method:'POST', body:JSON.stringify({...form, cultoTurno:Number(form.cultoTurno)||0}) })
      setModal(false); loadCultos()
    } catch(e) { toast.error(e.message) }
  }

  async function eliminarCulto() {
    if (!confirmDelCulto) return
    try {
      await apiFetch(`/cultos/${confirmDelCulto}`,{method:'DELETE'})
      setConfirmDelCulto(null); setSelected(null); setDetalle(null); loadCultos()
    } catch(e) { toast.error(e.message) }
  }

  const cultoActual = cultos.find(c=>Number(c.id)===Number(selected))
  const cultosOrdenados = [...cultos].sort((a, b) => {
    const dia = dayRank(a.cultoDia) - dayRank(b.cultoDia)
    if (dia !== 0) return dia
    const fecha = String(a.fecha || '').localeCompare(String(b.fecha || ''))
    if (fecha !== 0) return fecha
    return String(a.nombre || '').localeCompare(String(b.nombre || ''))
  })

  function abrirCulto(culto) {
    setSelected(Number(culto.id))
    setDetalle(null)
    setPresentes(new Set())
    setSearch('')
    setMsg(null)
  }

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <h1 className="page-title">{t('title')}</h1>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (!showStats && !stats) loadStats(); setShowStats(s => !s) }}
              style={{fontWeight: showStats ? 700 : 400}}>
              {t('showStats')}
            </button>
            {canManage && <button className="btn btn-primary" data-tip="Crear un nuevo registro de culto" onClick={()=>setModal(true)}>{t('newService')}</button>}
          </div>
        </div>
        {showStats && (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:20,marginBottom:18}}>
            {statsLoading ? (
              <p style={{color:'var(--text-muted)',fontSize:13,margin:0}}>{t('loading')}</p>
            ) : !stats || stats.tendencias.length === 0 ? (
              <p style={{color:'var(--text-muted)',fontSize:13,margin:0}}>{t('noStats')}</p>
            ) : (
              <div style={{display:'grid',gap:20}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>{t('attendanceTrend')}</div>
                  <div style={{display:'flex',alignItems:'flex-end',gap:3,height:72}}>
                    {stats.tendencias.map(c => {
                      const pct = c.total > 0 ? (c.presentes / c.total) * 100 : 0
                      const barH = Math.max(3, Math.round(pct * 0.65))
                      const label = c.cultoDia ? c.cultoDia.slice(0,3) : fechaCorta(c.fecha).slice(0,5)
                      return (
                        <div key={c.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,minWidth:0}}
                          title={`${c.nombre}\n${c.presentes}/${c.total} · ${Math.round(pct)}%`}>
                          <div style={{width:'100%',background:`hsl(${Math.round(pct*1.2)},65%,48%)`,borderRadius:'2px 2px 0 0',height:barH,minHeight:3}} />
                          <span style={{fontSize:8,color:'var(--text-faint)',overflow:'hidden',whiteSpace:'nowrap',maxWidth:'100%',textAlign:'center'}}>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {stats.porDia.length > 0 && (
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>{t('byDay')}</div>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                      {stats.porDia.map(d => (
                        <div key={d.cultoDia} style={{padding:'8px 12px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',minWidth:80}}>
                          <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',marginBottom:2}}>{d.cultoDia}</div>
                          <div style={{fontSize:22,fontWeight:800,color:'var(--text)',lineHeight:1.1}}>{d.promedio}</div>
                          <div style={{fontSize:10,color:'var(--text-faint)',marginTop:2}}>{t('avgPresent')} · {d.cultos} {t('cultosLabel')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="empty"><p>{t('loadingServices')}</p></div>
        ) : error ? (
          <div className="alert alert-error" style={{marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={loadCultos}>{t('retry')}</button>
          </div>
        ) : cultosOrdenados.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"></div>
            <p>{t('noServices')}</p>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14}}>
            {cultosOrdenados.map(c => {
              const active = Number(selected) === Number(c.id)
              const dia = c.cultoDia || 'ESPECIAL'
              return (
                <button
                  key={c.id}
                  onClick={() => abrirCulto(c)}
                  style={{
                    textAlign:'left',padding:16,borderRadius:'var(--r-lg)',border:`1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                    background: active ? 'var(--primary-soft)' : 'var(--surface)',color:'var(--text)',cursor:'pointer',
                    boxShadow: active ? '0 14px 36px rgba(77,70,229,.16)' : 'var(--shadow-sm)',
                    transition:'var(--t)',minHeight:146,display:'grid',alignContent:'space-between',gap:12,
                  }}
                >
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginBottom:10}}>
                      <span style={{fontSize:11,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-faint)',fontWeight:800}}>{dia}</span>
                      <span className="badge badge-activo">{c.presentes || 0} {t('present')}</span>
                    </div>
                    <div style={{fontSize:16,fontWeight:800,lineHeight:1.25,marginBottom:6}}>{c.nombre}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>{fechaCorta(c.fecha)}</div>
                  </div>
                  <div style={{fontSize:12,color:'var(--primary)',fontWeight:700}}>{t('openAttend')}</div>
                </button>
              )
            })}
          </div>
        )}

        <Modal
          open={!!selected}
          onClose={() => { setSelected(null); setDetalle(null); setSearch(''); setMsg(null) }}
          title={cultoActual?.nombre || 'Asistencia'}
          subtitle={cultoActual ? `${cultoActual.cultoDia || 'Culto especial'} · ${fechaCorta(cultoActual.fecha)}` : ''}
          size="xl"
          noPadding
        >
          <div style={{display:'grid',gap:0}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                {detalle && <span style={{fontSize:13,color:'var(--text-muted)',fontWeight:700}}>{presentes.size}/{detalle.personas.length} presentes</span>}
                {msg && <span className={`alert alert-${msg.type}`} style={{padding:'7px 10px',fontSize:12}}>{msg.text}</span>}
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                {canManage && <>
                  <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving || !detalle}>{saving ? t('saving') : t('save')}</button>
                  <button className="btn btn-ghost btn-sm" data-tip="Descargar planilla Excel con la asistencia" onClick={async()=>{const tk=localStorage.getItem('token');const r=await fetch(`${getApiUrl()}/export/asistencia/${selected}`,{headers:{Authorization:`Bearer ${tk}`}});if(!r.ok)return;const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`asistencia-${selected}.xlsx`;a.click();URL.revokeObjectURL(u)}}>{t('export')}</button>
                  <button className="btn btn-danger btn-sm" data-tip="Eliminar este culto y su registro de asistencia" onClick={()=>setConfirmDelCulto(selected)}>{t('delete')}</button>
                </>}
              </div>
            </div>

            <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',display:'flex',gap:10,flexWrap:'wrap'}}>
              <input name="h" className="input input-search" placeholder="Buscar persona..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:'1 1 220px'}} />
              {detalle && (
                <button className="btn btn-ghost btn-sm" onClick={()=>setPresentes(p=>p.size===detalle.personas.length?new Set():new Set((detalle?.personas || []).map(x=>Number(x.id))))}>
                  {presentes.size===detalle.personas?.length ? t('unmarkAll') : t('markAll')}
                </button>
              )}
            </div>

            {!detalle ? (
              <div className="empty"><p>{t('loadingList')}</p></div>
            ) : (
              <div style={{padding:18}}>
                {isPhone
                  ? <AsistenciaPhone personas={detalle?.personas} presentes={presentes} canManage={canManage} togglePresente={togglePresente} />
                  : <AsistenciaDesktop personas={detalle?.personas} presentes={presentes} canManage={canManage} togglePresente={togglePresente} />
                }
              </div>
            )}
          </div>
        </Modal>
        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
            <div className="modal">
              <div className="modal-header"><h3 className="modal-title">{t('newServiceModal')}</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>×</button></div>
              <form onSubmit={crearCulto}>
                <div className="modal-body">
                  <div className="form-grid">
                    <div className="form-group full"><label>{t('nameLabel')}</label><input name="nombre" className="form-input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} required placeholder={form.esEspecial ? form.nombreEspecial || "Oración" : `${form.cultoDia||"DOMINGO"} ${form.horario||"18hs"}`}/></div>
                    <div className="form-group"><label>{t('dateLabel')}</label><input name="fecha" className="form-input" type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} required/>{form.fecha&&<span style={{fontSize:11,color:'var(--text-muted)',marginTop:3,display:'block'}}>{new Date(form.fecha+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>}</div>
                    <div className="form-group full">
                      <label>{t('typeLabel')}</label>
                      <div className="radio-culto-group" style={{display:'flex',gap:10,marginBottom:10}}>
                        {[['regular',t('regular')],['especial',t('special')]].map(([k,l])=>(
                          <label key={k} className="radio-culto-option" style={{flex:1,minWidth:0,display:'flex',gap:8,alignItems:'flex-start',padding:'9px 12px',border:`1px solid ${!form.esEspecial===!(k==='especial')?'var(--primary)':'var(--border)'}`,borderRadius:'var(--r)',cursor:'pointer',fontSize:13,fontWeight:!form.esEspecial===!(k==='especial')?600:400,background:!form.esEspecial===!(k==='especial')?'var(--primary-soft)':'transparent'}}>
                            <input name="esEspecial" type="radio" checked={form.esEspecial===(k==='especial')} onChange={()=>setForm(f=>({...f,esEspecial:k==='especial',nombre:k==='especial'?f.nombreEspecial||'':`${f.cultoDia} ${f.horario}`}))} style={{accentColor:'var(--primary)',flexShrink:0,width:18,height:18,marginTop:1}}/>
                            <span className="radio-culto-label">{l}</span>
                          </label>
                        ))}
                      </div>
                      {!form.esEspecial ? (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                          <div><label style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:4}}>{t('dayLabel')}</label>
                            <select name="cultoDia" className="form-input" value={form.cultoDia} onChange={e=>setForm(f=>({...f,cultoDia:e.target.value,nombre:`${e.target.value} ${f.horario}`}))}>
                              {DIAS_REGULARES.map(d=><option key={d} value={d}>{d}</option>)}
                            </select></div>
                          <div><label style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,display:'block',marginBottom:4}}>{t('timeLabel')}</label>
                            <select name="horario" className="form-input" value={form.horario} onChange={e=>setForm(f=>({...f,horario:e.target.value,nombre:`${f.cultoDia} ${e.target.value}`}))}>
                              {HORARIOS.map(h=><option key={h} value={h}>{h}</option>)}
                            </select></div>
                        </div>
                      ) : (
                        <select name="nombreEspecial" className="form-input" value={form.nombreEspecial} onChange={e=>setForm(f=>({...f,nombreEspecial:e.target.value,nombre:e.target.value}))}>
                          <option value="">{t('selectLabel')}</option>
                          {CULTOS_ESPECIALES.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary">{t('create')}</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
      <ConfirmModal
        open={!!confirmDelCulto} onClose={()=>setConfirmDelCulto(null)} onConfirm={eliminarCulto}
        title={t('delServiceTitle')} danger
        message={t('delServiceMsg')}
        confirmLabel={t('delete')} cancelLabel={t('cancel')}
      />
    </div>
  )
}

function AsistenciaPhone({ personas, presentes, canManage, togglePresente }) {
  return (
    <div className="attendance-mobile-list">
      {(personas || []).map(p => {
        const checked = presentes.has(Number(p.id))
        return (
          <button key={p.id} className={`attendance-person-card${checked ? ' is-present' : ''}`}
            onClick={() => canManage && togglePresente(Number(p.id))}>
            <span className="attendance-check">{checked ? 'OK' : ''}</span>
            <span className="attendance-person-name">{p.nombre} {p.apellido}</span>
            <span className={`badge badge-${p.estado?.toLowerCase()}`}>{p.estado}</span>
          </button>
        )
      })}
    </div>
  )
}

function AsistenciaDesktop({ personas, presentes, canManage, togglePresente }) {
  return (
    <div className="attendance-table-wrap" style={{maxHeight:'calc(88dvh - 250px)',overflowY:'auto',overflowX:'auto'}}>
      <table style={{minWidth:500}}>
        <thead><tr><th style={{width:44}}>OK</th><th>Nombre</th><th>Estado</th></tr></thead>
        <tbody>{(personas || []).map(p => {
          const checked = presentes.has(Number(p.id))
          return (
            <tr key={p.id} onClick={()=>canManage&&togglePresente(Number(p.id))} style={{cursor:canManage?'pointer':'default',background:checked?'var(--c-success-bg)':''}}>
              <td><input name="has" type="checkbox" readOnly checked={checked} style={{width:16,height:16,accentColor:'var(--primary)'}}/></td>
              <td><strong>{p.nombre} {p.apellido}</strong></td>
              <td><span className={`badge badge-${p.estado?.toLowerCase()}`}>{p.estado}</span></td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}
