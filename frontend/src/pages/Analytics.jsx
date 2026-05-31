import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  ArcElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import Layout from '../components/Layout.jsx'
import { apiFetch } from '../services/api.js'

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  ArcElement, Tooltip, Legend, Filler
)

const C = {
  primary:  '#6B5CFF',
  success:  '#22c55e',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  info:     '#3b82f6',
  purple:   '#a855f7',
  teal:     '#14b8a6',
  muted:    '#94a3b8',
}

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: { grid: { color: '#ffffff0a' }, ticks: { color: '#94a3b8', font: { size: 11 } }, beginAtZero: true },
  },
}
const CHART_OPTS_NO_SCALE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } },
}

function KPI({ icon, label, value, sub, color = C.primary }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '20px 18px',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, marginBottom: 12,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color,
      }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function ChartCard({ title, height = 200, children, insight }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '20px 20px 16px',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>{title}</h3>
      <div style={{ height }}>{children}</div>
      {insight && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 8,
          background: 'var(--bg)', border: '1px solid var(--border)',
          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4,
        }}>
          💡 {insight}
        </div>
      )}
    </div>
  )
}

function InsightBadge({ icon, text, color = C.primary }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 10,
      background: `${color}0e`, border: `1px solid ${color}28`,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch('/analytics/resumen')
      .then(r => { setData(r); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner" />
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div className="empty">
        <div className="empty-icon">📊</div>
        <p>Error al cargar analytics: {error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    </Layout>
  )

  const plan = data?.plan || 'STARTER'
  const kpis = data?.kpis || {}

  // ── Preparar datasets ───────────────────────────────────────────
  const segTrend = data?.seguimientoTrend || []
  const segChart = {
    labels: segTrend.map(d => d.semana),
    datasets: [{
      data: segTrend.map(d => d.total),
      backgroundColor: `${C.primary}99`,
      borderColor: C.primary,
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const estadoData = data?.estadoEspiritual || []
  const estadoColors = [C.success, C.info, C.warning, C.danger, C.muted, C.purple]
  const estadoChart = {
    labels: estadoData.map(d => d.estado || 'Sin datos'),
    datasets: [{
      data: estadoData.map(d => d.total),
      backgroundColor: estadoColors.slice(0, estadoData.length),
      borderWidth: 0,
    }],
  }

  const discChart = {
    labels: (data?.discipuladoProgreso || []).map(d => d.etapa || 'General'),
    datasets: [{
      data: (data?.discipuladoProgreso || []).map(d => d.total),
      backgroundColor: `${C.purple}99`,
      borderColor: C.purple,
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const asisData = data?.asistenciaTrend || []
  const asisChart = {
    labels: asisData.map(d => d.fecha),
    datasets: [
      {
        label: 'Presentes',
        data: asisData.map(d => d.presentes),
        borderColor: C.success,
        backgroundColor: `${C.success}22`,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
      },
      {
        label: 'Total registrados',
        data: asisData.map(d => d.total),
        borderColor: C.muted,
        backgroundColor: 'transparent',
        tension: 0.4,
        borderDash: [4, 4],
        pointRadius: 3,
      },
    ],
  }

  const consData = data?.consolidacionEstados || []
  const consChart = {
    labels: consData.map(d => d.estado),
    datasets: [{
      data: consData.map(d => d.total),
      backgroundColor: [C.primary, C.success, C.warning, C.info, C.muted].slice(0, consData.length),
      borderWidth: 0,
    }],
  }

  const crecData = data?.crecimientoMensual || []
  const crecChart = {
    labels: crecData.map(d => d.mes),
    datasets: [{
      label: 'Personas nuevas',
      data: crecData.map(d => d.total),
      borderColor: C.teal,
      backgroundColor: `${C.teal}22`,
      tension: 0.4,
      fill: true,
      pointRadius: 5,
    }],
  }

  const lineOpts = {
    ...CHART_OPTS,
    plugins: { ...CHART_OPTS.plugins, legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 } } } },
  }

  const tasaRetencion = asisData.length > 0
    ? Math.round((asisData.reduce((s, d) => s + (d.total > 0 ? d.presentes / d.total : 0), 0) / asisData.length) * 100)
    : null

  return (
    <Layout>
      <div style={{ padding: '0 0 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            📊 Analytics
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Insights de tu actividad pastoral · Plan <strong>{plan}</strong>
          </p>
        </div>

        {/* ── KPIs STARTER (todos) ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
          <KPI icon="👥" label="Total personas"   value={kpis.totalPersonas ?? 0}    color={C.primary} />
          <KPI icon="✅" label="Activos"           value={kpis.personasActivas ?? 0}  color={C.success} />
          <KPI icon="🙋" label="Visitantes"        value={kpis.visitantes ?? 0}       color={C.info} />
          <KPI icon="👪" label="Grupos"            value={kpis.totalGrupos ?? 0}      color={C.purple} />
          <KPI icon="📋" label="Seguimientos (30d)" value={kpis.seguimientosActivos ?? 0} color={C.warning} />
          {typeof kpis.sinSeguimiento === 'number' && (
            <KPI icon="⚠️" label="Sin contacto (30d)" value={kpis.sinSeguimiento} color={C.danger}
              sub="personas activas sin seguimiento" />
          )}
        </div>

        {/* ── KPIs PRO/MAX ─────────────────────────────────────── */}
        {(plan === 'PRO' || plan === 'MAX') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
            <KPI icon="⛪" label="Cultos accesibles" value={kpis.totalCultos ?? 0}       color={C.teal} />
            <KPI icon="📈" label="Promedio asistencia" value={kpis.promedioAsistencia ?? 0} color={C.success} />
            <KPI icon="🕊" label="Última asistencia"  value={kpis.ultimaAsistencia ?? 0}   color={C.info} />
            <KPI icon="🌱" label="Nuevos este mes"    value={kpis.nuevosMes ?? 0}           color={C.primary} />
            <KPI icon="✉️" label="Mensajes (30d)"     value={kpis.mensajesMes ?? 0}         color={C.warning} />
            {tasaRetencion !== null && (
              <KPI icon="🔄" label="Tasa retención" value={`${tasaRetencion}%`} color={C.purple}
                sub="presentes / total registrados" />
            )}
          </div>
        )}

        {/* ── KPIs MAX ─────────────────────────────────────────── */}
        {plan === 'MAX' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
            <KPI icon="👤" label="Usuarios activos" value={kpis.totalUsuarios ?? 0} color={C.teal} />
          </div>
        )}

        {/* ── Insights rápidos ─────────────────────────────────── */}
        {kpis.sinSeguimiento > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginBottom: 24 }}>
            <InsightBadge icon="⚠️" color={C.danger}
              text={`${kpis.sinSeguimiento} persona${kpis.sinSeguimiento === 1 ? '' : 's'} activa${kpis.sinSeguimiento === 1 ? '' : 's'} sin contacto en los últimos 30 días`} />
            {tasaRetencion !== null && tasaRetencion < 70 && (
              <InsightBadge icon="📉" color={C.warning}
                text={`Tasa de retención en ${tasaRetencion}% — por debajo del objetivo del 70%`} />
            )}
            {tasaRetencion !== null && tasaRetencion >= 70 && (
              <InsightBadge icon="🎯" color={C.success}
                text={`Tasa de retención en ${tasaRetencion}% — por encima del objetivo del 70%`} />
            )}
          </div>
        )}

        {/* ── Gráficos fila 1 ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginBottom: 16 }}>

          {segTrend.length > 0 && (
            <ChartCard title="Actividad de seguimiento (8 semanas)" height={180}
              insight={segTrend.length > 1 && segTrend.at(-1).total > segTrend.at(-2)?.total
                ? 'La última semana tuvo más actividad que la anterior'
                : 'Considerá intensificar el seguimiento esta semana'}>
              <Bar data={segChart} options={CHART_OPTS} />
            </ChartCard>
          )}

          {estadoData.length > 0 && (
            <ChartCard title="Estado espiritual" height={180}
              insight={`${estadoData[0]?.estado || ''} es el estado más frecuente (${estadoData[0]?.total || 0} personas)`}>
              <Doughnut data={estadoChart} options={CHART_OPTS_NO_SCALE} />
            </ChartCard>
          )}

          {data?.discipuladoProgreso?.length > 0 && (
            <ChartCard title="Tipos de seguimiento / discipulado" height={180}>
              <Bar data={discChart} options={CHART_OPTS} />
            </ChartCard>
          )}
        </div>

        {/* ── Gráficos PRO/MAX ────────────────────────────────── */}
        {(plan === 'PRO' || plan === 'MAX') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, marginBottom: 16 }}>

            {asisData.length > 0 && (
              <ChartCard title="Tendencia de asistencia" height={200}
                insight={asisData.length >= 2
                  ? `Último culto: ${asisData.at(-1).presentes} presentes de ${asisData.at(-1).total} registrados`
                  : undefined}>
                <Line data={asisChart} options={lineOpts} />
              </ChartCard>
            )}

            {consData.length > 0 && (
              <ChartCard title="Consolidación por estado" height={200}
                insight="Nuevos creyentes en proceso de consolidación">
                <Doughnut data={consChart} options={CHART_OPTS_NO_SCALE} />
              </ChartCard>
            )}
          </div>
        )}

        {/* ── Gráficos MAX ────────────────────────────────────── */}
        {plan === 'MAX' && crecData.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <ChartCard title="Crecimiento de personas (últimos 6 meses)" height={200}
              insight={crecData.length >= 2
                ? `Este mes: ${crecData.at(-1).total} personas nuevas vs ${crecData.at(-2).total} el mes anterior`
                : undefined}>
              <Line data={crecChart} options={CHART_OPTS} />
            </ChartCard>
          </div>
        )}

        {/* Sin datos */}
        {segTrend.length === 0 && estadoData.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📊</div>
            <p>Todavía no hay suficientes datos para mostrar gráficos.</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Agregá personas, registrá seguimientos y marcá asistencia para ver tus insights.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
