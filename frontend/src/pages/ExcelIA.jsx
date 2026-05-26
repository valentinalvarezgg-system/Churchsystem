import React, { useState, useRef } from 'react'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'

const CAMPOS_SISTEMA = [
  { key:'nombre',            label:'Nombre *',            req:true },
  { key:'apellido',          label:'Apellido' },
  { key:'email',             label:'Email' },
  { key:'telefono',          label:'Teléfono' },
  { key:'fechaNacimiento',   label:'Fecha nacimiento' },
  { key:'cultoDia',          label:'Culto (día)' },
  { key:'estado',            label:'Estado' },
  { key:'estadoEspiritual',  label:'Estado espiritual' },
  { key:'bautizadoAgua',     label:'Bautizado agua' },
  { key:'bautizadoEspiritu', label:'Bautizado espíritu' },
  { key:'notas',             label:'Notas' },
  { key:'ocupacion',         label:'Ocupación' },
  { key:null,                label:'— Ignorar' },
]

const COLUMNAS_EXPORT = [
  { key:'nombre',          label:'Nombre',           def:true },
  { key:'apellido',        label:'Apellido',          def:true },
  { key:'email',           label:'Email',             def:true },
  { key:'telefono',        label:'Teléfono',          def:true },
  { key:'fechaNacimiento', label:'Fecha nacimiento',  def:true },
  { key:'cultoDia',        label:'Culto',             def:true },
  { key:'estado',          label:'Estado',            def:true },
  { key:'grupoNombre',     label:'Grupo',             def:true },
  { key:'estadoEspiritual',label:'Estado espiritual', def:false },
  { key:'bautizadoAgua',   label:'Bautizado agua',    def:false },
  { key:'bautizadoEspiritu',label:'Bautizado espíritu',def:false },
  { key:'notas',           label:'Notas',             def:false },
  { key:'fechaIngreso',    label:'Fecha ingreso',     def:false },
  { key:'liderNombre',     label:'Líder',             def:false },
]

export default function ExcelIA() {
  const [tab, setTab]     = useState('importar')
  const [paso, setPaso]   = useState(0)
  const [fileB64, setFileB64] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [mapeo, setMapeo] = useState({})
  const [opDup, setOpDup] = useState('saltar')
  const [resultado, setResultado] = useState(null)
  const [preview, setPreview]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]     = useState(null)
  const fileRef = useRef()
  const [colsExport, setColsExport] = useState(()=>COLUMNAS_EXPORT.filter(c=>c.def).map(c=>c.key))
  const [filtroExport, setFiltroExport] = useState({estado:'',cultoDia:''})
  const [nombreArchivo, setNombreArchivo] = useState('personas')

  async function handleFile(e) {
    const f = e.target.files[0]; if (!f) return
    setLoading(true); setMsg(null); setAnalisis(null); setResultado(null)
    const reader = new FileReader()
    reader.onload = async ev => {
      const b64 = ev.target.result.split(',')[1]; setFileB64(b64)
      try {
        const res = await apiFetch('/excel-ia/analizar',{method:'POST',body:JSON.stringify({file:b64})})
        setAnalisis(res); setMapeo(res.mapeo||{}); setPaso(1)
      } catch(err) { setMsg({type:'error',text:err.message}) }
      setLoading(false)
    }
    reader.readAsDataURL(f)
  }

  async function handlePreview() {
    setLoading(true)
    try {
      const res = await apiFetch('/excel-ia/importar',{method:'POST',body:JSON.stringify({file:fileB64,mapeo,opcionDuplicados:opDup,previewOnly:true})})
      setPreview(res); setPaso(2)
    } catch(err){setMsg({type:'error',text:err.message})}
    setLoading(false)
  }

  async function handleImportar() {
    setLoading(true); setMsg(null)
    try { const res = await apiFetch('/excel-ia/importar',{method:'POST',body:JSON.stringify({file:fileB64,mapeo,opcionDuplicados:opDup})}); setResultado(res); setPaso(3) }
    catch(err) { setMsg({type:'error',text:err.message}) }
    setLoading(false)
  }

  async function handleExportar() {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:4000/excel-ia/exportar',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({columnas:colsExport,filtros:filtroExport,nombreArchivo})})
      if (!res.ok) throw new Error('Error exportando')
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href=url; a.download=`${nombreArchivo}-${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch(err) { setMsg({type:'error',text:err.message}) }
    setLoading(false)
  }

  function reiniciar() { setPaso(0); setFileB64(null); setAnalisis(null); setMapeo({}); setResultado(null); setMsg(null); if(fileRef.current) fileRef.current.value='' }

  return (
    <div className="layout">
      <Menu />
      <main className="main">
        <div className="page-header"><h1 className="page-title">📊 Excel con IA</h1></div>
        <div style={{display:'flex',gap:4,marginBottom:20}}>
          {[['importar','📥 Importar'],['exportar','📤 Exportar']].map(([k,l])=>(
            <button key={k} onClick={()=>{setTab(k);setMsg(null)}} className={tab===k?'btn btn-primary':'btn btn-ghost'}>{l}</button>
          ))}
        </div>
        {msg&&<div className={`alert alert-${msg.type}`} style={{marginBottom:16}}>{msg.text}</div>}

        {tab==='importar'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:20,alignItems:'center'}}>
              {['Subir archivo','Mapear columnas','Resultado'].map((s,i)=>(
                <React.Fragment key={s}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,background:paso>i?'var(--c-success)':paso===i?'var(--primary)':'#f1f5f9',color:paso>=i?'var(--surface)':'var(--text-faint)'}}>{paso>i?'✓':i+1}</div>
                    <span style={{fontSize:13,fontWeight:paso===i?600:400,color:paso===i?'var(--primary)':paso>i?'var(--c-success)':'var(--text-muted)'}}>{s}</span>
                  </div>
                  {i<2&&<div style={{flex:1,height:2,background:paso>i?'var(--c-success)':'#f1f5f9',borderRadius:2,maxWidth:60}}/>}
                </React.Fragment>
              ))}
            </div>

            {paso===0&&(
              <div className="card">
                <div style={{textAlign:'center',padding:'40px 20px',border:'2px dashed var(--border)',borderRadius:12,cursor:'pointer'}} onClick={()=>fileRef.current?.click()}>
                  <div style={{fontSize:56,marginBottom:12}}>📊</div>
                  <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>Arrastrá tu planilla o hacé click</h3>
                  <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Acepta .xlsx y .xls — la IA detecta las columnas automáticamente</p>
                  <button className="btn btn-primary" disabled={loading}>{loading?'Analizando...':'Seleccionar archivo'}</button>
                  <input name="file_upload" ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:'none'}}/>
                </div>
              </div>
            )}

            {paso===1&&analisis&&(
              <div>
                <div className="card" style={{marginBottom:16}}>
                  <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
                    <span style={{fontSize:22}}>{analisis.metodo==='ia'?'🤖':'🔍'}</span>
                    <div><h3 style={{fontSize:15,fontWeight:700,margin:0}}>Análisis: {analisis.total} filas · {analisis.columnas?.length} columnas</h3><p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{analisis.metodo==='ia'?`IA · confianza ${Math.round((analisis.confianza||0)*100)}%`:'Mapeo automático'}</p></div>
                  </div>
                  <div style={{display:'flex',gap:16}}>
                    {[['saltar','Saltar duplicados'],['actualizar','Actualizar duplicados']].map(([v,l])=>(
                      <label key={v} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',borderRadius:8,cursor:'pointer',background:opDup===v?'#eff6ff':'var(--bg)',border:opDup===v?'1.5px solid var(--primary)':'1px solid var(--border)'}}>
                        <input name="radio_135" type="radio" checked={opDup===v} onChange={()=>setOpDup(v)} style={{accentColor:'var(--primary)'}}/><span style={{fontSize:13}}>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Mapeo de columnas</h3>
                  <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>Verificá que cada columna esté bien mapeada. Podés cambiar lo que detectó la IA.</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                    {analisis.columnas?.map(col=>(
                      <div key={col} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',borderRadius:8,border:'1px solid var(--border)'}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.3,marginBottom:2}}>Excel</div>
                          <div style={{fontSize:14,fontWeight:600}}>{col}</div>
                          {analisis.muestra?.[0]?.[col]&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Ej: "{String(analisis.muestra[0][col]).slice(0,25)}"</div>}
                        </div>
                        <span style={{fontSize:18,color:'var(--text-faint)'}}>→</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.3,marginBottom:2}}>Sistema</div>
                          <select name="select_154" value={mapeo[col]||''} onChange={e=>setMapeo(m=>({...m,[col]:e.target.value||null}))}
                            style={{width:'100%',padding:'7px 10px',border:`1.5px solid ${mapeo[col]?'var(--primary)':'var(--border)'}`,borderRadius:8,fontSize:13,background:'var(--surface)',outline:'none'}}>
                            {CAMPOS_SISTEMA.map(c=><option key={c.key||'null'} value={c.key||''}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:16,display:'flex',gap:10,justifyContent:'flex-end'}}>
                    <button className="btn btn-ghost" onClick={reiniciar}>← Cambiar archivo</button>
                    <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>{loading?'Analizando...':'Ver preview →'}</button>
                  </div>
                </div>
              </div>
            )}

                        {paso===2&&preview&&!resultado&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginBottom:16}}>
                  {[['var(--c-success-bg)','var(--c-success)','\u2795',preview.nuevos||0,'Nuevas'],
                    ['var(--c-info-bg)','var(--c-info)','\u270f\ufe0f',preview.actualizados||0,'Actualizar'],
                    ['var(--c-warning-bg)','var(--c-warning)','\u23ed',preview.saltados||0,'Saltar'],
                    ['var(--c-danger-bg)','var(--c-danger)','\u274c',preview.errores?.length||0,'Errores'],
                  ].map(([bg,col,ic,val,lab])=>(
                    <div key={lab} style={{background:bg,borderRadius:'var(--r)',padding:'12px 10px',textAlign:'center'}}>
                      <div style={{fontSize:20}}>{ic}</div>
                      <div style={{fontSize:24,fontWeight:800,color:col}}>{val}</div>
                      <div style={{fontSize:11,color:col,textTransform:'uppercase',letterSpacing:.4}}>{lab}</div>
                    </div>
                  ))}
                </div>
                {preview.errores?.length>0&&(
                  <div style={{marginBottom:14,padding:12,background:'var(--c-warning-bg)',borderRadius:'var(--r)',border:'1px solid rgba(217,119,6,.3)'}}>
                    <div style={{fontWeight:700,color:'var(--c-warning)',marginBottom:6,fontSize:13}}>
                      \u26a0\ufe0f {preview.errores.length} filas con problemas
                    </div>
                    {preview.errores.slice(0,5).map((e,i)=>(
                      <div key={i} style={{fontSize:12,color:'var(--c-warning)',marginBottom:2}}>\u2022 {e}</div>
                    ))}
                    {preview.errores.length>5&&<div style={{fontSize:11,color:'var(--text-muted)'}}>...y {preview.errores.length-5} m\u00e1s</div>}
                  </div>
                )}
                {preview.muestra?.length>0&&(
                  <div style={{marginBottom:14,overflowX:'auto'}}>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
                      Primeras {preview.muestra.length} personas:
                    </div>
                    <table style={{minWidth:400,fontSize:12}}>
                      <thead><tr><th>Nombre</th><th>Email</th><th>Tel\u00e9fono</th><th>Estado</th></tr></thead>
                      <tbody>
                        {preview.muestra.map((p,i)=>(
                          <tr key={i}>
                            <td style={{fontWeight:600}}>{p.nombre} {p.apellido}</td>
                            <td style={{color:'var(--text-muted)'}}>{p.email||'\u2014'}</td>
                            <td>{p.telefono||'\u2014'}</td>
                            <td><span style={{padding:'2px 8px',borderRadius:12,fontSize:11,background:'var(--c-info-bg)',color:'var(--c-info)',fontWeight:600}}>{p.estado||'ACTIVO'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                  <button className="btn btn-ghost" onClick={()=>setPaso(1)}>\u2190 Volver</button>
                  <button className="btn btn-primary" onClick={handleImportar} disabled={loading}>
                    {loading?'Importando...':('\u2705 Importar '+( preview.total||0)+' personas')}
                  </button>
                </div>
              </div>
            )}

{paso===3&&resultado&&(
              <div className="card" style={{textAlign:'center',padding:'40px 20px'}}>
                <div style={{fontSize:64,marginBottom:12}}>🎉</div>
                <h2 style={{fontSize:22,fontWeight:800,marginBottom:16}}>¡Importación completada!</h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,maxWidth:400,margin:'0 auto 20px'}}>
                  {[['var(--c-success-bg)','var(--c-green-dark)',resultado.importados,'Creadas'],['var(--c-info-bg)','var(--c-info)',resultado.actualizados,'Actualizadas'],['#f3f4f6','#374151',resultado.saltados,'Saltadas']].map(([bg,c,v,l])=>(
                    <div key={l} style={{background:bg,borderRadius:10,padding:14}}><div style={{fontSize:32,fontWeight:800,color:c}}>{v}</div><div style={{fontSize:12,color:c}}>{l}</div></div>
                  ))}
                </div>
                {resultado.errores?.length>0&&<div style={{margin:'0 auto 16px',maxWidth:500,padding:12,background:'var(--c-warning-bg)',borderRadius:'var(--r)',textAlign:'left',fontSize:12,border:'1px solid rgba(217,119,6,0.3)'}}>{resultado.errores.slice(0,5).map((e,i)=><div key={i}>• {e}</div>)}</div>}
                <button className="btn btn-primary" onClick={reiniciar}>Importar otra planilla</button>
              </div>
            )}
          </div>
        )}

        {tab==='exportar'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16,alignItems:'start'}}>
            <div className="card">
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Columnas a exportar</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>
                {COLUMNAS_EXPORT.map(c=>{
                  const activa = colsExport.includes(c.key)
                  return (
                    <label key={c.key} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',borderRadius:8,cursor:'pointer',background:activa?'#eff6ff':'var(--bg)',border:activa?'1.5px solid var(--primary)':'1px solid var(--border)'}}>
                      <input name="check_195" type="checkbox" checked={activa} style={{accentColor:'var(--primary)',width:16,height:16}} onChange={()=>setColsExport(cols=>activa?cols.filter(k=>k!==c.key):[...cols,c.key])}/>
                      <span style={{fontSize:13,fontWeight:activa?600:400}}>{c.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="card">
                <h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>Filtros</h3>
                <div className="form-group" style={{marginBottom:12}}>
                  <label>Estado</label>
                  <select name="estado" className="form-input" value={filtroExport.estado} onChange={e=>setFiltroExport(f=>({...f,estado:e.target.value}))}>
                    {['','ACTIVO','INACTIVO','VISITANTE','NUEVO'].map(s=><option key={s} value={s}>{s||'Todos'}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{marginBottom:12}}>
                  <label>Nombre del archivo</label>
                  <input name="o" className="form-input" value={nombreArchivo} onChange={e=>setNombreArchivo(e.target.value)}/>
                </div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={handleExportar} disabled={loading||colsExport.length===0}>
                  {loading?'Generando...':'📥 Descargar Excel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
