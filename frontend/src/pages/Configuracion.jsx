import { TokenIglesiaAdmin } from '../components/TokenIglesia.jsx'
import React, { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import BtnNotificaciones from '../components/BtnNotificaciones.jsx'
import { apiFetch, getApiUrl, getStoredContext } from '../services/api.js'

const CATEGORIAS = [
  { key:'iglesia', label:'Iglesia', icon:'🏛️', secciones:[
    { key:'general',    icon:'🏛️', label:'General',    desc:'Nombre, pastor, contacto' },
    { key:'cultos',     icon:'✓', label:'Cultos',     desc:'Días, turnos y horarios' },
    { key:'apariencia', icon:'🎨', label:'Apariencia', desc:'Color y logo' },
  ]},
  { key:'suscripcion', label:'Suscripción', icon:'▣', secciones:[] },
  { key:'integraciones', label:'Integraciones', icon:'🔌', secciones:[
    { key:'whatsapp', icon:'▢', label:'WhatsApp',             desc:'Twilio — mensajes reales' },
    { key:'ia',       icon:'◆', label:'Inteligencia Artificial', desc:'Groq · Anthropic · OpenAI' },
    { key:'email',    icon:'✉', label:'Email',                  desc:'Resend — emails masivos' },
  ]},
  { key:'pastoral', label:'Pastoral', icon:'≡', secciones:[
    { key:'alertas',     icon:'▣', label:'Alertas',     desc:'Umbrales automáticos' },
    { key:'seguimiento', icon:'👣', label:'Seguimiento', desc:'Frecuencias' },
  ]},
  { key:'sistema', label:'Sistema', icon:'⊙', secciones:[
    { key:'seguridad', icon:'🔐', label:'Seguridad',     desc:'Sesiones y acceso' },
    { key:'backup',    icon:'💾', label:'Backup y datos', desc:'Base de datos SQLite' },
  ]},
]

const CAMPOS = {
  general:     ['nombre_iglesia','direccion','telefono_iglesia','email_iglesia','pastor_nombre','sitio_web'],
  cultos:      ['cultos_dias','cultos_turnos','culto_duracion','culto_capacidad'],
  apariencia:  ['color_primario','logo_url','modo_oscuro_default'],
  whatsapp:    ['twilio_sid','twilio_from'],
  ia:          ['ia_proveedor'],
  email:       ['resend_key','email_from','email_nombre'],
  alertas:     ['alerta_sin_asistir','alerta_sin_seguimiento','alerta_visitante','alerta_cumple'],
  seguimiento: ['seg_frecuencia_default'],
  seguridad:   ['sesion_horas','max_intentos'],
  backup:      [],
}

function badge(sec, cfg) {
  if (sec==='whatsapp') return cfg.twilio_configurado ? 'ok' : 'warn'
  if (sec==='ia')       return (cfg.anthropic_ok||cfg.openai_ok||cfg.groq_ok) ? 'ok' : 'warn'
  if (sec==='email')    return cfg.email_configurado ? 'ok' : 'warn'
  return null
}


function SuscripcionTab() {
  const [estado, setEstado]     = React.useState(null)
  const [planes, setPlanes]     = React.useState([])
  const [loading, setLoading]   = React.useState(false)
  const [msg, setMsg]           = React.useState(null)
  const [billingCtx, setBillingCtx] = React.useState(getStoredContext())

  React.useEffect(() => {
    Promise.all([
      apiFetch('/mp/estado').catch(() => null),
      apiFetch('/config').catch(() => ({})),
    ]).then(([estadoRes, cfg]) => {
      if (estadoRes) setEstado(estadoRes)
      const ctx = {
        country: cfg.pais || cfg.country || billingCtx.country || 'AR',
        currency: cfg.divisa || cfg.currency || billingCtx.currency || 'ARS',
        lang: cfg.idioma || cfg.lang || billingCtx.lang || 'es',
        promo: cfg.promoCode || billingCtx.promo || '',
      }
      setBillingCtx(ctx)
      apiFetch(`/mp/planes?country=${ctx.country}&lang=${ctx.lang}`).then(setPlanes).catch(() => {})
    })
  }, [])

  async function pagar(planId) {
    setLoading(true); setMsg(null)
    try {
      const r = await apiFetch('/mp/crear-preferencia', { method:'POST', body: JSON.stringify({ plan: planId, country: billingCtx.country, currency: billingCtx.currency, promo: billingCtx.promo }) })
      if (r.initPoint) window.open(r.initPoint, '_blank')
      else setMsg({ type:'error', text: r.error || 'Error al crear el link de pago' })
    } catch(e) { setMsg({ type:'error', text: e.message }) }
    setLoading(false)
  }

  if (!estado) return <div className="empty"><div className="empty-icon">▣</div><p>Cargando...</p></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Estado actual */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Estado de tu suscripción</h3>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:160, padding:'14px 16px', borderRadius:'var(--r-lg)', background: estado.activo ? 'var(--c-success-bg)' : 'var(--c-warning-bg)', border: `1px solid ${estado.activo ? 'var(--c-success-brd)' : 'var(--c-warning-brd)'}` }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{estado.activo ? '✓' : '⚠'}</div>
            <div style={{ fontSize:14, fontWeight:700, color: estado.activo ? 'var(--c-success)' : 'var(--c-warning)' }}>
              {estado.enTrial ? `Trial — ${estado.diasTrial} días restantes` : estado.suscActiva ? 'Suscripción activa' : 'Sin suscripción activa'}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {estado.enTrial ? `Vence: ${estado.trialFin}` : estado.suscVence ? `Renovación: ${estado.suscVence}` : 'Activá un plan para continuar'}
            </div>
          </div>
          <div style={{ flex:1, minWidth:160, padding:'14px 16px', borderRadius:'var(--r-lg)', background:'var(--c-info-bg)', border:'1px solid var(--c-info-brd)' }}>
            <div style={{ fontSize:22, marginBottom:4 }}>📦</div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--c-info)' }}>Plan {estado.planLabel}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {estado.personasMax === 99999 ? 'Personas ilimitadas' : `Hasta ${estado.personasMax} personas`}
            </div>
          </div>
        </div>
      </div>

      {/* Planes */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Planes disponibles</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
          {planes.map(p => (
            <div key={p.id} style={{
              padding:'16px', borderRadius:'var(--r-lg)',
              border: p.id === estado.plan ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: p.id === estado.plan ? 'var(--primary-soft)' : 'var(--surface)',
            }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                {p.label} {p.id === estado.plan && '✓ Actual'}
              </div>
              <div style={{ fontSize:26, fontWeight:800, marginBottom:4 }}>
                {p.currency || 'ARS'} {Number(p.precio || 0).toLocaleString('es-AR')}
                <span style={{ fontSize:13, fontWeight:400, color:'var(--text-muted)' }}>/mes</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>
                {p.personas === 99999 ? 'Ilimitadas' : `Hasta ${p.personas}`} personas
              </div>
              <button className="btn btn-primary btn-sm" style={{ width:'100%' }}
                onClick={() => pagar(p.id)} disabled={loading}>
                {loading ? '…' : '▣ Suscribirse'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const [sec, setSec]         = useState('general')
  const [config, setConfig]   = useState({})
  const [form, setForm]       = useState({})
  const [msg, setMsg]         = useState(null)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [backupInfo, setBackupInfo] = useState(null)
  const [collapsed, setCollapsed]   = useState({})
  const [emailDiag, setEmailDiag]   = useState(null)
  const [testingEmail, setTestingEmail] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch('/config').catch(() => ({})),
      apiFetch('/backup/info').catch(() => null),
      apiFetch('/config/email-diagnostics').catch(() => null),
    ]).then(([c, b, diag]) => {
      const cfg = c || {}
      setConfig(cfg)
      setForm({
        nombre_iglesia:    cfg.nombre_iglesia    || '',
        direccion:         cfg.direccion         || '',
        telefono_iglesia:  cfg.telefono_iglesia  || '',
        email_iglesia:     cfg.email_iglesia     || '',
        pastor_nombre:     cfg.pastor_nombre     || '',
        sitio_web:         cfg.sitio_web         || '',
        cultos_dias:       cfg.cultos_dias       || 'DOMINGO',
        cultos_turnos:     cfg.cultos_turnos     || '1',
        culto_duracion:    cfg.culto_duracion    || '90',
        culto_capacidad:   cfg.culto_capacidad   || '',
        color_primario:    cfg.color_primario    || '#2563EB',
        logo_url:          cfg.logo_url          || '',
        modo_oscuro_default: cfg.modo_oscuro_default || '0',
        twilio_sid:        cfg.twilio_sid        || '',
        twilio_token:      '',
        resend_key:        '',
        email_from:        cfg.email_from     || '',
        email_nombre:      cfg.email_nombre   || '',
        twilio_from:       cfg.twilio_from       || '',
        ia_proveedor:      cfg.ia_proveedor      || 'groq',
        anthropic_key:     '',
        openai_key:        '',
        groq_key:          '',
        alerta_sin_asistir:     cfg.alerta_sin_asistir     || '3',
        alerta_sin_seguimiento: cfg.alerta_sin_seguimiento || '30',
        alerta_visitante:       cfg.alerta_visitante       || '14',
        alerta_cumple:          cfg.alerta_cumple          || '7',
        seg_frecuencia_default: cfg.seg_frecuencia_default || '30',
        sesion_horas:      cfg.sesion_horas      || '8',
        max_intentos:      cfg.max_intentos      || '10',
      })
      setBackupInfo(b)
      setEmailDiag(diag)
      setLoading(false)
    })
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg(null)
    const payload = {}
    for (const k of (CAMPOS[sec] || [])) if (form[k] !== undefined && form[k] !== '') payload[k] = form[k]
    if (sec === 'whatsapp' && form.twilio_token) payload.twilio_token = form.twilio_token
    if (sec === 'email' && form.resend_key) payload.resend_key = form.resend_key
    if (sec === 'ia') {
      if (form.anthropic_key) payload.anthropic_key = form.anthropic_key
      if (form.openai_key)    payload.openai_key    = form.openai_key
      if (form.groq_key)      payload.groq_key      = form.groq_key
    }
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify(payload) })
      setMsg({ type: 'success', text: 'Guardado' })
      const c = await apiFetch('/config').catch(() => config)
      setConfig(c || config)
      if (sec === 'email') {
        apiFetch('/config/email-diagnostics').then(setEmailDiag).catch(() => {})
      }
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    setSaving(false)
  }

  async function testEmail() {
    setTestingEmail(true); setMsg(null)
    try {
      const res = await apiFetch('/config/email-test', { method:'POST' })
      setEmailDiag(res.diagnostics || emailDiag)
      setMsg({ type:'success', text: res.result?.demo ? 'Prueba simulada: falta RESEND_API_KEY en producción.' : 'Email de prueba enviado.' })
    } catch (err) {
      setMsg({ type:'error', text: err.message })
    } finally {
      setTestingEmail(false)
    }
  }

  const catActiva = CATEGORIAS.find(c => c.secciones.some(s => s.key === sec))
  const secActiva = CATEGORIAS.flatMap(c => c.secciones).find(s => s.key === sec)

  if (loading) return <div className="layout"><Menu /><main className="main"><div className="empty"><p>Cargando...</p></div></main></div>

  return (
    <div className="layout"><Menu />
      <main className="main">
        <TokenIglesiaAdmin />
      <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Settings /> Configuración</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>{catActiva?.label} · {secActiva?.label}</p>
          </div>
        </div>
        <div className="settings-shell" style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:16,alignItems:'start'}}>

          {/* Sidebar */}
          <nav className="card settings-nav" style={{padding:6}}>
            {CATEGORIAS.map(cat => {
              const open = !collapsed[cat.key]
              return (
                <div key={cat.key} style={{marginBottom:4}}>
                  <button onClick={() => setCollapsed(p=>({...p,[cat.key]:!p[cat.key]}))}
                    style={{width:'100%',padding:'7px 10px',border:'none',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:8,borderRadius:'var(--r)'}}>
                    <span style={{fontSize:13}}>{cat.icon}</span>
                    <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'var(--text-muted)',flex:1,textAlign:'left'}}>{cat.label}</span>
                    <span style={{fontSize:10,color:'var(--text-faint)'}}>{open?'▾':'▸'}</span>
                  </button>
                  {open && (cat?.secciones || []).map(s => {
                    const b = badge(s.key, config)
                    const active = sec === s.key
                    return (
                      <button key={s.key} onClick={() => { setSec(s.key); setMsg(null) }}
                        style={{width:'100%',padding:'8px 10px 8px 28px',border:'none',borderRadius:'var(--r)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:9,marginBottom:1,background:active?'var(--primary)':'transparent',color:active?'var(--surface)':'var(--text)'}}>
                        <span style={{fontSize:13,flexShrink:0}}>{s.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:active?600:450,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.label}</div>
                          {!active && <div style={{fontSize:10,opacity:.55,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.desc}</div>}
                        </div>
                        {b && <span style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:b==='ok'?'#16A34A':'#F59E0B'}}/>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          {/* Panel */}
          <form className="settings-form" onSubmit={handleSave}>
            <div className="card settings-panel">
              <div className="settings-panel-header" style={{display:'flex',alignItems:'center',gap:12,marginBottom:24,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:22}}>{secActiva?.icon}</span>
                <div><h2 style={{fontSize:16,fontWeight:700,margin:0}}>{secActiva?.label}</h2><p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{secActiva?.desc}</p></div>
              </div>

              {msg && <div className={`alert alert-${msg.type}`} style={{marginBottom:20}}>{msg.text}</div>}

              {/* GENERAL */}
              {sec==='general' && (
                <div className="form-grid">
                  <div className="form-group full"><label>Nombre de la iglesia</label><input name="nombre_iglesia" className="form-input" value={form.nombre_iglesia} onChange={e=>f('nombre_iglesia',e.target.value)} placeholder="Iglesia Evangélica..."/></div>
                  <div className="form-group full"><label>Dirección</label><input name="direccion" className="form-input" value={form.direccion} onChange={e=>f('direccion',e.target.value)}/></div>
                  <div className="form-group"><label>Teléfono</label><input name="telefono_iglesia" className="form-input" value={form.telefono_iglesia} onChange={e=>f('telefono_iglesia',e.target.value)} placeholder="+54 11 1234-5678"/></div>
                  <div className="form-group"><label>Email</label><input name="email_iglesia" className="form-input" type="email" value={form.email_iglesia} onChange={e=>f('email_iglesia',e.target.value)}/></div>
                  <div className="form-group"><label>Pastor/a principal</label><input name="pastor_nombre" className="form-input" value={form.pastor_nombre} onChange={e=>f('pastor_nombre',e.target.value)} placeholder="Pr. Juan González"/></div>
                  <div className="form-group"><label>Sitio web</label><input name="sitio_web" className="form-input" value={form.sitio_web} onChange={e=>f('sitio_web',e.target.value)} placeholder="https://iglesia.com"/></div>
                </div>
              )}

              {/* CULTOS */}
              {sec==='cultos' && <>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Días de culto (separados por coma)</label>
                    <input name="cultos_dias" className="form-input" value={form.cultos_dias} onChange={e=>f('cultos_dias',e.target.value)} placeholder="DOMINGO,MIERCOLES"/>
                    <span style={{fontSize:11,color:'var(--text-muted)',marginTop:3,display:'block'}}>En mayúsculas. Ej: DOMINGO,MIERCOLES,VIERNES</span>
                  </div>
                  <div className="form-group"><label>Turnos por culto</label>
                    <select name="cultos_turnos" className="form-input" value={form.cultos_turnos} onChange={e=>f('cultos_turnos',e.target.value)}>
                      {['1','2','3','4'].map(n=><option key={n} value={n}>{n} turno{n!=='1'?'s':''}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Duración (minutos)</label><input name="culto_duracion" className="form-input" type="number" min={30} max={300} value={form.culto_duracion} onChange={e=>f('culto_duracion',e.target.value)}/></div>
                  <div className="form-group"><label>Capacidad del lugar</label><input name="culto_capacidad" className="form-input" type="number" min={1} value={form.culto_capacidad} onChange={e=>f('culto_capacidad',e.target.value)} placeholder="200"/></div>
                </div>
                <div style={{marginTop:16,padding:'12px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Vista previa</p>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {form.cultos_dias.split(',').filter(Boolean).map(dia=>
                      Array.from({length:Number(form.cultos_turnos)||1},(_,i)=>(
                        <span key={`${dia}-${i}`} style={{padding:'4px 12px',background:'var(--primary)',color:'var(--surface)',borderRadius:'var(--r)',fontSize:12,fontWeight:600}}>{dia.trim()} · T{i+1}</span>
                      ))
                    )}
                  </div>
                </div>
              </>}

              {/* APARIENCIA */}
              {sec==='apariencia' && <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Color principal</label>
                    <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                      <input name="color_primario" type="color" value={form.color_primario} onChange={e=>f('color_primario',e.target.value)} style={{width:44,height:36,padding:2,border:'1px solid var(--border)',borderRadius:'var(--r)',cursor:'pointer'}}/>
                      <input name="color_primario" className="form-input" value={form.color_primario} onChange={e=>f('color_primario',e.target.value)}/>
                    </div>
                  </div>
                  <div className="form-group"><label>URL del logo</label><input name="logo_url" className="form-input" value={form.logo_url} onChange={e=>f('logo_url',e.target.value)} placeholder="https://..."/></div>
                  <div className="form-group full"><label>Tema por defecto</label>
                    <div style={{display:'flex',gap:10}}>
                      {[['0','☀️  Claro'],['1','🌙  Oscuro']].map(([val,lbl])=>(
                        <label key={val} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 16px',border:`1px solid ${form.modo_oscuro_default===val?'var(--primary)':'var(--border)'}`,borderRadius:'var(--r)',cursor:'pointer',background:form.modo_oscuro_default===val?'var(--primary-soft)':'transparent',fontSize:13,fontWeight:form.modo_oscuro_default===val?600:400}}>
                          <input type="radio" name="modo" value={val} checked={form.modo_oscuro_default===val} onChange={()=>f('modo_oscuro_default',val)} style={{accentColor:'var(--primary)'}}/>{lbl}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{marginTop:16,padding:16,background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:10,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Vista previa</p>
                  <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:form.color_primario,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--surface)',fontSize:18,flexShrink:0}}><Icons.Dashboard /></div>
                    <div><div style={{fontSize:14,fontWeight:700,color:form.color_primario}}>{form.nombre_iglesia||'Church System'}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{form.pastor_nombre||'Pastor'}</div></div>
                    <button type="button" style={{marginLeft:'auto',padding:'6px 14px',background:form.color_primario,border:'none',borderRadius:'var(--r)',color:'var(--surface)',fontSize:12,fontWeight:600}}>Botón</button>
                  </div>
                </div>
              </>}

              {/* WHATSAPP */}
              {sec==='whatsapp' && <>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:20,borderRadius:'var(--r)',background:config.twilio_configurado?'#F0FDF4':'#FFFBEB',border:`1px solid ${config.twilio_configurado?'#86EFAC':'#FDE68A'}`}}>
                  <span style={{fontSize:20}}>{config.twilio_configurado?'✓':'⚠'}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:config.twilio_configurado?'var(--c-success)':'var(--c-warning)'}}>{config.twilio_configurado?'Twilio activo':'Sin configurar — modo demo'}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{config.twilio_configurado?'Los mensajes se envían por WhatsApp real':'Los mensajes se registran pero no se envían'}</div>
                  </div>
                  <a href="https://console.twilio.com" target="_blank" rel="noreferrer" style={{marginLeft:'auto',fontSize:12,color:'var(--primary)',fontWeight:600,whiteSpace:'nowrap'}}>Ir a Twilio →</a>
                </div>
                <div className="form-grid">
                  <div className="form-group full"><label>Account SID</label><input name="twilio_sid" className="form-input" value={form.twilio_sid} onChange={e=>f('twilio_sid',e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"/></div>
                  <div className="form-group full"><label>Auth Token{config.twilio_configurado&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> — vacío = no cambiar</span>}</label><input name="twilio_token" className="form-input" type="password" value={form.twilio_token} onChange={e=>f('twilio_token',e.target.value)} placeholder={config.twilio_configurado?'••••••••••':'Tu auth token'}/></div>
                  <div className="form-group full"><label>Número WhatsApp de Twilio</label><input name="twilio_from" className="form-input" value={form.twilio_from} onChange={e=>f('twilio_from',e.target.value)} placeholder="+14155238886"/></div>
                </div>
              </>}

              {/* IA */}
              {sec==='ia' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Elegí un proveedor. <strong>Groq es gratuito</strong> y no necesita tarjeta de crédito.</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:24}}>
                  {[
                    {key:'groq',      icon:'⚡',name:'Groq',      sub:'Gratis · Llama 3.1',     url:'https://console.groq.com',       ok:config.groq_ok},
                    {key:'anthropic', icon:'🧠',name:'Anthropic', sub:'Claude · Más preciso',    url:'https://console.anthropic.com',  ok:config.anthropic_ok},
                    {key:'openai',    icon:'💡',name:'OpenAI',    sub:'ChatGPT · Popular',       url:'https://platform.openai.com',    ok:config.openai_ok},
                  ].map(p=>{
                    const sel = form.ia_proveedor===p.key
                    return (
                      <div key={p.key} onClick={()=>f('ia_proveedor',p.key)}
                        style={{padding:'14px 12px',borderRadius:'var(--r-lg)',cursor:'pointer',textAlign:'center',border:`2px solid ${sel?'var(--primary)':'var(--border)'}`,background:sel?'var(--primary-soft)':'var(--surface)',transition:'var(--t)'}}>
                        <div style={{fontSize:24,marginBottom:6}}>{p.icon}</div>
                        <div style={{fontSize:13,fontWeight:700,color:sel?'var(--primary)':'var(--text)'}}>{p.name}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.sub}</div>
                        {p.ok&&<div style={{fontSize:10,marginTop:6,color:'var(--c-success)',fontWeight:600}}>● Configurado</div>}
                        <a href={p.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,color:'var(--primary)',display:'block',marginTop:4}}>Obtener key →</a>
                      </div>
                    )
                  })}
                </div>
                {form.ia_proveedor==='groq' && (
                  <div className="form-group" style={{marginBottom:16}}>
                    <label>Groq API Key{config.groq_ok&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> — vacío = no cambiar</span>}</label>
                    <input name="groq_key" className="form-input" type="password" value={form.groq_key} onChange={e=>f('groq_key',e.target.value)} placeholder={config.groq_ok?'gsk_•••••••':'gsk_...'}/>
                    <span style={{fontSize:11,color:'var(--text-muted)',marginTop:4,display:'block'}}>Gratis en <strong>console.groq.com</strong> — sin tarjeta de crédito</span>
                  </div>
                )}
                {form.ia_proveedor==='anthropic' && (
                  <div className="form-group" style={{marginBottom:16}}>
                    <label>Anthropic API Key{config.anthropic_ok&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> — vacío = no cambiar</span>}</label>
                    <input name="anthropic_key" className="form-input" type="password" value={form.anthropic_key} onChange={e=>f('anthropic_key',e.target.value)} placeholder={config.anthropic_ok?'sk-ant-•••':'sk-ant-api03-...'}/>
                  </div>
                )}
                {form.ia_proveedor==='openai' && (
                  <div className="form-group" style={{marginBottom:16}}>
                    <label>OpenAI API Key{config.openai_ok&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> — vacío = no cambiar</span>}</label>
                    <input name="openai_key" className="form-input" type="password" value={form.openai_key} onChange={e=>f('openai_key',e.target.value)} placeholder={config.openai_ok?'sk-•••':'sk-proj-...'}/>
                  </div>
                )}
                <div style={{background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',overflow:'hidden'}}>
                  <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Modelos</div>
                  {[
                    {prov:'groq',      modelo:'llama-3.1-8b-instant',    desc:'Gratis · Muy rápido'},
                    {prov:'anthropic', modelo:'claude-haiku-4-5-20251001', desc:'Económico · Preciso'},
                    {prov:'openai',    modelo:'gpt-4o-mini',              desc:'Equilibrado · Popular'},
                  ].map(m=>(
                    <div key={m.prov} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 14px',borderBottom:'1px solid var(--border)',fontSize:13,background:form.ia_proveedor===m.prov?'var(--primary-soft)':'transparent'}}>
                      <div><span style={{fontWeight:600,color:form.ia_proveedor===m.prov?'var(--primary)':'var(--text)'}}>{m.modelo}</span><span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>{m.desc}</span></div>
                      {form.ia_proveedor===m.prov&&<span style={{fontSize:10,color:'var(--primary)',fontWeight:700}}>ACTIVO</span>}
                    </div>
                  ))}
                </div>
              </>}


              {/* EMAIL */}
              {sec==='email' && <>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:20,borderRadius:'var(--r)',background:config.email_configurado?'#F0FDF4':'#FFFBEB',border:`1px solid ${config.email_configurado?'#86EFAC':'#FDE68A'}`}}>
                  <span style={{fontSize:20}}>{config.email_configurado?'✓':'⚠'}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:config.email_configurado?'var(--c-success)':'var(--c-warning)'}}>{config.email_configurado?'Email activo — Resend configurado':'Sin configurar — modo demo'}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{config.email_configurado?'Los emails se envían realmente':'Los mensajes se guardan pero no se envían'}</div>
                  </div>
                  <a href="https://resend.com" target="_blank" rel="noreferrer" style={{marginLeft:'auto',fontSize:12,color:'var(--primary)',fontWeight:600,whiteSpace:'nowrap'}}>Ir a Resend →</a>
                </div>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Resend API Key{config.email_configurado&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> — vacío = no cambiar</span>}</label>
                    <input className="form-input" type="password" value={form.resend_key} onChange={e=>f('resend_key',e.target.value)} placeholder={config.email_configurado?'re_•••••••':'re_...'}/>
                    <span style={{fontSize:11,color:'var(--text-muted)',marginTop:4,display:'block'}}>Gratis hasta 3.000 emails/mes en <strong>resend.com</strong></span>
                  </div>
                  <div className="form-group">
                    <label>Email remitente</label>
                    <input className="form-input" type="email" value={form.email_from} onChange={e=>f('email_from',e.target.value)} placeholder="noreply@tuiglesia.com"/>
                  </div>
                  <div className="form-group">
                    <label>Nombre del remitente</label>
                    <input className="form-input" value={form.email_nombre} onChange={e=>f('email_nombre',e.target.value)} placeholder="Iglesia Evangelica"/>
                  </div>
                </div>
                {emailDiag && (
                  <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:10}}>
                      <div>
                        <p style={{fontSize:11,fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Diagnóstico Render / Email</p>
                        <div style={{fontSize:13,color:emailDiag.ok?'var(--c-success)':'var(--c-warning)',fontWeight:700}}>
                          {emailDiag.ok?'Configuración completa':'Revisar configuración'}
                        </div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={testEmail} disabled={testingEmail}>
                        {testingEmail ? 'Enviando...' : 'Enviar prueba'}
                      </button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,marginBottom:10}}>
                      {[
                        ['Resend', emailDiag.resendConfigured ? 'OK' : 'Falta API key'],
                        ['Remitente', emailDiag.fromEmail || 'Sin detectar'],
                        ['Dominio', emailDiag.domainLooksValid ? emailDiag.domain : `${emailDiag.domain || 'N/A'} (verificar)`],
                        ['Variables faltantes', emailDiag.render?.missing?.length ? emailDiag.render.missing.join(', ') : 'Ninguna'],
                      ].map(([l,v])=>(
                        <div key={l} style={{padding:'9px 10px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)'}}>
                          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:3}}>{l}</div>
                          <div style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {emailDiag.warnings?.length > 0 && (
                      <ul style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.7,paddingLeft:18,margin:0}}>
                        {emailDiag.warnings.map(w => <li key={w}>{w}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Para activar Resend</p>
                  <ol style={{paddingLeft:16,fontSize:13,color:'var(--text-2)',lineHeight:2}}>
                    <li>Creá cuenta gratis en <strong>resend.com</strong></li>
                    <li>Verificá tu dominio (o usá el sandbox de Resend para tests)</li>
                    <li>Copiá tu API key y pegála arriba</li>
                    <li>Configurá el email remitente con tu dominio verificado</li>
                  </ol>
                </div>
              </>}

              {/* ALERTAS */}
              {sec==='alertas' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Cuándo se disparan las alertas pastorales automáticas.</p>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {[
                    {k:'alerta_sin_asistir',     label:'🚨 Sin asistir',             unit:'cultos consecutivos',   min:1,max:10},
                    {k:'alerta_sin_seguimiento',  label:'⚠ Sin seguimiento',         unit:'días sin contacto',     min:7,max:90},
                    {k:'alerta_visitante',        label:'Visitante sin consolidar', unit:'días desde el ingreso', min:7,max:60},
                    {k:'alerta_cumple',           label:'🎂 Cumpleaños',              unit:'días de anticipación',  min:1,max:14},
                  ].map(({k,label,unit,min,max})=>(
                    <div key={k} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{label}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{unit}</div></div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <input name="field_329" type="number" min={min} max={max} value={form[k]} onChange={e=>f(k,e.target.value)}
                          style={{width:60,padding:'6px 10px',border:'1px solid var(--border-strong)',borderRadius:'var(--r)',fontSize:15,fontWeight:700,textAlign:'center',outline:'none',background:'var(--surface)',color:'var(--text)'}}/>
                        <span style={{fontSize:12,color:'var(--text-muted)',minWidth:40}}>{k==='alerta_sin_asistir'?'cultos':'días'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>}

              {/* SEGUIMIENTO */}
              {sec==='seguimiento' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Configuración del seguimiento pastoral.</p>
                <div className="form-group" style={{marginBottom:20}}>
                  <label>Frecuencia recomendada (días entre seguimientos)</label>
                  <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                    <input name="seg_frecuencia_default" className="form-input" type="number" min={7} max={90} value={form.seg_frecuencia_default} onChange={e=>f('seg_frecuencia_default',e.target.value)} style={{width:80}}/>
                    <span style={{fontSize:13,color:'var(--text-muted)'}}>días</span>
                  </div>
                </div>
              </>}

              {/* SEGURIDAD */}
              {sec==='seguridad' && <>
                <div className="form-grid" style={{marginBottom:20}}>
                  <div className="form-group"><label>Duración de sesión</label>
                    <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}><input name="sesion_horas" className="form-input" type="number" min={1} max={72} value={form.sesion_horas} onChange={e=>f('sesion_horas',e.target.value)} style={{width:70}}/><span style={{fontSize:13,color:'var(--text-muted)'}}>horas</span></div>
                  </div>
                  <div className="form-group"><label>Máx. intentos de login</label>
                    <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}><input name="max_intentos" className="form-input" type="number" min={3} max={20} value={form.max_intentos} onChange={e=>f('max_intentos',e.target.value)} style={{width:70}}/><span style={{fontSize:13,color:'var(--text-muted)'}}>→ bloqueo 15 min</span></div>
                  </div>
                </div>
                <div style={{background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',overflow:'hidden'}}>
                  <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Protecciones activas</div>
                  {['JWT con expiración configurable','Verificación de usuario activo en cada request','Rate limiting en login y API de IA','Sanitización de inputs en todos los endpoints','Validación Zod en rutas críticas','Helmet — headers HTTP de seguridad','CORS estricto — solo localhost','Auditoría de acciones en historial'].map((item,i)=>(
                    <div key={i} style={{display:'flex',gap:10,padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:13,alignItems:'center'}}>
                      <span style={{color:'var(--c-success)',flexShrink:0}}>✓</span>{item}
                    </div>
                  ))}
                </div>
              </>}

              {/* BACKUP */}
              {sec==='backup' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>La base de datos es un archivo SQLite. Descargalo periódicamente como respaldo.</p>
                {backupInfo && (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:16}}>
                      {[['Tamaño',backupInfo.tamano],['Modificado',backupInfo.modificado?.slice(0,10)||'—'],['Tablas','18']].map(([l,v])=>(
                        <div key={l} style={{padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                          <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)',marginBottom:4}}>{l}</div>
                          <div style={{fontSize:18,fontWeight:800,color:'var(--primary)'}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {backupInfo.totales && (
                      <div style={{background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',overflow:'hidden',marginBottom:16}}>
                        <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Resumen</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
                          {Object.entries(backupInfo.totales).map(([k,v])=>(
                            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 14px',borderBottom:'1px solid var(--border)',fontSize:13}}>
                              <span style={{color:'var(--text-muted)',textTransform:'capitalize'}}>{k}</span><strong>{v}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <a href={`${getApiUrl()}/backup/download?token=${localStorage.getItem("token")}`} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:12,background:'var(--primary)',color:'var(--surface)',borderRadius:'var(--r)',fontSize:14,fontWeight:600,textDecoration:'none'}}>⬇️ Descargar backup (church.db)</a>
                <p style={{fontSize:11,color:'var(--text-muted)',marginTop:8,textAlign:'center'}}>Para restaurar: reemplazá <code>church.db</code> en <code>backend/</code></p>
              </>}

              {sec!=='backup' && (
                <div style={{marginTop:24,paddingTop:16,borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</button>
                  {msg?.type==='success'&&<span style={{fontSize:13,color:'var(--c-success)'}}>{msg.text}</span>}
                </div>
              )}
            </div>
          </form>
        </div>
      {/* Notificaciones */}
      <div style={{marginTop:20}}>
        <h2 style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--text-muted)',marginBottom:12}}>
          <Icons.Comunicados /> Notificaciones
        </h2>
        <BtnNotificaciones />
      </div>

      {/* Contacto y soporte */}
      <div style={{marginTop:32}}>
        <h2 style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--text-muted)',marginBottom:16}}>Contacto y soporte</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
          {[
            {label:'Soporte general',email:'soporte@churchsystem.com.ar',desc:'Problemas y consultas técnicas'},
            {label:'Ventas',email:'ventas@churchsystem.com.ar',desc:'Planes, precios y demos'},
            {label:'Contacto',email:'contacto@churchsystem.com.ar',desc:'Consultas generales'},
            {label:'Legal / Privacidad',email:'legal@churchsystem.com.ar',desc:'Contratos, datos y baja'},
            {label:'Seguridad',email:'seguridad@churchsystem.com.ar',desc:'Vulnerabilidades e incidentes'},
          ].map(item=>(
            <a key={item.label} href={`mailto:${item.email}`}
              style={{padding:'14px 16px',background:'var(--surface)',border:'1px solid var(--border)',
                borderRadius:12,textDecoration:'none',display:'block',transition:'border-color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:2}}>{item.label}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>{item.desc}</div>
              <div style={{fontSize:12,color:'var(--primary)'}}>{item.email}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Documentos legales */}
      <div style={{marginTop:32}}>
        <h2 style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--text-muted)',marginBottom:16}}>Documentos legales</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
          {[
            {label:'Términos y Condiciones',href:'/app/terminos'},
            {label:'Política de Privacidad',href:'/app/privacidad'},
            {label:'Preguntas frecuentes',href:'/app/faq'},
          ].map(item=>(
            <a key={item.label} href={item.href}
              style={{padding:'14px 16px',background:'var(--surface)',border:'1px solid var(--border)',
                borderRadius:12,textDecoration:'none',display:'flex',alignItems:'center',
                gap:8,fontSize:13,fontWeight:600,color:'var(--text)',transition:'border-color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <span style={{color:'var(--primary)'}}>▤</span>{item.label}
            </a>
          ))}
        </div>
        <div style={{marginTop:12,padding:'12px 16px',background:'rgba(245,158,11,0.08)',
          border:'1px solid rgba(245,158,11,0.2)',borderRadius:12,fontSize:12,
          color:'var(--text-muted)',lineHeight:1.6}}>
          <strong style={{color:'var(--c-warning)'}}>⚠ Beta v2.6.0:</strong>{' '}
          Plataforma en etapa beta. Algunas funciones pueden cambiar o fallar.
          Para baja o exportación de datos:{' '}
          <a href="mailto:legal@churchsystem.com.ar" style={{color:'var(--primary)'}}>legal@churchsystem.com.ar</a>
        </div>
      </div>

      </main>
    </div>
  )
}
