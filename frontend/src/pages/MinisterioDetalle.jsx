import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import Icons from '../components/Icons.jsx'
import { ConfirmModal } from '../components/Modal.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import MinIcons, { MINISTERIO_ICONS } from './MinIcons.jsx'

const TABS_POR_TIPO = {
  ALABANZA: ['panel', 'tareas', 'miembros', 'canciones', 'setlists', 'archivos', 'checklists'],
  SONIDO: ['panel', 'tareas', 'miembros', 'equipos', 'archivos', 'checklists'],
  PROYECCION: ['panel', 'tareas', 'miembros', 'equipos', 'archivos', 'checklists'],
  NINOS: ['panel', 'tareas', 'miembros', 'salas', 'checkin', 'archivos', 'checklists'],
  MANTENIMIENTO: ['panel', 'tareas', 'miembros', 'equipos', 'archivos', 'checklists'],
  SEGURIDAD: ['panel', 'tareas', 'miembros', 'equipos', 'archivos', 'checklists'],
  default: ['panel', 'tareas', 'miembros', 'archivos', 'checklists'],
}

const TAB_LABELS = {
  panel: 'Panel',
  tareas: 'Tareas',
  miembros: 'Miembros',
  canciones: 'Repertorio',
  setlists: 'Setlists',
  archivos: 'Archivos',
  checklists: 'Checklists',
  equipos: 'Equipos',
  salas: 'Salas',
  checkin: 'Check-in',
}

const PRIOR_COLOR = {
  URGENTE: '#DC2626',
  ALTA: '#D97706',
  MEDIA: '#2563EB',
  BAJA: '#6B7280',
}

const ESTADO_COLOR = {
  PENDIENTE: '#6B7280',
  EN_PROGRESO: '#2563EB',
  COMPLETADA: '#15803D',
  CANCELADA: '#DC2626',
}

const ROL_COLOR = {
  COORDINADOR: '#6B5CFF',
  LIDER: '#10B981',
  SERVIDOR: '#3B82F6',
  LECTURA: '#6B7280',
}

const fmt = iso =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

const initials = name =>
  (name || 'U')
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function TabPanel({ ministerio }) {
  const pendingTasks = ministerio.tareasPendientes ?? 0

  return (
    <div>
      <div style={S.kpiGrid}>
        <div style={S.kpiCard}>
          <MinIcons.Users size={24} color="var(--text-muted)" />
          <span style={S.kpiNum}>{ministerio.totalMiembros ?? 0}</span>
          <span style={S.kpiLabel}>Miembros</span>
        </div>
        <div style={{ ...S.kpiCard, borderColor: pendingTasks > 0 ? 'var(--c-warning-brd, rgba(245,158,11,.35))' : 'var(--border)' }}>
          <MinIcons.CheckSquare size={24} color={pendingTasks > 0 ? 'var(--c-warning)' : 'var(--text-muted)'} />
          <span style={{ ...S.kpiNum, color: pendingTasks > 0 ? 'var(--c-warning)' : 'var(--text)' }}>{pendingTasks}</span>
          <span style={S.kpiLabel}>Tareas pendientes</span>
        </div>
      </div>
      <div style={S.descBox}>
        <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
          {ministerio.descripcion || 'Sin descripción. Editá el ministerio para agregar una.'}
        </p>
      </div>
    </div>
  )
}

function TabTareas({ ministerioId }) {
  const [tareas, setTareas] = useState([])
  const [nueva, setNueva] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setTareas((await apiFetch(`/ministerios/${ministerioId}/tareas`)) || [])
    } finally {
      setLoading(false)
    }
  }, [ministerioId])

  useEffect(() => { cargar() }, [cargar])

  async function crearTarea(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      const tarea = await apiFetch(`/ministerios/${ministerioId}/tareas`, {
        method: 'POST',
        body: JSON.stringify({
          titulo: fd.get('titulo'),
          prioridad: fd.get('prioridad'),
          fechaVence: fd.get('fechaVence') || undefined,
        }),
      })
      setTareas(prev => [tarea, ...prev])
      setNueva(false)
      e.target.reset()
      toast.success('Tarea creada')
    } catch (err) {
      toast.error(err.message || 'No pudimos crear la tarea')
    }
  }

  async function cambiarEstado(id, estado) {
    try {
      const tarea = await apiFetch(`/ministerios/${ministerioId}/tareas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
      })
      setTareas(prev => prev.map(item => (item.id === id ? tarea : item)))
    } catch (err) {
      toast.error(err.message || 'No pudimos actualizar la tarea')
    }
  }

  async function confirmarEliminacion() {
    if (!confirmDeleteId) return
    setDeleting(true)
    try {
      await apiFetch(`/ministerios/${ministerioId}/tareas/${confirmDeleteId}`, { method: 'DELETE' })
      setTareas(prev => prev.filter(item => item.id !== confirmDeleteId))
      toast.success('Tarea eliminada')
      setConfirmDeleteId(null)
    } catch (err) {
      toast.error(err.message || 'No pudimos eliminar la tarea')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={S.tabActions}>
        <button onClick={() => setNueva(value => !value)} style={S.btnPrimary}>
          <MinIcons.Plus size={16} color="#fff" style={{ marginRight: 6 }} />
          Nueva tarea
        </button>
      </div>

      {nueva && (
        <form onSubmit={crearTarea} style={S.formCard}>
          <div style={S.formGrid}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.label}>Título *</label>
              <input name="titulo" style={S.input} placeholder="¿Qué hay que hacer?" autoFocus required />
            </div>
            <div>
              <label style={S.label}>Prioridad</label>
              <select name="prioridad" style={S.input} defaultValue="MEDIA">
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Vence</label>
              <input name="fechaVence" type="date" style={S.input} />
            </div>
          </div>
          <div style={S.formFooter}>
            <button type="submit" style={S.btnPrimary}>Guardar</button>
            <button type="button" onClick={() => setNueva(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </form>
      )}

      {tareas.length === 0 && !nueva ? (
        <div style={S.empty}>
          <MinIcons.CheckSquare size={40} color="var(--text-faint)" />
          <p style={{ color: 'var(--text-muted)' }}>Sin tareas. Todo al día.</p>
        </div>
      ) : (
        <div style={S.list}>
          {tareas.map(tarea => {
            const dueDate = fmt(tarea.fechaVence)
            const completed = tarea.estado === 'COMPLETADA'
            const priorityColor = PRIOR_COLOR[tarea.prioridad] || 'var(--text-muted)'
            const stateColor = ESTADO_COLOR[tarea.estado] || 'var(--text-muted)'
            return (
              <div key={tarea.id} style={{ ...S.tareaCard, opacity: completed ? 0.6 : 1 }}>
                <div style={S.tareaFila1}>
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={() => cambiarEstado(tarea.id, completed ? 'PENDIENTE' : 'COMPLETADA')}
                    style={S.checkbox}
                  />
                  <span
                    style={{
                      ...S.tareaTitulo,
                      textDecoration: completed ? 'line-through' : 'none',
                      color: completed ? 'var(--text-muted)' : 'var(--text)',
                    }}
                  >
                    {tarea.titulo}
                  </span>
                </div>

                <div style={S.tareaFila2}>
                  <span style={{ ...S.badge, color: priorityColor, background: `${priorityColor}18` }}>
                    {tarea.prioridad === 'URGENTE' && (
                      <MinIcons.AlertTriangle size={11} color={priorityColor} style={{ marginRight: 3 }} />
                    )}
                    {tarea.prioridad}
                  </span>
                  <span style={{ ...S.badge, color: stateColor, background: `${stateColor}15` }}>
                    {String(tarea.estado || '').replace('_', ' ')}
                  </span>
                  {dueDate && (
                    <span style={S.fecha}>
                      <MinIcons.Calendar size={11} color="var(--text-faint)" style={{ marginRight: 3 }} />
                      {dueDate}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <button onClick={() => setConfirmDeleteId(tarea.id)} style={S.btnIcono} title="Eliminar">
                    <MinIcons.Trash size={15} color="var(--text-faint)" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmarEliminacion}
        title="Eliminar tarea"
        message="Esta acción quita la tarea del tablero del ministerio."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        loading={deleting}
      />
    </div>
  )
}

function TabMiembros({ ministerioId }) {
  const [miembros, setMiembros] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/miembros`)
      .then(data => setMiembros(data || []))
      .finally(() => setLoading(false))
  }, [ministerioId])

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      {miembros.length === 0 ? (
        <div style={S.empty}>
          <MinIcons.Users size={40} color="var(--text-faint)" />
          <p style={{ color: 'var(--text-muted)' }}>Sin miembros asignados</p>
        </div>
      ) : (
        <div style={S.list}>
          {miembros.map(miembro => (
            <div key={miembro.id} style={S.memberCard}>
              <div style={{ ...S.avatar, background: `${ROL_COLOR[miembro.rol] || '#6B7280'}20`, color: ROL_COLOR[miembro.rol] || '#6B7280' }}>
                {initials(miembro.userName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {miembro.userName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {miembro.email}
                </div>
              </div>
              <span style={{ ...S.badge, color: ROL_COLOR[miembro.rol] || '#6B7280', background: `${ROL_COLOR[miembro.rol] || '#6B7280'}18`, flexShrink: 0 }}>
                {miembro.rol}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabCanciones({ ministerioId }) {
  const [canciones, setCanciones] = useState([])
  const [nueva, setNueva] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/canciones`)
      .then(data => setCanciones(data || []))
      .finally(() => setLoading(false))
  }, [ministerioId])

  async function crear(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      const cancion = await apiFetch(`/ministerios/${ministerioId}/canciones`, {
        method: 'POST',
        body: JSON.stringify({
          titulo: fd.get('titulo'),
          artista: fd.get('artista') || undefined,
          tonalidad: fd.get('tonalidad') || undefined,
          bpm: fd.get('bpm') || undefined,
        }),
      })
      setCanciones(prev => [...prev, cancion])
      setNueva(false)
      e.target.reset()
      toast.success('Canción agregada')
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar la canción')
    }
  }

  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm']

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={S.tabActions}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{canciones.length} canciones</span>
        <button onClick={() => setNueva(value => !value)} style={S.btnPrimary}>
          <MinIcons.Plus size={16} color="#fff" style={{ marginRight: 6 }} />
          Agregar
        </button>
      </div>

      {nueva && (
        <form onSubmit={crear} style={S.formCard}>
          <div style={S.formGrid}>
            <div>
              <label style={S.label}>Título *</label>
              <input name="titulo" style={S.input} placeholder="Nombre de la canción" autoFocus required />
            </div>
            <div>
              <label style={S.label}>Artista</label>
              <input name="artista" style={S.input} placeholder="Chris Tomlin..." />
            </div>
            <div>
              <label style={S.label}>Tonalidad</label>
              <select name="tonalidad" style={S.input}>
                <option value="">—</option>
                {notes.map(note => <option key={note} value={note}>{note}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>BPM</label>
              <input name="bpm" type="number" style={S.input} placeholder="76" min="40" max="220" />
            </div>
          </div>
          <div style={S.formFooter}>
            <button type="submit" style={S.btnPrimary}>Guardar</button>
            <button type="button" onClick={() => setNueva(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </form>
      )}

      {canciones.length === 0 && !nueva ? (
        <div style={S.empty}>
          <MinIcons.Music size={40} color="var(--text-faint)" />
          <p style={{ color: 'var(--text-muted)' }}>El repertorio está vacío</p>
        </div>
      ) : (
        <div style={S.list}>
          {canciones.map(cancion => (
            <div key={cancion.id} style={S.cancionCard}>
              <MinIcons.Music size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{cancion.titulo}</span>
                {cancion.artista && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>{cancion.artista}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {cancion.tonalidad && <span style={S.badge}>{cancion.tonalidad}</span>}
                {cancion.bpm && <span style={{ ...S.badge, background: 'var(--bg)' }}>{cancion.bpm} BPM</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabEquipos({ ministerioId }) {
  const [equipos, setEquipos] = useState([])
  const [nuevo, setNuevo] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/equipos`)
      .then(data => setEquipos(data || []))
      .finally(() => setLoading(false))
  }, [ministerioId])

  async function crear(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      const equipo = await apiFetch(`/ministerios/${ministerioId}/equipos`, {
        method: 'POST',
        body: JSON.stringify({
          nombre: fd.get('nombre'),
          tipo: fd.get('tipo') || undefined,
          marca: fd.get('marca') || undefined,
          modelo: fd.get('modelo') || undefined,
          ubicacion: fd.get('ubicacion') || undefined,
        }),
      })
      setEquipos(prev => [...prev, equipo])
      setNuevo(false)
      e.target.reset()
      toast.success('Equipo agregado')
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar el equipo')
    }
  }

  async function cambiarEstado(id, estado) {
    try {
      const equipo = await apiFetch(`/ministerios/${ministerioId}/equipos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
      })
      setEquipos(prev => prev.map(item => (item.id === id ? equipo : item)))
    } catch (err) {
      toast.error(err.message || 'No pudimos actualizar el estado')
    }
  }

  const equipmentStateColors = {
    OPERATIVO: '#15803D',
    FALLA: '#DC2626',
    MANTENIMIENTO: '#D97706',
    BAJA: '#6B7280',
  }

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={S.tabActions}>
        <button onClick={() => setNuevo(value => !value)} style={S.btnPrimary}>
          <MinIcons.Plus size={16} color="#fff" style={{ marginRight: 6 }} />
          Agregar equipo
        </button>
      </div>

      {nuevo && (
        <form onSubmit={crear} style={S.formCard}>
          <div style={S.formGrid}>
            <div>
              <label style={S.label}>Nombre *</label>
              <input name="nombre" style={S.input} placeholder="Consola Yamaha QL5" autoFocus required />
            </div>
            <div>
              <label style={S.label}>Tipo</label>
              <input name="tipo" style={S.input} placeholder="consola, micrófono..." />
            </div>
            <div>
              <label style={S.label}>Marca</label>
              <input name="marca" style={S.input} placeholder="Yamaha, Shure..." />
            </div>
            <div>
              <label style={S.label}>Modelo</label>
              <input name="modelo" style={S.input} placeholder="QL5, SM58..." />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.label}>Ubicación</label>
              <input name="ubicacion" style={S.input} placeholder="Sala principal, depósito..." />
            </div>
          </div>
          <div style={S.formFooter}>
            <button type="submit" style={S.btnPrimary}>Guardar</button>
            <button type="button" onClick={() => setNuevo(false)} style={S.btnSec}>Cancelar</button>
          </div>
        </form>
      )}

      {equipos.length === 0 && !nuevo ? (
        <div style={S.empty}>
          <MinIcons.Package size={40} color="var(--text-faint)" />
          <p style={{ color: 'var(--text-muted)' }}>Sin equipos en el inventario</p>
        </div>
      ) : (
        <div style={S.list}>
          {equipos.map(equipo => (
            <div key={equipo.id} style={S.equipoCard}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{equipo.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {[equipo.tipo, equipo.marca, equipo.modelo].filter(Boolean).join(' · ')}
                  {equipo.ubicacion ? ` — ${equipo.ubicacion}` : ''}
                </div>
              </div>
              <select
                value={equipo.estado}
                onChange={e => cambiarEstado(equipo.id, e.target.value)}
                style={{
                  ...S.input,
                  width: 'auto',
                  marginBottom: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: equipmentStateColors[equipo.estado] || 'var(--text-muted)',
                  borderColor: `${equipmentStateColors[equipo.estado] || '#6B7280'}50`,
                  flexShrink: 0,
                }}
              >
                {['OPERATIVO', 'FALLA', 'MANTENIMIENTO', 'BAJA'].map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabChecklists({ ministerioId }) {
  const [checklists, setChecklists] = useState([])
  const [nuevo, setNuevo] = useState(false)
  const [itemsTexto, setItemsTexto] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/checklists`)
      .then(data => setChecklists(data || []))
      .finally(() => setLoading(false))
  }, [ministerioId])

  async function crear(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const items = itemsTexto.split('\n').map(text => text.trim()).filter(Boolean)
    try {
      const checklist = await apiFetch(`/ministerios/${ministerioId}/checklists`, {
        method: 'POST',
        body: JSON.stringify({ nombre: fd.get('nombre'), tipo: fd.get('tipo'), items }),
      })
      setChecklists(prev => [checklist, ...prev])
      setNuevo(false)
      setItemsTexto('')
      e.target.reset()
      toast.success('Checklist creado')
    } catch (err) {
      toast.error(err.message || 'No pudimos crear el checklist')
    }
  }

  async function toggleItem(checklistId, itemId, completado) {
    try {
      await apiFetch(`/ministerios/${ministerioId}/checklists/${checklistId}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ completado }),
      })
      setChecklists(prev =>
        prev.map(checklist => {
          if (checklist.id !== checklistId) return checklist
          return {
            ...checklist,
            items: (checklist.items || []).map(item => (item.id === itemId ? { ...item, completado } : item)),
          }
        }),
      )
    } catch (err) {
      toast.error(err.message || 'No pudimos actualizar el ítem')
    }
  }

  if (loading) return <div style={S.spinner} />

  return (
    <div>
      <div style={S.tabActions}>
        <button onClick={() => setNuevo(value => !value)} style={S.btnPrimary}>
          <MinIcons.Plus size={16} color="#fff" style={{ marginRight: 6 }} />
          Nuevo checklist
        </button>
      </div>

      {nuevo && (
        <div style={S.formCard}>
          <form onSubmit={crear}>
            <div style={S.formGrid}>
              <div>
                <label style={S.label}>Nombre *</label>
                <input name="nombre" style={S.input} placeholder="Checklist pre-culto sonido" autoFocus required />
              </div>
              <div>
                <label style={S.label}>Tipo</label>
                <select name="tipo" style={S.input}>
                  <option value="CULTO">Por culto</option>
                  <option value="EVENTO">Por evento</option>
                  <option value="SEMANAL">Semanal</option>
                </select>
              </div>
            </div>
            <label style={S.label}>Ítems (uno por línea)</label>
            <textarea
              value={itemsTexto}
              onChange={e => setItemsTexto(e.target.value)}
              style={{ ...S.input, height: 96, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
              placeholder={'Verificar consola\nProbar micrófonos\nChequear monitores'}
            />
            <div style={S.formFooter}>
              <button type="submit" style={S.btnPrimary}>Crear</button>
              <button type="button" onClick={() => setNuevo(false)} style={S.btnSec}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {checklists.length === 0 && !nuevo ? (
        <div style={S.empty}>
          <MinIcons.CheckSquare size={40} color="var(--text-faint)" />
          <p style={{ color: 'var(--text-muted)' }}>Sin checklists todavía</p>
        </div>
      ) : (
        <div style={S.list}>
          {checklists.map(checklist => {
            const items = checklist.items || []
            const completedItems = items.filter(item => item.completado).length
            const progress = items.length ? Math.round((completedItems / items.length) * 100) : 0
            return (
              <div key={checklist.id} style={S.clCard}>
                <div style={S.clHeader}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{checklist.nombre}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{checklist.tipo}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, color: progress === 100 ? '#15803D' : 'var(--text-muted)' }}>
                    {completedItems}/{items.length}
                  </span>
                </div>

                <div style={S.progressBar}>
                  <div
                    style={{
                      ...S.progressFill,
                      width: `${progress}%`,
                      background: progress === 100 ? '#15803D' : '#6B5CFF',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(item => (
                    <label key={item.id} style={S.checklistItemLabel}>
                      <input
                        type="checkbox"
                        checked={item.completado}
                        onChange={e => toggleItem(checklist.id, item.id, e.target.checked)}
                        style={{ ...S.checkbox, marginTop: 2 }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: item.completado ? 'var(--text-muted)' : 'var(--text)',
                          textDecoration: item.completado ? 'line-through' : 'none',
                          lineHeight: 1.5,
                          flex: 1,
                        }}
                      >
                        {item.texto}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabArchivos({ ministerioId }) {
  const [drive, setDrive] = useState({ files: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [folderUrl, setFolderUrl] = useState('')
  const [folderLabel, setFolderLabel] = useState('')
  const [filter, setFilter] = useState('TODOS')

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch(`/ministerios/${ministerioId}/drive`)
      setDrive(data || { files: [] })
      setFolderUrl(data?.folderUrl || data?.folderId || '')
      setFolderLabel(data?.folderLabel || '')
    } finally {
      setLoading(false)
    }
  }, [ministerioId])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await apiFetch(`/ministerios/${ministerioId}/drive`, {
        method: 'PUT',
        body: JSON.stringify({
          folderUrl,
          folderLabel,
        }),
      })
      setDrive(prev => ({ ...prev, ...data }))
      await cargar()
      toast.success('Carpeta de Drive guardada')
    } catch (err) {
      toast.error(err.message || 'No pudimos guardar la carpeta')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={S.spinner} />

  const files = drive.files || []
  const categories = ['TODOS', ...new Set(files.map(file => file.categoryLabel || 'Archivo'))]
  const visibleFiles = filter === 'TODOS' ? files : files.filter(file => (file.categoryLabel || 'Archivo') === filter)

  return (
    <div>
      <div style={S.driveTop}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: drive.connected ? 'var(--c-success)' : 'var(--c-warning)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>
            {drive.connected ? 'Google Drive conectado' : 'Google Drive no conectado'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            {drive.message || 'Vinculá una carpeta del ministerio para leer partituras, lyrics, riders, cronogramas y checklists.'}
          </div>
        </div>
        <button onClick={cargar} style={S.btnSec} type="button">
          <Icons.Refresh size={16} color="var(--text-muted)" style={{ marginRight: 6 }} />
          Sincronizar
        </button>
      </div>

      {!drive.connected && (
        <div style={{ ...S.empty, marginBottom: 16 }}>
          <MinIcons.FolderOpen size={40} color="var(--text-faint)" />
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: 420 }}>
            Primero conectá Google Drive desde Configuración. Después podés pegar acá la carpeta del ministerio.
          </p>
        </div>
      )}

      <form onSubmit={guardar} style={S.formCard}>
        <div style={S.formGrid}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Carpeta de Google Drive *</label>
            <input
              value={folderUrl}
              onChange={e => setFolderUrl(e.target.value)}
              style={S.input}
              placeholder="Pegá el link de la carpeta o el folder ID"
              required
            />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Nombre interno de la carpeta</label>
            <input
              value={folderLabel}
              onChange={e => setFolderLabel(e.target.value)}
              style={S.input}
              placeholder="Alabanza / Repertorio / Sonido principal"
            />
          </div>
        </div>
        <div style={S.formFooter}>
          <button type="submit" style={S.btnPrimary} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar carpeta'}
          </button>
        </div>
      </form>

      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={S.tabActions}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{files.length} archivos</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  style={{
                    ...S.filterChip,
                    background: filter === cat ? 'var(--primary)' : 'var(--bg-2)',
                    color: filter === cat ? 'var(--surface)' : 'var(--text)',
                    borderColor: filter === cat ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  {cat === 'TODOS' ? 'Todos' : cat}
                </button>
              ))}
            </div>
          </div>

          <div style={S.list}>
            {visibleFiles.map(file => {
              const iconColor = file.category === 'carpeta' ? '#8B5CF6' : file.category === 'cronograma' ? '#2563EB' : file.category === 'produccion' ? '#D97706' : '#6B7280'
              return (
                <div key={file.id} style={S.fileCard}>
                  <div style={{ ...S.fileIcon, color: iconColor, background: `${iconColor}15` }}>
                    <MinIcons.FolderOpen size={16} color={iconColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.title || file.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{file.categoryLabel || 'Archivo'}</span>
                      {file.modifiedTime && <span>· {fmt(file.modifiedTime)}</span>}
                      {file.sizeLabel && <span>· {file.sizeLabel}</span>}
                    </div>
                  </div>
                  <a
                    href={file.webViewLink || file.webContentLink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    style={S.btnIcono}
                  >
                    <Icons.External size={15} color="var(--text-faint)" />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MinisterioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ministerio, setMinisterio] = useState(null)
  const [tab, setTab] = useState('panel')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/ministerios/${id}`)
      .then(data => setMinisterio(data))
      .catch(() => {
        toast.error('Ministerio no encontrado')
        navigate('/ministerios')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) {
    return (
      <div style={S.page}>
        <Menu />
        <main style={S.main}><div style={S.spinner} /></main>
      </div>
    )
  }

  if (!ministerio) return null

  const tabs = TABS_POR_TIPO[ministerio.tipo] || TABS_POR_TIPO.default
  const color = ministerio.color || '#6B5CFF'
  const IconComponent = MINISTERIO_ICONS[ministerio.tipo] || MinIcons.Building

  return (
    <div style={S.page}>
      <Menu />
      <main style={S.main}>
        <div style={S.pageHeader}>
          <button onClick={() => navigate('/ministerios')} style={S.btnBack} aria-label="Volver">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              flexShrink: 0,
              background: `${color}20`,
              border: `2px solid ${color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconComponent size={24} color={color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={S.pageTitle}>{ministerio.nombre}</h1>
            <span style={{ fontSize: 12, color, fontWeight: 600 }}>{String(ministerio.tipo || '').replace('_', ' ')}</span>
          </div>
        </div>

        <div style={S.tabBar}>
          {tabs.map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{
                ...S.tabBtn,
                borderBottomColor: tab === tabKey ? color : 'transparent',
                color: tab === tabKey ? color : 'var(--text-muted)',
                fontWeight: tab === tabKey ? 700 : 500,
              }}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>

        <div style={S.tabContent}>
          {tab === 'panel' && <TabPanel ministerio={ministerio} />}
          {tab === 'tareas' && <TabTareas ministerioId={id} />}
          {tab === 'miembros' && <TabMiembros ministerioId={id} />}
          {tab === 'canciones' && <TabCanciones ministerioId={id} />}
          {tab === 'equipos' && <TabEquipos ministerioId={id} />}
          {tab === 'archivos' && <TabArchivos ministerioId={id} />}
          {tab === 'checklists' && <TabChecklists ministerioId={id} />}
          {tab === 'setlists' && (
            <div style={S.empty}>
              <MinIcons.Music size={40} color="var(--text-faint)" />
              <p style={{ color: 'var(--text-muted)' }}>Setlists disponible en el próximo sprint.</p>
            </div>
          )}
          {tab === 'salas' && (
            <div style={S.empty}>
              <MinIcons.Building size={40} color="var(--text-faint)" />
              <p style={{ color: 'var(--text-muted)' }}>Salas disponible en el próximo sprint.</p>
            </div>
          )}
          {tab === 'checkin' && (
            <div style={S.empty}>
              <MinIcons.Child size={40} color="var(--text-faint)" />
              <p style={{ color: 'var(--text-muted)' }}>Check-in de niños disponible en el próximo sprint.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const S = {
  page: { display:'flex', minHeight:'100vh', background:'var(--bg)', color:'var(--text)' },
  main: { flex:1, padding:'20px 16px 80px', maxWidth:900, margin:'0 auto', width:'100%', boxSizing:'border-box' },
  pageHeader: { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  pageTitle: { margin:0, fontSize:20, fontWeight:800, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  btnBack: {
    background:'none',
    border:'none',
    cursor:'pointer',
    color:'var(--text-muted)',
    padding:6,
    borderRadius:8,
    display:'flex',
    alignItems:'center',
    flexShrink:0,
  },
  tabBar: {
    display:'flex',
    borderBottom:'1px solid var(--border)',
    marginBottom:20,
    overflowX:'auto',
    WebkitOverflowScrolling:'touch',
    scrollbarWidth:'none',
  },
  tabBtn: {
    padding:'10px 14px',
    background:'none',
    border:'none',
    borderBottom:'2px solid',
    cursor:'pointer',
    fontSize:13,
    whiteSpace:'nowrap',
    transition:'all .15s',
    WebkitTapHighlightColor:'transparent',
  },
  tabContent: { minHeight:240 },
  tabActions: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:8 },
  driveTop: {
    display:'flex',
    alignItems:'flex-start',
    justifyContent:'space-between',
    gap:12,
    marginBottom:14,
    padding:'14px 16px',
    border:'1px solid var(--border)',
    borderRadius:14,
    background:'var(--bg-2)',
  },
  kpiGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 },
  kpiCard: {
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderRadius:12,
    padding:'14px 12px',
    display:'flex',
    flexDirection:'column',
    alignItems:'center',
    gap:6,
  },
  kpiNum: { fontSize:28, fontWeight:800, color:'var(--text)', lineHeight:1 },
  kpiLabel: { fontSize:12, color:'var(--text-muted)', textAlign:'center' },
  descBox: { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:14 },
  list: { display:'flex', flexDirection:'column', gap:8 },
  tareaCard: {
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderRadius:12,
    padding:'12px 14px',
    display:'flex',
    flexDirection:'column',
    gap:8,
  },
  tareaFila1: { display:'flex', alignItems:'flex-start', gap:10 },
  tareaFila2: { display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, paddingLeft:28 },
  tareaTitulo: { fontSize:14, fontWeight:600, lineHeight:1.45, flex:1 },
  checkbox: { width:18, height:18, flexShrink:0, cursor:'pointer', accentColor:'#6B5CFF', marginTop:1 },
  badge: { display:'inline-flex', alignItems:'center', fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:6, flexShrink:0 },
  fecha: { display:'inline-flex', alignItems:'center', fontSize:11, color:'var(--text-muted)' },
  filterChip: {
    padding:'7px 10px',
    borderRadius:999,
    border:'1px solid var(--border)',
    fontSize:12,
    fontWeight:700,
    cursor:'pointer',
    whiteSpace:'nowrap',
  },
  fileCard: {
    display:'flex',
    alignItems:'center',
    gap:10,
    padding:'12px 14px',
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderRadius:12,
  },
  fileIcon: {
    width:36,
    height:36,
    borderRadius:10,
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    flexShrink:0,
  },
  btnIcono: {
    background:'none',
    border:'none',
    cursor:'pointer',
    padding:'2px 4px',
    borderRadius:6,
    display:'flex',
    alignItems:'center',
    WebkitTapHighlightColor:'transparent',
  },
  memberCard: {
    display:'flex',
    alignItems:'center',
    gap:12,
    padding:'10px 14px',
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderRadius:12,
  },
  avatar: { width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 },
  cancionCard: {
    display:'flex',
    alignItems:'center',
    gap:10,
    padding:'10px 14px',
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderRadius:12,
  },
  equipoCard: {
    display:'flex',
    alignItems:'center',
    gap:12,
    padding:'12px 14px',
    background:'var(--bg-2)',
    border:'1px solid var(--border)',
    borderRadius:12,
    flexWrap:'wrap',
  },
  clCard: { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:12, padding:16 },
  clHeader: { display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  progressBar: { height:4, background:'var(--border)', borderRadius:2, marginBottom:12 },
  progressFill: { height:'100%', borderRadius:2, transition:'width .3s ease' },
  checklistItemLabel: { display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer' },
  formCard: { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:16 },
  formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:12 },
  formFooter: { display:'flex', gap:8, flexWrap:'wrap' },
  label: { display:'block', fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:5 },
  input: {
    width:'100%',
    padding:'9px 12px',
    fontSize:14,
    background:'var(--bg)',
    border:'1px solid var(--border)',
    borderRadius:9,
    color:'var(--text)',
    outline:'none',
    boxSizing:'border-box',
    WebkitAppearance:'none',
  },
  btnPrimary: {
    display:'inline-flex',
    alignItems:'center',
    padding:'9px 16px',
    background:'#6B5CFF',
    color:'#fff',
    border:'none',
    borderRadius:9,
    cursor:'pointer',
    fontWeight:700,
    fontSize:13,
    WebkitTapHighlightColor:'transparent',
  },
  btnSec: {
    display:'inline-flex',
    alignItems:'center',
    padding:'9px 16px',
    background:'var(--bg-2)',
    color:'var(--text)',
    border:'1px solid var(--border)',
    borderRadius:9,
    cursor:'pointer',
    fontSize:13,
    WebkitTapHighlightColor:'transparent',
  },
  empty: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:180, gap:10, textAlign:'center' },
  spinner: { width:32, height:32, border:'3px solid var(--border)', borderTopColor:'#6B5CFF', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'60px auto' },
}
