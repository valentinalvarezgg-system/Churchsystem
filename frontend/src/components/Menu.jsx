import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { getUser, apiFetch, getStoredContext, setStoredContext } from '../services/api.js'
import BusquedaGlobal from './BusquedaGlobal.jsx'
import { useNotificaciones } from '../hooks/useNotificaciones.js'
import Icons from './Icons.jsx'

const BOTTOM_LINKS_BY_ROLE = {
  LIDER: [
    { to: '/', icon: 'Dashboard', key: 'home', exact: true },
    { to: '/personas', icon: 'Users', key: 'people', exact: false },
    { to: '/grupos', icon: 'Groups', key: 'groups', exact: false },
    { to: '/mensajes', icon: 'Messages', key: 'messages', exact: false },
    { to: '/menu', icon: 'Settings', key: 'menu', exact: false, isMenu: true },
  ],
  DEFAULT: [
    { to: '/', icon: 'Dashboard', key: 'home', exact: true },
    { to: '/personas', icon: 'Users', key: 'people', exact: false },
    { to: '/asistencia', icon: 'Attendance', key: 'attendance', exact: false },
    { to: '/alertas', icon: 'Comunicados', key: 'alerts', exact: false },
    { to: '/menu', icon: 'Settings', key: 'menu', exact: false, isMenu: true },
  ],
}

const RAIL_LINKS_BY_ROLE = {
  LIDER: [
    { to: '/', icon: <Icons.Dashboard />, exact: true },
    { to: '/personas', icon: <Icons.Users />, exact: false },
    { to: '/grupos', icon: <Icons.Groups />, exact: false },
    { to: '/mensajes', icon: <Icons.Messages />, exact: false },
  ],
  DEFAULT: [
    { to: '/', icon: <Icons.Dashboard />, exact: true },
    { to: '/personas', icon: <Icons.Users />, exact: false },
    { to: '/asistencia', icon: <Icons.Attendance />, exact: false },
    { to: '/alertas', icon: <Icons.Comunicados />, exact: false, badgeKey: 'alerts' },
    { to: '/mensajes', icon: <Icons.Messages />, exact: false },
    { to: '/checkin', icon: <Icons.CheckIn />, exact: false },
  ],
}

const I18N = {
  es: {
    smart:'Gestión Pastoral Inteligente', openMenu:'Abrir menú', search:'Buscar', notifications:'Notificaciones',
    activeNotifications:'Notificaciones activas', enableNotifications:'Activar notificaciones',
    lightMode:'Modo claro', darkMode:'Modo oscuro', searchPlaceholder:'Buscar...', logout:'Cerrar sesión',
    principal:'Principal', congregation:'Congregación', management:'Gestión', tools:'Herramientas', admin:'Admin',
    home:'Inicio', dashboard:'Dashboard', executive:'Vista Ejecutiva', communications:'Comunicados',
    people:'Personas', groups:'Grupos', attendance:'Asistencia', checkin:'Check-in QR', calendar:'Calendario',
    discipleship:'Discipulado', consolidation:'Consolidación', messages:'Mensajería', alerts:'Alertas',
    reports:'Reportes', finances:'Finanzas', excel:'Excel + IA', assistant:'Asistente IA', users:'Usuarios',
    promo:'Promo Codes', permissions:'Permisos', history:'Historial', settings:'Configuración',
    prayer:'Oración', events:'Eventos', profile:'Mi perfil', pageProfile:'Perfil', menu:'Menú',
  },
  pt: {
    smart:'Gestão Pastoral Inteligente', openMenu:'Abrir menu', search:'Buscar', notifications:'Notificações',
    activeNotifications:'Notificações ativas', enableNotifications:'Ativar notificações',
    lightMode:'Modo claro', darkMode:'Modo escuro', searchPlaceholder:'Buscar...', logout:'Sair',
    principal:'Principal', congregation:'Congregação', management:'Gestão', tools:'Ferramentas', admin:'Admin',
    home:'Início', dashboard:'Dashboard', executive:'Visão Executiva', communications:'Comunicados',
    people:'Pessoas', groups:'Grupos', attendance:'Presença', checkin:'Check-in QR', calendar:'Calendário',
    discipleship:'Discipulado', consolidation:'Consolidação', messages:'Mensagens', alerts:'Alertas',
    reports:'Relatórios', finances:'Finanças', excel:'Excel + IA', assistant:'Assistente IA', users:'Usuários',
    promo:'Promo Codes', permissions:'Permissões', history:'Histórico', settings:'Configuração',
    prayer:'Oração', events:'Eventos', profile:'Meu perfil', pageProfile:'Perfil', menu:'Menu',
  },
  en: {
    smart:'Smart Pastoral Management', openMenu:'Open menu', search:'Search', notifications:'Notifications',
    activeNotifications:'Notifications active', enableNotifications:'Enable notifications',
    lightMode:'Light mode', darkMode:'Dark mode', searchPlaceholder:'Search...', logout:'Sign out',
    principal:'Main', congregation:'Congregation', management:'Management', tools:'Tools', admin:'Admin',
    home:'Home', dashboard:'Dashboard', executive:'Executive View', communications:'Announcements',
    people:'People', groups:'Groups', attendance:'Attendance', checkin:'QR Check-in', calendar:'Calendar',
    discipleship:'Discipleship', consolidation:'Follow-up', messages:'Messaging', alerts:'Alerts',
    reports:'Reports', finances:'Finances', excel:'Excel + AI', assistant:'AI Assistant', users:'Users',
    promo:'Promo Codes', permissions:'Permissions', history:'History', settings:'Settings',
    prayer:'Prayer', events:'Events', profile:'My profile', pageProfile:'Profile', menu:'Menu',
  },
}

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
  const [ctx, setCtx] = useState(getStoredContext())
  const lang = (ctx.lang || localStorage.getItem('church_lang') || user?.idioma || 'es').slice(0, 2)
  const tt = key => I18N[lang]?.[key] || I18N.es[key] || key
  const COUNTRY_OPTIONS = [
    { code:'AR', label:'Argentina', currency:'ARS', lang:'es' },
    { code:'BR', label:'Brasil', currency:'BRL', lang:'pt' },
    { code:'CL', label:'Chile', currency:'CLP', lang:'es' },
    { code:'CO', label:'Colombia', currency:'COP', lang:'es' },
    { code:'MX', label:'Mexico', currency:'MXN', lang:'es' },
    { code:'PE', label:'Peru', currency:'PEN', lang:'es' },
    { code:'UY', label:'Uruguay', currency:'UYU', lang:'es' },
    { code:'US', label:'United States', currency:'USD', lang:'en' },
  ]
  const selectedCountry = COUNTRY_OPTIONS.find(c => c.code === String(ctx.country || 'AR').toUpperCase()) || COUNTRY_OPTIONS[0]

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

  function updateCountry(code) {
    const c = COUNTRY_OPTIONS.find(x => x.code === code) || COUNTRY_OPTIONS[0]
    const next = { ...ctx, country: c.code, currency: c.currency, lang: c.lang }
    setCtx(next)
    setStoredContext(next)
  }

  const lnk = (to, icon, label, end=false, badge=0) => (
    <NavLink key={to} to={to} end={end}
      className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}>
      <span style={{lineHeight:1,flexShrink:0,width:18,display:'flex',alignItems:'center',justifyContent:'center'}}>{icon}</span>
      <span style={{flex:1}}>{label}</span>
      {badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  )

  // Plan-based navigation (STARTER / PRO / MAX + legacy role fallback)
  const PLAN_LEGACY = { LIDER:'STARTER', CULTO:'STARTER', CONSOLIDACION:'PRO', ADMINISTRACION:'PRO', GENERAL:'MAX' }
  const planKey = PLAN_LEGACY[user?.plan] || user?.plan || 'STARTER'

  const isStarter = planKey === 'STARTER'
  const isPro     = planKey === 'PRO' || planKey === 'MAX'
  const isMax     = planKey === 'MAX' || rol === 'PASTOR_GENERAL' || rol === 'GODMODE'

  // Compatibilidad con lógica antigua de roles
  const isAdmin = isMax
  const isMid   = isPro || isMax
  const isAudit = isPro || isMax
  const initials = (user?.nombre || user?.email || '?').slice(0,1).toUpperCase()
  const isLider = isStarter && !isPro && !isMax
  const bottomLinks = isLider ? BOTTOM_LINKS_BY_ROLE.LIDER : BOTTOM_LINKS_BY_ROLE.DEFAULT
  const railLinks = isLider ? RAIL_LINKS_BY_ROLE.LIDER : RAIL_LINKS_BY_ROLE.DEFAULT

  // Nombre de la página actual para el header mobile
  const PAGE_NAMES = {
    '/': tt('dashboard'), '/personas': tt('people'), '/grupos': tt('groups'),
    '/asistencia': tt('attendance'), '/checkin': tt('checkin'),
    '/calendario': tt('calendar'), '/discipulado': tt('discipleship'),
    '/consolidacion': tt('consolidation'), '/mensajes': tt('messages'),
    '/alertas': tt('alerts'),
    '/reportes': tt('reports'), '/excel-ia': tt('excel'),
    '/asistente-ia': tt('assistant'), '/configuracion': tt('settings'),
    '/users': tt('users'), '/permisos': tt('permissions'),
    '/historial': tt('history'),
    '/comunicados': tt('communications'), '/mi-perfil': tt('profile'),
    '/eventos': tt('events'),
  }
  const currentPage = PAGE_NAMES[location.pathname] ||
    (location.pathname.startsWith('/personas/') ? tt('pageProfile') : 'Church System')

  return (
    <>
      {/* ── Header mobile (solo visible en < 1024px) ─────────── */}
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label={tt('openMenu')}>
          ☰
        </button>
        <div className="mobile-header-title">
          {currentPage}
          <span>{tt('smart')}</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setBusqueda(true)} aria-label={tt('search')}>
          ⌕
        </button>
        {soportado && permiso !== 'denied' && (
          <button className="mobile-menu-btn" aria-label={tt('notifications')}
            onClick={async () => { if(!suscrito){ const ok = await suscribir(); if(ok){ /* ya suscrito, el botón se oculta */ } } }}
            style={{ position:'relative' }}
            title={suscrito ? tt('activeNotifications') : tt('enableNotifications')}>
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
          <svg className="sidebar-logo-icon" width="40" height="40" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M60 40 Q40 40 40 60 L40 140 Q40 160 60 160 L80 160 Q100 160 100 140 L100 60 Q100 40 80 40 Z" fill="url(#cs_grad)" stroke="none"/>
            <path d="M120 40 Q100 40 100 60 L100 100 Q100 120 120 120 L140 120 Q160 120 160 100 L160 60 Q160 40 140 40 Z" fill="url(#cs_grad)" stroke="none"/>
            <defs>
              <linearGradient id="cs_grad" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6B5CFF"/>
                <stop offset="100%" stopColor="#4845D2"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="sidebar-logo-text">
            Church System
            <span>{tt('smart')}</span>
          </div>
          <button className="sidebar-theme-btn" onClick={() => setDark(d => !d)}
            title={dark ? tt('lightMode') : tt('darkMode')}>
            {dark ? '☀︎' : '☽'}
          </button>
        </div>

        <button className="search-trigger" onClick={() => setBusqueda(true)}>
          <span style={{fontSize:13}}>⌕</span>
          <span style={{flex:1}}>{tt('searchPlaceholder')}</span>
          <span className="search-kbd">⌘K</span>
        </button>

        <nav className="sidebar-nav">
          <div className="nav-section">{tt('principal')}</div>
          {lnk('/', <Icons.Dashboard />, tt('dashboard'), true)}
          {lnk('/analytics', <Icons.Reports />, 'Analytics')}
          {isAdmin && lnk('/premium', <Icons.Premium />, tt('executive'))}
          {lnk('/planes', <span style={{fontSize:14}}>★</span>, 'Planes')}

          {/* STARTER — ver y agregar notas hasta discipulados */}
          {isStarter && !isPro && <>
            <div className="nav-section">{tt('congregation')}</div>
            {lnk('/personas',      <Icons.Users />,      tt('people'))}
            {lnk('/grupos',        <Icons.Groups />,     tt('groups'))}
            {lnk('/comunicados',   <Icons.Comunicados />, tt('communications'))}
            {lnk('/consolidacion', <Icons.Users />,      tt('consolidation'))}
            {lnk('/checkin',       <Icons.CheckIn />,    tt('checkin'))}
          </>}

          {/* PRO — ver, modificar y auditar cultos asignados */}
          {isPro && !isMax && <>
            <div className="nav-section">{tt('congregation')}</div>
            {lnk('/personas',      <Icons.Users />,      tt('people'))}
            {lnk('/grupos',        <Icons.Groups />,     tt('groups'))}
            {lnk('/asistencia',    <Icons.Attendance />, tt('attendance'))}
            {lnk('/checkin',       <Icons.CheckIn />,    tt('checkin'))}
            {lnk('/calendario',    <Icons.Calendar />,   tt('calendar'))}
            {lnk('/eventos',       <Icons.Calendar />,   tt('events'))}
            {lnk('/consolidacion', <Icons.Users />,      tt('consolidation'))}
            <div className="nav-section">{tt('management')}</div>
            {lnk('/mensajes',      <Icons.Messages />,   tt('messages'))}
            {lnk('/alertas',       <Icons.Comunicados />, tt('alerts'), false, alertCount)}
            {lnk('/reportes',      <Icons.Reports />,    tt('reports'))}
            {lnk('/comunicados',   <Icons.Comunicados />, tt('communications'))}
            <div className="nav-section">{tt('tools')}</div>
            {lnk('/configuracion', <Icons.Settings />,   tt('settings'))}
          </>}

          {/* MAX — todo sin restricciones */}
          {isMax && <>
            <div className="nav-section">{tt('congregation')}</div>
            {lnk('/personas',      <Icons.Users />,      tt('people'))}
            {lnk('/grupos',        <Icons.Groups />,     tt('groups'))}
            {lnk('/asistencia',    <Icons.Attendance />, tt('attendance'))}
            {lnk('/checkin',       <Icons.CheckIn />,    tt('checkin'))}
            {lnk('/calendario',    <Icons.Calendar />,   tt('calendar'))}
            {lnk('/eventos',       <Icons.Calendar />,   tt('events'))}
            {lnk('/consolidacion', <Icons.Users />,      tt('consolidation'))}
            <div className="nav-section">{tt('management')}</div>
            {lnk('/mensajes',      <Icons.Messages />,   tt('messages'))}
            {lnk('/alertas',       <Icons.Comunicados />, tt('alerts'), false, alertCount)}
            {lnk('/reportes',      <Icons.Reports />,    tt('reports'))}
            {lnk('/comunicados',   <Icons.Comunicados />, tt('communications'))}
            <div className="nav-section">{tt('tools')}</div>
            {lnk('/excel-ia',      <Icons.Excel />,      tt('excel'))}
            {lnk('/asistente-ia',  <Icons.AI />,         tt('assistant'))}
            <div className="nav-section">{tt('admin')}</div>
            {lnk('/users',         <Icons.Profile />,    tt('users'))}
            {lnk('/permisos',      <Icons.Shield />,     tt('permissions'))}
            {lnk('/historial',     <Icons.History />,    tt('history'))}
            {lnk('/configuracion', <Icons.Settings />,   tt('settings'))}
          </>}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display:'grid', gap:6, marginBottom:8 }}>
            <label style={{ fontSize:11, color:'var(--text-faint)' }}>Región</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 72px', gap:6, alignItems:'center' }}>
              <div style={{ position:'relative' }}>
                <div style={{
                  position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
                  width:22, height:16, overflow:'hidden', borderRadius:2,
                  border:'1px solid var(--border)', pointerEvents:'none', background:'var(--surface)',
                }}>
                  <img
                    src={`https://flagcdn.com/w80/${String(ctx.country || 'ar').toLowerCase()}.png`}
                    alt={ctx.country}
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                  />
                </div>
                <select
                  className="form-input"
                  title={selectedCountry.label}
                  value={ctx.country}
                  onChange={e => updateCountry(e.target.value)}
                  style={{ minHeight:24, padding:'2px 8px 2px 36px' }}>
                {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
              <select className="form-input" value={ctx.lang} onChange={e => { const next = { ...ctx, lang: e.target.value }; setCtx(next); setStoredContext(next) }} style={{ minHeight:24, padding:'2px 8px' }}>
                <option value="es">ES</option>
                <option value="pt">PT</option>
                <option value="en">EN</option>
              </select>
            </div>
          </div>
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
                borderRadius:'var(--r)', border:'1px solid var(--border)',
                background: suscrito ? 'var(--c-success-bg)' : 'var(--bg)',
                color: suscrito ? 'var(--c-success)' : 'var(--text-muted)',
                fontSize:12, cursor:'pointer', width:'100%', marginBottom:6,
              }}>
              <span>{suscrito ? '🔔' : '🔕'}</span>
              <span>{suscrito ? tt('activeNotifications') : tt('enableNotifications')}</span>
            </button>
          )}
          <button className="btn-logout" onClick={logout}>{tt('logout')}</button>
        </div>
      </aside>

      {/* ── Bottom Navigation (solo mobile < 1024px) ─────────── */}
      <nav className="bottom-nav">
        {bottomLinks.map(link => {
          const IconComponent = Icons[link.icon]
          if (link.isMenu) {
            return (
              <button key="menu" className="bottom-nav-item" onClick={() => setOpen(true)}
                style={{background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                <span className="nav-icon"><IconComponent /></span>
                <span>{tt(link.key)}</span>
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
              <span>{tt(link.key)}</span>
            </NavLink>
          )
        })}
      </nav>


      {/* ── Icon Rail (landscape mobile solamente) ─────────────── */}
      <nav className="landscape-rail">
        {railLinks.map(link => {
          const isActive = link.exact
            ? location.pathname === link.to
            : location.pathname.startsWith(link.to)
          const badge = link.badgeKey === 'alerts' ? alertCount : 0
          return (
            <NavLink key={link.to} to={link.to}
              className={'landscape-rail-item' + (isActive ? ' active' : '')}>
              {link.icon}
              {badge > 0 && (
                <span className="landscape-rail-badge">{badge > 9 ? '9+' : badge}</span>
              )}
            </NavLink>
          )
        })}
        {/* Botón para abrir sidebar completo */}
        <button onClick={() => setOpen(true)}
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            width:44, height:40, borderRadius:8, marginTop:4,
            background:'var(--surface)',
            border:'1px solid var(--border)',
            color:'var(--text-muted)', fontSize:16, cursor:'pointer',
          }}>
          ☰
        </button>
      </nav>

      {busqueda && <BusquedaGlobal onClose={() => setBusqueda(false)} />}
    </>
  )
}
