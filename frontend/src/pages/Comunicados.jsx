import { useEffect, useState, useCallback } from 'react'
import Icons from '../components/Icons.jsx'
import Menu from '../components/Menu.jsx'
import { apiFetch, getUser } from '../services/api.js'

const TIPOS = ['GENERAL','URGENTE','PASTORAL','MINISTERIO','EVENTO','OTRO']
const TCOLOR = {GENERAL:'#2563EB',URGENTE:'#DC2626',PASTORAL:'#16A34A',MINISTERIO:'#7C3AED',EVENTO:'#D97706',OTRO:'#64748B'}
const TBG    = {GENERAL:'#DBEAFE',URGENTE:'#FEE2E2',PASTORAL:'#DCFCE7',MINISTERIO:'#EDE9FE',EVENTO:'#FEF3C7',OTRO:'#F3F4F6'}

export default function Comunicados() {
  const user = getUser()
  const canCreate = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION'].includes(user?.rol)
  const [data, setData]     = useState([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [pages, setPages]   = useState(1)
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState({titulo:'',contenido:'',tipo:'GENERAL',destinatarios:'TODOS',fijado:0})
  const [msg, setMsg]       = useState(null)
  const [expandido, setExpandido] = useState(null)

  const load = useCallback(async () => {
    try { const r = await apiFetch(`/comunicados?page=${page}&limit=15`); setData(r.data||[]); setTotal(r.total||0); setPages(r.pages||1) } catch {}
  }, [page])
  useEffect(()=>{load()},[load])

  async function handleSave(e) {
    e.preventDefault(); setMsg(null)
    try { await apiFetch('/comunicados',{method:'POST',body:JSON.stringify(form)}); setModal(false); setForm({titulo:'',contenido:'',tipo:'GENERAL',destinatarios:'TODOS',fijado:0}); load() }
    catch(err){setMsg({type:'error',text:err.message})}
  }
  async function archivar(id) { try { await apiFetch(`/comunicados/${id}`,{method:'DELETE'}); load() } catch(e){alert(e.message)} }

  return (
    <div className="layout"><Menu />
      <main className="main">
        <div className="page-header">
          <div><h1 className="page-title"><Icons.Comunicados /> Comunicados</h1><p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>Novedades internas del equipo</p></div>
          {canCreate&&<button className="btn btn-primary" data-tip="Publicar nuevo comunicado al equipo" onClick={()=>{setModal(true);setMsg(null)}}>+ Nuevo</button>}
        </div>
        {data.length===0 ? <div className="empty"><div className="empty-icon"><Icons.Comunicados /></div><p>Sin comunicados</p></div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {data.map(c=>(
                <div key={c.id} className="card" style={{padding:'16px 20px',borderLeft:`3px solid ${TCOLOR[c.tipo]||'#2563EB'}`}}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start',justifyContent:'space-between'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6,flexWrap:'wrap'}}>
                        {c.fijado?<span style={{fontSize:11,fontWeight:700,color:'var(--c-warning)'}}>📌 FIJADO</span>:null}
                        <span style={{padding:'2px 8px',borderRadius:3,fontSize:11,fontWeight:600,background:TBG[c.tipo],color:TCOLOR[c.tipo]}}>{c.tipo}</span>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{c.createdAt?.slice(0,10)} · {c.autorNombre}</span>
                      </div>
                      <h3 style={{fontSize:15,fontWeight:700,margin:'0 0 6px'}}>{c.titulo}</h3>
                      <p style={{fontSize:13,color:'var(--text-muted)',margin:0,lineHeight:1.6,overflow:'hidden',maxHeight:expandido===c.id?'none':'3.2em'}}>{c.contenido}</p>
                      {c.contenido?.length>120&&<button onClick={()=>setExpandido(expandido===c.id?null:c.id)} style={{background:'none',border:'none',color:'var(--primary)',fontSize:12,cursor:'pointer',padding:'4px 0',fontWeight:600}}>{expandido===c.id?'Ver menos ↑':'Ver más ↓'}</button>}
                    </div>
                    {(c.userId===user?.id||user?.rol==='PASTOR_GENERAL')&&<button className="btn btn-ghost btn-sm" data-tip="Archivar este comunicado (no se elimina)" onClick={()=>archivar(c.id)} style={{flexShrink:0,color:'var(--text-muted)'}}>Archivar</button>}
                  </div>
                </div>
              ))}
            </div>
        }
        {pages>1&&<div className="pagination"><span className="pag-info">Pág {page}/{pages} · {total}</span><button className="pag-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>←</button><button className="pag-btn" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>→</button></div>}
        {modal&&(
          <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
            <div className="modal">
              <div className="modal-header"><h3 className="modal-title"><Icons.Comunicados /> Nuevo comunicado</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>✕</button></div>
              <form onSubmit={handleSave}>
                <div className="modal-body">
                  {msg&&<div className={`alert alert-${msg.type}`}>{msg.text}</div>}
                  <div className="form-grid">
                    <div className="form-group full"><label>Título *</label><input name="titulo" className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} required/></div>
                    <div className="form-group"><label>Tipo</label><select name="tipo" className="form-input" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
                    <div className="form-group"><label>Para</label><select name="destinatarios" className="form-input" value={form.destinatarios} onChange={e=>setForm(f=>({...f,destinatarios:e.target.value}))}>{['TODOS','PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF','LIDER'].map(d=><option key={d}>{d}</option>)}</select></div>
                    <div className="form-group full"><label>Contenido *</label><textarea name="contenido" className="form-input" rows={5} value={form.contenido} onChange={e=>setForm(f=>({...f,contenido:e.target.value}))} required/></div>
                    <div className="form-group full"><label style={{display:'flex',gap:10,alignItems:'center',cursor:'pointer',textTransform:'none',letterSpacing:0,fontWeight:400,fontSize:13}}><input name="fijado" type="checkbox" checked={!!form.fijado} onChange={e=>setForm(f=>({...f,fijado:e.target.checked?1:0}))} style={{width:16,height:16,accentColor:'var(--primary)'}}/>📌 Fijar comunicado</label></div>
                  </div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Publicar</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
