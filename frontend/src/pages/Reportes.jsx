import { useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch, getApiUrl } from '../services/api.js'
import { useRealtimeQuery } from '../hooks/useRealtimeQuery.js'
import { useOrientation } from '../hooks/useOrientation.js'
import { makeI18n } from '../lib/i18n.js'

const REP_I18N = {
  es: {
    title: 'Reportes',
    week: 'Semana',
    monthly: 'Mensual',
    general: 'General',
    thisWeek: 'Esta semana',
    loadingReport: 'Generando reporte...',
    selectPeriod: 'Seleccioná un período para generar el reporte',
    personas: 'Personas',
    activos: 'Activos',
    visitantes: 'Visitantes',
    grupos: 'Grupos',
    seguimientos: 'Seguimientos',
    cultosPeriodo: 'Cultos del período',
    nuevasPersonas: 'Nuevas personas',
    seguimientosRealizados: 'Seguimientos realizados',
    congregacion: 'Congregación',
    asistenciaMes: 'Asistencia del mes',
    sinCultos: 'Sin cultos en el período',
    sinNuevasPersonas: 'Sin nuevas personas en el período',
    imprimir: 'Imprimir',
    excel: 'Excel',
    pdf: 'PDF',
    month: 'Mes',
    periodo: 'Período',
    semana: 'Semana',
    bimestre: 'Bimestre',
    trimestre: 'Trimestre',
    cuatrimestre: 'Cuatrimestre',
    semestre: 'Semestre',
    anual: 'Anual',
    printReport: 'Imprimir reporte',
    exportExcel: 'Exportar membresía en Excel',
    viewPdf: 'Ver lista de membresía en PDF',
    generatedOn: 'Generado el',
    reportTitle: 'Church System — Reporte',
    brandAlt: 'Church System',
    footer: 'Church System · https://churchsystem.com.ar · Uso interno',
  },
  pt: {
    title: 'Relatórios',
    week: 'Semana',
    monthly: 'Mensal',
    general: 'Geral',
    thisWeek: 'Esta semana',
    loadingReport: 'Gerando relatório...',
    selectPeriod: 'Selecione um período para gerar o relatório',
    personas: 'Pessoas',
    activos: 'Ativos',
    visitantes: 'Visitantes',
    grupos: 'Grupos',
    seguimientos: 'Acompanhamentos',
    cultosPeriodo: 'Cultos do período',
    nuevasPersonas: 'Novas pessoas',
    seguimientosRealizados: 'Acompanhamentos realizados',
    congregacion: 'Congregação',
    asistenciaMes: 'Assistência do mês',
    sinCultos: 'Sem cultos no período',
    sinNuevasPersonas: 'Sem novas pessoas no período',
    imprimir: 'Imprimir',
    excel: 'Excel',
    pdf: 'PDF',
    month: 'Mês',
    periodo: 'Período',
    semana: 'Semana',
    bimestre: 'Bimestre',
    trimestre: 'Trimestre',
    cuatrimestre: 'Quadrimestre',
    semestre: 'Semestre',
    anual: 'Anual',
    printReport: 'Imprimir relatório',
    exportExcel: 'Exportar membrosia em Excel',
    viewPdf: 'Ver lista de membrosia em PDF',
    generatedOn: 'Gerado em',
    reportTitle: 'Church System — Relatório',
    brandAlt: 'Church System',
    footer: 'Church System · https://churchsystem.com.ar · Uso interno',
  },
  en: {
    title: 'Reports',
    week: 'Week',
    monthly: 'Monthly',
    general: 'General',
    thisWeek: 'This week',
    loadingReport: 'Generating report...',
    selectPeriod: 'Select a period to generate the report',
    personas: 'People',
    activos: 'Active',
    visitantes: 'Visitors',
    grupos: 'Groups',
    seguimientos: 'Follow-ups',
    cultosPeriodo: 'Services in the period',
    nuevasPersonas: 'New people',
    seguimientosRealizados: 'Follow-ups completed',
    congregacion: 'Congregation',
    asistenciaMes: 'Monthly attendance',
    sinCultos: 'No services in the period',
    sinNuevasPersonas: 'No new people in the period',
    imprimir: 'Print',
    excel: 'Excel',
    pdf: 'PDF',
    month: 'Month',
    periodo: 'Period',
    semana: 'Week',
    bimestre: 'Two months',
    trimestre: 'Quarter',
    cuatrimestre: 'Four months',
    semestre: 'Semester',
    anual: 'Year',
    printReport: 'Print report',
    exportExcel: 'Export membership to Excel',
    viewPdf: 'View membership list in PDF',
    generatedOn: 'Generated on',
    reportTitle: 'Church System — Report',
    brandAlt: 'Church System',
    footer: 'Church System · https://churchsystem.com.ar · Internal use',
  },
}

const fmt = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
const pct  = (a, b) => b > 0 ? Math.round(a / b * 100) : 0
const PERIODOS = [
  ['semana', 'semana'],
  ['mes', 'month'],
  ['bimestre', 'bimestre'],
  ['trimestre', 'trimestre'],
  ['cuatrimestre', 'cuatrimestre'],
  ['semestre', 'semestre'],
  ['anual', 'anual'],
]

export default function Reportes() {
  const t = makeI18n(REP_I18N)
  const navigate  = useNavigate()
  const { isPhone } = useOrientation()
  const [tipo, setTipo]     = useState('semanal')
  const [mes, setMes]       = useState(new Date().toISOString().slice(0, 7))
  const [periodo, setPeriodo] = useState('semana')
  const { data, loading, error } = useRealtimeQuery(
    'reportes',
    () => apiFetch(
      tipo === 'semanal'
        ? '/reportes/semanal'
        : tipo === 'mensual'
        ? `/reportes/mensual?mes=${mes}`
        : `/reportes/general?periodo=${periodo}`
    ),
    [tipo, mes, periodo],
    { intervalMs: 10000 }
  )

  async function descargar(path, nombre) {
    const token = localStorage.getItem('token')
    const base  = getApiUrl()
    try {
      const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
    a.href = url; a.download = nombre; a.click()
    URL.revokeObjectURL(url)
    } catch {}
  }

  function exportarPDF() {
    if (tipo === 'semanal') {
      descargar('/export/reporte/semanal', 'reporte-semanal.xlsx')
    } else if (tipo === 'mensual') {
      descargar(`/export/reporte/mensual?mes=${mes}`, 'reporte-mensual.xlsx')
    } else {
      imprimirReporte()
    }
  }

  function exportarExcel() {
    descargar('/export/excel/personas', 'membresia.xlsx')
  }

  function imprimirReporte() {
    const c = document.getElementById('reporte-contenido')
    if (!c) return
    const w = window.open('', '_blank')
    if (!w) return
    const logoUrl = 'https://churchsystem.com.ar/logo.png'
    w.document.write(`<!DOCTYPE html><html><head><title>${t('title')}</title>
    <style>body{font-family:-apple-system,sans-serif;padding:24px;color:#0f172a}
    .header{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #2563eb}
    .header img{height:40px;width:auto}
    .header-text h1{font-size:22px;font-weight:800;margin:0}
    .header-text p{font-size:12px;color:#64748B;margin:2px 0 0}
    h2{font-size:16px;font-weight:700;margin:20px 0 10px}
    h3{font-size:14px;font-weight:700;margin:0 0 10px}
    .stats{display:flex;gap:12px;margin-bottom:20px}
    .stat{flex:1;padding:12px;border:1px solid #e2e8f0;border-radius:8px}
    .val{font-size:24px;font-weight:800;color:#2563eb}
    .lbl{font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.4px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
    th{background:#f8fafc;padding:8px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:11px;text-transform:uppercase}
    td{padding:8px;border-bottom:1px solid #f1f5f9}
    .bar{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:4px}
    .fill{height:100%;border-radius:3px}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
    @page{margin:12mm}</style></head>
    <body>
    <div class="header">
      <img src="${logoUrl}" alt="${t('brandAlt')}" onerror="this.style.display='none'"/>
      <div class="header-text">
        <h1>${t('reportTitle')}</h1>
        <p>${t('generatedOn')} ${new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' })}</p>
      </div>
    </div>
    ${c.innerHTML}
    <div class="footer">${t('footer')}</div>
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  const r = data
  const totalPersonas = r?.totales?.personas || r?.personas?.reduce((a, b) => a + Number(b.total), 0) || 0

  return (
    <div className="layout"><Menu />
      <main className="main">
        {/* ── PHONE: header compacto ───────────────────────────── */}
        {isPhone ? (
          <div style={{marginBottom:16}}>
            <h1 className="page-title" style={{marginBottom:6}}><Icons.Reports /> {t('title')}</h1>
            <div style={{overflowX:'auto',display:'flex',gap:6,paddingBottom:4,scrollbarWidth:'none'}}>
              {[['semanal','week'],['mensual','monthly'],['general','general']].map(([k,l]) => (
                <button key={k} onClick={() => setTipo(k)}
                  style={{flexShrink:0,padding:'7px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:13,fontWeight:tipo===k?700:500,
                    background:tipo===k?'var(--primary)':'var(--bg-2)',color:tipo===k?'#fff':'var(--text)'}}>
                  {t(l)}
                </button>
              ))}
              {tipo === 'mensual' && <input name="mes" type="month" className="input" value={mes} onChange={e=>setMes(e.target.value)} style={{width:130,flexShrink:0}}/>}
              {tipo === 'general' && <select className="input" value={periodo} onChange={e=>setPeriodo(e.target.value)} style={{width:130,flexShrink:0}}>{PERIODOS.map(([k,label])=><option key={k} value={k}>{t(label)}</option>)}</select>}
              {r && <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={exportarExcel}><Icons.Reports /> {t('excel')}</button>}
            </div>
          </div>
        ) : (
          /* ── TABLET / DESKTOP: header completo ─────────────── */
          <div className="page-header">
            <div>
              <h1 className="page-title"><Icons.Reports /> {t('title')}</h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                {tipo === 'mensual'
                  ? `${t('month')} ${mes}`
                  : `${r?.periodo?.label || (tipo === 'general' ? t('periodo') : t('week'))} ${r?.periodo?.desde || '...'} → ${r?.periodo?.hasta || '...'}`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {tipo === 'mensual' && (
                <input name="mes" type="month" className="input" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 140 }} />
              )}
              {tipo === 'general' && (
                <select className="input" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ width: 160 }}>
                  {PERIODOS.map(([k, label]) => <option key={k} value={k}>{t(label)}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[['semanal', 'thisWeek'], ['mensual', 'monthly'], ['general', 'general']].map(([k, l]) => (
                  <button key={k} onClick={() => setTipo(k)} className={tipo === k ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>{t(l)}</button>
                ))}
              </div>
              {r && <>
                <button className="btn btn-ghost btn-sm" data-tip={t('printReport')} onClick={imprimirReporte}> {t('imprimir')}</button>
                <button className="btn btn-ghost btn-sm" data-tip={t('exportExcel')} onClick={exportarExcel}><Icons.Reports /> {t('excel')}</button>
                {tipo !== 'general' && <button className="btn btn-ghost btn-sm" data-tip={t('viewPdf')} onClick={exportarPDF}> {t('pdf')}</button>}
              </>}
            </div>
          </div>
        )}

        {loading && <div className="empty"><p>{t('loadingReport')}</p></div>}
        {error && (
          <div className="alert alert-error" style={{marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>
            <span>{error.message}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>{t('retry')}</button>
          </div>
        )}

        {r && (
          <div id="reporte-contenido">

            {/* Stats cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card" onClick={() => navigate('/personas')} style={{ cursor: 'pointer' }}>
                <div className="stat-val">{r.totales?.personas || totalPersonas}</div>
                <div className="stat-lbl"><Icons.Users /> {t('personas')}</div>
              </div>
              <div className="stat-card" onClick={() => navigate('/personas')} style={{ cursor: 'pointer' }}>
                <div className="stat-val" style={{ color: 'var(--c-success)' }}>{r.totales?.activos || 0}</div>
                <div className="stat-lbl"><Icons.Attendance /> {t('activos')}</div>
              </div>
              <div className="stat-card" onClick={() => navigate('/personas')} style={{ cursor: 'pointer' }}>
                <div className="stat-val" style={{ color: 'var(--c-warning)' }}>{r.totales?.visitantes || 0}</div>
                <div className="stat-lbl">{t('visitantes')}</div>
              </div>
              <div className="stat-card" onClick={() => navigate('/grupos')}>
                <div className="stat-val" style={{ color: 'var(--c-info)' }}>{r.totales?.grupos || 0}</div>
                <div className="stat-lbl"><Icons.Groups /> {t('grupos')}</div>
              </div>
              {tipo !== 'mensual' && (
                <div className="stat-card">
                  <div className="stat-val" style={{ color: 'var(--c-purple)' }}>{r.seguimientos?.reduce((a, b) => a + Number(b.qty), 0) || 0}</div>
                  <div className="stat-lbl">≡ {t('seguimientos')}</div>
                </div>
              )}
            </div>

            {/* Semanal */}
            {tipo !== 'mensual' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

                {/* Cultos */}
                {(r.cultos || []).length > 0 && (
                  <div className="card">
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}><Icons.Attendance /> {t('cultosPeriodo')}</h3>
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
                    {(r.cultos || []).length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('sinCultos')}</p>}
                  </div>
                )}

                {/* Nuevas personas */}
                <div className="card">
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                    <Icons.Users /> {t('nuevasPersonas')} ({(r.nuevasPersonas || []).length})
                  </h3>
                  {(r.nuevasPersonas || []).length === 0
                    ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('sinNuevasPersonas')}</p>
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
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>≡ {t('seguimientosRealizados')}</h3>
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
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}><Icons.Users /> {t('congregacion')}</h3>
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
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}><Icons.Attendance /> {t('asistenciaMes')}</h3>
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
          <div className="empty"><div className="empty-icon"><Icons.Reports /></div><p>{t('selectPeriod')}</p></div>
        )}
      </main>
    </div>
  )
}