import { useNavigate } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan.js'
import { getCommercialPlanUi } from '../lib/commercialPlans.js'

const LABELS = {
  FREE:'Free', STARTER:'Starter', PRO:'Pro', MAX:'Max',
  CHURCH_100:'Church 100', CHURCH_500:'Church 500', CHURCH_1000:'Church 1000+',
  // Legacy labels still in some JWTs
  LIDER:'Starter', CULTO:'Starter', CONSOLIDACION:'Pro', ADMINISTRACION:'Pro', GENERAL:'Pro',
}
// Plan MÍNIMO que incluye cada módulo. DEBE coincidir con PLANES en backend/src/middlewares/plan.js
const MOD_PLAN = {
  // STARTER (y por ende PRO/MAX)
  dashboard:'STARTER', personas:'STARTER', grupos:'STARTER', perfil:'STARTER',
  checkin:'STARTER', comunicados:'STARTER', seguimiento:'STARTER',
  discipulado:'STARTER', analytics:'STARTER',
  // PRO (y MAX)
  asistencia:'PRO', calendario:'PRO', mensajes:'PRO', alertas:'PRO',
  reportes:'PRO', historial:'PRO', consolidacion:'PRO', configuracion:'PRO',
  // MAX solamente
  users:'MAX', permisos:'MAX', 'excel-ia':'MAX', 'asistente-ia':'MAX',
  backup:'MAX', premium:'MAX',
}

export default function UpgradeGate({ modulo, children }) {
  const navigate = useNavigate()
  const { tiene, plan, commercialPlan, loading } = usePlan()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:200}}><div className="spinner-xs"/></div>
  if (tiene(modulo)) return children
  const req = MOD_PLAN[modulo] || 'MAX'
  const currentLabel = getCommercialPlanUi(commercialPlan || plan).name || LABELS[commercialPlan] || LABELS[plan] || plan
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'calc(100vh - 120px)',padding:40,textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:20,marginBottom:24,background:'linear-gradient(135deg,#6B5CFF,#4845D2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,color:'#fff'}}>★</div>
      <h2 style={{fontSize:22,fontWeight:800,marginBottom:8,color:'var(--text)'}}>Módulo no disponible</h2>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:6,maxWidth:360}}>Requiere plan <strong style={{color:'var(--primary)'}}>{LABELS[req]}</strong>.</p>
      <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:28}}>Estás en plan <strong>{currentLabel}</strong>.</p>
      <button
        onClick={() => navigate('/planes')}
        style={{padding:'12px 28px',borderRadius:12,fontSize:14,fontWeight:700,background:'linear-gradient(135deg,#6B5CFF,#4845D2)',color:'#fff',border:'none',cursor:'pointer'}}>
        Ver planes y precios →
      </button>
    </div>
  )
}
