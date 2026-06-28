import Layout from '../components/Layout.jsx'
import { apiFetch, getUser } from '../services/api.js'
import Icons from '../components/Icons.jsx'
import { useRealtimeQuery } from '../hooks/useRealtimeQuery.js'

const COLORS = {
  primary: '#6B5CFF',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  muted: '#94A3B8',
}

function KPI({ icon, label, value, delta, color }) {
  const isUp = delta > 0
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      transition: 'all .2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${color || COLORS.primary}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color || COLORS.primary,
        }}>{icon}</div>
        {delta !== null && delta !== undefined && (
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: isUp ? COLORS.success : COLORS.danger,
            background: isUp ? '#22c55e14' : '#ef444414',
            padding: '3px 8px', borderRadius: 20,
          }}>
            {isUp ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function MiniChart({ data, height = 80, color = COLORS.primary }) {
  if (!data?.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin datos</div>
  const max = Math.max(...data.map(d => d.value), 1)
  const w = 100 / data.length
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 3, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            height: Math.max(4, (d.value / max) * height * 0.85),
            background: i === data.length - 1 ? color : `${color}60`,
            transition: 'height .3s',
          }} title={`${d.label}: ${d.value}`} />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function ActivityItem({ icon, title, subtitle, time, color }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color || COLORS.primary}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color || COLORS.primary,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      {time && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{time}</span>}
    </div>
  )
}

function Card({ title, children, style: s }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 24, ...s,
    }}>
      {title && <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>{title}</h3>}
      {children}
    </div>
  )
}

export default function DashboardPremium() {
  const user = getUser()
  const { data, loading } = useRealtimeQuery(
    'stats-premium',
    () => apiFetch('/stats/premium'),
    [],
    { intervalMs: 10000 }
  )

  const { personas = {}, asist = {}, grupos = {}, seg = {}, consol = {} } = data?.kpis || {}
  const tendencia = data?.tendencia || []
  const actividad = data?.actividad || {}
  const hoy = new Date()
  const saludo = hoy.getHours() < 12 ? 'Buenos días' : hoy.getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'
  const mesLabel = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  if (loading) return (
    <Layout title="Vista Ejecutiva">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 20 }}>
        {Array(5).fill(0).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, height: 130 }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '60%', height: 28, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: '40%', height: 14 }} />
          </div>
        ))}
      </div>
    </Layout>
  )

  return (
    <Layout
      title={`${saludo}, ${user?.nombre?.split(' ')[0] || 'Pastor'}`}
      subtitle={`Vista ejecutiva · ${mesLabel}`}
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KPI icon={<Icons.Users />} label="Total personas" value={personas.total || 0} delta={personas.variacion} color={COLORS.primary} />
        <KPI icon={<Icons.Attendance />} label="Asistencia promedio" value={`${asist.promedio || 0}%`} delta={asist.variacion} color={COLORS.info} />
        <KPI icon={<Icons.Groups />} label="Grupos activos" value={grupos.total || 0} delta={grupos.variacion} color={COLORS.success} />
        <KPI icon={<Icons.Messages />} label="Seguimientos (mes)" value={seg.mes || 0} delta={seg.variacion} color={COLORS.warning} />
        <KPI icon={<Icons.CheckIn />} label="Consolidados" value={consol.totalConsolidados || 0} delta={consol.variacion} color="#8b5cf6" />
      </div>

      {/* Charts + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left: Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Asistencia semanal">
            <MiniChart
              data={tendencia.map(s => ({ value: s.asistencia, label: s.semana }))}
              height={120}
              color={COLORS.info}
            />
          </Card>

          <Card title="Nuevos miembros por semana">
            <MiniChart
              data={tendencia.map(s => ({ value: s.nuevos, label: s.semana }))}
              height={90}
              color={COLORS.success}
            />
          </Card>
        </div>

        {/* Right: Activity feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Personas recientes">
            {(actividad.personas || []).length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin actividad reciente</p>
              : (actividad.personas || []).map(p => (
                <ActivityItem
                  key={p.id}
                  icon={<Icons.Users />}
                  title={`${p.nombre} ${p.apellido}`}
                  subtitle={p.estado}
                  time={timeAgo(p.createdAt)}
                  color={COLORS.primary}
                />
              ))
            }
          </Card>

          <Card title="Últimos seguimientos">
            {(actividad.seguimientos || []).length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Sin seguimientos</p>
              : (actividad.seguimientos || []).map(s => (
                <ActivityItem
                  key={s.id}
                  icon={<Icons.Messages />}
                  title={`${s.nombre || ''} ${s.apellido || ''}`}
                  subtitle={s.tipo}
                  time={timeAgo(s.fecha)}
                  color={COLORS.warning}
                />
              ))
            }
          </Card>
        </div>
      </div>
    </Layout>
  )
}
