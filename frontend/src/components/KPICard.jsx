export default function KPICard({ icon, label, value, delta }) {
  let deltaColor = 'var(--text-muted)', deltaIcon = '■'
  if (delta?.type === 'up') { deltaColor = 'var(--c-success)'; deltaIcon = '▲' }
  else if (delta?.type === 'down') { deltaColor = 'var(--c-error)'; deltaIcon = '▼' }
  return (
    <div className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {delta && <div className="kpi-delta" style={{color:deltaColor}}><span>{deltaIcon}</span><span>{delta.value}%</span></div>}
    </div>
  )
}

export function KPISkeleton() {
  return (
    <div className="kpi-card">
      <div className="kpi-icon skeleton" style={{width:40,height:40}} />
      <div className="kpi-value skeleton skeleton-text" style={{width:120}} />
      <div className="kpi-label skeleton skeleton-text" style={{width:80}} />
    </div>
  )
}
