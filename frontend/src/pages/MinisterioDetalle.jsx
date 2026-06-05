import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import Icons from '../components/Icons.jsx'
import { ConfirmModal } from '../components/Modal.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import MinIcons, { MINISTERIO_ICONS } from './MinIcons.jsx'

const TABS_POR_TIPO = {
  ALABANZA:     ['panel', 'tareas', 'miembros', 'turnos', 'cobertura', 'evaluaciones', 'onboarding', 'canciones', 'setlists', 'archivos', 'checklists'],
  SONIDO:       ['panel', 'tareas', 'miembros', 'turnos', 'cobertura', 'evaluaciones', 'onboarding', 'equipos', 'inventario', 'archivos', 'checklists'],
  PROYECCION:   ['panel', 'tareas', 'miembros', 'turnos', 'cobertura', 'evaluaciones', 'onboarding', 'equipos', 'inventario', 'archivos', 'checklists'],
  NINOS:        ['panel', 'tareas', 'miembros', 'turnos', 'cobertura', 'evaluaciones', 'onboarding', 'salas', 'checkin', 'archivos', 'checklists'],
  MANTENIMIENTO:['panel', 'tareas', 'miembros', 'turnos', 'cobertura', 'evaluaciones', 'onboarding', 'equipos', 'inventario', 'archivos', 'checklists'],
  SEGURIDAD:    ['panel', 'tareas', 'miembros', 'turnos', 'cobertura', 'evaluaciones', 'onboarding', 'equipos', 'inventario', 'archivos', 'checklists'],
  default:      ['panel', 'tareas', 'miembros', 'turnos', 'cobertura', 'evaluaciones', 'onboarding', 'inventario', 'archivos', 'checklists'],
}

const TAB_LABELS = {
  panel:       'Panel',
  tareas:      'Tareas',
  miembros:    'Miembros',
  canciones:   'Repertorio',
  setlists:    'Setlists',
  archivos:    'Archivos',
  checklists:  'Checklists',
  equipos:     'Equipos',
  salas:       'Salas',
  checkin:     'Check-in',
  turnos:      '🗓 Turnos',
  cobertura:   '🔄 Cobertura',
  evaluaciones:'⭐ Evaluaciones',
  inventario:  '📦 Inventario',
  onboarding:  '🧭 Onboarding',
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

// ── Tab Turnos (#11) ─────────────────────────────────────────
const ROLES_TURNO = ['SERVIDOR','COORDINADOR','TECNICO','APOYO']
function TabTurnos({ ministerioId }) {
  const [mes, setMes]         = useState(new Date().toISOString().slice(0,7))
  const [turnos, setTurnos]   = useState([])
  const [miembros, setMiembros] = useState([])
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState({ miembroId:'', fecha:'', rol:'SERVIDOR', notas:'' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTurnos(await apiFetch(`/ministerios/${ministerioId}/turnos?mes=${mes}`) || []) } catch {}
    setLoading(false)
  }, [ministerioId, mes])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/miembros`).then(m => setMiembros(m||[])).catch(()=>{})
  }, [ministerioId])

  async function guardar() {
    if (!form.miembroId || !form.fecha) return toast.error('Completá miembro y fecha')
    try { await apiFetch(`/ministerios/${ministerioId}/turnos`,{method:'POST',body:JSON.stringify(form)}); toast.success('Turno agregado'); setModal(false); setForm({miembroId:'',fecha:'',rol:'SERVIDOR',notas:''}); load() }
    catch(e) { toast.error(e.message) }
  }

  async function toggleConfirmado(t) {
    try { await apiFetch(`/ministerios/${ministerioId}/turnos/${t.id}`,{method:'PUT',body:JSON.stringify({confirmado:!t.confirmado})}); load() }
    catch(e) { toast.error(e.message) }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar turno?')) return
    try { await apiFetch(`/ministerios/${ministerioId}/turnos/${id}`,{method:'DELETE'}); load() }
    catch(e) { toast.error(e.message) }
  }

  // Agrupar por fecha
  const porFecha = turnos.reduce((acc, t) => {
    const k = t.fecha?.slice(0,10) || ''
    ;(acc[k] = acc[k]||[]).push(t)
    return acc
  }, {})

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input type="month" value={mes} onChange={e=>setMes(e.target.value)}
            style={{padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize:13}}/>
          <span style={{fontSize:12,color:'var(--text-muted)'}}>{turnos.length} turnos</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ Agregar turno</button>
      </div>

      {loading ? <p style={{color:'var(--text-muted)'}}>Cargando...</p>
      : Object.keys(porFecha).length === 0
      ? <div style={{textAlign:'center',padding:'32px 0',color:'var(--text-muted)'}}>Sin turnos para este mes</div>
      : Object.entries(porFecha).sort().map(([fecha, ts]) => (
        <div key={fecha} style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:6}}>
            {new Date(fecha+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}
          </div>
          {ts.map(t => (
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg-2)',borderRadius:8,marginBottom:4}}>
              <div style={{width:10,height:10,borderRadius:'50%',flexShrink:0,background:t.confirmado?'var(--c-success)':'var(--c-warning)'}} />
              <div style={{flex:1}}>
                <span style={{fontWeight:600,fontSize:13}}>{t.nombre} {t.apellido}</span>
                <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8,padding:'1px 7px',borderRadius:20,border:'1px solid var(--border)'}}>{t.rol}</span>
                {t.notas && <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>— {t.notas}</span>}
              </div>
              <button onClick={()=>toggleConfirmado(t)}
                style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:'1px solid var(--border)',background:t.confirmado?'var(--c-success-bg)':'var(--bg)',color:t.confirmado?'var(--c-success)':'var(--text-muted)',cursor:'pointer',fontWeight:600}}>
                {t.confirmado ? '✓ Confirmado' : 'Confirmar'}
              </button>
              <button onClick={()=>eliminar(t.id)} style={{background:'none',border:'none',color:'var(--c-danger)',cursor:'pointer',fontSize:16,padding:0}}>×</button>
            </div>
          ))}
        </div>
      ))}

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Agregar turno</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>×</button></div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Miembro *</label>
                <select className="form-input" value={form.miembroId} onChange={e=>setForm(f=>({...f,miembroId:e.target.value}))}>
                  <option value="">— Seleccionar —</option>
                  {miembros.map(m=><option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Fecha *</label>
                  <input type="date" className="form-input" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
                </div>
                <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Rol</label>
                  <select className="form-input" value={form.rol} onChange={e=>setForm(f=>({...f,rol:e.target.value}))}>
                    {ROLES_TURNO.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Notas</label>
                <input className="form-input" placeholder="Opcional..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer" style={{display:'flex',justifyContent:'flex-end',gap:8,padding:'12px 20px'}}>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Evaluaciones (#12) ───────────────────────────────────
const STARS = n => '★'.repeat(n) + '☆'.repeat(5-n)

function TabEvaluaciones({ ministerioId }) {
  const [evals, setEvals]     = useState([])
  const [miembros, setMiembros] = useState([])
  const [modal, setModal]     = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ miembroId:'', tipo:'AUTOEVALUACION', puntualidad:3, compromiso:3, habilidad:3, actitud:3, comentarios:'', periodo:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setEvals(await apiFetch(`/ministerios/${ministerioId}/evaluaciones`) || []) } catch {}
    setLoading(false)
  }, [ministerioId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/miembros`).then(m => setMiembros(m||[])).catch(()=>{})
  }, [ministerioId])

  async function guardar() {
    if (!form.miembroId) return toast.error('Seleccioná un miembro')
    try { await apiFetch(`/ministerios/${ministerioId}/evaluaciones`,{method:'POST',body:JSON.stringify(form)}); toast.success('Evaluación guardada'); setModal(false); load() }
    catch(e) { toast.error(e.message) }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar evaluación?')) return
    try { await apiFetch(`/ministerios/${ministerioId}/evaluaciones/${id}`,{method:'DELETE'}); load() }
    catch(e) { toast.error(e.message) }
  }

  const RangeInput = ({label, campo}) => (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
        <span style={{color:'var(--text-muted)'}}>{label}</span>
        <span style={{color:'#F59E0B',fontWeight:700}}>{STARS(form[campo])}</span>
      </div>
      <input type="range" min={1} max={5} value={form[campo]}
        onChange={e=>setForm(f=>({...f,[campo]:Number(e.target.value)}))}
        style={{width:'100%',accentColor:'#F59E0B'}}/>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>{evals.length} evaluaciones</span>
        <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ Nueva evaluación</button>
      </div>

      {loading ? <p style={{color:'var(--text-muted)'}}>Cargando...</p>
      : evals.length === 0 ? <div style={{textAlign:'center',padding:'32px 0',color:'var(--text-muted)'}}>Sin evaluaciones registradas</div>
      : evals.map(e => {
        const prom = ((Number(e.puntualidad||0)+Number(e.compromiso||0)+Number(e.habilidad||0)+Number(e.actitud||0))/4).toFixed(1)
        return (
          <div key={e.id} style={{background:'var(--bg-2)',borderRadius:10,padding:'12px 14px',marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
              <div>
                <span style={{fontWeight:700,fontSize:13}}>{e.nombre} {e.apellido}</span>
                <span style={{fontSize:11,marginLeft:8,padding:'1px 7px',borderRadius:20,border:'1px solid var(--border)',color:'var(--text-muted)'}}>{e.tipo}</span>
                {e.periodo && <span style={{fontSize:11,marginLeft:6,color:'var(--text-muted)'}}>{e.periodo}</span>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18,fontWeight:800,color:'#F59E0B'}}>{prom}</span>
                <button onClick={()=>eliminar(e.id)} style={{background:'none',border:'none',color:'var(--c-danger)',cursor:'pointer',fontSize:16,padding:0}}>×</button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,fontSize:11,marginBottom:6}}>
              {[['Puntualidad',e.puntualidad],['Compromiso',e.compromiso],['Habilidad',e.habilidad],['Actitud',e.actitud]].map(([l,v])=>(
                <div key={l} style={{textAlign:'center',background:'var(--bg)',borderRadius:6,padding:'4px 6px'}}>
                  <div style={{color:'#F59E0B'}}>{STARS(Number(v||0))}</div>
                  <div style={{color:'var(--text-muted)',marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
            {e.comentarios && <p style={{fontSize:12,color:'var(--text-muted)',margin:0,fontStyle:'italic'}}>"{e.comentarios}"</p>}
          </div>
        )
      })}

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Nueva evaluación</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>×</button></div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Miembro *</label>
                  <select className="form-input" value={form.miembroId} onChange={e=>setForm(f=>({...f,miembroId:e.target.value}))}>
                    <option value="">— Seleccionar —</option>
                    {miembros.map(m=><option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>)}
                  </select>
                </div>
                <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Tipo</label>
                  <select className="form-input" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                    <option value="AUTOEVALUACION">Autoevaluación</option>
                    <option value="LIDER">Por líder</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Período (ej: 2026-Q2)</label>
                  <input className="form-input" placeholder="Opcional" value={form.periodo} onChange={e=>setForm(f=>({...f,periodo:e.target.value}))}/>
                </div>
              </div>
              <div style={{background:'var(--bg-2)',borderRadius:8,padding:'12px'}}>
                <RangeInput label="Puntualidad" campo="puntualidad"/>
                <RangeInput label="Compromiso" campo="compromiso"/>
                <RangeInput label="Habilidad" campo="habilidad"/>
                <RangeInput label="Actitud" campo="actitud"/>
              </div>
              <div><label style={{fontSize:12,color:'var(--text-muted)',display:'block',marginBottom:4}}>Comentarios</label>
                <textarea className="form-input" rows={3} value={form.comentarios} onChange={e=>setForm(f=>({...f,comentarios:e.target.value}))} placeholder="Observaciones..."/>
              </div>
            </div>
            <div className="modal-footer" style={{display:'flex',justifyContent:'flex-end',gap:8,padding:'12px 20px'}}>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}>Guardar evaluación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Inventario (#13) ─────────────────────────────────────
const CAT_COLOR = { INSTRUMENTO:'#6D5DFB', AUDIO:'#3B82F6', VIDEO:'#8B5CF6', MOBILIARIO:'#F59E0B', OTRO:'#64748B' }
const ESTADO_REC_COLOR = { BUENO:'var(--c-success)', REGULAR:'var(--c-warning)', REPARACION:'var(--c-danger)', BAJA:'#94A3B8' }
const CATEGORIAS = ['INSTRUMENTO','AUDIO','VIDEO','MOBILIARIO','OTRO']
const ESTADOS_REC = ['BUENO','REGULAR','REPARACION','BAJA']

function TabInventario({ ministerioId }) {
  const [recursos, setRecursos] = useState([])
  const [miembros, setMiembros] = useState([])
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState(null)
  const [loading, setLoading]   = useState(true)
  const FORM0 = { nombre:'', descripcion:'', categoria:'OTRO', estado:'BUENO', responsableId:'', fechaCompra:'', fechaMantenimiento:'', valorEstimado:'', notas:'' }
  const [form, setForm]         = useState(FORM0)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRecursos(await apiFetch(`/ministerios/${ministerioId}/recursos`) || []) } catch {}
    setLoading(false)
  }, [ministerioId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/miembros`).then(m => setMiembros(m||[])).catch(()=>{})
  }, [ministerioId])

  function openModal(r=null) {
    setEditando(r)
    setForm(r ? {...FORM0,...r,responsableId:r.responsableId||'',fechaCompra:r.fechaCompra?.slice(0,10)||'',fechaMantenimiento:r.fechaMantenimiento?.slice(0,10)||''} : FORM0)
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre?.trim()) return toast.error('El nombre es requerido')
    const body = {...form, responsableId: form.responsableId || null, fechaCompra: form.fechaCompra || null, fechaMantenimiento: form.fechaMantenimiento || null, valorEstimado: form.valorEstimado || null }
    try {
      if (editando) await apiFetch(`/ministerios/${ministerioId}/recursos/${editando.id}`,{method:'PUT',body:JSON.stringify(body)})
      else await apiFetch(`/ministerios/${ministerioId}/recursos`,{method:'POST',body:JSON.stringify(body)})
      toast.success(editando ? 'Recurso actualizado' : 'Recurso agregado')
      setModal(false); load()
    } catch(e) { toast.error(e.message) }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar recurso?')) return
    try { await apiFetch(`/ministerios/${ministerioId}/recursos/${id}`,{method:'DELETE'}); load() }
    catch(e) { toast.error(e.message) }
  }

  // Alertas de mantenimiento próximo
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const alertas = recursos.filter(r => {
    if (!r.fechaMantenimiento) return false
    const d = new Date(r.fechaMantenimiento+'T12:00:00')
    return (d - hoy) / 86400000 <= 14
  })

  return (
    <div>
      {alertas.length > 0 && (
        <div style={{background:'var(--c-warning-bg)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#92400E'}}>
          ⚠️ {alertas.length} recurso(s) con mantenimiento próximo: {alertas.map(a=>a.nombre).join(', ')}
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <span style={{fontSize:12,color:'var(--text-muted)'}}>{recursos.length} recursos</span>
        <button className="btn btn-primary btn-sm" onClick={()=>openModal()}>+ Agregar recurso</button>
      </div>

      {loading ? <p style={{color:'var(--text-muted)'}}>Cargando...</p>
      : recursos.length === 0 ? <div style={{textAlign:'center',padding:'32px 0',color:'var(--text-muted)'}}>Sin recursos en el inventario</div>
      : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:8}}>
          {recursos.map(r => (
            <div key={r.id} style={{background:'var(--bg-2)',borderRadius:10,padding:'12px',border:`1px solid var(--border)`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>{r.nombre}</div>
                  <span style={{fontSize:10,padding:'1px 7px',borderRadius:20,background:CAT_COLOR[r.categoria]+'20',color:CAT_COLOR[r.categoria],fontWeight:600}}>{r.categoria}</span>
                </div>
                <span style={{fontSize:11,fontWeight:700,color:ESTADO_REC_COLOR[r.estado]}}>{r.estado}</span>
              </div>
              {r.descripcion && <p style={{fontSize:11,color:'var(--text-muted)',margin:'4px 0',lineHeight:1.4}}>{r.descripcion}</p>}
              {(r.responsableNombre) && <p style={{fontSize:11,color:'var(--text-muted)',margin:'4px 0'}}>👤 {r.responsableNombre} {r.responsableApellido||''}</p>}
              {r.fechaMantenimiento && <p style={{fontSize:11,color: (new Date(r.fechaMantenimiento+'T12:00:00')-hoy)/86400000<=14 ? 'var(--c-warning)' : 'var(--text-muted)',margin:'4px 0'}}>🔧 Mant: {r.fechaMantenimiento?.slice(0,10)}</p>}
              {r.valorEstimado && <p style={{fontSize:11,color:'var(--text-muted)',margin:'4px 0'}}>💰 ${Number(r.valorEstimado).toLocaleString('es-AR')}</p>}
              <div style={{display:'flex',gap:6,marginTop:8}}>
                <button className="btn btn-ghost btn-sm" style={{flex:1,fontSize:11}} onClick={()=>openModal(r)}>Editar</button>
                <button className="btn btn-ghost btn-sm" style={{color:'var(--c-danger)',fontSize:11}} onClick={()=>eliminar(r.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      }

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{maxWidth:520}}>
            <div className="modal-header"><h3 className="modal-title">{editando?'Editar recurso':'Nuevo recurso'}</h3><button className="btn btn-ghost btn-sm" onClick={()=>setModal(false)}>×</button></div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:10}}>
              <div className="form-group" style={{margin:0}}><label>Nombre *</label><input className="form-input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div className="form-group" style={{margin:0}}><label>Categoría</label>
                  <select className="form-input" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                    {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{margin:0}}><label>Estado</label>
                  <select className="form-input" value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                    {ESTADOS_REC.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{margin:0}}><label>Responsable</label>
                <select className="form-input" value={form.responsableId} onChange={e=>setForm(f=>({...f,responsableId:e.target.value}))}>
                  <option value="">Sin responsable</option>
                  {miembros.map(m=><option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div className="form-group" style={{margin:0}}><label>Fecha compra</label><input type="date" className="form-input" value={form.fechaCompra} onChange={e=>setForm(f=>({...f,fechaCompra:e.target.value}))}/></div>
                <div className="form-group" style={{margin:0}}><label>Próx. mantenimiento</label><input type="date" className="form-input" value={form.fechaMantenimiento} onChange={e=>setForm(f=>({...f,fechaMantenimiento:e.target.value}))}/></div>
                <div className="form-group" style={{margin:0}}><label>Valor estimado $</label><input type="number" className="form-input" value={form.valorEstimado} onChange={e=>setForm(f=>({...f,valorEstimado:e.target.value}))}/></div>
              </div>
              <div className="form-group" style={{margin:0}}><label>Notas</label><textarea className="form-input" rows={2} value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/></div>
            </div>
            <div className="modal-footer" style={{display:'flex',justifyContent:'flex-end',gap:8,padding:'12px 20px'}}>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}>{editando?'Guardar cambios':'Agregar recurso'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Cobertura (#14) ──────────────────────────────────────
const ESTADO_COB_COLOR = { PENDIENTE:'var(--c-warning)', CUBIERTO:'var(--c-success)', SIN_COBERTURA:'var(--c-danger)' }

function TabCobertura({ ministerioId }) {
  const [coberturas, setCoberturas] = useState([])
  const [miembros, setMiembros]     = useState([])
  const [modal, setModal]           = useState(false)
  const [loading, setLoading]       = useState(true)
  const [form, setForm]             = useState({ solicitanteId:'', fecha:'', rol:'SERVIDOR', motivo:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setCoberturas(await apiFetch(`/ministerios/${ministerioId}/coberturas`) || []) } catch {}
    setLoading(false)
  }, [ministerioId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/miembros`).then(m => setMiembros(m||[])).catch(()=>{})
  }, [ministerioId])

  async function crear() {
    if (!form.solicitanteId || !form.fecha) return toast.error('Completá solicitante y fecha')
    try {
      await apiFetch(`/ministerios/${ministerioId}/coberturas`, { method:'POST', body:JSON.stringify(form) })
      toast.success('Pedido de cobertura creado — se notificó al equipo por WhatsApp')
      setModal(false); setForm({ solicitanteId:'', fecha:'', rol:'SERVIDOR', motivo:'' }); load()
    } catch(e) { toast.error(e.message) }
  }

  async function cambiarEstado(c, estado, cubiertoPorId = null) {
    try {
      await apiFetch(`/ministerios/${ministerioId}/coberturas/${c.id}`, { method:'PUT', body:JSON.stringify({ estado, cubiertoPorId }) })
      load()
    } catch(e) { toast.error(e.message) }
  }

  const pendientes = coberturas.filter(c => c.estado === 'PENDIENTE')
  const resueltos  = coberturas.filter(c => c.estado !== 'PENDIENTE')

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ display:'flex', gap:8 }}>
          {pendientes.length > 0 && (
            <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:'var(--c-warning-bg)', color:'var(--c-warning)', fontWeight:700 }}>
              {pendientes.length} pendiente(s)
            </span>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Pedir cobertura</button>
      </div>

      {loading ? <p style={{ color:'var(--text-muted)' }}>Cargando...</p>
      : coberturas.length === 0 ? <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>Sin pedidos de cobertura</div>
      : coberturas.map(c => (
        <div key={c.id} style={{ background:'var(--bg-2)', borderRadius:10, padding:'12px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:13 }}>{c.solicitanteNombre} {c.solicitanteApellido}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              📅 {c.fecha} · {c.rol}
              {c.motivo && <span> — {c.motivo}</span>}
            </div>
            {c.cubiertoPorNombre && (
              <div style={{ fontSize:12, color:'var(--c-success)', marginTop:3 }}>
                ✓ Cubierto por {c.cubiertoPorNombre} {c.cubiertoPorApellido}
              </div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color:ESTADO_COB_COLOR[c.estado], padding:'2px 8px', borderRadius:20, background:ESTADO_COB_COLOR[c.estado]+'18' }}>{c.estado}</span>
            {c.estado === 'PENDIENTE' && (
              <div style={{ display:'flex', gap:4 }}>
                <select
                  onChange={e => { if (e.target.value) cambiarEstado(c, 'CUBIERTO', Number(e.target.value)) }}
                  defaultValue=""
                  style={{ fontSize:11, padding:'3px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', cursor:'pointer' }}>
                  <option value="">Asignar cobertura...</option>
                  {miembros.filter(m => m.id !== c.solicitanteId).map(m => (
                    <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
                  ))}
                </select>
                <button onClick={() => cambiarEstado(c, 'SIN_COBERTURA')}
                  style={{ fontSize:11, padding:'3px 8px', borderRadius:8, border:'1px solid var(--c-danger)', color:'var(--c-danger)', background:'none', cursor:'pointer' }}>
                  Sin cobertura
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Pedir cobertura</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>×</button></div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>¿Quién no puede asistir? *</label>
                <select className="form-input" value={form.solicitanteId} onChange={e => setForm(f => ({...f, solicitanteId:e.target.value}))}>
                  <option value="">— Seleccionar —</option>
                  {miembros.map(m => <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Fecha *</label>
                  <input type="date" className="form-input" value={form.fecha} onChange={e => setForm(f => ({...f, fecha:e.target.value}))} /></div>
                <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Rol</label>
                  <select className="form-input" value={form.rol} onChange={e => setForm(f => ({...f, rol:e.target.value}))}>
                    {['SERVIDOR','COORDINADOR','TECNICO','APOYO'].map(r => <option key={r}>{r}</option>)}
                  </select></div>
              </div>
              <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Motivo</label>
                <input className="form-input" placeholder="Opcional..." value={form.motivo} onChange={e => setForm(f => ({...f, motivo:e.target.value}))} /></div>
              <p style={{ fontSize:11, color:'var(--text-muted)' }}>Se enviará un mensaje de WhatsApp a todos los miembros del ministerio.</p>
            </div>
            <div className="modal-footer" style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px' }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crear}>Crear pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab Onboarding (#15) ─────────────────────────────────────
const ETAPAS_OB = ['FORMULARIO','ENTREVISTA','COMPROMISO','ACTIVO']
const ETAPA_OB_COLOR = { FORMULARIO:'#3B82F6', ENTREVISTA:'#F59E0B', COMPROMISO:'#8B5CF6', ACTIVO:'#22C55E' }

function TabOnboarding({ ministerioId }) {
  const [data, setData]         = useState({ rows:[], dones:[], dias:[] })
  const [miembros, setMiembros] = useState([])
  const [modal, setModal]       = useState(false)
  const [verDetalle, setVerDetalle] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState({ personaId:'', dones:[], disponibilidad:[], notasEntrevista:'' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await apiFetch(`/ministerios/${ministerioId}/onboarding`) || { rows:[], dones:[], dias:[] }) } catch {}
    setLoading(false)
  }, [ministerioId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch(`/ministerios/${ministerioId}/miembros`).then(m => setMiembros(m||[])).catch(()=>{})
  }, [ministerioId])

  function toggleArr(key, val) {
    setForm(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val] }))
  }

  async function guardar() {
    if (!form.personaId) return toast.error('Seleccioná una persona')
    try {
      await apiFetch(`/ministerios/${ministerioId}/onboarding`, { method:'POST', body:JSON.stringify(form) })
      toast.success('Ficha de onboarding guardada')
      setModal(false); setForm({ personaId:'', dones:[], disponibilidad:[], notasEntrevista:'' }); load()
    } catch(e) { toast.error(e.message) }
  }

  async function avanzarEtapa(ob) {
    const idx = ETAPAS_OB.indexOf(ob.etapa)
    if (idx >= ETAPAS_OB.length - 1) return
    const nextEtapa = ETAPAS_OB[idx + 1]
    const firmaCompromiso = nextEtapa === 'ACTIVO'
    try {
      await apiFetch(`/ministerios/${ministerioId}/onboarding/${ob.id}`, { method:'PUT', body:JSON.stringify({ etapa:nextEtapa, firmaCompromiso }) })
      toast.success(`Etapa avanzada a ${nextEtapa}`)
      load()
    } catch(e) { toast.error(e.message) }
  }

  const ChipBtn = ({ label, active, onClick }) => (
    <button type="button" onClick={onClick}
      style={{ padding:'3px 10px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:active?700:400,
        background: active?'var(--primary)':'var(--bg-2)', color: active?'#fff':'var(--text)',
        border: active?'none':'1px solid var(--border)' }}>
      {label}
    </button>
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>{data.rows?.length || 0} voluntarios en proceso</span>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Iniciar onboarding</button>
      </div>

      {loading ? <p style={{ color:'var(--text-muted)' }}>Cargando...</p>
      : (!data.rows?.length) ? <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>Sin procesos de onboarding activos</div>
      : data.rows.map(ob => {
        const donesArr = (() => { try { return JSON.parse(ob.dones||'[]') } catch { return [] } })()
        const diasArr  = (() => { try { return JSON.parse(ob.disponibilidad||'[]') } catch { return [] } })()
        return (
          <div key={ob.id} style={{ background:'var(--bg-2)', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{ob.nombre} {ob.apellido}</div>
                <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
                  {ETAPAS_OB.map((e, i) => {
                    const current = ob.etapa === e
                    const done = ETAPAS_OB.indexOf(ob.etapa) > i
                    return (
                      <span key={e} style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600,
                        background: done ? ETAPA_OB_COLOR[e]+'30' : current ? ETAPA_OB_COLOR[e] : 'var(--bg)',
                        color: done ? ETAPA_OB_COLOR[e] : current ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${done||current ? ETAPA_OB_COLOR[e] : 'var(--border)'}` }}>
                        {done ? '✓ ' : ''}{e}
                      </span>
                    )
                  })}
                </div>
                {donesArr.length > 0 && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Dones: {donesArr.join(', ')}</div>}
                {diasArr.length > 0  && <div style={{ fontSize:11, color:'var(--text-muted)' }}>Disponibilidad: {diasArr.join(', ')}</div>}
                {ob.firmaCompromiso && <div style={{ fontSize:11, color:'var(--c-success)', marginTop:2 }}>✓ Compromiso firmado {ob.fechaFirma?.slice(0,10)}</div>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => setVerDetalle(ob)}>Ver</button>
                {ob.etapa !== 'ACTIVO' && (
                  <button className="btn btn-primary btn-sm" style={{ fontSize:11 }} onClick={() => avanzarEtapa(ob)}>
                    → {ETAPAS_OB[ETAPAS_OB.indexOf(ob.etapa)+1]}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Modal nuevo */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth:500 }}>
            <div className="modal-header"><h3 className="modal-title">🧭 Iniciar onboarding</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>×</button></div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Persona *</label>
                <select className="form-input" value={form.personaId} onChange={e => setForm(f => ({...f, personaId:e.target.value}))}>
                  <option value="">— Seleccionar —</option>
                  {miembros.map(m => <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6, fontWeight:600 }}>Dones espirituales</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {(data.dones||[]).map(d => <ChipBtn key={d} label={d} active={form.dones.includes(d)} onClick={() => toggleArr('dones', d)} />)}
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6, fontWeight:600 }}>Disponibilidad</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {(data.dias||[]).map(d => <ChipBtn key={d} label={d} active={form.disponibilidad.includes(d)} onClick={() => toggleArr('disponibilidad', d)} />)}
                </div>
              </div>
              <div><label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Notas de entrevista</label>
                <textarea className="form-input" rows={3} value={form.notasEntrevista} onChange={e => setForm(f => ({...f, notasEntrevista:e.target.value}))} placeholder="Observaciones del proceso de admisión..."/>
              </div>
            </div>
            <div className="modal-footer" style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 20px' }}>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}>Iniciar proceso</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {verDetalle && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setVerDetalle(null)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">{verDetalle.nombre} {verDetalle.apellido}</h3><button className="btn btn-ghost btn-sm" onClick={() => setVerDetalle(null)}>×</button></div>
            <div className="modal-body">
              <p style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Etapa: <span style={{ color:ETAPA_OB_COLOR[verDetalle.etapa] }}>{verDetalle.etapa}</span></p>
              {verDetalle.dones && <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>Dones: {(() => { try { return JSON.parse(verDetalle.dones).join(', ') } catch { return '—' } })()}</p>}
              {verDetalle.disponibilidad && <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>Disponibilidad: {(() => { try { return JSON.parse(verDetalle.disponibilidad).join(', ') } catch { return '—' } })()}</p>}
              {verDetalle.notasEntrevista && <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>Notas: {verDetalle.notasEntrevista}</p>}
              {verDetalle.firmaCompromiso && <p style={{ fontSize:12, color:'var(--c-success)' }}>✓ Compromiso firmado el {verDetalle.fechaFirma?.slice(0,10)}</p>}
              {verDetalle.asignadoNombre && <p style={{ fontSize:12, color:'var(--text-muted)' }}>Asignado a: {verDetalle.asignadoNombre}</p>}
            </div>
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
      <div className="layout">
        <Menu />
        <main className="main"><div style={S.spinner} /></main>
      </div>
    )
  }

  if (!ministerio) return null

  const tabs = TABS_POR_TIPO[ministerio.tipo] || TABS_POR_TIPO.default
  const color = ministerio.color || '#6B5CFF'
  const IconComponent = MINISTERIO_ICONS[ministerio.tipo] || MinIcons.Building

  return (
    <div className="layout">
      <Menu />
      <main className="main">
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
          {tab === 'turnos'       && <TabTurnos ministerioId={id} />}
          {tab === 'cobertura'    && <TabCobertura ministerioId={id} />}
          {tab === 'evaluaciones' && <TabEvaluaciones ministerioId={id} />}
          {tab === 'inventario'   && <TabInventario ministerioId={id} />}
          {tab === 'onboarding'   && <TabOnboarding ministerioId={id} />}
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
