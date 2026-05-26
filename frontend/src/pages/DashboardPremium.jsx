import { useState, useEffect } from 'react'
import Layout from '../components/Layout.jsx'
import { apiFetch } from '../services/api.js'
import KPICard, { KPISkeleton } from '../components/KPICard.jsx'
import Icons from '../components/Icons.jsx'

export default function DashboardPremium() {
  const [loading, setLoading] = useState(true)
  const [kpis, setKPIs] = useState({})
  
  useEffect(() => {
    Promise.all([
      apiFetch('/stats/personas'),
      apiFetch('/stats/asistencias'),
      apiFetch('/stats/grupos'),  
      apiFetch('/stats/seguimientos'),
      apiFetch('/stats/consolidacion'),
    ])
      .then(([personas, asistencias, grupos, seguimientos, consolidacion]) => {
        setKPIs({ personas, asistencias, grupos, seguimientos, consolidacion })
      })
      .catch(e => console.error('KPIs error:', e))
      .finally(() => setLoading(false))
  }, [])
  
  const { personas={}, asistencias={}, grupos={}, seguimientos={}, consolidacion={} } = kpis
  const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  
  return (
    <Layout 
      title="Vista Ejecutiva" 
      subtitle={`Métricas clave · ${mesActual}`}
    >
      <div className="kpi-grid">
        {loading ? (
          Array(5).fill(0).map((_, i) => <KPISkeleton key={i} />)
        ) : (
          <>
            <KPICard
              icon={<Icons.Users />}
              label="Total de personas"
              value={personas.total || 0}
              delta={personas.variacion ? {
                value: personas.variacion,
                type: personas.variacion >= 0 ? 'up' : 'down',
              } : null}
            />
            
            <KPICard
              icon={<Icons.Attendance />}
              label="Asistencia promedio"
              value={`${asistencias.promedio || 0}%`}
              delta={asistencias.variacion ? {
                value: asistencias.variacion,
                type: asistencias.variacion >= 0 ? 'up' : 'down',
              } : null}
            />
            
            <KPICard
              icon={<Icons.Groups />}
              label="Grupos activos"
              value={grupos.total || 0}
              delta={grupos.variacion ? {
                value: grupos.variacion,
                type: grupos.variacion >= 0 ? 'up' : 'down',
              } : null}
            />
            
            <KPICard
              icon={<Icons.Messages />}
              label="Seguimientos (mes)"
              value={seguimientos.mes || 0}
              delta={seguimientos.variacion ? {
                value: seguimientos.variacion,
                type: seguimientos.variacion >= 0 ? 'up' : 'down',
              } : null}
            />
            
            <KPICard
              icon={<Icons.CheckIn />}
              label="Consolidados"
              value={consolidacion.totalConsolidados || 0}
              delta={consolidacion.variacion ? {
                value: consolidacion.variacion,
                type: consolidacion.variacion >= 0 ? 'up' : 'down',
              } : null}
            />
          </>
        )}
      </div>
    </Layout>
  )
}
