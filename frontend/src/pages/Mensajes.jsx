import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { makeI18n } from '../lib/i18n.js'

const MSG_I18N = {
  es: { title:'Mensajería', notConfigured:'sin configurar',
        tabSend:'✉ Enviar', tabTemplates:'Plantillas', tabHistory:'≡ Historial',
        loadingMsg:'Cargando mensajería...', noMessages:'Sin mensajes aún',
        newMessage:'Nuevo mensaje', sendMode:'Modo de envío', channel:'Canal',
        individual:'Individual', mass:'Masivo',
        emailSubject:'Asunto del email', recipient:'Destinatario',
        selectPerson:'Seleccioná una persona...', sendTo:'Enviar a',
        byGroup:'-- Por grupo --', byStatus:'-- Por estado --',
        allCongregation:'Dejar ambos vacíos = toda la congregación · Estimado:',
        people:'personas', message:'Mensaje', preview:'Vista previa',
        sending:'Enviando...', sendMsg:'↑ Enviar mensaje', sendToAll:'↑ Enviar a todos',
        quickTemplates:'Plantillas rápidas', noTemplatesFor:'Sin plantillas para',
        customTemplates:'Plantillas personalizadas', newTemplate:'+ Nueva',
        templateNote:'Las plantillas con 📌 son predeterminadas del sistema.',
        templateName:'Nombre', templateType:'Tipo', content:'Contenido',
        variables:'variables:', use:'Usar',
        sentMessages:'Mensajes enviados', sent:'Enviado', error:'Error', noPerson:'Sin persona',
        colChannel:'Canal', colPerson:'Persona', colDest:'Destino', colMsg:'Mensaje', colStatus:'Estado',
        delTemplate:'¿Eliminar plantilla?', delTemplateMsg:'Esta plantilla será eliminada permanentemente.',
  },
  pt: { title:'Mensagens', notConfigured:'sem configuração',
        tabSend:'✉ Enviar', tabTemplates:'Templates', tabHistory:'≡ Histórico',
        loadingMsg:'Carregando mensagens...', noMessages:'Sem mensagens ainda',
        newMessage:'Nova mensagem', sendMode:'Modo de envio', channel:'Canal',
        individual:'Individual', mass:'Em massa',
        emailSubject:'Assunto do email', recipient:'Destinatário',
        selectPerson:'Selecione uma pessoa...', sendTo:'Enviar para',
        byGroup:'-- Por grupo --', byStatus:'-- Por estado --',
        allCongregation:'Deixar ambos vazios = toda a congregação · Estimado:',
        people:'pessoas', message:'Mensagem', preview:'Pré-visualização',
        sending:'Enviando...', sendMsg:'↑ Enviar mensagem', sendToAll:'↑ Enviar para todos',
        quickTemplates:'Templates rápidos', noTemplatesFor:'Sem templates para',
        customTemplates:'Templates personalizados', newTemplate:'+ Novo',
        templateNote:'Os templates com 📌 são predefinidos do sistema.',
        templateName:'Nome', templateType:'Tipo', content:'Conteúdo',
        variables:'variáveis:', use:'Usar',
        sentMessages:'Mensagens enviadas', sent:'Enviado', error:'Erro', noPerson:'Sem pessoa',
        colChannel:'Canal', colPerson:'Pessoa', colDest:'Destino', colMsg:'Mensagem', colStatus:'Estado',
        delTemplate:'Excluir template?', delTemplateMsg:'Este template será excluído permanentemente.',
  },
  en: { title:'Messaging', notConfigured:'not configured',
        tabSend:'✉ Send', tabTemplates:'Templates', tabHistory:'≡ History',
        loadingMsg:'Loading messaging...', noMessages:'No messages yet',
        newMessage:'New message', sendMode:'Send mode', channel:'Channel',
        individual:'Individual', mass:'Mass',
        emailSubject:'Email subject', recipient:'Recipient',
        selectPerson:'Select a person...', sendTo:'Send to',
        byGroup:'-- By group --', byStatus:'-- By status --',
        allCongregation:'Leave both empty = whole congregation · Estimated:',
        people:'people', message:'Message', preview:'Preview',
        sending:'Sending...', sendMsg:'↑ Send message', sendToAll:'↑ Send to all',
        quickTemplates:'Quick templates', noTemplatesFor:'No templates for',
        customTemplates:'Custom templates', newTemplate:'+ New',
        templateNote:'Templates with 📌 are system defaults.',
        templateName:'Name', templateType:'Type', content:'Content',
        variables:'variables:', use:'Use',
        sentMessages:'Sent messages', sent:'Sent', error:'Error', noPerson:'No person',
        colChannel:'Channel', colPerson:'Person', colDest:'Destination', colMsg:'Message', colStatus:'Status',
        delTemplate:'Delete template?', delTemplateMsg:'This template will be permanently deleted.',
  },
}

const TIPOS = ['WHATSAPP', 'EMAIL']

const PLANTILLAS_DEFAULT = [
  { id: 'd1', nombre: 'Bienvenida', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! <Icons.Users /> Bienvenido/a a nuestra comunidad. Es un placer tenerte con nosotros. ¡Que Dios te bendiga!' },
  { id: 'd2', nombre: 'Recordatorio culto', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! <Icons.Prayer /> Te recordamos que este domingo tenemos culto. Te esperamos!' },
  { id: 'd3', nombre: 'Seguimiento', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! ¿Cómo estás? Te contactamos desde la iglesia para saber cómo te encontrás. Estamos orando por vos <Icons.Prayer />' },
  { id: 'd4', nombre: 'Cumpleaños', tipo: 'WHATSAPP', contenido: '🎂 Feliz cumpleaños {nombre}! Que Dios te colme de bendiciones en este nuevo año de vida. Te queremos mucho! ❤️' },
]

export default function Mensajes() {
  const t = makeI18n(MSG_I18N)
  const user = getUser()
  const canSend = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF'].includes(user?.rol)

  const [tab, setTab]           = useState('enviar')
  const [grupos, setGrupos]     = useState([])
  const [personas, setPersonas] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [historial, setHistorial]   = useState([])
  const [hTotal, setHTotal]         = useState(0)
  const [hPage, setHPage]           = useState(1)
  const [msg, setMsg]           = useState(null)
  const [sending, setSending]   = useState(false)
  const [config, setConfig]     = useState({})
  const [loadingBase, setLoadingBase] = useState(true)
  const [errorBase, setErrorBase] = useState(null)
  const [editPlantilla, setEditPlantilla] = useState(null)
  const [showNewP, setShowNewP] = useState(false)
  const [confirmBorrarId, setConfirmBorrarId] = useState(null)
  const [newP, setNewP]         = useState({ nombre: '', tipo: 'WHATSAPP', contenido: '' })
  const [form, setForm]         = useState({
    tipo: 'WHATSAPP', personaId: '', grupoId: '', estado: '',
    mensaje: '', modo: 'individual', asunto: 'Mensaje pastoral'
  })

  const loadBase = useCallback(async () => {
    setLoadingBase(true); setErrorBase(null)
    try {
      const [g, p, pl, c] = await Promise.all([
        apiFetch('/grupos'),
        apiFetch('/personas?limit=400'),
        apiFetch('/mensajes/plantillas'),
        apiFetch('/config'),
      ])
      setGrupos(g || [])
      setPersonas(p?.data || [])
      setPlantillas(pl || [])
      setConfig(c || {})
    } catch (e) {
      setErrorBase(e.message || 'No se pudo cargar mensajería')
    }
    setLoadingBase(false)
  }, [])

  useEffect(() => { loadBase() }, [loadBase])

  const loadHistorial = useCallback(async () => {
    try {
      const r = await apiFetch(`/mensajes?limit=30&page=${hPage}`)
      setHistorial(r?.data || [])
      setHTotal(r?.total || 0)
    } catch {}
  }, [hPage])

  useEffect(() => { loadHistorial() }, [loadHistorial])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Preview del mensaje con variables reemplazadas
  const preview = form.mensaje
    .replace(/{nombre}/g, 'María')
    .replace(/{apellido}/g, 'González')
    .replace(/{grupo}/g, 'Matrimonios')

  // Contar destinatarios estimados
  const contarDestinatarios = () => {
    if (form.modo === 'individual') return form.personaId ? 1 : 0
    if (form.grupoId) return grupos.find(g => String(g.id) === String(form.grupoId))?.totalMiembros || '?'
    if (form.estado)  return personas.filter(p => p.estado === form.estado).length
    return personas.length
  }

  async function handleEnviar(e) {
    e.preventDefault(); setMsg(null); setSending(true)
    try {
      let res
      if (form.modo === 'individual') {
        if (!form.personaId) { setMsg({ type: 'error', text: 'Seleccioná una persona' }); setSending(false); return }
        res = await apiFetch('/mensajes/enviar', {
          method: 'POST',
          body: JSON.stringify({ personaId: Number(form.personaId), tipo: form.tipo, mensaje: form.mensaje, asunto: form.asunto })
        })
        const txt = res.demo ? '≡ Mensaje guardado (email sin configurar — andá a Configuración → Integraciones → Email)'
          : res.enviado ? `<Icons.Attendance /> Mensaje enviado por ${form.tipo}`
          : `⚠ No se pudo enviar: ${res.error}`
        setMsg({ type: res.enviado || res.demo ? 'success' : 'warning', text: txt })
      } else {
        res = await apiFetch('/mensajes/masivo', {
          method: 'POST',
          body: JSON.stringify({ grupoId: form.grupoId || null, estado: form.estado || null, tipo: form.tipo, mensaje: form.mensaje, asunto: form.asunto })
        })
        setMsg({ type: 'success', text: `<Icons.Attendance /> ${res.enviados}/${res.total} mensajes enviados` + (res.errores > 0 ? ` · ${res.errores} errores` : '') })
      }
      loadHistorial()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setSending(false)
  }

  async function guardarPlantilla(e) {
    e.preventDefault()
    try {
      if (editPlantilla?.id && !String(editPlantilla.id).startsWith('d')) {
        await apiFetch(`/mensajes/plantillas/${editPlantilla.id}`, { method: 'PUT', body: JSON.stringify(newP) })
      } else {
        await apiFetch('/mensajes/plantillas', { method: 'POST', body: JSON.stringify(newP) })
      }
      const p = await apiFetch('/mensajes/plantillas').catch(() => [])
      setPlantillas(p || [])
      setNewP({ nombre: '', tipo: 'WHATSAPP', contenido: '' })
      setShowNewP(false); setEditPlantilla(null)
    } catch (err) { toast.error(err.message) }
  }

  async function borrarPlantilla() {
    if (!confirmBorrarId) return
    try {
      await apiFetch(`/mensajes/plantillas/${confirmBorrarId}`, { method: 'DELETE' })
      setPlantillas(p => p.filter(x => x.id !== confirmBorrarId))
    } catch (err) { toast.error(err.message) }
    setConfirmBorrarId(null)
  }

  const todasPlantillas = [...PLANTILLAS_DEFAULT, ...plantillas]
  const twOk  = config.twilio_configurado
  const emlOk = config.email_configurado

  const badgeColor = (tipo) => tipo === 'WHATSAPP'
    ? { background: '#dcfce7', color: 'var(--c-success)' }
    : { background: 'var(--c-info-bg)', color: 'var(--c-info)' }

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Messages /> {t('title')}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10 }}>
              <span style={{ ...badgeColor('WHATSAPP'), padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                WhatsApp {twOk ? '✓' : `⚠ ${t('notConfigured')}`}
              </span>
              <span style={{ ...badgeColor('EMAIL'), padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                Email {emlOk ? '✓' : `⚠ ${t('notConfigured')}`}
              </span>
            </p>
          </div>
        </div>

        {errorBase && (
          <div className="alert alert-error" style={{marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
            <span>{errorBase}</span>
            <button className="btn btn-ghost btn-sm" onClick={loadBase}>{t('retry')}</button>
          </div>
        )}
        {loadingBase && <div className="empty" style={{marginBottom:12}}><p>{t('loadingMsg')}</p></div>}

        <div className="mobile-tabs" style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 20 }}>
          {[['enviar', t('tabSend')], ['plantillas', t('tabTemplates')], ['historial', t('tabHistory')]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? 'btn btn-primary' : 'btn btn-ghost'}>{l}</button>
          ))}
        </div>

        {/* ── ENVIAR ── */}
        {tab === 'enviar' && (
          <div className="messages-compose-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>{t('newMessage')}</h3>
              {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>}

              <form onSubmit={handleEnviar}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  {/* Modo */}
                  <div className="form-group">
                    <label>{t('sendMode')}</label>
                    <select name="modo" className="form-input" value={form.modo} onChange={e => f('modo', e.target.value)}>
                      <option value="individual">{t('individual')}</option>
                      <option value="masivo">{t('mass')}</option>
                    </select>
                  </div>

                  {/* Canal */}
                  <div className="form-group">
                    <label>{t('channel')}</label>
                    <select name="tipo" className="form-input" value={form.tipo} onChange={e => f('tipo', e.target.value)}>
                      <option value="WHATSAPP"><Icons.CheckIn /> WhatsApp{!twOk ? ' (sin config)' : ''}</option>
                      <option value="EMAIL">✉ Email{!emlOk ? ' (sin config)' : ''}</option>
                    </select>
                  </div>

                  {/* Asunto — solo para email */}
                  {form.tipo === 'EMAIL' && (
                    <div className="form-group full">
                      <label>{t('emailSubject')}</label>
                      <input name="asunto" className="form-input" value={form.asunto} onChange={e => f('asunto', e.target.value)} />
                    </div>
                  )}

                  {/* Destinatario individual */}
                  {form.modo === 'individual' && (
                    <div className="form-group full">
                      <label>{t('recipient')}</label>
                      <select name="personaId" className="form-input" value={form.personaId} onChange={e => f('personaId', e.target.value)} required>
                        <option value="">{t('selectPerson')}</option>
                        {personas.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre} {p.apellido} — {p.telefono || p.email || '—'}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Destinatario masivo */}
                  {form.modo === 'masivo' && (
                    <div className="form-group full">
                      <label>{t('sendTo')}</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8 }}>
                        <select name="grupoId" className="form-input" value={form.grupoId} onChange={e => { f('grupoId', e.target.value); f('estado', '') }}>
                          <option value="">{t('byGroup')}</option>
                          {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                        </select>
                        <select name="estado" className="form-input" value={form.estado} onChange={e => { f('estado', e.target.value); f('grupoId', '') }}>
                          <option value="">{t('byStatus')}</option>
                          {['ACTIVO', 'VISITANTE', 'NUEVO', 'INACTIVO'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        {t('allCongregation')} {contarDestinatarios()} {t('people')}
                      </span>
                    </div>
                  )}

                  {/* Mensaje */}
                  <div className="form-group full">
                    <label>{t('message')} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>{t('variables')} {'{nombre}'} {'{apellido}'} {'{grupo}'}</span></label>
                    <textarea name="mensaje" className="form-input" style={{ minHeight: 100 }} required
                      value={form.mensaje} onChange={e => f('mensaje', e.target.value)}
                      placeholder="Hola {nombre}! Te escribimos desde la iglesia..." />
                  </div>
                </div>

                {/* Preview */}
                {form.mensaje && (
                  <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--text-muted)', marginBottom: 6 }}>{t('preview')}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{preview}</p>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? t('sending') : form.modo === 'individual' ? t('sendMsg') : `${t('sendToAll')} (${contarDestinatarios()})`}
                </button>
              </form>
            </div>

            {/* Plantillas lateral */}
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{t('quickTemplates')}</h3>
              <div className="template-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todasPlantillas.filter(p => p.tipo === form.tipo).map(p => (
                  <div key={p.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => { f('mensaje', p.contenido); setMsg(null) }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{p.nombre}</div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{p.contenido.slice(0, 70)}...</p>
                  </div>
                ))}
                {todasPlantillas.filter(p => p.tipo === form.tipo).length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('noTemplatesFor')} {form.tipo}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PLANTILLAS ── */}
        {tab === 'plantillas' && (
          <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('customTemplates')}</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowNewP(true); setEditPlantilla(null); setNewP({ nombre: '', tipo: 'WHATSAPP', contenido: '' }) }}>{t('newTemplate')}</button>
            </div>

            {showNewP && (
              <form className="mobile-inline-form" onSubmit={guardarPlantilla} style={{ marginBottom: 24, padding: 16, background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                <div className="form-grid">
                  <div className="form-group"><label>{t('templateName')}</label><input name="nombre" className="form-input" value={newP.nombre} onChange={e => setNewP(p => ({ ...p, nombre: e.target.value }))} required /></div>
                  <div className="form-group"><label>{t('templateType')}</label>
                    <select name="tipo" className="form-input" value={newP.tipo} onChange={e => setNewP(p => ({ ...p, tipo: e.target.value }))}>
                      <option value="WHATSAPP"><Icons.CheckIn /> WhatsApp</option>
                      <option value="EMAIL">✉ Email</option>
                    </select>
                  </div>
                  <div className="form-group full">
                    <label>{t('content')} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>— {t('variables')} {'{nombre}'} {'{apellido}'}</span></label>
                    <textarea name="contenido" className="form-input" style={{ minHeight: 80 }} required value={newP.contenido} onChange={e => setNewP(p => ({ ...p, contenido: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowNewP(false); setEditPlantilla(null) }}>{t('cancel')}</button>
                  <button type="submit" className="btn btn-primary btn-sm">{t('save')}</button>
                </div>
              </form>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {t('templateNote')}
            </p>

            {[...PLANTILLAS_DEFAULT, ...plantillas].map(p => (
              <div key={p.id} className="template-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                    <strong style={{ fontSize: 14 }}>{String(p.id).startsWith('d') ? '📌 ' : ''}{p.nombre}</strong>
                    <span style={{ ...badgeColor(p.tipo), padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{p.tipo}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{p.contenido}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setTab('enviar'); f('mensaje', p.contenido); f('tipo', p.tipo) }}>{t('use')}</button>
                  {!String(p.id).startsWith('d') && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmBorrarId(p.id)}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab === 'historial' && (
          <div className="card messages-history-card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t('sentMessages')} ({hTotal})</h3>
            </div>
            {historial.length > 0 && (
              <div className="messages-mobile-history">
                {historial.map(m => (
                  <article className="message-history-card" key={m.id}>
                    <div>
                      <span style={{ ...badgeColor(m.tipo), padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{m.tipo}</span>
                      {m.enviado
                        ? <span className="badge badge-activo">{t('sent')}</span>
                        : <span className="badge badge-inactivo">{t('error')}</span>}
                    </div>
                    <strong>{m.personaNombre ? `${m.personaNombre} ${m.personaApellido || ''}` : t('noPerson')}</strong>
                    <p>{m.mensaje}</p>
                    <small>{m.destino} · {m.createdAt?.slice(0, 16).replace('T', ' ')}</small>
                  </article>
                ))}
              </div>
            )}
            {historial.length === 0
              ? <div className="empty"><div className="empty-icon"><Icons.Messages /></div><p>{t('noMessages')}</p></div>
              : <div className="table-responsive"><table className="messages-history-table" style={{minWidth:500}}>
                  <thead><tr><th>{t('colChannel')}</th><th>{t('colPerson')}</th><th>{t('colDest')}</th><th>{t('colMsg')}</th><th>{t('colStatus')}</th><th>{t('date')}</th></tr></thead>
                  <tbody>
                    {historial.map(m => (
                      <tr key={m.id}>
                        <td><span style={{ ...badgeColor(m.tipo), padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{m.tipo}</span></td>
                        <td style={{ fontSize: 13 }}>{m.personaNombre ? `${m.personaNombre} ${m.personaApellido || ''}` : t('noPerson')}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.destino}</td>
                        <td style={{ maxWidth: 200, overflowX:'auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{m.mensaje}</td>
                        <td>
                          {m.enviado
                            ? <span className="badge badge-activo">{t('sent')}</span>
                            : <span className="badge badge-inactivo" title={m.error || ''}>{t('error')}</span>
                          }
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
            }
            {Math.ceil(hTotal / 30) > 1 && (
              <div className="pagination">
                <span className="pag-info">Pág {hPage}/{Math.ceil(hTotal / 30)}</span>
                <button className="pag-btn" disabled={hPage === 1} onClick={() => setHPage(p => p - 1)}>←</button>
                <button className="pag-btn" disabled={hPage === Math.ceil(hTotal / 30)} onClick={() => setHPage(p => p + 1)}>→</button>
              </div>
            )}
          </div>
        )}
      </main>
      <ConfirmModal
        open={!!confirmBorrarId} onClose={()=>setConfirmBorrarId(null)} onConfirm={borrarPlantilla}
        title={t('delTemplate')} danger
        message={t('delTemplateMsg')}
        confirmLabel={t('delete')} cancelLabel={t('cancel')}
      />
    </div>
  )
}
