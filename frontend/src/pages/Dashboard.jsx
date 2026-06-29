import { useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getStoredContext, getUser } from '../services/api.js'
import { useDevice } from '../hooks/useDevice.js'
import { useRealtimeQuery } from '../hooks/useRealtimeQuery.js'

const DASH_I18N = {
  es: {
    locale:'es-AR', morning:'Buenos días', afternoon:'Buenas tardes', night:'Buenas noches', pastor:'Pastor',
    newThisMonth:'este mes', newPeople:'nuevas personas',
    total:'Total', active:'Activos', visitors:'Visitantes', groups:'Grupos', services:'Cultos reg.', attendance:'Asistencia',
    overdueFollowUps:'seguimientos vencidos', unconsolidatedVisitors:'visitantes sin consolidar', viewAlerts:'Ver alertas →',
    recentServices:'Últimos cultos', seeAll:'Ver todos →', noServices:'Sin cultos aún.', createFirstService:'Creá el primero en Asistencia.',
    followUps:'Seguimientos', noFollowUps:'Sin seguimientos pendientes', overdue:'¡Vencido!', today:'Hoy',
    birthdays:'Cumpleaños', next30:'próximos 30 días', noBirthdays:'Sin cumpleaños próximos', inDays:'en {days}d', todayBang:'Hoy!',
    quick:'Acceso rápido', growth:'Crecimiento mensual', last12:'últimos 12 meses', noGrowth:'Sin datos de crecimiento aún',
    status:'Estado', consolidation:'Consolidación', activePrayer:'Oración activa', noTracking:'Sin seguimiento',
    recentActivity:'Actividad reciente',
    actions:[
      ['Nueva persona', 'Registrar miembro o visitante'],
      ['Registrar culto', 'Tomar asistencia del servicio'],
      ['Check-in QR', 'Generar código QR para entrada'],
      ['Enviar mensaje', 'Contactar persona o grupo'],
      ['Asistente IA', 'Consultar datos con inteligencia artificial'],
      ['Ver alertas', 'Seguimientos y avisos pendientes'],
      ['Reportes', 'Estadísticas y métricas de la iglesia'],
    ],
  },
  pt: {
    locale:'pt-BR', morning:'Bom dia', afternoon:'Boa tarde', night:'Boa noite', pastor:'Pastor',
    newThisMonth:'este mês', newPeople:'novas pessoas',
    total:'Total', active:'Ativos', visitors:'Visitantes', groups:'Grupos', services:'Cultos reg.', attendance:'Presença',
    overdueFollowUps:'acompanhamentos vencidos', unconsolidatedVisitors:'visitantes sem consolidação', viewAlerts:'Ver alertas →',
    recentServices:'Últimos cultos', seeAll:'Ver todos →', noServices:'Sem cultos ainda.', createFirstService:'Crie o primeiro em Presença.',
    followUps:'Acompanhamentos', noFollowUps:'Sem acompanhamentos pendentes', overdue:'Vencido!', today:'Hoje',
    birthdays:'Aniversários', next30:'próximos 30 dias', noBirthdays:'Sem aniversários próximos', inDays:'em {days}d', todayBang:'Hoje!',
    quick:'Acesso rápido', growth:'Crescimento mensal', last12:'últimos 12 meses', noGrowth:'Sem dados de crescimento ainda',
    status:'Estado', consolidation:'Consolidação', activePrayer:'Oração ativa', noTracking:'Sem acompanhamento',
    recentActivity:'Atividade recente',
    actions:[
      ['Nova pessoa', 'Registrar membro ou visitante'],
      ['Registrar culto', 'Registrar presença do culto'],
      ['Check-in QR', 'Gerar código QR para entrada'],
      ['Enviar mensagem', 'Contatar pessoa ou grupo'],
      ['Assistente IA', 'Consultar dados com inteligência artificial'],
      ['Ver alertas', 'Acompanhamentos e avisos pendentes'],
      ['Relatórios', 'Estatísticas e métricas da igreja'],
    ],
  },
  en: {
    locale:'en-US', morning:'Good morning', afternoon:'Good afternoon', night:'Good evening', pastor:'Pastor',
    newThisMonth:'this month', newPeople:'new people',
    total:'Total', active:'Active', visitors:'Visitors', groups:'Groups', services:'Services', attendance:'Attendance',
    overdueFollowUps:'overdue follow-ups', unconsolidatedVisitors:'visitors not consolidated', viewAlerts:'View alerts →',
    recentServices:'Recent services', seeAll:'See all →', noServices:'No services yet.', createFirstService:'Create the first one in Attendance.',
    followUps:'Follow-ups', noFollowUps:'No pending follow-ups', overdue:'Overdue!', today:'Today',
    birthdays:'Birthdays', next30:'next 30 days', noBirthdays:'No upcoming birthdays', inDays:'in {days}d', todayBang:'Today!',
    quick:'Quick access', growth:'Monthly growth', last12:'last 12 months', noGrowth:'No growth data yet',
    status:'Status', consolidation:'Consolidation', activePrayer:'Active prayer', noTracking:'No follow-up',
    recentActivity:'Recent activity',
    actions:[
      ['New person', 'Register member or visitor'],
      ['Register service', 'Take service attendance'],
      ['QR check-in', 'Generate entry QR code'],
      ['Send message', 'Contact person or group'],
      ['AI assistant', 'Ask questions about church data'],
      ['View alerts', 'Pending follow-ups and notices'],
      ['Reports', 'Church statistics and metrics'],
    ],
  },
}

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

function OnboardingChecklist({ navigate, prog, billingEstado }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!billingEstado?.enTrial) return null
  if (!prog) return null

  const steps = [
    { key: 'personas',    label: 'Registrá tu primera persona',   done: prog.personas > 0,    path: '/personas' },
    { key: 'grupos',      label: 'Creá un grupo o célula',        done: prog.grupos > 0,      path: '/grupos' },
    { key: 'cultos',      label: 'Registrá un culto',             done: prog.cultos > 0,      path: '/asistencia' },
    { key: 'comunicados', label: 'Enviá un comunicado',           done: prog.comunicados > 0, path: '/comunicados' },
    { key: 'users',       label: 'Invitá a un líder o colaborador', done: prog.users > 1,    path: '/users' },
  ]
  const done = steps.filter(s => s.done).length
  if (done === steps.length) return null

  return (
    <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(99,102,241,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icons.CheckCircle size={16} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Primeros pasos — {done}/{steps.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {billingEstado.diasTrial} días de trial restantes
            </div>
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          onClick={() => setCollapsed(c => !c)} aria-label="Colapsar">
          <Icons.ChevronDown size={16} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
        </button>
      </div>
      {!collapsed && (
        <>
          <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ width: `${(done / steps.length) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 2, transition: 'width .4s ease' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map(s => (
              <div key={s.key} onClick={() => !s.done && navigate(s.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  background: s.done ? 'var(--c-success-bg)' : 'var(--bg)',
                  border: `1px solid ${s.done ? 'rgba(22,163,74,0.15)' : 'var(--border)'}`,
                  cursor: s.done ? 'default' : 'pointer',
                  transition: 'background .15s',
                }}>
                {s.done
                  ? <Icons.CheckCircle size={16} color="var(--c-success)" />
                  : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', flexShrink: 0 }} />
                }
                <span style={{ fontSize: 13, color: s.done ? 'var(--c-success)' : 'var(--text)', textDecoration: s.done ? 'line-through' : 'none', flex: 1 }}>
                  {s.label}
                </span>
                {!s.done && <Icons.ChevronRight size={14} color="var(--text-muted)" />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate   = useNavigate()
  const user       = getUser()
  const ori = useDevice()
  const { data: overview, loading, error } = useRealtimeQuery('stats-overview', () => apiFetch('/stats/overview'), [], { intervalMs: 10000 })
  const lang = (localStorage.getItem('church_lang') || user?.idioma || getStoredContext().lang || 'es').slice(0, 2)
  const copy = DASH_I18N[lang] || DASH_I18N.es
  const txt = key => copy[key] || DASH_I18N.es[key] || key

  const hora    = new Date().getHours()
  const saludo  = hora < 12 ? txt('morning') : hora < 19 ? txt('afternoon') : txt('night')
  const hoyStr  = new Date().toLocaleDateString(txt('locale'), { weekday:'long', day:'numeric', month:'long' })

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

  if (error) return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="empty">
          <div className="empty-icon"><Icons.Dashboard /></div>
          <p>No se pudo cargar el dashboard.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      </main>
    </div>
  )

  const t   = overview?.totales ?? {}
  const pct = t.pctAsistencia || 0
  const pctColor = pct >= 70 ? 'var(--c-success)' : pct >= 45 ? 'var(--c-warning)' : 'var(--c-danger)'

  return (
    <div className="layout"><Menu />
      <main className="main">

        {/* ── Bienvenida ─────────────────────────────────────────── */}
        <div className="dashboard-welcome" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:23, fontWeight:800, letterSpacing:'-0.6px', margin:'0 0 3px', display:'flex', alignItems:'center', gap:8 }}>
              {saludo}, {user?.nombre?.split(' ')[0] || txt('pastor')}
              <Icons.Users size={20} color='var(--text-muted)' />
            </h1>
            <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>{hoyStr.charAt(0).toUpperCase() + hoyStr.slice(1)}</p>
          </div>
          {t.nuevosMes > 0 && (
            <div onClick={() => navigate('/personas')} style={{
              padding:'8px 14px', borderRadius:8, cursor:'pointer',
              background:'var(--c-success-bg)', border:'1px solid rgba(22,163,74,0.2)',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <Icons.TrendingUp size={18} color='var(--c-success)' />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--c-success)' }}>+{t.nuevosMes} {txt('newThisMonth')}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{txt('newPeople')}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Onboarding checklist (trial) ─────────────────────────── */}
        <OnboardingChecklist navigate={navigate} prog={overview?.onboarding || null} billingEstado={overview?.billing || null} />

        {/* ── Stats principales ──────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${ori.colsStats},1fr)`, gap: ori.isPhone ? 8 : 12, marginBottom: 20 }}>
          {[
            { val: t.personas || 0,  lbl: txt('total'),      Ic: Icons.Users,       color:'#6366F1', path:'/personas' },
            { val: t.activos  || 0,  lbl: txt('active'),     Ic: Icons.CheckCircle, color:'#16A34A', path:'/personas' },
            { val: t.visitantes||0,  lbl: txt('visitors'),   Ic: Icons.UserPlus,    color:'#D97706', path:'/personas' },
            { val: t.grupos   || 0,  lbl: txt('groups'),     Ic: Icons.Groups,      color:'#0891B2', path:'/grupos' },
            { val: t.cultos   || 0,  lbl: txt('services'),   Ic: Icons.Attendance,  color:'#7C3AED', path:'/asistencia' },
            { val: pct+'%',          lbl: txt('attendance'), Ic: Icons.Reports,     color: pctColor, path:'/asistencia' },
          ].map(s => (
            <div key={s.lbl} onClick={() => navigate(s.path)}
              style={{
                background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:14, padding: ori.isPhone ? '14px 10px' : '18px 16px',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:6, cursor:'pointer', transition:'box-shadow .15s, transform .15s', textAlign:'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow=`0 0 0 2px ${s.color}40`; e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform='' }}>
              <div style={{
                width:38, height:38, borderRadius:10,
                background:`${s.color}18`,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <s.Ic size={18} color={s.color} />
              </div>
              <div style={{ fontSize: ori.isPhone ? 22 : 26, fontWeight:800, color:s.color, lineHeight:1, letterSpacing:'-1px' }}>{s.val}</div>
              <div style={{ fontSize:11, fontWeight:500, color:'var(--text-muted)', lineHeight:1.2 }}>{s.lbl}</div>
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
            <Icons.AlertTriangle size={20} color='var(--c-danger)' />
            <div style={{ flex:1 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--c-danger)' }}>
                {[
                  t.seguimientosVencidos   > 0 && `${t.seguimientosVencidos} ${txt('overdueFollowUps')}`,
                  t.visitantesSinConsolidar> 0 && `${t.visitantesSinConsolidar} ${txt('unconsolidatedVisitors')}`,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
            <span style={{ fontSize:12, color:'var(--c-danger)', fontWeight:600 }}>{txt('viewAlerts')}</span>
          </div>
        )}

        {/* ── Grid principal ───────────────────────────────────────── */}
        <div className="dashboard-grid" style={{ display:'grid', gridTemplateColumns:`repeat(${ori.cols2},1fr)`, gap: ori.isPhone ? 10 : 16, marginBottom:16 }}>

          {/* Últimos cultos */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:700, margin:0 }}>{txt('recentServices')}</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => navigate('/asistencia')}>{txt('seeAll')}</button>
            </div>
            {(overview?.asistenciaReciente || []).length === 0
              ? <div className="empty" style={{ padding:'20px 0' }}><p>{txt('noServices')}<br/>{txt('createFirstService')}</p></div>
              : (overview?.asistenciaReciente || []).slice(0, 5).map((c, i) => {
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
              <h3 style={{ fontSize:13, fontWeight:700, margin:0, display:'flex', alignItems:'center', gap:6 }}><Icons.History size={14} />{txt('followUps')}</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => navigate('/alertas')}>{txt('seeAll')}</button>
            </div>
            {(overview?.proximosContactos || []).length === 0
              ? <div className="empty" style={{ padding:'20px 0' }}>
                  <div className="empty-icon"><Icons.History size={24} color='var(--text-muted)' /></div>
                  <p>{txt('noFollowUps')}</p>
                </div>
              : (overview?.proximosContactos || []).slice(0, 6).map((s, i) => {
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
                        {urgente ? txt('overdue') : dias === 0 ? txt('today') : `${dias}d`}
                      </span>
                    </div>
                  )
                })
            }
          </div>

          {/* Cumpleaños */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:700, margin:0, display:'flex', alignItems:'center', gap:6 }}><Icons.Heart size={14} />{txt('birthdays')}</h3>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{txt('next30')}</span>
            </div>
            {(overview?.cumpleanos || []).length === 0
              ? <div className="empty" style={{ padding:'20px 0' }}><p>{txt('noBirthdays')}</p></div>
              : (overview?.cumpleanos || []).slice(0, 5).map((p, i) => {
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
                          {new Date(p.fechaNacimiento+'T12:00:00').toLocaleDateString(txt('locale'),{day:'numeric',month:'long'})}
                        </div>
                      </div>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap',
                        background: dias === 0 ? 'var(--c-success-bg)' : 'var(--bg)',
                        color: dias === 0 ? 'var(--c-success)' : 'var(--text-muted)',
                      }}>
                        {dias === 0 ? txt('todayBang') : txt('inDays').replace('{days}', dias)}
                      </span>
                    </div>
                  )
                })
            }
          </div>

          {/* Acceso rápido */}
          <div className="card">
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>{txt('quick')}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:8 }}>
              {[
                { Ic: Icons.UserPlus,   label:copy.actions[0][0], desc:copy.actions[0][1], path:'/personas',     color:'#2563EB' },
                { Ic: Icons.Attendance, label:copy.actions[1][0], desc:copy.actions[1][1], path:'/asistencia',   color:'#16A34A' },
                { Ic: Icons.QrCode,     label:copy.actions[2][0], desc:copy.actions[2][1], path:'/checkin',      color:'#0891B2' },
                { Ic: Icons.Messages,   label:copy.actions[3][0], desc:copy.actions[3][1], path:'/mensajes',     color:'#D97706' },
                { Ic: Icons.AI,         label:copy.actions[4][0], desc:copy.actions[4][1], path:'/asistente-ia', color:'#7C3AED' },
                { Ic: Icons.Comunicados,label:copy.actions[5][0], desc:copy.actions[5][1], path:'/alertas',      color:'#DC2626' },
                { Ic: Icons.Reports,    label:copy.actions[6][0], desc:copy.actions[6][1], path:'/reportes',     color:'#9333EA' },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start',
                    gap:0, padding:'14px 8px 12px', borderRadius:12, cursor:'pointer',
                    background:'var(--bg)', border:'1px solid var(--border)',
                    transition:'all .15s', textAlign:'center', width:'100%',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.background = `${a.color}08` }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                  <div style={{
                    width:40, height:40, borderRadius:12, marginBottom:8,
                    background:`${a.color}18`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <a.Ic size={18} color={a.color} />
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text)', lineHeight:1.3, marginBottom:2 }}>{a.label}</div>
                  <div style={{ fontSize:10, fontWeight:400, color:'var(--text-muted)', lineHeight:1.3 }}>{a.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Fila inferior ─────────────────────────────────────────── */}
        <div className="dashboard-grid" style={{ display:'grid', gridTemplateColumns:`repeat(${ori.cols2},1fr)`, gap: ori.isPhone ? 10 : 16, marginBottom:16 }}>

          {/* Crecimiento mensual (barras) */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:700, margin:0, display:'flex', alignItems:'center', gap:6 }}><Icons.Reports size={14} />{txt('growth')}</h3>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{txt('last12')}</span>
            </div>
            {(overview?.crecimientoMensual || []).length === 0
              ? <div className="empty" style={{ padding:'16px 0' }}><p>{txt('noGrowth')}</p></div>
              : (() => {
                  const data = (overview?.crecimientoMensual || []).slice(-12)
                  const max  = Math.max(...data.map(m => m.nuevos || 0), 1)
                  return (
                    <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:80 }}>
                      {data.map((m, i) => {
                        const h  = Math.max(Math.round((m.nuevos || 0) / max * 100), 4)
                        const esUltimo = i === data.length - 1
                        return (
                          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                            {(m.nuevos || 0) > 0 && (
                              <span style={{ fontSize:9, color: esUltimo ? 'var(--primary)' : 'var(--text-muted)', fontWeight:700 }}>
                                {m.nuevos}
                              </span>
                            )}
                            <div style={{
                              width:'100%', height:`${h}%`, minHeight:4,
                              background: esUltimo ? 'var(--primary)' : 'var(--primary-soft)',
                              borderRadius:'3px 3px 0 0',
                              transition:'height .4s ease',
                            }} />
                            <span style={{ fontSize:9, color:'var(--text-muted)', writingMode:'initial' }}>
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
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:6 }}><Icons.Shield size={14} />{txt('status')}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { lbl:txt('consolidation'), val: t.consolidacionActiva || 0, icon:<Icons.Heart size={14} />,          path:'/consolidacion', warn: t.consolidacionActiva > 0 },
                { lbl:txt('noTracking'), val: t.sinSeguimiento    || 0, icon:<Icons.AlertTriangle size={14} />,   path:'/alertas',       danger: t.sinSeguimiento > 0 },
              ].map(s => (
                <div key={s.lbl} onClick={() => navigate(s.path)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:8, cursor:'pointer', background:'var(--bg)', border:'1px solid var(--border)', transition:'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    {s.icon}
                    <span style={{ fontSize:12, fontWeight:500, color:'var(--text-2)' }}>{s.lbl}</span>
                  </div>
                  <span style={{
                    fontSize:13, fontWeight:800,
                    color: s.danger && s.val > 0 ? 'var(--c-danger)' : s.ok && s.val > 0 ? 'var(--c-success)' : s.warn && s.val > 0 ? 'var(--c-warning)' : 'var(--text-muted)',
                  }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Actividad reciente ─────────────────────────────────────── */}
        {(overview?.actividadReciente || []).length > 0 && (
          <div className="card">
            <h3 style={{ fontSize:13, fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:6 }}><Icons.History size={14} />{txt('recentActivity')}</h3>
            <div className="dashboard-activity-grid" style={{ display:'grid', gridTemplateColumns:`repeat(${ori.cols2},1fr)`, gap:0 }}>
              {(overview?.actividadReciente || []).slice(0, 8).map((a, i) => {
                const iconMap = { CREAR:<Icons.Plus size={13} />, ACTUALIZAR:<Icons.Edit size={13} />, ELIMINAR:<Icons.Delete size={13} />, MENSAJE:<Icons.Messages size={13} />, MASIVO:<Icons.Send size={13} />, IMPORTAR_EXCEL:<Icons.Excel size={13} />, BACKUP:<Icons.Archive size={13} />, LOGIN:<Icons.Profile size={13} /> }
                const ico = iconMap[a.accion] || <Icons.Mail size={13} />
                const time = a.createdAt ? new Date(a.createdAt).toLocaleTimeString(txt('locale'),{hour:'2-digit',minute:'2-digit'}) : ''
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom: i < 6 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ flexShrink:0, color:'var(--text-muted)' }}>{ico}</span>
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
