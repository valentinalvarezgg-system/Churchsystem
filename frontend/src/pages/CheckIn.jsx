import { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useParams } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import CheckInFacial from '../components/CheckInFacial.jsx'
import { apiFetch } from '../services/api.js'

// ── Pantalla pública — lo que ve el miembro al escanear el QR ────────────────
export function CheckInPublico() {
  const { cultoId, token } = useParams()
  const [culto, setCulto]     = useState(null)
  const [step, setStep]       = useState('form') // form | loading | ok | error
  const [form, setForm]       = useState({ nombre:'', telefono:'' })
  const [resultado, setResult] = useState(null)
  const [err, setErr]         = useState(null)

  useEffect(() => {
    // En HTTPS (Cloudflare): mismo origen. En HTTP (red local): :4000
    const { protocol, hostname } = window.location
    const base = protocol === 'https:' ? '' : `http://${hostname}:4000`
    fetch(`${base}/checkin/info/${cultoId}/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setCulto(d) })
      .catch(() => setErr('Sin conexión con el servidor'))
  }, [cultoId, token])

  async function handleSubmit(e) {
    e.preventDefault()
    setStep('loading')
    try {
      // En HTTPS (Cloudflare): mismo origen. En HTTP (red local): :4000
    const { protocol, hostname } = window.location
    const base = protocol === 'https:' ? '' : `http://${hostname}:4000`
      const r = await fetch(`${base}/checkin/registrar/${cultoId}/${token}`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(form)
      }).then(r => r.json())
      if (r.error) { setErr(r.error); setStep('error') }
      else          { setResult(r); setStep('ok') }
    } catch {
      setErr('Error de conexión')
      setStep('error')
    }
  }

  const s = {
    page: { minHeight:'100vh', background:'linear-gradient(135deg,#0A0F1E,#0F1E3C)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'-apple-system,sans-serif' },
    card: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:16, padding:32, width:'100%', maxWidth:380, backdropFilter:'blur(20px)', boxShadow:'0 24px 64px rgba(0,0,0,0.4)' },
    label: { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, color:'rgba(255,255,255,0.35)', display:'block', marginBottom:5 },
    input: { width:'100%', padding:'12px 14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'var(--surface)', fontSize:15, outline:'none', boxSizing:'border-box' },
    btn: { width:'100%', padding:14, background:'linear-gradient(135deg,#2563EB,#7C3AED)', border:'none', borderRadius:8, color:'var(--surface)', fontSize:16, fontWeight:700, cursor:'pointer', marginTop:8 },
  }

  if (err) return (
    <div style={s.page}><div style={{...s.card, textAlign:'center'}}>
      <div style={{fontSize:48, marginBottom:12}}>⚠</div>
      <h2 style={{color:'var(--surface)', fontSize:18, marginBottom:8}}>QR inválido</h2>
      <p style={{color:'rgba(255,255,255,0.4)', fontSize:13}}>{err}</p>
    </div></div>
  )

  if (!culto) return (
    <div style={s.page}><div style={{...s.card, textAlign:'center'}}>
      <div style={{fontSize:40, marginBottom:12, animation:'pulse 1s infinite'}}><Icons.Dashboard /></div>
      <p style={{color:'rgba(255,255,255,0.4)'}}>Cargando...</p>
    </div></div>
  )

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{textAlign:'center', marginBottom:28}}>
          <div style={{fontSize:40, marginBottom:8}}><Icons.Dashboard /></div>
          <h1 style={{color:'var(--surface)', fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-.5}}>{culto.culto?.nombre}</h1>
          <p style={{color:'rgba(255,255,255,0.4)', fontSize:13}}>{culto.culto?.fecha} · {culto.totalPresentes} registrados</p>
        </div>

        {step === 'ok' ? (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:64, marginBottom:16}}><Icons.Attendance /></div>
            <h2 style={{color:'var(--surface)', fontSize:22, fontWeight:800, marginBottom:8}}>
              ¡Bienvenido, {resultado?.persona?.nombre?.split(' ')[0]}!
            </h2>
            <p style={{color:'rgba(255,255,255,0.5)', fontSize:14}}>Tu asistencia fue registrada.</p>
            <div style={{marginTop:20, padding:'10px 16px', background:'rgba(22,163,74,0.15)', borderRadius:8, border:'1px solid rgba(22,163,74,0.3)'}}>
              <p style={{color:'#86EFAC', fontSize:13, margin:0}}>
                {resultado?.persona?.estado === 'VISITANTE' ? 'Registrado como nuevo visitante' : '✓ Asistencia confirmada'}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:16}}>
            <div>
              <label style={s.label}>Tu nombre *</label>
              <input name="nombre" required style={s.input} value={form.nombre}
                onChange={e => setForm(f=>({...f, nombre:e.target.value}))}
                placeholder="Nombre y apellido" autoComplete="name" autoFocus/>
            </div>
            <div>
              <label style={s.label}>Teléfono (opcional)</label>
              <input name="telefono" style={s.input} value={form.telefono}
                onChange={e => setForm(f=>({...f, telefono:e.target.value}))}
                placeholder="11 1234-5678" type="tel" autoComplete="tel"/>
            </div>
            <button type="submit" style={{...s.btn, opacity: step==='loading'?.6:1}} disabled={step==='loading'}>
              {step === 'loading' ? 'Registrando...' : 'Registrar asistencia ✓'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Panel admin — genera QR ───────────────────────────────────────────────────
export default function CheckInAdmin() {
  const [cultos, setCultos]   = useState([])
  const [showFacial, setShowFacial] = useState(false)
  const [facialRegistros, setFacialRegistros] = useState([])
  const [qrData, setQrData]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    apiFetch('/cultos').then(c => setCultos(c||[])).catch(()=>{})
  }, [])

  async function generarQR(cultoId) {
    setLoading(true); setQrData(null); setCopied(false)
    try { setQrData(await apiFetch(`/checkin/token/${cultoId}`)) }
    catch(e) { alert(e.message) }
    setLoading(false)
  }

  function copiar() {
    navigator.clipboard.writeText(qrData.url)
    setCopied(true)
    setTimeout(()=>setCopied(false), 2500)
  }

  function imprimir() {
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>QR ${qrData.culto?.nombre}</title>
    <style>
      body { font-family:-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#fff; }
      h1 { font-size:28px; font-weight:800; margin:0 0 8px; color:#0F172A; }
      p  { color:#64748B; margin:4px 0; font-size:15px; }
      img { margin:24px 0; border:2px solid #E2E8F0; border-radius:8px; padding:8px; }
      .url { font-size:12px; color:#94A3B8; word-break:break-all; max-width:280px; text-align:center; }
      @media print { button { display:none } }
    </style></head><body>
    <h1><Icons.Dashboard /> ${qrData.culto?.nombre}</h1>
    <p><Icons.Attendance /> ${qrData.culto?.fecha}</p>
    <p style="font-size:14px;color:#2563EB;font-weight:600">Escaneá para registrar tu asistencia</p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData.url)}" width="300" height="300"/>
    <p class="url">${qrData.url}</p>
    <button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#2563EB;color:white;border:none;border-radius:6px;font-size:15px;cursor:pointer">🖨️ Imprimir</button>
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  const QR_SIZE = 220

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.CheckIn /> Check-in QR</h1>
            <p style={{fontSize:13, color:'var(--text-muted)', marginTop:3}}>
              Los miembros escanean el QR y se registran solos desde su celular
            </p>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, alignItems:'start'}}>

          {/* Lista de cultos */}
          <div className="card">
            <h3 style={{fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)', marginBottom:14}}>
              Seleccioná un culto
            </h3>
            {cultos.length === 0
              ? <div className="empty"><div className="empty-icon"><Icons.Attendance /></div><p>Sin cultos.<br/>Creá uno en Asistencia.</p></div>
              : cultos.map(c => (
                <div key={c.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:'1px solid var(--border)'}}>
                  <div>
                    <div style={{fontWeight:600, fontSize:13}}>{c.nombre}</div>
                    <div style={{fontSize:11, color:'var(--text-muted)'}}>{c.fecha} · {c.presentes||0} presentes</div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-primary btn-sm"
                      data-tip="Generar código QR para este culto"
                      onClick={() => generarQR(c.id)}
                      disabled={loading}>
                      {loading ? '…' : 'QR'}
                    </button>
                    <button className="btn btn-ghost btn-sm"
                      data-tip="Reconocimiento facial — registrar asistencia por cara"
                      onClick={() => { setQrData(null); generarQR(c.id).then(() => setShowFacial(true)) }}
                      disabled={loading}
                      style={{whiteSpace:'nowrap'}}>
                      🎭 Facial
                    </button>
                  </div>
                </div>
              ))
            }
          </div>

          {/* QR generado */}
          {qrData ? (
            <div className="card" style={{textAlign:'center'}}>
              <h3 style={{fontSize:15, fontWeight:800, marginBottom:4}}>{qrData.culto?.nombre}</h3>
              <p style={{fontSize:12, color:'var(--text-muted)', marginBottom:20}}>{qrData.culto?.fecha}</p>

              {/* QR image */}
              <div style={{
                display:'inline-block', background:'var(--surface)', padding:12,
                borderRadius:12, border:'1px solid var(--border)',
                boxShadow:'var(--shadow-md)', marginBottom:16
              }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(qrData.url)}&bgcolor=ffffff&color=0F172A&margin=2`}
                  alt="QR Check-in"
                  width={QR_SIZE} height={QR_SIZE}
                  style={{display:'block', borderRadius:4}}
                />
              </div>

              {/* Info de red */}
              <div style={{
                margin:'0 0 16px', padding:'10px 14px',
                background:'var(--primary-soft)', borderRadius:'var(--r)',
                border:'1px solid rgba(37,99,235,0.15)', textAlign:'left'
              }}>
                <p style={{fontSize:11, fontWeight:700, color:'var(--primary)', textTransform:'uppercase', letterSpacing:.4, marginBottom:4}}>
                  <Icons.CheckIn /> Acceso desde celular
                </p>
                <p style={{fontSize:12, color:'var(--text-2)', wordBreak:'break-all', fontFamily:'monospace'}}>
                  {qrData.url}
                </p>
                <p style={{fontSize:11, color:'var(--text-muted)', marginTop:4}}>
                  IP: {qrData.ip} — misma red WiFi
                </p>
              </div>

              {/* Botones */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                <button className="btn btn-primary btn-sm" onClick={copiar}
                  data-tip="Copiar link para compartir por WhatsApp">
                  {copied ? '✓ Copiado' : '≡ Copiar link'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={imprimir}
                  data-tip="Imprimir el QR en papel para el culto">
                  🖨️ Imprimir
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => window.open(qrData.url, '_blank')}
                  data-tip="Probar el QR en esta misma computadora">
                  🔗 Probar
                </button>
              </div>

              <p style={{fontSize:11, color:'var(--text-muted)', marginTop:14, lineHeight:1.6}}>
                Los miembros escanean el QR con la cámara del celular.<br/>
                Los que no están en la lista quedan registrados como visitantes.
              </p>
            </div>
          ) : (
            <div className="card" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:320, color:'var(--text-muted)'}}>
              <div style={{fontSize:64, marginBottom:16, opacity:.2}}><Icons.CheckIn /></div>
              <p style={{fontSize:14}}>Seleccioná un culto para generar el QR</p>
            </div>
          )}
        </div>

        {/* Registros por facial en esta sesión */}
        {facialRegistros.length > 0 && (
          <div className="card" style={{padding:'12px 16px',background:'var(--c-success-bg)',border:'1px solid rgba(22,163,74,0.2)'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--c-success)',marginBottom:8}}>
              🎭 Registrados por reconocimiento facial ({facialRegistros.length})
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {facialRegistros.map((r,i) => (
                <span key={i} style={{fontSize:12,background:'var(--surface)',padding:'3px 10px',borderRadius:20,border:'1px solid var(--border)'}}>{r.nombre}</span>
              ))}
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="card" style={{marginTop:16}}>
          <h3 style={{fontSize:13, fontWeight:700, marginBottom:14, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)'}}>
            ¿Cómo funciona?
          </h3>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12}}>
            {[
              ['1️⃣', 'Creá el culto', 'En la sección Asistencia'],
              ['2️⃣', 'Generá el QR', 'Aparece aquí en pantalla'],
              ['3️⃣', 'Mostralo en la entrada', 'Imprimilo o proyectalo'],
              ['4️⃣', 'Los miembros escanean', 'Con la cámara del celular — sin app'],
            ].map(([num, title, desc]) => (
              <div key={num} style={{textAlign:'center', padding:'14px 10px', background:'var(--bg)', borderRadius:'var(--r)', border:'1px solid var(--border)'}}>
                <div style={{fontSize:24, marginBottom:6}}>{num}</div>
                <div style={{fontSize:13, fontWeight:700, marginBottom:3}}>{title}</div>
                <div style={{fontSize:11, color:'var(--text-muted)'}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {showFacial && qrData && (
        <CheckInFacial
          cultoId={qrData.culto?.id}
          cultoNombre={qrData.culto?.nombre}
          onRegistrado={(info) => setFacialRegistros(prev => [...prev, info])}
          onCerrar={() => setShowFacial(false)}
        />
      )}
    </div>
  )
}
