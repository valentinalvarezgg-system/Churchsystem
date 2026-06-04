import { useEffect, useState } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'

function Kpi({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-lbl">{label}</div>
      <div className="stat-val">{value}</div>
    </div>
  )
}

export default function GodMode() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [mailMsg, setMailMsg] = useState('')
  const [alias, setAlias] = useState('soporte')
  const [mode, setMode] = useState('outbound')

  useEffect(() => {
    apiFetch('/godmode/overview').then(setData).catch(e => setErr(e.message))
  }, [])

  async function sendMailTest() {
    setMailMsg('')
    try {
      const r = await apiFetch('/godmode/mail-test', {
        method: 'POST',
        body: JSON.stringify({ alias, mode }),
      })
      setData(prev => prev ? { ...prev, contactMail: r.contactMail || prev.contactMail } : prev)
      setMailMsg(r?.ok ? `${mode === 'inbound' ? 'Smoke inbound' : 'Smoke outbound'}: ${r.publicEmail} -> ${r.routedTo}` : 'No se pudo enviar prueba')
    } catch (e) {
      setMailMsg(e.message)
    }
  }

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title">GodMode</h1>
            <p className="page-subtitle">Control global de cuentas, cobros, OAuth, correo y estado comercial.</p>
          </div>
        </div>

        {err && <div className="alert alert-error">{err}</div>}
        {!data && !err && <div className="empty"><p>Cargando panel global...</p></div>}

        {data && (
          <div className="page-shell">
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
              <Kpi label="Usuarios" value={data.kpis.totalUsers} />
              <Kpi label="Iglesias" value={data.kpis.totalChurches} />
              <Kpi label="Con pago" value={data.kpis.paidChurches} />
              <Kpi label="Sin pago" value={data.kpis.unpaidChurches} />
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Inbox central</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                {data.mailboxHint?.ownerInboxConfigured
                  ? `Owner inbox: ${data.mailboxHint.ownerInbox}`
                  : 'OWNER_REPORTS_EMAIL no está configurado todavía.'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="form-input" value={alias} onChange={e => setAlias(e.target.value)} style={{ minWidth: 140 }}>
                  {(data.contactMail?.aliases || []).map(item => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <select className="form-input" value={mode} onChange={e => setMode(e.target.value)} style={{ minWidth: 140 }}>
                  <option value="outbound">Smoke outbound</option>
                  <option value="inbound">Smoke inbound</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={sendMailTest}>Ejecutar</button>
              </div>
              {!!mailMsg && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>{mailMsg}</div>}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Estado de contacto</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                Fallback actual: {data.contactMail?.adminFallbackEmail || 'admin@churchsystem.com.ar'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                {(data.contactMail?.aliases || []).map(item => (
                  <div key={item.key} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{item.publicEmail}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                      Destino: {item.targetEmail}
                      <br />
                      {item.usingFallback ? 'Fallback admin activo' : `Configurado via ${item.resolvedFrom}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Planes en uso</h3>
              {(data.plans || []).map(p => <div key={p.plan} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><span>{p.plan}</span><b>{p.total}</b></div>)}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Cuentas OAuth vinculadas</h3>
              <div className="table-wrap"><table><thead><tr><th>Email</th><th>Iglesia</th><th>Proveedor</th></tr></thead><tbody>
                {(data.oauthAccounts || []).slice(0, 20).map(r => <tr key={r.id}><td>{r.email}</td><td>{r.iglesia || '—'}</td><td>{r.oauth_provider}</td></tr>)}
              </tbody></table></div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
