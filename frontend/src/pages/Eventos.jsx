import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { makeI18n } from '../lib/i18n.js'

const TIPOS = ['EVENTO','REUNION','RETIRO','CONFERENCIA','CULTO_ESPECIAL','OTRO']
const TCOLOR = { EVENTO:'#2563EB', REUNION:'#7C3AED', RETIRO:'#16A34A', CONFERENCIA:'#D97706', CULTO_ESPECIAL:'#DC2626', OTRO:'#64748B' }
const TBG    = { EVENTO:'#DBEAFE', REUNION:'#EDE9FE', RETIRO:'#DCFCE7', CONFERENCIA:'#FEF3C7', CULTO_ESPECIAL:'#FEE2E2', OTRO:'#F3F4F6' }

const I18N = {
  es: {
    title:'Eventos', subtitle:'Actividades y calendario de la iglesia',
    newEvent:'+ Nuevo evento', upcoming:'Próximos', past:'Pasados',
    noUpcoming:'Sin eventos próximos', noEvents:'Sin eventos', createFirst:'Crear primer evento',
    labelPast:'Pasado', today:'Hoy', tomorrow:'Mañana', inDaysPrefix:'En', inDaysSuffix:'días',
    allDay:'Todo el día', confirmations:'Confirmaciones',
    editEvent:'Editar evento', newEventModal:'Nuevo evento',
    titleField:'Título *', typeField:'Tipo', dateField:'Fecha *',
    timeField:'Horario', placeField:'Lugar', descField:'Descripción',
    placePlaceholder:'Dirección o salón', titlePlaceholder:'Nombre del evento',
    descPlaceholder:'Detalles del evento...',
    saveChanges:'Guardar cambios', createEvent:'Crear evento',
    deleteTitle:'¿Eliminar evento?', deleteMsg:'Este evento será eliminado permanentemente.',
    rsvpYes:'Sí', rsvpNo:'No', rsvpMaybe:'Tal vez',
    rsvpShare:'Compartir link de confirmación',
    rsvpNoResponses:'Todavía no hay confirmaciones. Compartí el link para empezar a recibir respuestas.',
    rsvpResponses:'Respuestas',
    rsvpNote:'El link incluye botones Sí / No. Al hacer clic, la persona confirma automáticamente y aparece en esta lista.',
    rsvpWhatsApp:'Enviar invitación con confirmación por WhatsApp',
  },
  pt: {
    title:'Eventos', subtitle:'Atividades e calendário da igreja',
    newEvent:'+ Novo evento', upcoming:'Próximos', past:'Passados',
    noUpcoming:'Sem eventos próximos', noEvents:'Sem eventos', createFirst:'Criar primeiro evento',
    labelPast:'Passado', today:'Hoje', tomorrow:'Amanhã', inDaysPrefix:'Em', inDaysSuffix:'dias',
    allDay:'Dia todo', confirmations:'Confirmações',
    editEvent:'Editar evento', newEventModal:'Novo evento',
    titleField:'Título *', typeField:'Tipo', dateField:'Data *',
    timeField:'Horário', placeField:'Local', descField:'Descrição',
    placePlaceholder:'Endereço ou sala', titlePlaceholder:'Nome do evento',
    descPlaceholder:'Detalhes do evento...',
    saveChanges:'Salvar alterações', createEvent:'Criar evento',
    deleteTitle:'Excluir evento?', deleteMsg:'Este evento será excluído permanentemente.',
    rsvpYes:'Sim', rsvpNo:'Não', rsvpMaybe:'Talvez',
    rsvpShare:'Compartilhar link de confirmação',
    rsvpNoResponses:'Ainda não há confirmações. Compartilhe o link para começar a receber respostas.',
    rsvpResponses:'Respostas',
    rsvpNote:'O link inclui botões Sim / Não. Ao clicar, a pessoa confirma automaticamente e aparece nesta lista.',
    rsvpWhatsApp:'Enviar convite com confirmação pelo WhatsApp',
  },
  en: {
    title:'Events', subtitle:'Activities and church calendar',
    newEvent:'+ New event', upcoming:'Upcoming', past:'Past',
    noUpcoming:'No upcoming events', noEvents:'No events', createFirst:'Create first event',
    labelPast:'Past', today:'Today', tomorrow:'Tomorrow', inDaysPrefix:'In', inDaysSuffix:'days',
    allDay:'All day', confirmations:'Confirmations',
    editEvent:'Edit event', newEventModal:'New event',
    titleField:'Title *', typeField:'Type', dateField:'Date *',
    timeField:'Time', placeField:'Place', descField:'Description',
    placePlaceholder:'Address or room', titlePlaceholder:'Event name',
    descPlaceholder:'Event details...',
    saveChanges:'Save changes', createEvent:'Create event',
    deleteTitle:'Delete event?', deleteMsg:'This event will be permanently deleted.',
    rsvpYes:'Yes', rsvpNo:'No', rsvpMaybe:'Maybe',
    rsvpShare:'Share confirmation link',
    rsvpNoResponses:'No confirmations yet. Share the link to start receiving responses.',
    rsvpResponses:'Responses',
    rsvpNote:'The link includes Yes / No buttons. When clicked, the person confirms automatically and appears in this list.',
    rsvpWhatsApp:'Send invitation with confirmation via WhatsApp',
  },
}

function fmtFecha(f) {
  if (!f) return ''
  const d = new Date(f + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function diasRestantes(fecha, t) {
  const hoy  = new Date(); hoy.setHours(0,0,0,0)
  const ev   = new Date(fecha + 'T00:00:00')
  const diff = Math.round((ev - hoy) / 86400000)
  if (diff < 0)  return { label: t('labelPast'), color: 'var(--text-muted)' }
  if (diff === 0) return { label: t('today'), color: '#DC2626' }
  if (diff === 1) return { label: t('tomorrow'), color: '#D97706' }
  return { label: `${t('inDaysPrefix')} ${diff} ${t('inDaysSuffix')}`, color: '#16A34A' }
}

// ── Modal RSVP ──────────────────────────────────────────────
function RsvpModal({ evento, onClose }) {
  const t = makeI18n(I18N)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch(`/eventos/${evento.id}/rsvp`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [evento.id])

  const baseUrl = window.location.origin.replace('/app','')
  const waLink = () => {
    const token = btoa(`${evento.id}-${Date.now()}`).slice(0,16)
    return `https://wa.me/?text=${encodeURIComponent(`¿Vas a asistir a *${evento.titulo}* el ${evento.fecha}?\n\n✅ Sí: ${baseUrl}/api/eventos/rsvp/confirmar?token=${token}&r=SI&ig=0\n❌ No puedo: ${baseUrl}/api/eventos/rsvp/confirmar?token=${token}&r=NO&ig=0`)}`
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-header">
          <h3 className="modal-title">{t('confirmations')} — {evento.titulo}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? <p style={{color:'var(--text-muted)'}}>{t('loading')}</p> : !data ? <p>{t('noData')}</p> : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
                {[[`✅ ${t('rsvpYes')}`,data.si,'var(--c-success)'],[`❌ ${t('rsvpNo')}`,data.no,'var(--c-danger)'],[`🤔 ${t('rsvpMaybe')}`,data.talvez,'var(--c-warning)']].map(([l,v,c])=>(
                  <div key={l} style={{textAlign:'center',background:'var(--bg-2)',borderRadius:10,padding:'12px 8px'}}>
                    <div style={{fontSize:26,fontWeight:800,color:c}}>{v}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{l}</div>
                  </div>
                ))}
              </div>

              <div style={{background:'var(--bg-2)',borderRadius:10,padding:'12px',marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>{t('rsvpWhatsApp')}</div>
                <a href={waLink()} target="_blank" rel="noopener noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,background:'#25D366',color:'#fff',fontSize:12,fontWeight:600,textDecoration:'none'}}>
                  💬 {t('rsvpShare')}
                </a>
                <p style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>{t('rsvpNote')}</p>
              </div>

              {data.detalle?.length > 0 && (
                <div>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>{t('rsvpResponses')} ({data.total})</div>
                  <div style={{maxHeight:200,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                    {data.detalle.map(r => (
                      <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:'var(--bg-2)',borderRadius:6,fontSize:12}}>
                        <span>{r.nombre} {r.apellido || ''}</span>
                        <span style={{fontWeight:700,color: r.respuesta==='SI'?'var(--c-success)':r.respuesta==='NO'?'var(--c-danger)':'var(--c-warning)'}}>
                          {r.respuesta==='SI'?`✅ ${t('rsvpYes')}`:r.respuesta==='NO'?`❌ ${t('rsvpNo')}`:`🤔 ${t('rsvpMaybe')}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.total === 0 && <p style={{color:'var(--text-muted)',fontSize:13,textAlign:'center',padding:'12px 0'}}>{t('rsvpNoResponses')}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Eventos() {
  const t = makeI18n(I18N)
  const user = getUser()
  const canManage = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(user?.rol)

  const hoy = new Date().toISOString().slice(0,10)
  const en90 = new Date(Date.now() + 90*86400000).toISOString().slice(0,10)

  const [eventos, setEventos]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm]         = useState({ titulo:'', tipo:'EVENTO', fecha:hoy, hora:'', lugar:'', descripcion:'', todoElDia:false })
  const [filtro, setFiltro]     = useState('proximos')
  const [msg, setMsg]           = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [rsvpEvento, setRsvpEvento] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      let url = '/eventos'
      if (filtro === 'proximos') url += `?desde=${hoy}&hasta=${en90}`
      else if (filtro === 'pasados') url += `?desde=2000-01-01&hasta=${hoy}`
      else url += `?desde=2000-01-01&hasta=2099-12-31`
      setEventos(await apiFetch(url) || [])
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [filtro])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditando(null)
    setForm({ titulo:'', tipo:'EVENTO', fecha:hoy, hora:'', lugar:'', descripcion:'', todoElDia:false })
    setMsg(null)
    setModal(true)
  }

  function openEdit(ev) {
    setEditando(ev)
    setForm({ titulo:ev.titulo, tipo:ev.tipo, fecha:ev.fecha, hora:ev.hora||'', lugar:ev.lugar||'', descripcion:ev.descripcion||'', todoElDia:!!ev.todoElDia })
    setMsg(null)
    setModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try {
      if (editando) {
        await apiFetch(`/eventos/${editando.id}`, { method:'PUT', body:JSON.stringify(form) })
      } else {
        await apiFetch('/eventos', { method:'POST', body:JSON.stringify(form) })
      }
      setModal(false)
      load()
    } catch(err) { setMsg({ type:'error', text:err.message }) }
  }

  async function eliminar() {
    if (!confirmDel) return
    try { await apiFetch(`/eventos/${confirmDel}`, { method:'DELETE' }); setConfirmDel(null); load(); toast.success(t('delete') + ' OK') }
    catch(e) { toast.error(e.message) }
  }

  const agrupadosPorMes = eventos.reduce((acc, ev) => {
    const mes = ev.fecha?.slice(0,7) || '?'
    if (!acc[mes]) acc[mes] = []
    acc[mes].push(ev)
    return acc
  }, {})

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Calendar /> {t('title')}</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>{t('subtitle')}</p>
          </div>
          {canManage && <button className="btn btn-primary" onClick={openNew}>{t('newEvent')}</button>}
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {[['proximos',t('upcoming')],['todos',t('all')],['pasados',t('past')]].map(([k,l])=>(
            <button key={k} className={`btn btn-sm ${filtro===k?'btn-primary':'btn-ghost'}`} onClick={()=>setFiltro(k)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="empty"><div className="spinner-sm" /></div>
        ) : error ? (
          <div className="alert alert-error" style={{margin:'0 0 16px'}}>
            {error} <button className="btn btn-ghost btn-sm" style={{marginLeft:12}} onClick={load}>{t('retry')}</button>
          </div>
        ) : eventos.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Icons.Calendar /></div>
            <p>{filtro==='proximos' ? t('noUpcoming') : t('noEvents')}</p>
            {canManage && <button className="btn btn-primary" onClick={openNew}>{t('createFirst')}</button>}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            {Object.entries(agrupadosPorMes).sort().map(([mes, evs]) => {
              const [y,m] = mes.split('-')
              const nombreMes = new Date(Number(y), Number(m)-1, 1).toLocaleDateString('es-AR',{month:'long',year:'numeric'})
              return (
                <div key={mes}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>
                     {nombreMes.charAt(0).toUpperCase()+nombreMes.slice(1)}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {evs.map(ev => {
                      const restantes = diasRestantes(ev.fecha, t)
                      return (
                        <div key={ev.id} className="card" style={{padding:'14px 18px',borderLeft:`3px solid ${TCOLOR[ev.tipo]||'#2563EB'}`,display:'flex',gap:14,alignItems:'flex-start'}}>
                          {/* Fecha */}
                          <div style={{minWidth:52,textAlign:'center',padding:'8px 6px',background:'var(--bg-2)',borderRadius:8,flexShrink:0}}>
                            <div style={{fontSize:20,fontWeight:800,color:'var(--primary)',lineHeight:1}}>{ev.fecha?.slice(8,10)}</div>
                            <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase',marginTop:2}}>
                              {new Date(ev.fecha+'T00:00:00').toLocaleDateString('es-AR',{month:'short'})}
                            </div>
                          </div>

                          {/* Info */}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
                              <span style={{padding:'2px 8px',borderRadius:3,fontSize:11,fontWeight:600,background:TBG[ev.tipo],color:TCOLOR[ev.tipo]}}>{ev.tipo}</span>
                              <span style={{fontSize:11,fontWeight:600,color:restantes.color}}>{restantes.label}</span>
                            </div>
                            <h3 style={{fontSize:15,fontWeight:700,margin:'0 0 4px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ev.titulo}</h3>
                            <div style={{fontSize:12,color:'var(--text-muted)',display:'flex',gap:12,flexWrap:'wrap'}}>
                              {ev.hora && <span> {ev.todoElDia?t('allDay'):ev.hora}</span>}
                              {ev.lugar && <span> {ev.lugar}</span>}
                            </div>
                            {ev.descripcion && <p style={{fontSize:12,color:'var(--text-muted)',margin:'6px 0 0',lineHeight:1.5}}>{ev.descripcion}</p>}
                          </div>

                          {/* Acciones */}
                          <div style={{display:'flex',gap:6,flexShrink:0,flexDirection:'column',alignItems:'flex-end'}}>
                            <button className="btn btn-ghost btn-sm" style={{fontSize:11,whiteSpace:'nowrap'}}
                              onClick={() => setRsvpEvento(ev)}>
                              ✅ {t('confirmations')}
                            </button>
                            {canManage && (
                              <div style={{display:'flex',gap:6}}>
                                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(ev)}>{t('edit')}</button>
                                <button className="btn btn-ghost btn-sm" style={{color:'var(--c-danger)'}} onClick={()=>setConfirmDel(ev.id)}></button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal editar/crear */}
        {modal && (
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">{editando?t('editEvent'):t('newEventModal')}</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>×</button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg && <div className={`alert alert-${msg.type}`} style={{marginBottom:12}}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group full">
                      <label>{t('titleField')}</label>
                      <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required placeholder={t('titlePlaceholder')} />
                    </div>
                    <div className="form-group">
                      <label>{t('typeField')}</label>
                      <select className="form-input" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                        {TIPOS.map(tp=><option key={tp} value={tp}>{tp.replace(/_/g,' ')}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{t('dateField')}</label>
                      <input className="form-input" type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} required />
                    </div>
                    <div className="form-group">
                      <label>{t('timeField')}</label>
                      <input className="form-input" type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} disabled={form.todoElDia} />
                    </div>
                    <div className="form-group">
                      <label>{t('placeField')}</label>
                      <input className="form-input" value={form.lugar} onChange={e=>setForm(f=>({...f,lugar:e.target.value}))} placeholder={t('placePlaceholder')} />
                    </div>
                    <div className="form-group full">
                      <label>{t('descField')}</label>
                      <textarea className="form-input" value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} rows={3} placeholder={t('descPlaceholder')} />
                    </div>
                    <div className="form-group full">
                      <label style={{display:'flex',gap:10,alignItems:'center',cursor:'pointer',fontWeight:400}}>
                        <input type="checkbox" checked={form.todoElDia} onChange={e=>setForm(f=>({...f,todoElDia:e.target.checked,hora:e.target.checked?'':f.hora}))} style={{width:16,height:16,accentColor:'var(--primary)'}} />
                        {t('allDay')}
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>{t('cancel')}</button>
                  <button type="submit" className="btn btn-primary">{editando?t('saveChanges'):t('createEvent')}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={eliminar}
        title={t('deleteTitle')} danger
        message={t('deleteMsg')}
        confirmLabel={t('delete')} cancelLabel={t('cancel')}
      />

      {rsvpEvento && (
        <RsvpModal
          evento={rsvpEvento}
          onClose={() => setRsvpEvento(null)}
        />
      )}
    </div>
  )
}
