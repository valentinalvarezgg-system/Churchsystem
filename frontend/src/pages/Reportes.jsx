import { useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getApiUrl } from '../services/api.js'
import { useRealtimeQuery } from '../hooks/useRealtimeQuery.js'

const fmt = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
const pct  = (a, b) => b > 0 ? Math.round(a / b * 100) : 0

export default function Reportes() {
  const navigate  = useNavigate()
  const [tipo, setTipo]     = useState('semanal')
  const [mes, setMes]       = useState(new Date().toISOString().slice(0, 7))
  const { data, loading, error } = useRealtimeQuery(
    'stats',
    () => apiFetch(tipo === 'semanal' ? '/reportes/semanal' : `/reportes/mensual?mes=${mes}`),
    [tipo, mes],
    { intervalMs: 10000 }
  )

  function exportarPDF() {
    const token = localStorage.getItem('token')
    const base  = getApiUrl()
    if (tipo === 'semanal') {
      window.open(`${base}/export/reporte/semanal?token=${token}`, '_blank')
    } else {
      window.open(`${base}/export/reporte/mensual?mes=${mes}&token=${token}`, '_blank')
    }
  }

  function exportarExcel() {
    const token = localStorage.getItem('token')
    const base  = getApiUrl()
    window.open(`${base}/export/excel/personas?token=${token}`, '_blank')
  }

  function imprimirReporte() {
    const c = document.getElementById('reporte-contenido')
    if (!c) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Reporte</title>
    <style>body{font-family:-apple-system,sans-serif;padding:24px;color:#0f172a}
    h1{font-size:22px;font-weight:800;margin-bottom:4px}
    h2{font-size:16px;font-weight:700;margin:20px 0 10px}
    h3{font-size:14px;font-weight:700;margin:0 0 10px}
    .stats{display:flex;gap:12px;margin-bottom:20px}
    .stat{flex:1;padding:12px;border:1px solid #e2e8f0;border-radius:8px}
    .val{font-size:24px;font-weight:800;color:#2563EB}
    .lbl{font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.4px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
    th{background:#f8fafc;padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase}
    td{padding:8px;border-bottom:1px solid #f1f5f9}
    .bar{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:4px}
    .fill{height:100%;border-radius:3px}
    @page{margin:12mm}</style></head>
    <body>${c.innerHTML}</body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  const r = data
  const totalPersonas = r?.totales?.personas || r?.personas?.reduce((a, b) => a + Number(b.total), 0) || 0

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Reports /> Reportes</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              {tipo === 'semanal' ? `Semana ${r?.periodo?.desde || '...'} → ${r?.periodo?.hasta || '...'}` : `Mes ${mes}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {tipo === 'mensual' && (
              <input name="mes" type="month" className="input" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 140 }} />
            )}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[['semanal', 'Esta semana'], ['mensual', 'Mensual']].map(([k, l]) => (
                <button key={k} onClick={() => setTipo(k)} className={tipo === k ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>{l}</button>
              ))}
            </div>
            {r && <>
              <button className="btn btn-ghost btn-sm" data-tip="Imprimir reporte" onClick={imprimirReporte}>🖨️ Imprimir</button>
              <button className="btn btn-ghost btn-sm" data-tip="Exportar membresía en Excel" onClick={exportarExcel}><Icons.Reports /> Excel</button>
              <button className="btn btn-ghost btn-sm" data-tip="Ver lista de membresía en PDF" onClick={exportarPDF}>📄 PDF</button>
            </>}
          </div>
        </div>

        {loading && <div className="empty"><p>Generando reporte...</p></div>}
        {error && (
          <div className="alert alert-error" style={{marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
            <span>{error.message}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Reintentar</button>
          </div>
        )}

        {r && (
          <div id="reporte-contenido">

            {/* Stats cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card" onClick={() => navigate('/personas')} style={{ cursor: 'pointer' }}>
                <div className="stat-val">{r.totales?.personas || totalPersonas}</div>
                <div className="stat-lbl"><Icons.Users /> Personas</div>
              </div>
              <div className="stat-card" onClick={() => navigate('/personas')} style={{ cursor: 'pointer' }}>
                <div className="stat-val" style={{ color: 'var(--c-success)' }}>{r.totales?.activos || 0}</div>
                <div className="stat-lbl"><Icons.Attendance /> Activos</div>
              </div>
              <div className="stat-card" onClick={() => navigate('/personas')} style={{ cursor: 'pointer' }}>
                <div className="stat-val" style={{ color: 'var(--c-warning)' }}>{r.totales?.visitantes || 0}</div>
                <div className="stat-lbl">Visitantes</div>
              </div>
              <div className="stat-card" onClick={() => navigate('/grupos')}>
                <div className="stat-val" style={{ color: 'var(--c-info)' }}>{r.totales?.grupos || 0}</div>
                <div className="stat-lbl"><Icons.Groups /> Grupos</div>
              </div>
              {tipo === 'semanal' && (
                <div className="stat-card">
                  <div className="stat-val" style={{ color: 'var(--c-purple)' }}>{r.seguimientos?.reduce((a, b) => a + Number(b.qty), 0) || 0}</div>
                  <div className="stat-lbl">≡ Seguimientos</div>
                </div>
              )}
            </div>

            {/* Semanal */}
            {tipo === 'semanal' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

                {/* Cultos */}
                {(r.cultos || []).length > 0 && (
                  <div className="card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}><Icons.Attendance /> Cultos de la semana</h3>
                    {(r.cultos || []).map((c, i) => {
                      const p = pct(c.presentes, c.total)
                      const color = p >= 70 ? 'var(--c-success)' : p >= 50 ? 'var(--c-warning)' : 'var(--c-danger)'
                      return (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                            <strong style={{ color }}>{c.presentes}/{c.total} ({p}%)</strong>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 3 }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.fecha}</div>
                        </div>
                      )
                    })}
                    {(r.cultos || []).length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin cultos esta semana</p>}
                  </div>
                )}

                {/* Nuevas personas */}
                <div className="card">
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                    <Icons.Users /> Nuevas personas ({(r.nuevasPersonas || []).length})
                  </h3>
                  {(r.nuevasPersonas || []).length === 0
                    ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin nuevas personas esta semana</p>
                    : (r.nuevasPersonas || []).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => navigate(`/personas/${p.id}`)}>
                        <span style={{ fontSize: 13 }}>{p.nombre} {p.apellido}</span>
                        <span className={`badge badge-${p.estado?.toLowerCase()}`}>{p.estado}</span>
                      </div>
                    ))
                  }
                </div>

                {/* Seguimientos */}
                {(r.seguimientos || []).length > 0 && (
                  <div className="card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>≡ Seguimientos realizados</h3>
                    {(r.seguimientos || []).map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <span>{s.tipo}</span><strong>{s.qty}</strong>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* Mensual */}
            {tipo === 'mensual' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

                {/* Congregación */}
                <div className="card">
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}><Icons.Users /> Congregación</h3>
                  {(r.personas || []).map((p, i) => {
                    const total = (r.personas || []).reduce((a, b) => a + Number(b.total), 0)
                    const p2 = total > 0 ? Math.round(Number(p.total) / total * 100) : 0
                    const color = { ACTIVO: 'var(--c-success)', VISITANTE: 'var(--c-warning)', NUEVO: 'var(--c-info)', INACTIVO: 'var(--text-muted)' }[p.estado] || 'var(--text-muted)'
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span className={`badge badge-${p.estado?.toLowerCase()}`}>{p.estado}</span>
                          <strong style={{ fontSize: 14 }}>{p.total} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>({p2}%)</span></strong>
                        </div>
                        <div style={{ height: 5, background: 'var(--bg-2)', borderRadius: 3 }}>
                          <div style={{ width: `${p2}%`, height: '100%', background: color, borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Asistencia mensual */}
                {(r.asistencia || []).length > 0 && (
                  <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}><Icons.Attendance /> Asistencia del mes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                      {(r.asistencia || []).map((c, i) => {
                        const p = pct(c.presentes, c.total)
                        const color = p >= 70 ? 'var(--c-success)' : p >= 50 ? 'var(--c-warning)' : 'var(--c-danger)'
                        return (
                          <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{c.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{c.fecha}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span>{c.presentes}/{c.total}</span>
                              <strong style={{ color }}>{p}%</strong>
                            </div>
                            <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2 }}>
                              <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 2 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!r && !loading && (
          <div className="empty"><div className="empty-icon"><Icons.Reports /></div><p>Seleccioná un período para generar el reporte</p></div>
        )}
      </main>
    </div>
  )
}
