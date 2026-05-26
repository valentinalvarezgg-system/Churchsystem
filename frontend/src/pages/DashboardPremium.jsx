/**
 * Dashboard Premium — executive overview with key metrics
 */
import { useState, useEffect } from 'react'
import { apiFetch } from '../services/api.js'
import KPICard, { KPISkeleton } from '../components/KPICard.jsx'

function fmtMes() {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return meses[new Date().getMonth()]
}

function DashPremium() {
  const [isLoading, setLoading] = useState(true)
  const [kpis, setKPIs] = useState({
    personas:      {},
    asistencias:   {},
    grupos:        {},
    seguimientos:  {},
    consolidacion: {},
  })
  
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
      .catch(e => console.error('KPIs fetch error:', e))
      .finally(() => setLoading(false))
  }, [])
  
  const { personas, asistencias, grupos, seguimientos, consolidacion } = kpis
  
  return (
    <div className="dash-premium">
      <header>
        <h1>Vista Ejecutiva</h1>
        <p>{fmtMes()} {new Date().getFullYear()}</p>
      </header>

      <div className="kpi-grid">
        {isLoading ? (
          <>
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
          </>
        ) : (
          <>
            <KPICard
              icon="👥"
              label="Total de personas"
              value={personas.total}
              delta={{
                value: personas.variacion,
                type:  personas.variacion >= 0 ? 'up' : 'down',
              }}
            />
            
            <KPICard
              icon="✅"
              label="Asistencia promedio"
              value={`${asistencias.promedio}%`}
              delta={{
                value: asistencias.variacion,
                type:  asistencias.variacion >= 0 ? 'up' : 'down',
              }}
            />
            
            <KPICard
              icon="👨‍👩‍👦"
              label="Grupos activos"
              value={grupos.total}
              delta={{
                value: grupos.variacion,
                type:  grupos.variacion >= 0 ? 'up' : 'down',
              }}
            />
            
            <KPICard
              icon="☎️"
              label="Seguimientos este mes"
              value={seguimientos.mes}
              delta={{
                value: seguimientos.variacion,
                type:  seguimientos.variacion >= 0 ? 'up' : 'down',
              }}  
            />
            
            <KPICard
              icon="🌱"
              label="Consolidados"
              value={consolidacion.totalConsolidados}
              delta={{
                value: consolidacion.variacion,
                type:  consolidacion.variacion >= 0 ? 'up' : 'down',
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default DashPremium
