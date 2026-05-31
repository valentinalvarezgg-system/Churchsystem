import React, { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BannerNotificaciones from './components/BannerNotificaciones.jsx'
import { apiFetch, getUser, syncContextFromUser } from './services/api.js'
import SetupWizard from './pages/SetupWizard.jsx'
import CheckInAdmin, { CheckInPublico } from './pages/CheckIn.jsx'
import { ToastContainer } from './components/Toast.jsx'
import UpgradeGate from './components/UpgradeGate.jsx'
import BugReporter from './components/BugReporter.jsx'

// Lazy-loaded pages — cada página se descarga solo cuando el usuario navega a ella
const Login            = lazy(() => import('./pages/Login.jsx'))
const Registro         = lazy(() => import('./pages/Registro.jsx'))
const Terminos         = lazy(() => import('./pages/Terminos.jsx'))
const Privacidad       = lazy(() => import('./pages/Privacidad.jsx'))
const FAQ              = lazy(() => import('./pages/FAQ.jsx'))
const Dashboard        = lazy(() => import('./pages/Dashboard.jsx'))
const DashboardPremium = lazy(() => import('./pages/DashboardPremium.jsx'))
const Personas         = lazy(() => import('./pages/Personas.jsx'))
const Perfil           = lazy(() => import('./pages/Perfil.jsx'))
const Grupos           = lazy(() => import('./pages/Grupos.jsx'))
const Asistencia       = lazy(() => import('./pages/Asistencia.jsx'))
const Calendario       = lazy(() => import('./pages/Calendario.jsx'))
const Mensajes         = lazy(() => import('./pages/Mensajes.jsx'))
const Alertas          = lazy(() => import('./pages/Alertas.jsx'))
const Reportes         = lazy(() => import('./pages/Reportes.jsx'))
const Consolidacion    = lazy(() => import('./pages/Discipulado.jsx'))
const Comunicados      = lazy(() => import('./pages/Comunicados.jsx'))
const Eventos          = lazy(() => import('./pages/Eventos.jsx'))
const ExcelIA          = lazy(() => import('./pages/ExcelIA.jsx'))
const MiPerfil         = lazy(() => import('./pages/MiPerfil.jsx'))
const AsistenteIA      = lazy(() => import('./pages/AsistenteIA.jsx'))
const Configuracion    = lazy(() => import('./pages/Configuracion.jsx'))
const GestionPermisos  = lazy(() => import('./pages/GestionPermisos.jsx'))
const Users            = lazy(() => import('./pages/Users.jsx'))
const Historial        = lazy(() => import('./pages/Historial.jsx'))
const PromoCodes       = lazy(() => import('./pages/PromoCodes.jsx'))
const GodMode          = lazy(() => import('./pages/GodMode.jsx'))
const GodModeLogin     = lazy(() => import('./pages/GodModeLogin.jsx'))
const Analytics        = lazy(() => import('./pages/Analytics.jsx'))
const Planes           = lazy(() => import('./pages/Planes.jsx'))
const RecuperarPassword = lazy(() => import('./pages/RecuperarPassword.jsx'))

const ALL   = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF','LIDER']
const MID   = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF']
const ADMIN = ['PASTOR_GENERAL']
const AUDIT = ['PASTOR_GENERAL','CONSOLIDACION']

function PageSpinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner-sm" />
    </div>
  )
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100vh', background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: 32, maxWidth: 600, width: '100%' }}>
          <h2 style={{ color: '#FCA5A5', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>⚠️ Error en la aplicación</h2>
          <pre style={{ color: '#FCA5A5', fontSize: 12, background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 4, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{this.state.error?.message}{'\n\n'}{this.state.error?.stack?.split('\n').slice(0, 5).join('\n')}</pre>
          <button onClick={() => { this.setState({ error: null }); window.location.href = '/' }} style={{ marginTop: 16, padding: '10px 20px', background: '#2563EB', border: 'none', borderRadius: 4, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Recargar</button>
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
    const forced = localStorage.getItem('church_force_setup') === '1'
    if (forced) {
      setMostrarWizard(true)
      setCheckeado(true)
      return
    }
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

  useEffect(() => {
    if (user) syncContextFromUser(user)
  }, [user?.id])

  return (
    <ErrorBoundary>
      {checkeado && mostrarWizard && (
        <SetupWizard onCompleto={() => { localStorage.removeItem('church_force_setup'); setMostrarWizard(false) }} />
      )}

      {isLoggedIn && !mostrarWizard && <BannerNotificaciones />}

      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/checkin/:cultoId/:token" element={<CheckInPublico />} />
          <Route path="/login"      element={<Login />} />
          <Route path="/registro"   element={<Registro />} />
          <Route path="/recuperar"  element={<RecuperarPassword />} />
          <Route path="/terminos"   element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/faq"        element={<FAQ />} />
          <Route path="/vault-login" element={<GodModeLogin />} />
          <Route path="/godmode/login" element={<GodModeLogin />} />

          {/* App — rutas protegidas */}
          <Route path="/"              element={<ProtectedRoute roles={ALL}   element={<Dashboard />} />} />
          <Route path="/premium"       element={<ProtectedRoute roles={ADMIN} element={<DashboardPremium />} />} />
          <Route path="/personas"      element={<ProtectedRoute roles={MID}   element={<Personas />} />} />
          <Route path="/personas/:id"  element={<ProtectedRoute roles={MID}   element={<Perfil />} />} />
          <Route path="/grupos"        element={<ProtectedRoute roles={MID}   element={<Grupos />} />} />

          <Route path="/asistencia"    element={<ProtectedRoute roles={MID}   element={<UpgradeGate modulo="asistencia"><Asistencia /></UpgradeGate>} />} />
          <Route path="/calendario"    element={<ProtectedRoute roles={MID}   element={<UpgradeGate modulo="calendario"><Calendario /></UpgradeGate>} />} />
          <Route path="/eventos"       element={<ProtectedRoute roles={MID}   element={<UpgradeGate modulo="calendario"><Eventos /></UpgradeGate>} />} />
          <Route path="/mensajes"      element={<ProtectedRoute roles={MID}   element={<UpgradeGate modulo="mensajes"><Mensajes /></UpgradeGate>} />} />
          <Route path="/alertas"       element={<ProtectedRoute roles={AUDIT} element={<UpgradeGate modulo="alertas"><Alertas /></UpgradeGate>} />} />
          <Route path="/reportes"      element={<ProtectedRoute roles={AUDIT} element={<UpgradeGate modulo="reportes"><Reportes /></UpgradeGate>} />} />
          <Route path="/discipulado"   element={<Navigate to="/grupos" replace />} />
          <Route path="/consolidacion" element={<ProtectedRoute roles={AUDIT} element={<UpgradeGate modulo="consolidacion"><Consolidacion title="Consolidación" /></UpgradeGate>} />} />
          <Route path="/finanzas"      element={<Navigate to="/" replace />} />
          <Route path="/oracion"       element={<Navigate to="/" replace />} />
          <Route path="/comunicados"   element={<ProtectedRoute roles={MID}   element={<Comunicados />} />} />
          <Route path="/checkin"       element={<ProtectedRoute roles={MID}   element={<CheckInAdmin />} />} />
          <Route path="/excel-ia"      element={<ProtectedRoute roles={MID}   element={<ExcelIA />} />} />
          <Route path="/mi-perfil"     element={<ProtectedRoute roles={ALL}   element={<MiPerfil />} />} />
          <Route path="/asistente-ia"  element={<ProtectedRoute roles={AUDIT} element={<AsistenteIA />} />} />
          <Route path="/configuracion" element={<ProtectedRoute roles={ADMIN} element={<Configuracion />} />} />
          <Route path="/permisos"      element={<ProtectedRoute roles={ADMIN} element={<GestionPermisos />} />} />
          <Route path="/users"         element={<ProtectedRoute roles={ADMIN} element={<Users />} />} />
          <Route path="/promo-codes"   element={<ProtectedRoute roles={['GODMODE']} element={<PromoCodes />} />} />
          <Route path="/vault"         element={<ProtectedRoute roles={['GODMODE']} element={<GodMode />} />} />
          <Route path="/godmode"       element={<ProtectedRoute roles={['GODMODE']} element={<GodMode />} />} />
          <Route path="/historial"     element={<ProtectedRoute roles={AUDIT} element={<UpgradeGate modulo="historial"><Historial /></UpgradeGate>} />} />
          <Route path="/analytics"    element={<ProtectedRoute roles={ALL}   element={<Analytics />} />} />
          <Route path="/planes"       element={<ProtectedRoute roles={ALL}   element={<Planes />} />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <ToastContainer />
      <BugReporter />
    </ErrorBoundary>
  )
}
