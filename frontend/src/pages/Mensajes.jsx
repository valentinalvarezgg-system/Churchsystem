import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { makeI18n } from '../lib/i18n.js'

const MSG_I18N = {
  es: { title:'Mensajería', notConfigured:'sin configurar',
        tabSend:'Enviar', tabTemplates:'Plantillas', tabHistory:'Historial',
        tabSegment:'Segmentar',
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
        templateNote:'Las plantillas marcadas con * son predeterminadas del sistema.',
        templateName:'Nombre', templateType:'Tipo', content:'Contenido',
        variables:'variables:', use:'Usar',
        allMessages:'Todos', incoming:'Recibidos', outgoing:'Enviados',
        incomingLabel:'RECIBIDO', outgoingLabel:'ENVIADO',
        sentMessages:'Mensajes', sent:'Enviado', error:'Error', noPerson:'Sin persona',
        colChannel:'Canal', colPerson:'Persona', colDest:'Destino', colMsg:'Mensaje',
        colStatus:'Estado', colDir:'Dirección',
        delTemplate:'¿Eliminar plantilla?', delTemplateMsg:'Esta plantilla será eliminada permanentemente.',
        confirmSendTitle:'¿Enviar mensaje masivo?', confirmSendMsg:'Se enviará a todos los destinatarios seleccionados.',
  },
  pt: { title:'Mensagens', notConfigured:'sem configuração',
        tabSend:'Enviar', tabTemplates:'Templates', tabHistory:'Histórico',
        tabSegment:'Segmentar',
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
        templateNote:'Os templates marcados com * são predefinidos do sistema.',
        templateName:'Nome', templateType:'Tipo', content:'Conteúdo',
        variables:'variáveis:', use:'Usar',
        allMessages:'Todos', incoming:'Recebidos', outgoing:'Enviados',
        incomingLabel:'RECEBIDO', outgoingLabel:'ENVIADO',
        sentMessages:'Mensagens', sent:'Enviado', error:'Erro', noPerson:'Sem pessoa',
        colChannel:'Canal', colPerson:'Pessoa', colDest:'Destino', colMsg:'Mensagem',
        colStatus:'Estado', colDir:'Direção',
        delTemplate:'Excluir template?', delTemplateMsg:'Este template será excluído permanentemente.',
        confirmSendTitle:'Enviar mensagem em massa?', confirmSendMsg:'Será enviado para todos os destinatários selecionados.',
  },
  en: { title:'Messaging', notConfigured:'not configured',
        tabSend:'Send', tabTemplates:'Templates', tabHistory:'History',
        tabSegment:'Segment',
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
        templateNote:'Templates marked with * are system defaults.',
        templateName:'Name', templateType:'Type', content:'Content',
        variables:'variables:', use:'Use',
        allMessages:'All', incoming:'Received', outgoing:'Sent',
        incomingLabel:'RECEIVED', outgoingLabel:'SENT',
        sentMessages:'Messages', sent:'Sent', error:'Error', noPerson:'No person',
        colChannel:'Channel', colPerson:'Person', colDest:'Destination', colMsg:'Message',
        colStatus:'Status', colDir:'Direction',
        delTemplate:'Delete template?', delTemplateMsg:'This template will be permanently deleted.',
        confirmSendTitle:'Send mass message?', confirmSendMsg:'Will be sent to all selected recipients.',
  },
}

const TIPOS = ['WHATSAPP', 'EMAIL']

const PLANTILLAS_DEFAULT = [
  { id: 'd1', nombre: 'Bienvenida', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! <Icons.Users /> Bienvenido/a a nuestra comunidad. Es un placer tenerte con nosotros. ¡Que Dios te bendiga!' },
  { id: 'd2', nombre: 'Recordatorio culto', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! Te recordamos que este domingo tenemos culto. Te esperamos!' },
  { id: 'd3', nombre: 'Seguimiento', tipo: 'WHATSAPP', contenido: 'Hola {nombre}! ¿Cómo estás? Te contactamos desde la iglesia para saber cómo te encontrás. Estamos orando por vos' },
  { id: 'd4', nombre: 'Cumpleaños', tipo: 'WHATSAPP', contenido: ' Feliz cumpleaños {nombre}! Que Dios te colme de bendiciones en este nuevo año de vida. Te queremos mucho! ' },
]

// ── Segmentador avanzado (#16) ───────────────────────────────
const ETAPAS_ESPIRITALES = ['NUEVO_CREYENTE','CONSOLIDADO','DISCIPULO','LIDER','MINISTRO']

function SegmentadorAvanzado({ grupos }) {
  const t = makeI18n(MSG_I18N)
  const [filtros, setFiltros] = useState({
    estados: [],
    grupos: [],
    etapas: [],
    genero: '',
    bautizadoAgua: null,
    bautizadoEspiritu: null,
    discipuladoCompletado: null,
    inactivoDesde: '',
    soloConTelefono: false,
    soloConEmail: false,
  })
  const [resultado, setResultado]   = useState(null)
  const [buscando, setBuscando]     = useState(false)
  const [mensaje, setMensaje]       = useState('')
  const [asunto, setAsunto]         = useState('Mensaje de la iglesia')
  const [tipo, setTipo]             = useState('WHATSAPP')
  const [enviando, setEnviando]     = useState(false)
  const [resultado2, setResultado2] = useState(null)
  const [confirmEnvio, setConfirmEnvio] = useState(false)

  function toggleArr(key, val) {
    setFiltros(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val]
    }))
  }

  async function buscar() {
    setBuscando(true); setResultado(null); setResultado2(null)
    try {
      const body = { ...filtros, inactivoDesde: filtros.inactivoDesde ? Number(filtros.inactivoDesde) : null }
      const r = await apiFetch('/mensajes/segmentar', { method:'POST', body: JSON.stringify(body) })
      setResultado(r)
    } catch(e) { toast.error(e.message) }
    setBuscando(false)
  }

  async function doEnviar() {
    setConfirmEnvio(false)
    setEnviando(true); setResultado2(null)
    try {
      const r = await apiFetch('/mensajes/masivo-segmentado', {
        method: 'POST',
        body: JSON.stringify({ ids: resultado.ids, tipo, mensaje, asunto })
      })
      setResultado2(r)
      toast.success(`${r.enviados} mensajes enviados`)
    } catch(e) { toast.error(e.message) }
    setEnviando(false)
  }

  function enviar() {
    if (!resultado?.ids?.length) return toast.error('Buscá destinatarios primero')
    if (!mensaje.trim()) return toast.error('Escribí un mensaje')
    setConfirmEnvio(true)
  }

  const ChipBtn = ({ label, active, onClick }) => (
    <button type="button" onClick={onClick}
      style={{ padding:'4px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:active?700:400,
        background: active ? 'var(--primary)' : 'var(--bg-2)',
        color: active ? '#fff' : 'var(--text)', border: active ? 'none' : '1px solid var(--border)' }}>
      {label}
    </button>
  )

  const TriToggle = ({ label, campo }) => {
    const val = filtros[campo]
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ fontSize:12, color:'var(--text-muted)', minWidth:120 }}>{label}</span>
        <div style={{ display:'flex', gap:4 }}>
          {[null,'Sí','No'].map((v, i) => {
            const boolVal = v === 'Sí' ? true : v === 'No' ? false : null
            const active = filtros[campo] === boolVal
            return (
              <button key={i} type="button" onClick={() => setFiltros(f=>({...f,[campo]:boolVal}))}
                style={{ padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:active?700:400,
                  background: active ? (boolVal===true?'var(--c-success)':boolVal===false?'var(--c-danger)':'var(--primary)') : 'var(--bg-2)',
                  color: active ? '#fff' : 'var(--text)', border: active ? 'none' : '1px solid var(--border)' }}>
                {v ?? 'Indiferente'}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, alignItems:'start' }}>
      <ConfirmModal
        open={confirmEnvio}
        onClose={() => setConfirmEnvio(false)}
        onConfirm={doEnviar}
        title={`${t('confirmSendTitle')} (${resultado?.total || 0} ${t('people')})`}
        message={t('confirmSendMsg')}
        confirmLabel={t('sendToAll')}
        cancelLabel={t('cancel')}
      />
      {/* Panel de filtros */}
      <div className="card">
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Segmentación avanzada</h3>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>Combiná filtros para definir exactamente quién recibe el mensaje.</p>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Estado */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>Estado</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['ACTIVO','VISITANTE','INACTIVO'].map(e => (
                <ChipBtn key={e} label={e} active={filtros.estados.includes(e)} onClick={() => toggleArr('estados', e)} />
              ))}
            </div>
          </div>

          {/* Grupos */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>Grupos</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {(grupos||[]).map(g => (
                <ChipBtn key={g.id} label={g.nombre} active={filtros.grupos.includes(g.id)} onClick={() => toggleArr('grupos', g.id)} />
              ))}
            </div>
          </div>

          {/* Etapa espiritual */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>Etapa espiritual</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ETAPAS_ESPIRITALES.map(e => (
                <ChipBtn key={e} label={e.replace(/_/g,' ')} active={filtros.etapas.includes(e)} onClick={() => toggleArr('etapas', e)} />
              ))}
            </div>
          </div>

          {/* Booleans */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:8 }}>Indicadores espirituales</div>
            <TriToggle label="Bautizado en agua" campo="bautizadoAgua" />
            <TriToggle label="Bautizado espíritu" campo="bautizadoEspiritu" />
            <TriToggle label="Discipulado completo" campo="discipuladoCompletado" />
          </div>

          {/* Género */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>Género</div>
            <div style={{ display:'flex', gap:6 }}>
              {[['', 'Todos'], ['M', 'Masculino'], ['F', 'Femenino']].map(([v, l]) => (
                <ChipBtn key={v} label={l} active={filtros.genero === v} onClick={() => setFiltros(f=>({...f,genero:v}))} />
              ))}
            </div>
          </div>

          {/* Inactividad */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>Sin asistir hace más de</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" min="1" max="52" className="form-input" style={{ width:80 }}
                placeholder="Sem." value={filtros.inactivoDesde} onChange={e => setFiltros(f=>({...f,inactivoDesde:e.target.value}))} />
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>semanas (vacío = sin filtro)</span>
            </div>
          </div>

          {/* Canal requerido */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:6 }}>Requerir contacto</div>
            <div style={{ display:'flex', gap:12 }}>
              <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, cursor:'pointer' }}>
                <input type="checkbox" checked={filtros.soloConTelefono} onChange={e => setFiltros(f=>({...f,soloConTelefono:e.target.checked}))} style={{ accentColor:'var(--primary)' }} />
                Solo con teléfono
              </label>
              <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, cursor:'pointer' }}>
                <input type="checkbox" checked={filtros.soloConEmail} onChange={e => setFiltros(f=>({...f,soloConEmail:e.target.checked}))} style={{ accentColor:'var(--primary)' }} />
                Solo con email
              </label>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop:20, width:'100%' }} onClick={buscar} disabled={buscando}>
          {buscando ? 'Calculando...' : 'Calcular destinatarios'}
        </button>
      </div>

      {/* Panel de resultado y envío */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {resultado && (
          <div className="card">
            <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Resultado</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
              {[['Total', resultado.total, 'var(--primary)'], ['📱 Con tel.', resultado.conTelefono, 'var(--c-success)'], ['✉️ Con email', resultado.conEmail, 'var(--c-info)']].map(([l,v,c]) => (
                <div key={l} style={{ textAlign:'center', background:'var(--bg-2)', borderRadius:8, padding:'10px 6px' }}>
                  <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{l}</div>
                </div>
              ))}
            </div>
            {resultado.muestra?.length > 0 && (
              <div style={{ maxHeight:160, overflowY:'auto', marginBottom:12 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Muestra (primeros {resultado.muestra.length})</div>
                {resultado.muestra.map(p => (
                  <div key={p.id} style={{ fontSize:12, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                    {p.nombre} {p.apellido}
                    {p.grupoNombre && <span style={{ color:'var(--text-muted)', marginLeft:6 }}>— {p.grupoNombre}</span>}
                  </div>
                ))}
                {resultado.total > resultado.muestra.length && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>…y {resultado.total - resultado.muestra.length} más</div>}
              </div>
            )}
          </div>
        )}

        {resultado && resultado.total > 0 && (
          <div className="card">
            <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Enviar mensaje</div>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              {['WHATSAPP','EMAIL'].map(c => (
                <button key={c} type="button" onClick={() => setTipo(c)}
                  style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', fontWeight:tipo===c?700:400, background: tipo===c?'var(--primary)':'var(--bg-2)', color: tipo===c?'#fff':'var(--text)' }}>
                  {c}
                </button>
              ))}
            </div>
            {tipo === 'EMAIL' && (
              <input className="form-input" style={{ marginBottom:8 }} placeholder="Asunto" value={asunto} onChange={e => setAsunto(e.target.value)} />
            )}
            <textarea className="form-input" rows={5} placeholder="Hola {nombre}, ..." value={mensaje} onChange={e => setMensaje(e.target.value)} />
            <p style={{ fontSize:11, color:'var(--text-muted)', margin:'6px 0 12px' }}>Variables: {'{nombre}'} {'{apellido}'}</p>
            <button className="btn btn-primary" style={{ width:'100%' }} onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando...' : `↑ Enviar a ${resultado.total} personas`}
            </button>
          </div>
        )}

        {resultado2 && (
          <div className={`alert alert-${resultado2.errores > 0 ? 'warning' : 'success'}`}>
            ✅ {resultado2.enviados} enviados · ❌ {resultado2.errores} errores de {resultado2.total}
          </div>
        )}
      </div>
    </div>
  )
}

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
  const [hDir, setHDir]             = useState('')
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
      const qs = new URLSearchParams({ limit:30, page:hPage })
      if (hDir) qs.set('direccion', hDir)
      const r = await apiFetch(`/mensajes?${qs}`)
      setHistorial(r?.data || [])
      setHTotal(r?.total || 0)
    } catch {}
  }, [hPage, hDir])

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
        const txt = res.demo ? 'Historial Mensaje guardado (email sin configurar — andá a Configuración → Integraciones → Email)'
          : res.enviado ? `Mensaje enviado por ${form.tipo}`
          : `Advertencia No se pudo enviar: ${res.error}`
        setMsg({ type: res.enviado || res.demo ? 'success' : 'warning', text: txt })
      } else {
        res = await apiFetch('/mensajes/masivo', {
          method: 'POST',
          body: JSON.stringify({ grupoId: form.grupoId || null, estado: form.estado || null, tipo: form.tipo, mensaje: form.mensaje, asunto: form.asunto })
        })
        setMsg({ type: 'success', text: `${res.enviados}/${res.total} mensajes enviados` + (res.errores > 0 ? ` · ${res.errores} errores` : '') })
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
                WhatsApp {twOk ? 'OK' : `Advertencia ${t('notConfigured')}`}
              </span>
              <span style={{ ...badgeColor('EMAIL'), padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                Email {emlOk ? 'OK' : `Advertencia ${t('notConfigured')}`}
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
        {loadingBase ? (
          <div className="empty" style={{marginTop:40}}><div className="spinner" /><p style={{marginTop:16}}>{t('loadingMsg')}</p></div>
        ) : (<>
        <div className="mobile-tabs" style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 20 }}>
          {[['enviar', t('tabSend')], ['segmentar', t('tabSegment')], ['plantillas', t('tabTemplates')], ['historial', t('tabHistory')]].map(([k, l]) => (
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
                      <option value="EMAIL">Email Email{!emlOk ? ' (sin config)' : ''}</option>
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
                      <option value="EMAIL">Email Email</option>
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
                    <strong style={{ fontSize: 14 }}>{String(p.id).startsWith('d') ? '* ' : ''}{p.nombre}</strong>
                    <span style={{ ...badgeColor(p.tipo), padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{p.tipo}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{p.contenido}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setTab('enviar'); f('mensaje', p.contenido); f('tipo', p.tipo) }}>{t('use')}</button>
                  {!String(p.id).startsWith('d') && (
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmBorrarId(p.id)}>×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab === 'historial' && (
          <div className="card messages-history-card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap:10, flexWrap:'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t('sentMessages')} ({hTotal})</h3>
              <div style={{ display:'flex', gap:6 }}>
                {[['', t('allMessages')], ['SALIENTE', t('outgoing')], ['ENTRANTE', t('incoming')]].map(([v,l]) => (
                  <button key={v} className={hDir===v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    onClick={() => { setHDir(v); setHPage(1) }}>{l}</button>
                ))}
              </div>
            </div>
            {historial.length > 0 && (
              <div className="messages-mobile-history">
                {historial.map(m => (
                  <article className="message-history-card" key={m.id} style={m.direccion==='ENTRANTE'?{background:'var(--primary-soft)'}:{}}>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{ ...badgeColor(m.tipo), padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{m.tipo}</span>
                      {m.direccion === 'ENTRANTE'
                        ? <span style={{padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,background:'#EDE9FE',color:'#7C3AED'}}>{t('incomingLabel')}</span>
                        : null}
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
                      <tr key={m.id} style={m.direccion==='ENTRANTE'?{background:'var(--primary-soft)'}:{}}>
                        <td>
                          <span style={{ ...badgeColor(m.tipo), padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{m.tipo}</span>
                          {m.direccion === 'ENTRANTE' &&
                            <span style={{marginLeft:4,padding:'2px 6px',borderRadius:10,fontSize:10,fontWeight:600,background:'#EDE9FE',color:'#7C3AED'}}>{t('incomingLabel')}</span>}
                        </td>
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

        {/* ── SEGMENTADOR AVANZADO (#16) ── */}
        {tab === 'segmentar' && (
          <SegmentadorAvanzado grupos={grupos} />
        )}

        </>)}
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
