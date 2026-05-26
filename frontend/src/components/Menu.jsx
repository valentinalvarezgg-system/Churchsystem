import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { getUser, apiFetch } from '../services/api.js'
import BusquedaGlobal from './BusquedaGlobal.jsx'
import { useNotificaciones } from '../hooks/useNotificaciones.js'
import Icons from './Icons.jsx'

const BOTTOM_LINKS = [
  { to: '/',           icon: 'Dashboard', label: 'Inicio',   exact: true  },
  { to: '/personas',   icon: 'Users', label: 'Personas', exact: false },
  { to: '/asistencia', icon: 'Attendance', label: 'Asistencia',exact:false },
  { to: '/alertas',    icon: 'Comunicados', label: 'Alertas',  exact: false },
  { to: '/menu',       icon: 'Settings',  label: 'Menú',     exact: false, isMenu: true },
]

export default function Menu() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const user       = getUser()
  const rol        = user?.rol
  const [open, setOpen]           = useState(false)  // sidebar abierta en mobile
  const [busqueda, setBusqueda]   = useState(false)
  const { suscrito, suscribir, permiso, soportado } = useNotificaciones()
  const [alertCount, setAlertCount] = useState(0)
  const [dark, setDark]           = useState(() => localStorage.getItem('theme') === 'dark')

  // Cerrar sidebar al cambiar de ruta
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Tecla ⌘K
  useEffect(() => {
    const fn = e => { if ((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setBusqueda(true) } }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // Alertas
  useEffect(() => {
    if (!['PASTOR_GENERAL','CONSOLIDACION'].includes(rol)) return
    const load = () => apiFetch('/alertas').then(d => setAlertCount(d?.resumen?.total||0)).catch(()=>{})
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [rol])

  // Tema
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  // Bloquear scroll del body cuando sidebar está abierta
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const lnk = (to, icon, label, end=false, badge=0) => (
    <NavLink key={to} to={to} end={end}
      className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
      <span style={{lineHeight:1,flexShrink:0,width:18,display:'flex',alignItems:'center',justifyContent:'center'}}>{icon}</span>
      <span style={{flex:1}}>{label}</span>
      {badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  )

  const isAdmin = rol === 'PASTOR_GENERAL'
  const isMid   = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF'].includes(rol)
  const isAudit = ['PASTOR_GENERAL','CONSOLIDACION'].includes(rol)
  const initials = (user?.nombre || user?.email || '?').slice(0,1).toUpperCase()

  // Nombre de la página actual para el header mobile
  const PAGE_NAMES = {
    '/': 'Dashboard', '/personas': 'Personas', '/grupos': 'Grupos',
    '/asistencia': 'Asistencia', '/checkin': 'Check-in QR',
    '/calendario': 'Calendario', '/discipulado': 'Discipulado',
    '/consolidacion': 'Consolidación', '/mensajes': 'Mensajería',
    '/alertas': 'Alertas', '/finanzas': 'Finanzas',
    '/reportes': 'Reportes', '/excel-ia': 'Excel + IA',
    '/asistente-ia': 'Asistente IA', '/configuracion': 'Configuración',
    '/users': 'Usuarios', '/permisos': 'Permisos',
    '/historial': 'Historial', '/oracion': 'Oración',
    '/comunicados': 'Comunicados', '/mi-perfil': 'Mi perfil',
  }
  const currentPage = PAGE_NAMES[location.pathname] ||
    (location.pathname.startsWith('/personas/') ? 'Perfil' : 'Church System')

  return (
    <>
      {/* ── Header mobile (solo visible en < 1024px) ─────────── */}
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menú">
          ☰
        </button>
        <div className="mobile-header-title">
          {currentPage}
          <span>Gestión Pastoral Inteligente</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setBusqueda(true)} aria-label="Buscar">
          ⌕
        </button>
        {soportado && permiso !== 'denied' && (
          <button className="mobile-menu-btn" aria-label="Notificaciones"
            onClick={async () => { if(!suscrito){ const ok = await suscribir(); if(ok){ /* ya suscrito, el botón se oculta */ } } }}
            style={{ position:'relative' }}
            title={suscrito ? 'Notificaciones activas' : 'Activar notificaciones'}>
            {suscrito ? '🔔' : '🔕'}
          </button>
        )}
        <button className="mobile-menu-btn" onClick={() => setDark(d => !d)} aria-label="Tema">
          {dark ? '☀︎' : '☽'}
        </button>
      </header>

      {/* ── Overlay detrás del sidebar ────────────────────────── */}
      <div className={`sidebar-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <svg className="sidebar-logo-icon" width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M35 15C30 15 25 18 25 25V75C25 82 30 85 35 85H45C50 85 55 82 55 75V25C55 18 50 15 45 15H35Z" fill="url(#cs_grad)"/>
            <path d="M65 15C60 15 55 18 55 25V45C55 52 60 55 65 55H75C80 55 85 52 85 45V25C85 18 80 15 75 15H65Z" fill="url(#cs_grad)"/>
            <defs>
              <linearGradient id="cs_grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6B5CFF"/>
                <stop offset="100%" stopColor="#4845D2"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="sidebar-logo-text">
            Church System
            <span>Gestión Pastoral Inteligente</span>
          </div>
          <button className="sidebar-theme-btn" onClick={() => setDark(d => !d)}
            title={dark ? 'Modo claro' : 'Modo oscuro'}>
            {dark ? '☀︎' : '☽'}
          </button>
        </div>

        <button className="search-trigger" onClick={() => setBusqueda(true)}>
          <span style={{fontSize:13}}>⌕</span>
          <span style={{flex:1}}>Buscar...</span>
          <span className="search-kbd">⌘K</span>
        </button>

        <nav className="sidebar-nav">
          <div className="nav-section">Principal</div>
          {lnk('/', <Icons.Dashboard />, 'Dashboard', true)}
          {isAdmin && lnk('/premium', <Icons.Premium />, 'Vista Ejecutiva')}
          {isMid  && lnk('/comunicados', <Icons.Comunicados />, 'Comunicados')}
          {lnk('/oracion', <Icons.Prayer />, 'Oración')}

          {isMid && <>
            <div className="nav-section">Congregación</div>
            {lnk('/personas',    <Icons.Users />, 'Personas')}
            {lnk('/grupos',      <Icons.Groups />, 'Grupos')}
            {lnk('/asistencia',  <Icons.Attendance />, 'Asistencia')}
            {lnk('/checkin',     <Icons.CheckIn />, 'Check-in QR')}
            {lnk('/calendario',  <Icons.Calendar />, 'Calendario')}
            {lnk('/discipulado', <Icons.Discipleship />,  'Discipulado')}
            {isAudit && lnk('/consolidacion', <Icons.Users />, 'Consolidación')}
          </>}

          {(isMid||isAudit) && <>
            <div className="nav-section">Gestión</div>
            {isMid   && lnk('/mensajes',  <Icons.Messages />, 'Mensajería')}
            {isAudit && lnk('/alertas',   <Icons.Comunicados />, 'Alertas', false, alertCount)}
            {isAudit && lnk('/reportes',  <Icons.Reports />, 'Reportes')}
          </>}

          {isMid && <>
            <div className="nav-section">Herramientas</div>
            {lnk('/excel-ia',    <Icons.Excel />, 'Excel + IA')}
            {isAudit && lnk('/asistente-ia', <Icons.AI />, 'Asistente IA')}
          </>}

          {isAdmin && <>
            <div className="nav-section">Admin</div>
            {lnk('/users',         <Icons.Profile />, 'Usuarios')}
            {lnk('/promo-codes',   <Icons.Ticket />,  'Promo Codes')}
            {lnk('/permisos',      <Icons.Shield />,  'Permisos')}
            {lnk('/historial',     <Icons.History />, 'Historial')}
            {lnk('/configuracion', <Icons.Settings />,  'Configuración')}
          </>}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => navigate('/mi-perfil')}>
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.nombre || user?.email}</div>
              <div className="sidebar-user-rol">{rol?.replace(/_/g,' ')}</div>
            </div>
          </div>
          {soportado && permiso !== 'denied' && (
            <button onClick={async () => { if(!suscrito){ const ok = await suscribir(); if(ok){ /* ya suscrito, el botón se oculta */ } } }}
              style={{
                display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
                borderRadius:'var(--r)', border:'1px solid rgba(255,255,255,0.08)',
                background: suscrito ? 'rgba(22,163,74,0.1)' : 'rgba(255,255,255,0.04)',
                color: suscrito ? '#4ADE80' : 'rgba(255,255,255,0.5)',
                fontSize:12, cursor:'pointer', width:'100%', marginBottom:6,
              }}>
              <span>{suscrito ? '🔔' : '🔕'}</span>
              <span>{suscrito ? 'Notificaciones activas' : 'Activar notificaciones'}</span>
            </button>
          )}
          <button className="btn-logout" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>

      {/* ── Bottom Navigation (solo mobile < 1024px) ─────────── */}
      <nav className="bottom-nav">
        {BOTTOM_LINKS.map(link => {
          const IconComponent = Icons[link.icon]
          if (link.isMenu) {
            return (
              <button key="menu" className="bottom-nav-item" onClick={() => setOpen(true)}
                style={{background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                <span className="nav-icon"><IconComponent /></span>
                <span>{link.label}</span>
              </button>
            )
          }
          const isActive = link.exact
            ? location.pathname === link.to
            : location.pathname.startsWith(link.to)
          return (
            <NavLink key={link.to} to={link.to}
              className={`bottom-nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon"><IconComponent /></span>
              {link.to === '/alertas' && alertCount > 0 && (
                <span className="bottom-nav-badge">{alertCount > 9 ? '9+' : alertCount}</span>
              )}
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </nav>


      {/* ── Icon Rail (landscape mobile solamente) ─────────────── */}
      <nav className="landscape-rail">
        {[
          { to: '/',            icon: '📊', exact: true  },
          { to: '/personas',    icon: '👥', exact: false },
          { to: '/asistencia',  icon: '📅', exact: false },
          { to: '/alertas',     icon: '🔔', exact: false, badge: alertCount },
          { to: '/mensajes',    icon: '💬', exact: false },
          { to: '/checkin',     icon: '📱', exact: false },
          { to: '/finanzas',    icon: '💰', exact: false },
          { to: '/oracion',     icon: '🙏', exact: false },
        ].map(link => {
          const isActive = link.exact
            ? location.pathname === link.to
            : location.pathname.startsWith(link.to)
          return (
            <NavLink key={link.to} to={link.to}
              className={'landscape-rail-item' + (isActive ? ' active' : '')}>
              {link.icon}
              {link.badge > 0 && (
                <span className="landscape-rail-badge">{link.badge > 9 ? '9+' : link.badge}</span>
              )}
            </NavLink>
          )
        })}
        {/* Botón para abrir sidebar completo */}
        <button onClick={() => setOpen(true)}
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            width:44, height:40, borderRadius:8, marginTop:4,
            background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.08)',
            color:'rgba(255,255,255,0.4)', fontSize:16, cursor:'pointer',
          }}>
          ☰
        </button>
      </nav>

      {busqueda && <BusquedaGlobal onClose={() => setBusqueda(false)} />}
    </>
  )
}
