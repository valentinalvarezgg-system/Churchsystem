import { usePlan } from '../hooks/usePlan.js'

const LABELS = {
  STARTER:'Starter', PRO:'Pro', MAX:'Max',
  // Legacy labels still in some JWTs
  LIDER:'Starter', CULTO:'Starter', CONSOLIDACION:'Pro', ADMINISTRACION:'Pro', GENERAL:'Max',
}
const ORDER = ['STARTER','PRO','MAX']
const MOD_PLAN = {
  asistencia:'STARTER', calendario:'STARTER', comunicados:'STARTER',
  seguimiento:'PRO', consolidacion:'PRO', alertas:'PRO', mensajes:'PRO',
  reportes:'PRO', historial:'PRO', users:'PRO', permisos:'PRO',
  configuracion:'PRO', discipulado:'PRO', 'excel-ia':'PRO',
  'asistente-ia':'MAX', premium:'MAX', backup:'MAX',
}

export default function UpgradeGate({ modulo, children }) {
  const { tiene, plan, loading } = usePlan()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:200}}><div className="spinner-xs"/></div>
  if (tiene(modulo)) return children
  const req = MOD_PLAN[modulo] || 'MAX'
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'calc(100vh - 120px)',padding:40,textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:20,marginBottom:24,background:'linear-gradient(135deg,#6B5CFF,#4845D2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,color:'#fff'}}>★</div>
      <h2 style={{fontSize:22,fontWeight:800,marginBottom:8,color:'var(--text)'}}>Módulo no disponible</h2>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:6,maxWidth:360}}>Requiere plan <strong style={{color:'var(--primary)'}}>{LABELS[req]}</strong>.</p>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:28}}>Estás en plan <strong>{LABELS[plan]||plan}</strong>.</p>
      <a href="mailto:soporte@churchsystem.com.ar?subject=Upgrade" style={{padding:'12px 28px',borderRadius:12,fontSize:14,fontWeight:700,background:'linear-gradient(135deg,#6B5CFF,#4845D2)',color:'#fff',textDecoration:'none'}}>Mejorar mi plan →</a>
    </div>
  )
}
