import { useState, useEffect } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getUser } from '../services/api.js'

const PASOS = [
  { id: 'iglesia',      icon: '▦', titulo: 'Tu iglesia',          sub: 'Nombre, dirección y pastor' },
  { id: 'apariencia',  icon: '🎨', titulo: 'Apariencia',          sub: 'Color y logo (opcional)' },
  { id: 'integraciones',icon: '🔗', titulo: 'Integraciones',       sub: 'WhatsApp y email' },
  { id: 'listo',        icon: '🚀', titulo: '¡Todo listo!',        sub: 'Empezá a usar Church System' },
]

const COLORES = [
  { val:'#2563EB', label:'Azul' },
  { val:'#7C3AED', label:'Violeta' },
  { val:'#059669', label:'Verde' },
  { val:'#DC2626', label:'Rojo' },
  { val:'#D97706', label:'Ámbar' },
  { val:'#0891B2', label:'Celeste' },
  { val:'#DB2777', label:'Rosa' },
  { val:'#374151', label:'Gris' },
]

export default function SetupWizard({ onCompleto }) {
  const navigate  = useNavigate()
  const user      = getUser()
  const [paso, setPaso]     = useState(0)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({
    nombre_iglesia:  '',
    pastor_nombre:   user?.nombre || '',
    direccion:       '',
    telefono_iglesia:'',
    email_iglesia:   '',
    sitio_web:       '',
    color_primario:  '#2563EB',
    logo_url:        '',
  })

  // Aplicar color en tiempo real
  useEffect(() => {
    document.documentElement.style.setProperty('--primary', config.color_primario)
  }, [config.color_primario])

  const f = (k, v) => setConfig(p => ({ ...p, [k]: v }))

  async function guardarPaso() {
    setSaving(true)
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify(config) })
    } catch {}
    setSaving(false)
  }

  async function siguiente() {
    await guardarPaso()
    if (paso < PASOS.length - 1) setPaso(p => p + 1)
  }

  async function completar() {
    setSaving(true)
    try {
      await apiFetch('/config', {
        method: 'PUT',
        body: JSON.stringify({ ...config, setup_completado: '1' })
      })
      onCompleto?.()
      navigate('/')
    } catch {}
    setSaving(false)
  }

  const pasoActual = PASOS[paso]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'linear-gradient(135deg, #0A0E1A 0%, #0F1E3C 50%, #0A0E1A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: '-apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}><Icons.Dashboard /></div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Church System
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0' }}>
            Configuración inicial
          </p>
        </div>

        {/* Barra de progreso */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {PASOS.map((p, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: i <= paso
                  ? config.color_primario
                  : 'rgba(255,255,255,0.1)',
                transition: 'background 0.3s',
              }} />
              <div style={{
                fontSize: 10, marginTop: 5, textAlign: 'center',
                color: i === paso ? 'white' : 'rgba(255,255,255,0.3)',
                fontWeight: i === paso ? 700 : 400,
                transition: 'all 0.3s',
              }}>
                {p.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Card del paso */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, overflow: 'hidden',
          backdropFilter: 'blur(20px)',
        }}>
          {/* Header del paso */}
          <div style={{
            padding: '20px 28px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <h2 style={{ color: 'white', fontSize: 18, fontWeight: 800, margin: '0 0 3px' }}>
              {pasoActual.icon} {pasoActual.titulo}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
              {pasoActual.sub}
            </p>
          </div>

          {/* Contenido del paso */}
          <div style={{ padding: '24px 28px' }}>

            {/* ── PASO 1: Iglesia ─────────────────────────────── */}
            {paso === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Nombre de la iglesia *" required>
                  <input name="nombre_iglesia" style={inputStyle} autoFocus
                    placeholder="Ej: Iglesia Evangelica Vida Nueva"
                    value={config.nombre_iglesia}
                    onChange={e => f('nombre_iglesia', e.target.value)} />
                </Field>
                <Field label="Nombre del pastor">
                  <input name="pastor_nombre" style={inputStyle}
                    placeholder="Ej: Pastor Juan González"
                    value={config.pastor_nombre}
                    onChange={e => f('pastor_nombre', e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                  <Field label="Teléfono">
                    <input name="telefono_iglesia" style={inputStyle} type="tel"
                      placeholder="11 1234-5678"
                      value={config.telefono_iglesia}
                      onChange={e => f('telefono_iglesia', e.target.value)} />
                  </Field>
                  <Field label="Email de la iglesia">
                    <input name="email_iglesia" style={inputStyle} type="email"
                      placeholder="contacto@iglesia.com"
                      value={config.email_iglesia}
                      onChange={e => f('email_iglesia', e.target.value)} />
                  </Field>
                </div>
                <Field label="Dirección">
                  <input name="direccion" style={inputStyle}
                    placeholder="Calle y número, ciudad"
                    value={config.direccion}
                    onChange={e => f('direccion', e.target.value)} />
                </Field>
              </div>
            )}

            {/* ── PASO 2: Apariencia ──────────────────────────── */}
            {paso === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Field label="Color principal">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {COLORES.map(c => (
                      <button key={c.val}
                        onClick={() => f('color_primario', c.val)}
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: c.val, border: 'none', cursor: 'pointer',
                          outline: config.color_primario === c.val
                            ? `3px solid white`
                            : '3px solid transparent',
                          outlineOffset: 2,
                          transition: 'outline 0.15s, transform 0.15s',
                          transform: config.color_primario === c.val ? 'scale(1.15)' : 'scale(1)',
                        }} title={c.label} />
                    ))}
                    <input type="color" value={config.color_primario}
                      onChange={e => f('color_primario', e.target.value)}
                      style={{ width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }}
                      title="Color personalizado" />
                  </div>
                  <div style={{ marginTop: 10, padding: '10px 16px', borderRadius: 10, background: config.color_primario, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}><Icons.Dashboard /></span>
                    <div>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>
                        {config.nombre_iglesia || 'Tu iglesia'}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                        Vista previa del color
                      </div>
                    </div>
                  </div>
                </Field>
                <Field label="URL del logo (opcional)">
                  <input name="logo_url" style={inputStyle}
                    placeholder="https://tu-iglesia.com/logo.png"
                    value={config.logo_url}
                    onChange={e => f('logo_url', e.target.value)} />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '6px 0 0' }}>
                    Podés agregar el logo después desde Configuración
                  </p>
                </Field>
                <Field label="Sitio web (opcional)">
                  <input name="sitio_web" style={inputStyle}
                    placeholder="https://www.tu-iglesia.com"
                    value={config.sitio_web}
                    onChange={e => f('sitio_web', e.target.value)} />
                </Field>
              </div>
            )}

            {/* ── PASO 3: Integraciones ───────────────────────── */}
            {paso === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(22,163,74,0.12)',
                  border: '1px solid rgba(22,163,74,0.2)',
                }}>
                  <div style={{ color: '#4ADE80', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
                    <Icons.Attendance /> Email con Resend configurado
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    Los emails salen desde noreply@churchsystem.com.ar
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(22,163,74,0.12)',
                  border: '1px solid rgba(22,163,74,0.2)',
                }}>
                  <div style={{ color: '#4ADE80', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
                    <Icons.Attendance /> WhatsApp con Twilio configurado
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    Mensajes individuales y masivos activos
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(37,99,235,0.12)',
                  border: '1px solid rgba(37,99,235,0.2)',
                }}>
                  <div style={{ color: '#60A5FA', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
                    <Icons.AI /> IA pastoral con Groq activa
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    Asistente inteligente con datos de tu congregación
                  </div>
                </div>

                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, lineHeight: 1.6, margin: '4px 0 0' }}>
                  Podés cambiar estas integraciones en cualquier momento desde Configuración → Integraciones
                </p>
              </div>
            )}

            {/* ── PASO 4: Listo ───────────────────────────────── */}
            {paso === 3 && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}><Icons.Premium /></div>
                <h3 style={{ color: 'white', fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
                  ¡{config.nombre_iglesia || 'Bienvenido'} está listo!
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, margin: '0 0 20px' }}>
                  Church System está configurado para tu iglesia.<br />
                  Podés empezar cargando personas, grupos y cultos.
                </p>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, textAlign: 'left',
                  marginBottom: 8,
                }}>
                  {[
                    ['⊕', 'Agregar personas', '/personas'],
                    ['⊞', 'Crear grupos', '/grupos'],
                    ['✓', 'Registrar un culto', '/asistencia'],
                    ['⊙', 'Más configuración', '/configuracion'],
                  ].map(([icon, label, path]) => (
                    <button key={path}
                      onClick={() => { onCompleto?.(); navigate(path) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'white', fontSize: 13, cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                      <span style={{ fontSize: 18 }}>{icon}</span> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer con botones */}
          <div style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, alignItems: 'center',
          }}>
            <button onClick={() => setPaso(p => Math.max(0, p - 1))}
              disabled={paso === 0}
              style={{
                padding: '10px 20px', borderRadius: 10, cursor: paso === 0 ? 'default' : 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: paso === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                fontSize: 14,
              }}>
              ← Atrás
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {paso < PASOS.length - 1 && paso !== 2 && (
                <button onClick={() => setPaso(p => p + 1)}
                  style={{
                    padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.5)', fontSize: 13,
                  }}>
                  Saltar
                </button>
              )}

              {paso < PASOS.length - 1 ? (
                <button onClick={siguiente} disabled={saving || (paso === 0 && !config.nombre_iglesia.trim())}
                  style={{
                    padding: '10px 24px', borderRadius: 10, cursor: 'pointer',
                    background: config.color_primario, border: 'none',
                    color: 'white', fontSize: 14, fontWeight: 700,
                    opacity: saving || (paso === 0 && !config.nombre_iglesia.trim()) ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}>
                  {saving ? 'Guardando...' : 'Siguiente →'}
                </button>
              ) : (
                <button onClick={completar} disabled={saving}
                  style={{
                    padding: '12px 28px', borderRadius: 10, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${config.color_primario}, #7C3AED)`,
                    border: 'none', color: 'white', fontSize: 15, fontWeight: 800,
                    opacity: saving ? 0.6 : 1,
                  }}>
                  {saving ? 'Guardando...' : '🚀 Empezar'}
                </button>
              )}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 16 }}>
          Podés cambiar todo esto después en Configuración
        </p>
      </div>
    </div>
  )
}

// Helpers
const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  color: 'white', fontSize: 15, outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

function Field({ label, children, required }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.5,
        color: 'rgba(255,255,255,0.4)', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}
