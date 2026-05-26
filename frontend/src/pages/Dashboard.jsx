import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'
import { useOrientation } from '../hooks/useOrientation.js'

// Mini barra de progreso inline
function Bar({ pct, color = 'var(--primary)' }) {
  return (
    <div style={{ height: 5, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .5s ease' }} />
    </div>
  )
}

// Avatar con iniciales
function Avatar({ nombre = '', apellido = '', size = 34 }) {
  const initials = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase()
  const hue = ((nombre.charCodeAt(0) || 0) * 7 + (apellido.charCodeAt(0) || 0) * 13) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: `hsl(${hue},55%,52%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 800, color: 'var(--surface)', letterSpacing: '-0.5px',
    }}>{initials || '?'}</div>
  )
}

export default function Dashboard() {
  const navigate   = useNavigate()
  const user       = getUser()
  const ori = useOrientation()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/stats')
      .then(s => { setStats(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const hora    = new Date().getHours()
  const saludo  = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const hoyStr  = new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })

  if (loading) return (
    <div className="layout"><Menu />
      <main className="main">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginTop:32 }}>
          {Array(6).fill(0).map((_,i) => (
            <div key={i} style={{ height:88, borderRadius:12, background:'var(--bg-2)', animation:'pulse 1.5s ease-in-out infinite', animationDelay:`${i*0.1}s` }} />
          ))}
        </div>
      </main>
    </div>
  )

  const t   = stats?.totales ?? {}
  const pct = t.pctAsistencia || 0
  const pctColor = pct >= 70 ? 'var(--c-success)' : pct >= 45 ? 'var(--c-warning)' : 'var(--c-danger)'

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* ── Bienvenida ─────────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:23, fontWeight:800, letterSpacing:'-0.6px', margin:'0 0 3px' }}>
              {saludo}, {user?.nombre?.split(' ')[0] || 'Pastor'} 👋
            </h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:0, textTransform:'capitalize' }}>{hoyStr}</p>
          </div>
          {t.nuevosMes > 0 && (
            <div onClick={() => navigate('/personas')} style={{
              padding:'8px 14px', borderRadius:8, cursor:'pointer',
              background:'var(--c-success-bg)', border:'1px solid rgba(22,163,74,0.2)',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <span style={{ fontSize:18 }}>🌱</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--c-success)' }}>+{t.nuevosMes} este mes</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>nuevas personas</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Stats principales ──────────────────────────────────── */}
        <div className="stats-grid" style={{ gridTemplateColumns:`repeat(${ori.colsStats},1fr)`, gap: ori.isPhone ? 8 : 12 }} style={{ marginBottom:20 }}>
          {[
            { val: t.personas || 0,    lbl: 'Total',        icon:'👥', color:'var(--primary)',   path:'/personas' },
            { val: t.activos  || 0,    lbl: 'Activos',      icon:'✅', color:'var(--c-success)', path:'/personas' },
            { val: t.visitantes|| 0,   lbl: 'Visitantes',   icon:'👋', color:'var(--c-warning)', path:'/personas' },
            { val: t.grupos   || 0,    lbl: 'Grupos',       icon:'🧩', color:'var(--c-info)',    path:'/grupos' },
            { val: t.cultos   || 0,    lbl: 'Cultos reg.',  icon:'📅', color:'var(--c-purple)',  path:'/asistencia' },
            { val: pct+'%',            lbl: 'Asistencia',   icon:'📊', color: pctColor,          path:'/asistencia' },
          ].map(s => (
            <div key={s.lbl} className="stat-card" onClick={() => navigate(s.path)}>
              <div style={{ fontSize:18, marginBottom:6 }}>{s.icon}</div>
              <div className="stat-val" style={{ color: s.color, fontSize:26 }}>{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* ── Alertas urgentes ────────────────────────────────────── */}
        {(t.seguimientosVencidos > 0 || t.visitantesSinConsolidar > 0) && (
          <div onClick={() => navigate('/alertas')} style={{
            display:'flex', alignItems:'center', gap:12, padding:'11px 16px',
            borderRadius:10, marginBottom:20, cursor:'pointer',
            background:'var(--c-danger-bg)', border:'1px solid rgba(220,38,38,0.18)',
            transition:'opacity .15s',
          }}>
            <span style={{ fontSize:20 }}>🚨</span>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--c-danger)' }}>
                {[
                  t.seguimientosVencidos   > 0 && `${t.seguimientosVencidos} seguimientos vencidos`,
                  t.visitantesSinConsolidar> 0 && `${t.visitantesSinConsolidar} visitantes sin consolidar`,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
            <span style={{ fontSize:12, color:'var(--c-danger)', fontWeight:600 }}>Ver alertas →</span>
          </div>
        )}

        {/* ── Grid principal ───────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${ori.cols2},1fr)`, gap: ori.isPhone ? 10 : 16, marginBottom:16 }}>

          {/* Últimos cultos */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:700, margin:0 }}>📅 Últimos cultos</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => navigate('/asistencia')}>Ver todos →</button>
            </div>
            {(stats?.asistenciaReciente || []).length === 0
              ? <div className="empty" style={{ padding:'20px 0' }}><p>Sin cultos aún.<br/>Creá el primero en Asistencia.</p></div>
              : (stats?.asistenciaReciente || []).slice(0, 5).map((c, i) => {
                  const p = c.total > 0 ? Math.round(c.presentes / c.total * 100) : 0
                  const col = p >= 70 ? 'var(--c-success)' : p >= 45 ? 'var(--c-warning)' : 'var(--c-danger)'
                  return (
                    <div key={i} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                        <span style={{ fontWeight:600, color:'var(--text)' }}>{c.nombre}</span>
                        <span style={{ color:col, fontWeight:700 }}>{c.presentes}/{c.total} · {p}%</span>
                      </div>
                      <Bar pct={p} color={col} />
                    </div>
                  )
                })
            }
          </div>

          {/* Próximos seguimientos */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:700, margin:0 }}>📋 Seguimientos</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => navigate('/alertas')}>Ver todos →</button>
            </div>
            {(stats?.proximosContactos || []).length === 0
              ? <div className="empty" style={{ padding:'20px 0' }}>
                  <div className="empty-icon" style={{ fontSize:24 }}>✅</div>
                  <p>Sin seguimientos pendientes</p>
                </div>
              : (stats?.proximosContactos || []).slice(0, 6).map((s, i) => {
                  const dias    = Math.round((new Date(s.proximoContacto) - new Date()) / 86400000)
                  const urgente = dias <= 0
                  const pronto  = dias > 0 && dias <= 3
                  const col     = urgente ? 'var(--c-danger)' : pronto ? 'var(--c-warning)' : 'var(--text-muted)'
                  const bg      = urgente ? 'var(--c-danger-bg)' : pronto ? 'var(--c-warning-bg)' : 'var(--bg)'
                  return (
                    <div key={i}
                      style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                      onClick={() => navigate(`/personas/${s.personaId}`)}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar nombre={s.nombre} apellido={s.apellido} size={28} />
                        <div>
                          <div style={{ fontSize:12, fontWeight:600 }}>{s.nombre} {s.apellido}</div>
                          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.tipo}</div>
                        </div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:bg, color:col, whiteSpace:'nowrap' }}>
                        {urgente ? '¡Vencido!' : dias === 0 ? 'Hoy' : `${dias}d`}
                      </span>
                    </div>
                  )
                })
            }
          </div>

          {/* Cumpleaños */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:700, margin:0 }}>🎂 Cumpleaños</h3>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>próximos 30 días</span>
            </div>
            {(stats?.cumpleanos || []).length === 0
              ? <div className="empty" style={{ padding:'20px 0' }}><p>Sin cumpleaños próximos</p></div>
              : (stats?.cumpleanos || []).slice(0, 5).map((p, i) => {
                  const [m, d] = (p.cumDia || '').split('-').map(Number)
                  const f = new Date(new Date().getFullYear(), m - 1, d)
                  if (f < new Date()) f.setFullYear(f.getFullYear() + 1)
                  const dias = Math.round((f - new Date()) / 86400000)
                  return (
                    <div key={i}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                      onClick={() => navigate(`/personas/${p.id}`)}>
                      <Avatar nombre={p.nombre} apellido={p.apellido} size={32} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{p.nombre} {p.apellido}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                          {new Date(p.fechaNacimiento+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'long'})}
                        </div>
                      </div>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap',
                        background: dias === 0 ? 'var(--c-success-bg)' : 'var(--bg)',
                        color: dias === 0 ? 'var(--c-success)' : 'var(--text-muted)',
                      }}>
                        {dias === 0 ? '🎉 Hoy!' : `en ${dias}d`}
                      </span>
                    </div>
                  )
                })
            }
          </div>

          {/* Acceso rápido */}
          <div className="card">
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>⚡ Acceso rápido</h3>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${ori.isPhone && ori.portrait ? 2 : ori.cols4},1fr)`, gap: ori.isPhone ? 7 : 7 }}>
              {[
                { icon:'👤', label:'Nueva persona',   path:'/personas',     color:'#2563EB' },
                { icon:'📅', label:'Registrar culto',  path:'/asistencia',   color:'#16A34A' },
                { icon:'📱', label:'Check-in QR',      path:'/checkin',      color:'#0891B2' },
                { icon:'💬', label:'Enviar mensaje',   path:'/mensajes',     color:'#D97706' },
                { icon:'🤖', label:'Asistente IA',     path:'/asistente-ia', color:'#7C3AED' },
                { icon:'🔔', label:'Ver alertas',      path:'/alertas',      color:'#DC2626' },
                { icon:'💰', label:'Finanzas',         path:'/finanzas',     color:'#0D9488' },
                { icon:'📊', label:'Reportes',         path:'/reportes',     color:'#9333EA' },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  style={{
                    display:'flex', alignItems:'center', gap:8,
                    padding:'9px 11px', borderRadius:8, cursor:'pointer',
                    background:'var(--bg)', border:'1px solid var(--border)',
                    fontSize:12, fontWeight:600, color:'var(--text-2)',
                    transition:'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.color = a.color }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}>
                  <span style={{ fontSize:15 }}>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Fila inferior ─────────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${ori.cols2},1fr)`, gap: ori.isPhone ? 10 : 16, marginBottom:16 }}>

          {/* Crecimiento mensual (barras) */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:700, margin:0 }}>📈 Crecimiento mensual</h3>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>últimos 12 meses</span>
            </div>
            {(stats?.crecimientoMensual || []).length === 0
              ? <div className="empty" style={{ padding:'16px 0' }}><p>Sin datos de crecimiento aún</p></div>
              : (() => {
                  const data = (stats?.crecimientoMensual || []).slice(-12)
                  const max  = Math.max(...data.map(m => m.nuevos || 0), 1)
                  return (
                    <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:80 }}>
                      {data.map((m, i) => {
                        const h  = Math.max(Math.round((m.nuevos || 0) / max * 100), 4)
                        const esUltimo = i === data.length - 1
                        return (
                          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                            {(m.nuevos || 0) > 0 && (
                              <span style={{ fontSize:9, color: esUltimo ? 'var(--primary)' : 'var(--text-faint)', fontWeight:700 }}>
                                {m.nuevos}
                              </span>
                            )}
                            <div style={{
                              width:'100%', height:`${h}%`, minHeight:4,
                              background: esUltimo ? 'var(--primary)' : 'var(--primary-soft)',
                              borderRadius:'3px 3px 0 0',
                              transition:'height .4s ease',
                            }} />
                            <span style={{ fontSize:9, color:'var(--text-faint)', writingMode:'initial' }}>
                              {(m.mes || '').slice(5)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
            }
          </div>

          {/* Panel de estado */}
          <div className="card">
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>💡 Estado</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { lbl:'Consolidación', val: t.consolidacionActiva || 0, icon:'🤝', path:'/consolidacion', warn: t.consolidacionActiva > 0 },
                { lbl:'Oración activa', val: t.oracionesActivas  || 0, icon:'🙏', path:'/oracion',       ok:   t.oracionesActivas > 0 },
                { lbl:'Sin seguimiento',val: t.sinSeguimiento    || 0, icon:'📋', path:'/alertas',       danger: t.sinSeguimiento > 0 },
              ].map(s => (
                <div key={s.lbl} onClick={() => navigate(s.path)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:8, cursor:'pointer', background:'var(--bg)', border:'1px solid var(--border)', transition:'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ fontSize:14 }}>{s.icon}</span>
                    <span style={{ fontSize:12, fontWeight:500, color:'var(--text-2)' }}>{s.lbl}</span>
                  </div>
                  <span style={{
                    fontSize:13, fontWeight:800,
                    color: s.danger && s.val > 0 ? 'var(--c-danger)' : s.ok && s.val > 0 ? 'var(--c-success)' : s.warn && s.val > 0 ? 'var(--c-warning)' : 'var(--text-muted)',
                  }}>{s.val}</span>
                </div>
              ))}

              {/* Finanzas del mes */}
              {(stats?.finanzasMes || []).length > 0 && (
                <div onClick={() => navigate('/finanzas')}
                  style={{ marginTop:4, padding:'8px 10px', borderRadius:8, cursor:'pointer', background:'var(--c-success-bg)', border:'1px solid rgba(22,163,74,0.15)', transition:'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.4, color:'var(--c-success)', marginBottom:2 }}>💰 Ofrendas del mes</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'var(--c-success)' }}>
                    ${(t.totalOfrendasMes || 0).toLocaleString('es-AR')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Actividad reciente ─────────────────────────────────────── */}
        {(stats?.actividadReciente || []).length > 0 && (
          <div className="card">
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🕓 Actividad reciente</h3>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${ori.cols2},1fr)`, gap:0 }}>
              {(stats?.actividadReciente || []).slice(0, 8).map((a, i) => {
                const iconMap = { CREAR:'➕', ACTUALIZAR:'✏️', ELIMINAR:'🗑️', MENSAJE:'💬', MASIVO:'📢', IMPORTAR_EXCEL:'📊', BACKUP:'💾', LOGIN:'🔐' }
                const ico = iconMap[a.accion] || '📝'
                const time = a.createdAt ? new Date(a.createdAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}) : ''
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom: i < 6 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize:13, flexShrink:0 }}>{ico}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {a.detalle || `${a.accion} ${a.entidad}`}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{a.usuario} · {time}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
