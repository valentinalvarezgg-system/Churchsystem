import Menu from './Menu.jsx'

export default function Layout({ title, subtitle, children, actions }) {
  return (
    <>
      <Menu />
      <main className="main">
        <div className="page-shell">
          <div className="page-header">
            <div style={{ flex: 1 }}>
              <h1 className="page-title">{title}</h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
          </div>
          {children}
        </div>
      </main>
    </>
  )
}
