import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout.jsx'
import Icons from '../components/Icons.jsx'
import { ConfirmModal } from '../components/Modal.jsx'
import { toast } from '../components/Toast.jsx'
import { apiFetch, getUser } from '../services/api.js'
import './Inventario.css'

const EMPTY_ITEM = {
  nombre: '', codigo: '', seccionId: '', cantidad: 1, stockMinimo: 0,
  estado: 'BUENO', ubicacion: '', responsable: '', observaciones: '',
}
const EMPTY_SECTION = { nombre: '', descripcion: '' }
const STATES = ['NUEVO', 'BUENO', 'REGULAR', 'REPARACION', 'BAJA']
const STATE_LABELS = { NUEVO:'Nuevo', BUENO:'Bueno', REGULAR:'Regular', REPARACION:'En reparación', BAJA:'De baja' }

export default function Inventario() {
  const canManage = ['PASTOR_GENERAL', 'PASTOR_CULTO', 'STAFF'].includes(getUser()?.rol)
  const [data, setData] = useState({ secciones: [], items: [], resumen: {} })
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [itemModal, setItemModal] = useState(false)
  const [sectionModal, setSectionModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editingSection, setEditingSection] = useState(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [sectionForm, setSectionForm] = useState(EMPTY_SECTION)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await apiFetch('/inventario'))
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar el inventario')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (active !== 'all' && !data.secciones.some(s => String(s.id) === String(active))) setActive('all')
  }, [active, data.secciones])

  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return (data.items || []).filter(item => {
      if (active !== 'all' && String(item.seccionId) !== String(active)) return false
      if (!term) return true
      return [item.nombre, item.codigo, item.ubicacion, item.responsable]
        .some(value => String(value || '').toLocaleLowerCase().includes(term))
    })
  }, [active, data.items, search])

  function openItem(item = null) {
    if (!data.secciones.length) return toast.info('Creá una sección antes de agregar artículos')
    setEditingItem(item)
    setItemForm(item ? {
      nombre:item.nombre, codigo:item.codigo || '', seccionId:String(item.seccionId),
      cantidad:item.cantidad, stockMinimo:item.stockMinimo, estado:item.estado,
      ubicacion:item.ubicacion || '', responsable:item.responsable || '', observaciones:item.observaciones || '',
    } : { ...EMPTY_ITEM, seccionId: active === 'all' ? String(data.secciones[0].id) : String(active) })
    setItemModal(true)
  }

  function openSection(section = null) {
    setEditingSection(section)
    setSectionForm(section ? { nombre:section.nombre, descripcion:section.descripcion || '' } : EMPTY_SECTION)
    setSectionModal(true)
  }

  async function saveItem(event) {
    event.preventDefault()
    if (!itemForm.nombre.trim()) return toast.error('Ingresá el nombre del artículo')
    setSaving(true)
    try {
      const path = editingItem ? `/inventario/items/${editingItem.id}` : '/inventario/items'
      await apiFetch(path, { method: editingItem ? 'PUT' : 'POST', body: JSON.stringify(itemForm) })
      toast.success(editingItem ? 'Artículo actualizado' : 'Artículo agregado')
      setItemModal(false)
      await load()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function saveSection(event) {
    event.preventDefault()
    if (!sectionForm.nombre.trim()) return toast.error('Ingresá el nombre de la sección')
    setSaving(true)
    try {
      const path = editingSection ? `/inventario/secciones/${editingSection.id}` : '/inventario/secciones'
      const saved = await apiFetch(path, { method: editingSection ? 'PUT' : 'POST', body: JSON.stringify(sectionForm) })
      toast.success(editingSection ? 'Sección renombrada' : 'Sección creada')
      setSectionModal(false)
      if (!editingSection) setActive(String(saved.id))
      await load()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function removeConfirmed() {
    if (!confirm) return
    try {
      await apiFetch(confirm.type === 'item' ? `/inventario/items/${confirm.value.id}` : `/inventario/secciones/${confirm.value.id}`, { method:'DELETE' })
      toast.success(confirm.type === 'item' ? 'Artículo eliminado' : 'Sección eliminada')
      setConfirm(null)
      await load()
    } catch (err) { toast.error(err.message); setConfirm(null) }
  }

  const activeSection = data.secciones.find(s => String(s.id) === String(active))
  const summaryCards = [
    ['Artículos', data.resumen?.totalItems || 0, 'Archive'],
    ['Unidades', data.resumen?.totalUnidades || 0, 'Inventory'],
    ['Stock bajo', data.resumen?.stockBajo || 0, 'AlertTriangle'],
    ['Requieren atención', data.resumen?.requierenAtencion || 0, 'Tools'],
  ]

  return (
    <Layout title="Inventario físico" subtitle="Controlá equipos, mobiliario, insumos y recursos de la iglesia"
      actions={canManage && <div className="inventory-actions"><button className="btn btn-secondary" onClick={() => openSection()}><Icons.FolderPlus /> Nueva sección</button><button className="btn btn-primary" onClick={() => openItem()}><Icons.Plus /> Nuevo artículo</button></div>}>
      <section className="inventory-summary">
        {summaryCards.map(([label, value, icon]) => { const Icon = Icons[icon]; return <div className="stat-card inventory-stat" key={label}><Icon /><div><strong>{value}</strong><span>{label}</span></div></div> })}
      </section>

      <section className="inventory-workspace">
        <div className="inventory-tabs" role="tablist" aria-label="Secciones del inventario">
          <button className={active === 'all' ? 'active' : ''} onClick={() => setActive('all')}><Icons.Archive /> Todo <span>{data.resumen?.totalItems || 0}</span></button>
          {data.secciones.map(section => <button key={section.id} className={String(active) === String(section.id) ? 'active' : ''} onClick={() => setActive(String(section.id))}><Icons.Folder /> {section.nombre} <span>{section.totalItems}</span></button>)}
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-search"><Icons.Search /><input aria-label="Buscar inventario" placeholder="Buscar por nombre, código, ubicación o responsable" value={search} onChange={e => setSearch(e.target.value)} /></div>
          {activeSection && canManage && <div className="inventory-section-actions"><button className="btn btn-ghost btn-sm" onClick={() => openSection(activeSection)}><Icons.Edit /> Renombrar</button><button className="btn btn-ghost btn-sm danger" onClick={() => setConfirm({ type:'section', value:activeSection })}><Icons.Delete /> Eliminar</button></div>}
        </div>

        {activeSection?.descripcion && <p className="inventory-section-description">{activeSection.descripcion}</p>}
        {loading ? <div className="empty"><div className="spinner-sm" /><p>Cargando inventario...</p></div>
        : !data.secciones.length ? <div className="empty inventory-empty"><Icons.FolderPlus /><h3>Organizá el inventario por secciones</h3><p>Podés crear carpetas como Sonido, Cocina, Librería o Mantenimiento y renombrarlas cuando quieras.</p>{canManage && <button className="btn btn-primary" onClick={() => openSection()}>Crear primera sección</button>}</div>
        : !visibleItems.length ? <div className="empty inventory-empty"><Icons.Archive /><h3>{search ? 'No encontramos coincidencias' : 'Esta sección está vacía'}</h3><p>{search ? 'Probá con otra palabra.' : 'Agregá el primer artículo para empezar el control físico.'}</p>{canManage && !search && <button className="btn btn-primary" onClick={() => openItem()}>Agregar artículo</button>}</div>
        : <div className="inventory-grid">{visibleItems.map(item => {
          const low = item.cantidad <= item.stockMinimo
          const section = data.secciones.find(s => s.id === item.seccionId)
          return <article className="inventory-card" key={item.id}>
            <div className="inventory-card-head"><div className="inventory-card-icon"><Icons.Package /></div><div><h3>{item.nombre}</h3><p>{item.codigo || 'Sin código'} · {section?.nombre}</p></div>{canManage && <div className="inventory-card-actions"><button onClick={() => openItem(item)} aria-label={`Editar ${item.nombre}`}><Icons.Edit /></button><button onClick={() => setConfirm({ type:'item', value:item })} aria-label={`Eliminar ${item.nombre}`}><Icons.Delete /></button></div>}</div>
            <div className="inventory-quantity"><strong>{item.cantidad}</strong><span>unidades</span>{low && <em>Stock bajo</em>}</div>
            <div className="inventory-meta"><span><Icons.CheckCircle /> {STATE_LABELS[item.estado] || item.estado}</span>{item.ubicacion && <span><Icons.MapPin /> {item.ubicacion}</span>}{item.responsable && <span><Icons.User /> {item.responsable}</span>}</div>
            {item.observaciones && <p className="inventory-notes">{item.observaciones}</p>}
          </article>
        })}</div>}
      </section>

      {itemModal && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setItemModal(false)}><form className="modal inventory-modal" onSubmit={saveItem}>
        <div className="modal-header"><h3 className="modal-title">{editingItem ? 'Editar artículo' : 'Nuevo artículo'}</h3><button type="button" className="btn btn-ghost btn-sm" onClick={() => setItemModal(false)}><Icons.X /></button></div>
        <div className="modal-body inventory-form">
          <label className="form-group"><span>Nombre *</span><input autoFocus className="form-input" value={itemForm.nombre} onChange={e => setItemForm(f => ({...f,nombre:e.target.value}))} /></label>
          <div className="inventory-form-row"><label className="form-group"><span>Sección *</span><select className="form-input" value={itemForm.seccionId} onChange={e => setItemForm(f => ({...f,seccionId:e.target.value}))}>{data.secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label><label className="form-group"><span>Código interno</span><input className="form-input" value={itemForm.codigo} onChange={e => setItemForm(f => ({...f,codigo:e.target.value}))} /></label></div>
          <div className="inventory-form-row"><label className="form-group"><span>Cantidad</span><input type="number" min="0" className="form-input" value={itemForm.cantidad} onChange={e => setItemForm(f => ({...f,cantidad:e.target.value}))} /></label><label className="form-group"><span>Stock mínimo</span><input type="number" min="0" className="form-input" value={itemForm.stockMinimo} onChange={e => setItemForm(f => ({...f,stockMinimo:e.target.value}))} /></label></div>
          <div className="inventory-form-row"><label className="form-group"><span>Estado</span><select className="form-input" value={itemForm.estado} onChange={e => setItemForm(f => ({...f,estado:e.target.value}))}>{STATES.map(state => <option key={state} value={state}>{STATE_LABELS[state]}</option>)}</select></label><label className="form-group"><span>Ubicación</span><input className="form-input" placeholder="Ej. Depósito 1" value={itemForm.ubicacion} onChange={e => setItemForm(f => ({...f,ubicacion:e.target.value}))} /></label></div>
          <label className="form-group"><span>Responsable</span><input className="form-input" value={itemForm.responsable} onChange={e => setItemForm(f => ({...f,responsable:e.target.value}))} /></label>
          <label className="form-group"><span>Observaciones</span><textarea className="form-input" rows="3" value={itemForm.observaciones} onChange={e => setItemForm(f => ({...f,observaciones:e.target.value}))} /></label>
        </div><div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setItemModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar artículo'}</button></div>
      </form></div>}

      {sectionModal && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSectionModal(false)}><form className="modal inventory-section-modal" onSubmit={saveSection}>
        <div className="modal-header"><h3 className="modal-title">{editingSection ? 'Editar sección' : 'Nueva sección'}</h3><button type="button" className="btn btn-ghost btn-sm" onClick={() => setSectionModal(false)}><Icons.X /></button></div>
        <div className="modal-body inventory-form"><label className="form-group"><span>Nombre *</span><input autoFocus className="form-input" value={sectionForm.nombre} onChange={e => setSectionForm(f => ({...f,nombre:e.target.value}))} placeholder="Ej. Sonido" /></label><label className="form-group"><span>Descripción</span><textarea className="form-input" rows="3" value={sectionForm.descripcion} onChange={e => setSectionForm(f => ({...f,descripcion:e.target.value}))} /></label></div>
        <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setSectionModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editingSection ? 'Guardar cambios' : 'Crear sección'}</button></div>
      </form></div>}

      <ConfirmModal open={!!confirm} title={confirm?.type === 'item' ? 'Eliminar artículo' : 'Eliminar sección'} message={confirm?.type === 'item' ? `¿Eliminar “${confirm?.value?.nombre}” del inventario?` : `¿Eliminar la sección “${confirm?.value?.nombre}”? Solo se puede eliminar si está vacía.`} confirmLabel="Eliminar" danger onConfirm={removeConfirmed} onClose={() => setConfirm(null)} />
    </Layout>
  )
}
