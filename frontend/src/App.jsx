import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BannerNotificaciones from './components/BannerNotificaciones.jsx'
import { apiFetch, getUser } from './services/api.js'
import SetupWizard      from './pages/SetupWizard.jsx'
import Login            from './pages/Login.jsx'
import Dashboard        from './pages/Dashboard.jsx'
import Personas         from './pages/Personas.jsx'
import Grupos           from './pages/Grupos.jsx'
import Asistencia       from './pages/Asistencia.jsx'
import Calendario       from './pages/Calendario.jsx'
import Mensajes         from './pages/Mensajes.jsx'
import Alertas          from './pages/Alertas.jsx'
import Finanzas         from './pages/Finanzas.jsx'
import Reportes         from './pages/Reportes.jsx'
import Discipulado      from './pages/Discipulado.jsx'
import Consolidacion    from './pages/Consolidacion.jsx'
import Oracion          from './pages/Oracion.jsx'
import Comunicados      from './pages/Comunicados.jsx'
import CheckInAdmin, { CheckInPublico } from './pages/CheckIn.jsx'
import Perfil           from './pages/Perfil.jsx'
import MiPerfil         from './pages/MiPerfil.jsx'
import AsistenteIA      from './pages/AsistenteIA.jsx'
import Configuracion    from './pages/Configuracion.jsx'
import GestionPermisos  from './pages/GestionPermisos.jsx'
import ExcelIA          from './pages/ExcelIA.jsx'
import Users            from './pages/Users.jsx'
import Historial        from './pages/Historial.jsx'
import DashboardPremium from './pages/DashboardPremium.jsx'
import PromoCodes       from './pages/PromoCodes.jsx'
import Registro         from './pages/Registro.jsx'
import Terminos         from './pages/Terminos.jsx'
import Privacidad       from './pages/Privacidad.jsx'
import FAQ              from './pages/FAQ.jsx'
import { ToastContainer } from './components/Toast.jsx'
import BugReporter      from './components/BugReporter.jsx'

const ALL   = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF','LIDER']
const MID   = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF']
const ADMIN = ['PASTOR_GENERAL']
const AUDIT = ['PASTOR_GENERAL','CONSOLIDACION']

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{minHeight:'100vh',background:'#0A0F1E',display:'flex',alignItems:'center',justifyContent:'center',padding:40}}>
        <div style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:8,padding:32,maxWidth:600,width:'100%'}}>
          <h2 style={{color:'#FCA5A5',fontSize:18,fontWeight:700,marginBottom:12}}>⚠️ Error en la aplicación</h2>
          <pre style={{color:'#FCA5A5',fontSize:12,background:'rgba(0,0,0,0.3)',padding:14,borderRadius:4,overflow:'auto',whiteSpace:'pre-wrap'}}>{this.state.error?.message}{'\n\n'}{this.state.error?.stack?.split('\n').slice(0,5).join('\n')}</pre>
          <button onClick={()=>{this.setState({error:null});window.location.href='/'}} style={{marginTop:16,padding:'10px 20px',background:'#2563EB',border:'none',borderRadius:4,color:'white',fontSize:14,fontWeight:600,cursor:'pointer'}}>Recargar</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

function useSetupCheck() {
  const [mostrarWizard, setMostrarWizard] = useState(false)
  const [checkeado, setCheckeado]         = useState(false)
  const user = getUser()

  useEffect(() => {
    if (!user || user.rol !== 'PASTOR_GENERAL') { setCheckeado(true); return }
    apiFetch('/config')
      .then(cfg => {
        const completado  = cfg.setup_completado === '1' || cfg.setup_completado === true
        const tieneNombre = !!cfg.nombre_iglesia
        setMostrarWizard(!completado && !tieneNombre)
        setCheckeado(true)
      })
      .catch(() => setCheckeado(true))
  }, [])

  return { mostrarWizard, setMostrarWizard, checkeado }
}

export default function App() {
  const { mostrarWizard, setMostrarWizard, checkeado } = useSetupCheck()
  const user = getUser()
  const isLoggedIn = !!user

  return (
    <ErrorBoundary>
      {checkeado && mostrarWizard && (
        <SetupWizard onCompleto={() => setMostrarWizard(false)} />
      )}

      {/* Banner de notificaciones — solo para usuarios logueados */}
      {isLoggedIn && !mostrarWizard && <BannerNotificaciones />}

      <Routes>
        <Route path="/checkin/:cultoId/:token" element={<CheckInPublico />} />
        <Route path="/login"                   element={<Login />} />
        <Route path="/registro"                element={<Registro />} />
        <Route path="/terminos"                element={<Terminos />} />
        <Route path="/privacidad"              element={<Privacidad />} />
        <Route path="/faq"                     element={<FAQ />} />
        <Route path="/"                element={<ProtectedRoute roles={ALL}   element={<Dashboard />} />} />
        <Route path="/premium"         element={<ProtectedRoute roles={ADMIN} element={<DashboardPremium />} />} />
        <Route path="/personas"        element={<ProtectedRoute roles={MID}   element={<Personas />} />} />
        <Route path="/personas/:id"    element={<ProtectedRoute roles={MID}   element={<Perfil />} />} />
        <Route path="/grupos"          element={<ProtectedRoute roles={MID}   element={<Grupos />} />} />
        <Route path="/asistencia"      element={<ProtectedRoute roles={MID}   element={<Asistencia />} />} />
        <Route path="/calendario"      element={<ProtectedRoute roles={MID}   element={<Calendario />} />} />
        <Route path="/mensajes"        element={<ProtectedRoute roles={MID}   element={<Mensajes />} />} />
        <Route path="/alertas"         element={<ProtectedRoute roles={AUDIT} element={<Alertas />} />} />
        <Route path="/finanzas"        element={<ProtectedRoute roles={AUDIT} element={<Finanzas />} />} />
        <Route path="/reportes"        element={<ProtectedRoute roles={AUDIT} element={<Reportes />} />} />
        <Route path="/discipulado"     element={<ProtectedRoute roles={MID}   element={<Discipulado />} />} />
        <Route path="/consolidacion"   element={<ProtectedRoute roles={AUDIT} element={<Consolidacion />} />} />
        <Route path="/oracion"         element={<ProtectedRoute roles={ALL}   element={<Oracion />} />} />
        <Route path="/comunicados"     element={<ProtectedRoute roles={MID}   element={<Comunicados />} />} />
        <Route path="/checkin"         element={<ProtectedRoute roles={MID}   element={<CheckInAdmin />} />} />
        <Route path="/excel-ia"        element={<ProtectedRoute roles={MID}   element={<ExcelIA />} />} />
        <Route path="/mi-perfil"       element={<ProtectedRoute roles={ALL}   element={<MiPerfil />} />} />
        <Route path="/asistente-ia"    element={<ProtectedRoute roles={AUDIT} element={<AsistenteIA />} />} />
        <Route path="/configuracion"   element={<ProtectedRoute roles={ADMIN} element={<Configuracion />} />} />
        <Route path="/permisos"        element={<ProtectedRoute roles={ADMIN} element={<GestionPermisos />} />} />
        <Route path="/users"           element={<ProtectedRoute roles={ADMIN} element={<Users />} />} />
        <Route path="/promo-codes"     element={<ProtectedRoute roles={ADMIN} element={<PromoCodes />} />} />
        <Route path="/historial"       element={<ProtectedRoute roles={AUDIT} element={<Historial />} />} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
      
      <ToastContainer />
      <BugReporter />
    </ErrorBoundary>
  )
}
