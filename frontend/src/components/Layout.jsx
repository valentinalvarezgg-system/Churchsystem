import Menu from './Menu.jsx'

export default function Layout({ title, subtitle, children, actions }) {
  return (
    <>
      <Menu />
      <main className="main-content">
        <div className="page-header" style={{ marginBottom: 32 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{title}</h1>
            {subtitle && <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 15 }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 12 }}>{actions}</div>}
        </div>
        {children}
      </main>
    </>
  )
}
