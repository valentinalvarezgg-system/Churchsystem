import { TokenIglesiaAdmin } from '../components/TokenIglesia.jsx'
import React, { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useOrientation } from '../hooks/useOrientation.js'
import Menu from '../components/Menu.jsx'
import BtnNotificaciones from '../components/BtnNotificaciones.jsx'
import { apiFetch, getStoredContext } from '../services/api.js'
import { CONTACT_CHANNELS, EMAILS } from '../utils/legal.js'
import { APP_VERSION } from '../version.js'

const CATEGORIAS = [
  { key:'iglesia', label:'Iglesia', icon:'', secciones:[
    { key:'general',    icon:Icons.Building, label:'General',    desc:'Nombre, pastor, contacto' },
    { key:'cultos',     icon:Icons.Calendar, label:'Cultos',     desc:'Días, turnos y horarios' },
    { key:'apariencia', icon:Icons.Settings, label:'Apariencia', desc:'Color y logo' },
  ]},
  { key:'suscripcion', label:'Suscripción', icon:Icons.Premium, secciones:[] },
  { key:'integraciones', label:'Integraciones', icon:'', secciones:[
    { key:'whatsapp', icon:Icons.Messages, label:'WhatsApp',             desc:'Meta Cloud API oficial' },
    { key:'drive',    icon:Icons.FileText, label:'Google Drive', desc:'Carpetas y archivos por ministerio' },
    { key:'ia',       icon:Icons.AI, label:'Inteligencia Artificial', desc:'Groq · Anthropic · OpenAI' },
    { key:'email',    icon:Icons.Mail, label:'Email',                  desc:'Resend — emails masivos' },
  ]},
  { key:'pastoral', label:'Pastoral', icon:Icons.History, secciones:[
    { key:'alertas',     icon:Icons.Comunicados, label:'Alertas',     desc:'Umbrales automáticos' },
    { key:'seguimiento', icon:Icons.Clock, label:'Seguimiento', desc:'Frecuencias' },
  ]},
  { key:'sistema', label:'Sistema', icon:Icons.Settings, secciones:[
    { key:'seguridad', icon:Icons.Shield, label:'Seguridad',     desc:'Sesiones y acceso' },
    { key:'backup',    icon:Icons.Archive, label:'Backup y datos', desc:'PostgreSQL · Neon' },
  ]},
]

const CAMPOS = {
  general:     ['nombre_iglesia','direccion','telefono_iglesia','email_iglesia','pastor_nombre','sitio_web'],
  cultos:      ['cultos_dias','cultos_turnos','culto_duracion','culto_capacidad'],
  apariencia:  ['color_primario','logo_url','modo_oscuro_default'],
  whatsapp:    ['wa_phone_number_id','wa_business_account_id','wa_status'],
  ia:          ['ia_proveedor'],
  email:       ['resend_key','email_from','email_nombre'],
  alertas:     ['alerta_sin_asistir','alerta_sin_seguimiento','alerta_visitante','alerta_cumple'],
  seguimiento: ['seg_frecuencia_default'],
  seguridad:   ['sesion_horas','max_intentos'],
  backup:      [],
}

function badge(sec, cfg) {
  if (sec==='whatsapp') return cfg.whatsapp_cloud_configurado ? 'ok' : 'warn'
  if (sec==='drive')    return cfg.google_drive_configurado ? 'ok' : 'warn'
  if (sec==='ia')       return (cfg.anthropic_ok||cfg.openai_ok||cfg.groq_ok) ? 'ok' : 'warn'
  if (sec==='email')    return cfg.email_configurado ? 'ok' : 'warn'
  return null
}


const METODOS_PAGO = [
  { key:'mercadopago', label:'MercadoPago', icon:'', desc:'Tarjeta, débito, efectivo (Latinoamérica)' },
  { key:'stripe',      label:'Stripe',      icon:'', desc:'Tarjeta de crédito/débito (internacional)' },
  { key:'paypal',      label:'PayPal',      icon:'🅿',  desc:'Cuenta PayPal (USD, internacional)' },
  { key:'transferencia', label:'Transferencia', icon:'', desc:'Transferencia bancaria manual (24hs hábiles)' },
]

function SuscripcionTab() {
  const [estado, setEstado]     = React.useState(null)
  const [planes, setPlanes]     = React.useState([])
  const [loading, setLoading]   = React.useState(false)
  const [msg, setMsg]           = React.useState(null)
  const [billingCtx, setBillingCtx] = React.useState(getStoredContext())
  const [diag, setDiag]         = React.useState(null)
  const [readiness, setReadiness] = React.useState(null)
  const [metodo, setMetodo]     = React.useState('mercadopago')
  const [datosTransf, setDatosTransf] = React.useState(null)

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
      apiFetch('/config/commercial-diagnostics').then(setDiag).catch(() => {})
      apiFetch('/config/launch-readiness').then(setReadiness).catch(() => {})
    })
  }, [])

  async function pagar(planId) {
    setLoading(true); setMsg(null)
    try {
      if (metodo === 'mercadopago') {
        const r = await apiFetch('/mp/crear-preferencia', {
          method:'POST',
          body: JSON.stringify({ plan: planId, country: billingCtx.country, currency: billingCtx.currency, promo: billingCtx.promo }),
        })
        if (r.initPoint) window.open(r.initPoint, '_blank')
        else setMsg({ type:'error', text: r.error || 'Error al crear el link de pago' })

      } else if (metodo === 'stripe') {
        const r = await apiFetch('/stripe/crear-sesion', {
          method:'POST',
          body: JSON.stringify({ plan: planId, currency: 'USD', promo: billingCtx.promo }),
        })
        if (r.url) window.open(r.url, '_blank')
        else setMsg({ type:'error', text: r.error || 'Error al crear sesión Stripe' })

      } else if (metodo === 'paypal') {
        const r = await apiFetch('/paypal/crear-orden', {
          method:'POST',
          body: JSON.stringify({ plan: planId, promo: billingCtx.promo }),
        })
        if (r.approveUrl) window.open(r.approveUrl, '_blank')
        else setMsg({ type:'error', text: r.error || 'Error al crear orden PayPal' })

      } else if (metodo === 'transferencia') {
        const r = await apiFetch('/transferencia/solicitar', {
          method:'POST',
          body: JSON.stringify({ plan: planId }),
        })
        if (r.ok) {
          setDatosTransf(r)
          setMsg({ type:'success', text: r.mensaje || 'Solicitud registrada. Revisá los datos bancarios.' })
        } else {
          setMsg({ type:'error', text: r.error || 'Error al registrar la solicitud' })
        }
      }
    } catch(e) { setMsg({ type:'error', text: e.message }) }
    setLoading(false)
  }

  if (!estado) return <div className="empty"><div className="empty-icon">Pago</div><p>Cargando...</p></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Estado actual */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Estado de tu suscripción</h3>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:160, padding:'14px 16px', borderRadius:'var(--r-lg)', background: estado.activo ? 'var(--c-success-bg)' : 'var(--c-warning-bg)', border: `1px solid ${estado.activo ? 'var(--c-success-brd)' : 'var(--c-warning-brd)'}` }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{estado.activo ? 'OK' : 'Advertencia'}</div>
            <div style={{ fontSize:14, fontWeight:700, color: estado.activo ? 'var(--c-success)' : 'var(--c-warning)' }}>
              {estado.enTrial ? `Trial — ${estado.diasTrial} días restantes` : estado.suscActiva ? 'Suscripción activa' : 'Sin suscripción activa'}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {estado.enTrial ? `Vence: ${estado.trialFin}` : estado.suscVence ? `Renovación: ${estado.suscVence}` : 'Activá un plan para continuar'}
            </div>
            {!!estado.planPendiente && (
              <div style={{ fontSize:11, color:'var(--c-warning)', marginTop:6, fontWeight:600 }}>
                Pago pendiente para plan {estado.planPendiente}. Se activa al aprobarse.
              </div>
            )}
          </div>
          <div style={{ flex:1, minWidth:160, padding:'14px 16px', borderRadius:'var(--r-lg)', background:'var(--c-info-bg)', border:'1px solid var(--c-info-brd)' }}>
            <div style={{ fontSize:22, marginBottom:4 }}></div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--c-info)' }}>Plan {estado.planLabel}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {estado.personasMax === 99999 ? 'Personas ilimitadas' : `Hasta ${estado.personasMax} personas`}
            </div>
          </div>
        </div>
      </div>

      {/* Selector de medio de pago */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Medio de pago</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:8 }}>
          {METODOS_PAGO.map(m => (
            <button key={m.key} onClick={() => setMetodo(m.key)} style={{
              padding:'12px 14px',
              borderRadius:'var(--r-lg)',
              border: metodo === m.key ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: metodo === m.key ? 'var(--primary-soft)' : 'var(--surface)',
              cursor:'pointer',
              textAlign:'left',
            }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{m.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color: metodo === m.key ? 'var(--primary)' : 'var(--text)' }}>{m.label}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, lineHeight:1.3 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Datos bancarios (transferencia) */}
      {datosTransf?.datos && (
        <div className="card" style={{ padding:'20px 24px', border:'1px solid var(--c-info-brd)', background:'var(--c-info-bg)' }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Datos para transferencia</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13 }}>
            {datosTransf.datos.banco   && <div><b>Banco:</b> {datosTransf.datos.banco}</div>}
            {datosTransf.datos.titular && <div><b>Titular:</b> {datosTransf.datos.titular}</div>}
            {datosTransf.datos.cbu     && <div><b>CBU:</b> {datosTransf.datos.cbu}</div>}
            {datosTransf.datos.alias   && <div><b>Alias:</b> {datosTransf.datos.alias}</div>}
            {datosTransf.datos.cuit    && <div><b>CUIT:</b> {datosTransf.datos.cuit}</div>}
            {datosTransf.monto         && <div><b>Monto:</b> {datosTransf.monto}</div>}
            {datosTransf.datos.nota    && <div style={{ marginTop:6, color:'var(--c-info)', fontStyle:'italic' }}>{datosTransf.datos.nota}</div>}
          </div>
        </div>
      )}

      {/* Diagnóstico comercial */}
      {diag && (
        <div className="card" style={{ padding:'20px 24px' }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Diagnóstico comercial</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
            {(diag.checks || []).map(c => (
              <div key={c.key} style={{
                padding:'10px 12px', borderRadius:'var(--r)',
                border:`1px solid ${c.ok ? 'var(--c-success-brd)' : 'var(--c-warning-brd)'}`,
                background: c.ok ? 'var(--c-success-bg)' : 'var(--c-warning-bg)',
              }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)' }}>{c.key}</div>
                <div style={{ fontSize:13, fontWeight:700, color:c.ok ? 'var(--c-success)' : 'var(--c-warning)' }}>{c.ok ? 'OK' : 'Pendiente'}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{c.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {readiness && (
        <div className="card" style={{ padding:'20px 24px' }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Readiness de lanzamiento</h3>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>
            Estado: <b style={{ color: readiness.ok ? 'var(--c-success)' : 'var(--c-warning)' }}>{readiness.ok ? 'Listo para publicar' : 'Faltan ajustes'}</b> · Score {readiness.score}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10 }}>
            {(readiness.checks || []).map(c => (
              <div key={c.key} style={{ padding:'10px 12px', borderRadius:'var(--r)', border:`1px solid ${c.ok ? 'var(--c-success-brd)' : 'var(--c-warning-brd)'}`, background: c.ok ? 'var(--c-success-bg)' : 'var(--c-warning-bg)' }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>{c.key}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{c.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Planes */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>Planes disponibles</h3>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
          Pagando con {METODOS_PAGO.find(m => m.key === metodo)?.label}
          {metodo === 'paypal' ? ' (USD)' : metodo === 'stripe' ? ' (USD)' : ` (${billingCtx.currency || 'ARS'})`}
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
          {planes.map(p => (
            <div key={p.id} style={{
              padding:'16px', borderRadius:'var(--r-lg)',
              border: p.id === estado.plan ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: p.id === estado.plan ? 'var(--primary-soft)' : 'var(--surface)',
            }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                {p.label} {p.id === estado.plan && 'OK Actual'}
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
                {loading ? '…' : metodo === 'transferencia' ? ' Solicitar' : 'Pago Suscribirse'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const { isPhone } = useOrientation()
  const [sec, setSec]         = useState(() => new URLSearchParams(window.location.search).get('sec') || 'general')
  const [config, setConfig]   = useState({})
  const [form, setForm]       = useState({})
  const [msg, setMsg]         = useState(null)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [backupInfo, setBackupInfo] = useState(null)
  const [collapsed, setCollapsed]   = useState({})
  const [emailDiag, setEmailDiag]   = useState(null)
  const [testingEmail, setTestingEmail] = useState(false)
  const [contactAlias, setContactAlias] = useState('soporte')
  const [smokeRunning, setSmokeRunning] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [driveConnecting, setDriveConnecting] = useState(false)
  const publicOrigin = window.location.origin.replace('/app', '')

  useEffect(() => {
    setLoadError(null)
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
    }).catch((e) => {
      setLoadError(e.message || 'No se pudo cargar configuración')
      setLoading(false)
    })

    const params = new URLSearchParams(window.location.search)
    if (params.get('drive') === 'connected') {
      setMsg({ type: 'success', text: 'Google Drive conectado correctamente.' })
    } else if (params.get('error') === 'drive_failed') {
      setMsg({ type: 'error', text: 'No se pudo conectar Google Drive.' })
    }
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

  async function runContactMailSmoke(mode) {
    setSmokeRunning(mode)
    setMsg(null)
    try {
      const res = await apiFetch('/config/contact-mail-smoke', {
        method: 'POST',
        body: JSON.stringify({ mode, alias: contactAlias }),
      })
      setEmailDiag(prev => ({ ...(prev || {}), contactMail: res.contactMail || prev?.contactMail }))
      setMsg({
        type: 'success',
        text: `${mode === 'inbound' ? 'Smoke inbound' : 'Smoke outbound'} enviado para ${res.publicEmail} y ruteado a ${res.routedTo}.`,
      })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSmokeRunning('')
    }
  }

  async function connectGoogleDrive() {
    setDriveConnecting(true)
    setMsg(null)
    try {
      const res = await apiFetch('/config/google-drive/connect-url', { method: 'POST', body: JSON.stringify({}) })
      if (!res.url) throw new Error('No se pudo generar la URL de conexión')
      window.location.href = res.url
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
      setDriveConnecting(false)
    }
  }

  const catActiva = CATEGORIAS.find(c => c.secciones.some(s => s.key === sec))
  const secActiva = CATEGORIAS.flatMap(c => c.secciones).find(s => s.key === sec)

  if (loading) return <div className="layout"><Menu /><main className="main"><div className="empty"><p>Cargando...</p></div></main></div>
  if (loadError) return (
    <div className="layout"><Menu /><main className="main">
      <div className="empty">
        <div className="empty-icon"><Icons.Settings /></div>
        <p>{loadError}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    </main></div>
  )

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
        {/* ── PHONE: tabs horizontales scrollables ───────────────── */}
        {isPhone && (
          <nav style={{overflowX:'auto',display:'flex',gap:6,paddingBottom:8,marginBottom:8,scrollbarWidth:'none'}}>
            {CATEGORIAS.flatMap(cat => (cat.secciones||[]).map(s => {
              const b = badge(s.key, config)
              const active = sec === s.key
              return (
                <button key={s.key} onClick={() => { setSec(s.key); setMsg(null) }}
                  style={{flexShrink:0,padding:'8px 14px',border:'none',borderRadius:20,cursor:'pointer',fontSize:13,fontWeight:active?700:500,
                    background:active?'var(--primary)':'var(--bg-2)',color:active?'#fff':'var(--text)',whiteSpace:'nowrap',
                    position:'relative',transition:'background .15s'}}>
                  {s.label}
                  {b && <span style={{position:'absolute',top:4,right:6,width:6,height:6,borderRadius:'50%',background:b==='ok'?'#16A34A':'#F59E0B'}}/>}
                </button>
              )
            }))}
          </nav>
        )}

        <div className="settings-shell" style={{display:'grid',gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit,minmax(220px,1fr))',gap:16,alignItems:'start'}}>

          {/* ── TABLET / DESKTOP: sidebar ────────────────────────── */}
          {!isPhone && (
            <nav className="card settings-nav" style={{padding:6}}>
              {CATEGORIAS.map(cat => {
                const open = !collapsed[cat.key]
                return (
                  <div key={cat.key} style={{marginBottom:4}}>
                    <button onClick={() => setCollapsed(p=>({...p,[cat.key]:!p[cat.key]}))}
                      style={{width:'100%',padding:'7px 10px',border:'none',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:8,borderRadius:'var(--r)'}}>
                      <span style={{fontSize:13, display:'flex', alignItems:'center'}}>{typeof cat.icon === 'function' ? <cat.icon size={14} /> : cat.icon}</span>
                      <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'var(--text-muted)',flex:1,textAlign:'left'}}>{cat.label}</span>
                      <span style={{fontSize:10,color:'var(--text-faint)'}}>{open?'▾':'▸'}</span>
                    </button>
                    {open && (cat?.secciones || []).map(s => {
                      const b = badge(s.key, config)
                      const active = sec === s.key
                      return (
                        <button key={s.key} onClick={() => { setSec(s.key); setMsg(null) }}
                          style={{width:'100%',padding:'8px 10px 8px 28px',border:'none',borderRadius:'var(--r)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:9,marginBottom:1,background:active?'var(--primary)':'transparent',color:active?'var(--surface)':'var(--text)'}}>
                          <span style={{fontSize:13,flexShrink:0,display:'flex',alignItems:'center'}}>{typeof s.icon === 'function' ? <s.icon size={14} /> : s.icon}</span>
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
          )}

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
                      {[['0','Claro'],['1','Oscuro']].map(([val,lbl])=>(
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
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:20,borderRadius:'var(--r)',background:config.whatsapp_cloud_configurado?'#F0FDF4':'#FFFBEB',border:`1px solid ${config.whatsapp_cloud_configurado?'#86EFAC':'#FDE68A'}`}}>
                  <span style={{fontSize:20}}>{config.whatsapp_cloud_configurado?'OK':'Advertencia'}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:config.whatsapp_cloud_configurado?'var(--c-success)':'var(--c-warning)'}}>{config.whatsapp_cloud_configurado?'Meta Cloud API activa':'Sin configurar — modo demo / fallback'}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{config.whatsapp_cloud_configurado?'La iglesia ya puede enviar por WhatsApp oficial':'Los mensajes se registran; podés seguir con Twilio solo como legado temporal'}</div>
                  </div>
                  <a href="https://developers.facebook.com/docs/whatsapp" target="_blank" rel="noreferrer" style={{marginLeft:'auto',fontSize:12,color:'var(--primary)',fontWeight:600,whiteSpace:'nowrap'}}>Ir a Meta →</a>
                </div>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:18}}>
                  Recomendado para producción. Cada iglesia puede conectar su propio número y sus propios templates, dejando Twilio solo como compatibilidad de transición.
                </p>
                <div className="form-grid">
                  <div className="form-group full"><label>Provider</label><input name="wa_provider" className="form-input" value={form.wa_provider} onChange={e=>f('wa_provider',e.target.value)} placeholder="meta_cloud"/></div>
                  <div className="form-group full"><label>Phone Number ID</label><input name="wa_phone_number_id" className="form-input" value={form.wa_phone_number_id} onChange={e=>f('wa_phone_number_id',e.target.value)} placeholder="123456789012345"/></div>
                  <div className="form-group full"><label>WhatsApp Business Account ID</label><input name="wa_business_account_id" className="form-input" value={form.wa_business_account_id} onChange={e=>f('wa_business_account_id',e.target.value)} placeholder="987654321098765"/></div>
                  <div className="form-group full"><label>Access Token{config.whatsapp_cloud_configurado&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> — vacío = no cambiar</span>}</label><input name="wa_access_token" className="form-input" type="password" value={form.wa_access_token} onChange={e=>f('wa_access_token',e.target.value)} placeholder={config.whatsapp_cloud_configurado?'EAAG••••••••':'EAAG...'} /></div>
                  <div className="form-group"><label>Verify Token</label><input name="wa_verify_token" className="form-input" value={form.wa_verify_token} onChange={e=>f('wa_verify_token',e.target.value)} placeholder="churchsystem-whatsapp-verify"/></div>
                  <div className="form-group"><label>Estado</label><input name="wa_status" className="form-input" value={form.wa_status} onChange={e=>f('wa_status',e.target.value)} placeholder="connected"/></div>
                  <div className="form-group"><label>Display Phone Number</label><input name="wa_display_phone_number" className="form-input" value={form.wa_display_phone_number} onChange={e=>f('wa_display_phone_number',e.target.value)} placeholder="+54 9 11 0000 0000"/></div>
                  <div className="form-group"><label>Verified Name</label><input name="wa_verified_name" className="form-input" value={form.wa_verified_name} onChange={e=>f('wa_verified_name',e.target.value)} placeholder="Church System"/></div>
                </div>
                <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Webhook oficial</div>
                  <div style={{fontSize:13,color:'var(--text)',marginBottom:6}}><strong>GET / POST</strong> {publicOrigin}/whatsapp/webhook</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Si querés usar un verify token distinto por iglesia, cargalo acá y luego verificá el endpoint con esa conexión.</div>
                </div>
              </>}

              {/* GOOGLE DRIVE */}
              {sec==='drive' && <>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:20,borderRadius:'var(--r)',background:config.google_drive_configurado?'#F0FDF4':'#EFF6FF',border:`1px solid ${config.google_drive_configurado?'#86EFAC':'#BFDBFE'}`}}>
                  <span style={{fontSize:20}}>{config.google_drive_configurado ? 'OK' : 'Drive'}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:config.google_drive_configurado?'var(--c-success)':'var(--primary)'}}>
                      {config.google_drive_configurado ? 'Google Drive conectado' : 'Google Drive no conectado'}
                    </div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>
                      {config.google_drive_email || 'Conectá Drive para leer carpetas y archivos de ministerios.'}
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={connectGoogleDrive} disabled={driveConnecting} style={{marginLeft:'auto'}}>
                    {driveConnecting ? 'Conectando...' : config.google_drive_configurado ? 'Reconectar' : 'Conectar Drive'}
                  </button>
                </div>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Estado de conexión</label>
                    <input className="form-input" value={config.google_drive_status || 'disconnected'} readOnly />
                  </div>
                  <div className="form-group full">
                    <label>Correo conectado</label>
                    <input className="form-input" value={config.google_drive_email || ''} readOnly placeholder="Sin conectar todavía" />
                  </div>
                  <div className="form-group full">
                    <label>Última conexión</label>
                    <input className="form-input" value={config.google_drive_connected_at ? new Date(config.google_drive_connected_at).toLocaleString('es-AR') : ''} readOnly placeholder="Pendiente" />
                  </div>
                </div>
                <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Cómo se usa</p>
                  <ol style={{paddingLeft:16,fontSize:13,color:'var(--text-2)',lineHeight:1.9,margin:0}}>
                    <li>Conectá una sola vez la cuenta de Google Drive de la iglesia.</li>
                    <li>Luego, en cada ministerio, pegá la carpeta correspondiente.</li>
                    <li>La app leerá PDFs, Docs, Sheets y archivos comunes en solo lectura.</li>
                  </ol>
                </div>
                <div style={{marginTop:12,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Google Cloud Console</p>
                  <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7}}>
                    Agregá este redirect URI en tu cliente OAuth:
                    <div style={{marginTop:6,fontFamily:'monospace',fontSize:12,color:'var(--primary)',wordBreak:'break-all'}}>
                      {publicOrigin}/oauth/google/drive/callback
                    </div>
                  </div>
                </div>
              </>}

              {/* IA */}
              {sec==='ia' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Elegí un proveedor. <strong>Groq es gratuito</strong> y no necesita tarjeta de crédito.</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:24}}>
                  {[
                    {key:'groq',      icon:'Groq',name:'Groq',      sub:'Gratis · Llama 3.1',     url:'https://console.groq.com',       ok:config.groq_ok},
                    {key:'anthropic', icon:'',name:'Anthropic', sub:'Claude · Más preciso',    url:'https://console.anthropic.com',  ok:config.anthropic_ok},
                    {key:'openai',    icon:'',name:'OpenAI',    sub:'ChatGPT · Popular',       url:'https://platform.openai.com',    ok:config.openai_ok},
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
                  <span style={{fontSize:20}}>{config.email_configurado?'OK':'Advertencia'}</span>
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
                {emailDiag?.contactMail && (
                  <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                      <div>
                        <p style={{fontSize:11,fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>Aliases de contacto</p>
                        <div style={{fontSize:13,color:'var(--text)'}}>
                          Fallback seguro actual: <strong>{emailDiag.contactMail.adminFallbackEmail}</strong>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                        <select className="form-input" value={contactAlias} onChange={e => setContactAlias(e.target.value)} style={{minWidth:140}}>
                          {(emailDiag.contactMail.aliases || []).map(alias => (
                            <option key={alias.key} value={alias.key}>{alias.label}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => runContactMailSmoke('outbound')} disabled={!!smokeRunning}>
                          {smokeRunning === 'outbound' ? 'Enviando...' : 'Smoke outbound'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => runContactMailSmoke('inbound')} disabled={!!smokeRunning}>
                          {smokeRunning === 'inbound' ? 'Probando...' : 'Smoke inbound'}
                        </button>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8}}>
                      {(emailDiag.contactMail.aliases || []).map(alias => (
                        <div key={alias.key} style={{padding:'10px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)'}}>
                          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:4}}>{alias.label}</div>
                          <div style={{fontSize:12,fontWeight:700,color:'var(--text)',marginBottom:2}}>{alias.publicEmail}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5}}>
                            Destino: {alias.targetEmail}
                            <br />
                            {alias.usingFallback ? 'Fallback admin activo' : `Configurado via ${alias.resolvedFrom}`}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:10,lineHeight:1.6}}>
                      {emailDiag.contactMail.recommendedNextStep}
                    </div>
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
                    {k:'alerta_sin_asistir',     label:'Sin asistir',           unit:'cultos consecutivos',   min:1,max:10},
                    {k:'alerta_sin_seguimiento', label:'Sin seguimiento',         unit:'días sin contacto',     min:7,max:90},
                    {k:'alerta_visitante',       label:'Visitante sin consolidar',unit:'días desde el ingreso', min:7,max:60},
                    {k:'alerta_cumple',          label:'Cumpleaños',              unit:'días de anticipación',  min:1,max:14},
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
                  {['JWT con expiración configurable','Verificación de usuario activo en cada request','Rate limiting en login y API de IA','Sanitización de inputs en todos los endpoints','Aislamiento multi-tenant (datos por iglesia)','Helmet — headers HTTP de seguridad','CORS estricto — whitelist de orígenes','Auditoría de acciones en historial'].map((item,i)=>(
                    <div key={i} style={{display:'flex',gap:10,padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:13,alignItems:'center'}}>
                      <Icons.CheckCircle width={14} height={14} color="var(--c-success)" style={{flexShrink:0}} />{item}
                    </div>
                  ))}
                </div>
              </>}

              {/* BACKUP */}
              {sec==='backup' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Tus datos viven en PostgreSQL (Neon). Los respaldos automáticos se gestionan desde el panel de Neon o con <code>pg_dump</code>. Acá ves el resumen de tu información.</p>
                {backupInfo && (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:16}}>
                      {[['Motor','PostgreSQL'],['Estado','Activo (Neon)'],['Actualizado',backupInfo.modificado?.slice(0,10)||'—']].map(([l,v])=>(
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
                <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:14,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--r)'}}>
                  <span style={{fontSize:18,flexShrink:0}}></span>
                  <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.5}}>
                    Los respaldos de PostgreSQL se administran desde <strong>Neon</strong> (recuperación point-in-time automática). Para exportar manualmente usá <code>pg_dump</code> con tu <code>DATABASE_URL</code>.
                  </div>
                </div>
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
          {CONTACT_CHANNELS.map(item=>(
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
          <strong style={{color:'var(--c-warning)'}}>Advertencia Beta v{APP_VERSION}:</strong>{' '}
          Plataforma en etapa beta. Algunas funciones pueden cambiar o fallar.
          Para baja o exportación de datos:{' '}
          <a href={`mailto:${EMAILS.legal}`} style={{color:'var(--primary)'}}>{EMAILS.legal}</a>
        </div>
      </div>

      </main>
    </div>
  )
}
