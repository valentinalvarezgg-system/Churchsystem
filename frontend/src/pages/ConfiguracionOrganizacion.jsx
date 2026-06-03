import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Menu from '../components/Menu.jsx'
import { apiFetch } from '../services/api.js'
import { toast } from '../components/Toast.jsx'
import { ConfirmModal } from '../components/Modal.jsx'

// ─── Constantes ────────────────────────────────────────────────────────────────
const ROLES = ['PASTOR_GENERAL','PASTOR_CULTO','CONSOLIDACION','STAFF','LIDER']
const ROLE_META = {
  PASTOR_GENERAL: { label:'Pastor General', color:'#A78BFA', bg:'rgba(167,139,250,.15)', icon:'👑' },
  PASTOR_CULTO:   { label:'Pastor de Culto', color:'#60A5FA', bg:'rgba(96,165,250,.15)',  icon:'🎤' },
  CONSOLIDACION:  { label:'Consolidación',   color:'#34D399', bg:'rgba(52,211,153,.15)',  icon:'🌱' },
  STAFF:          { label:'Staff',           color:'#FBBF24', bg:'rgba(251,191,36,.15)',  icon:'⚙️' },
  LIDER:          { label:'Líder',           color:'#F87171', bg:'rgba(248,113,113,.15)', icon:'🙌' },
}
const MODULOS = [
  { key:'personas',      label:'Personas',      desc:'Ver y editar miembros' },
  { key:'grupos',        label:'Grupos',         desc:'Gestionar células' },
  { key:'asistencia',    label:'Asistencia',     desc:'Tomar asistencia' },
  { key:'calendario',    label:'Calendario',     desc:'Ver y crear eventos' },
  { key:'mensajes',      label:'Mensajería',     desc:'Enviar mensajes' },
  { key:'alertas',       label:'Alertas',        desc:'Alertas pastorales' },
  { key:'reportes',      label:'Reportes',       desc:'Generar reportes' },
  { key:'discipulado',   label:'Discipulado',    desc:'Seguimiento espiritual' },
  { key:'seguimiento',   label:'Seguimiento',    desc:'Notas pastorales' },
  { key:'historial',     label:'Historial',      desc:'Auditoría de acciones' },
  { key:'consolidacion', label:'Consolidación',  desc:'Nuevos miembros' },
  { key:'comunicados',   label:'Comunicados',    desc:'Novedades internas' },
  { key:'ministerios',   label:'Ministerios',    desc:'Gestión de ministerios' },
  { key:'finanzas',      label:'Finanzas',       desc:'Ver finanzas' },
]
const NIVELES = [
  { val:0, label:'Sin acceso', short:'—',    color:'#EF4444', bg:'rgba(239,68,68,.12)' },
  { val:1, label:'Solo ver',   short:'Ver',  color:'#F59E0B', bg:'rgba(245,158,11,.12)' },
  { val:2, label:'Ver+editar', short:'Edit', color:'#3B82F6', bg:'rgba(59,130,246,.12)' },
  { val:3, label:'Total',      short:'Full', color:'#10B981', bg:'rgba(16,185,129,.12)' },
]
const TABS = [
  { id:'miembros',    label:'Miembros',     icon:'👥' },
  { id:'roles',       label:'Roles',        icon:'🔐' },
  { id:'invitaciones',label:'Invitaciones', icon:'✉️' },
  { id:'sesiones',    label:'Sesiones',     icon:'🖥️' },
]

// ─── Estilos base ───────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight:'100vh', background:'#070C18', color:'#E2E8F0', fontFamily:"'Inter','Sora',sans-serif" },
  inner:  { maxWidth:960, margin:'0 auto', padding:'32px 24px 80px' },
  header: { marginBottom:32 },
  headerTop: { display:'flex', alignItems:'center', gap:12, marginBottom:6 },
  backBtn: { background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:14,
             display:'flex', alignItems:'center', gap:6, padding:'6px 0', transition:'color .15s' },
  title:  { fontSize:26, fontWeight:800, color:'#F1F5F9', margin:0, fontFamily:"'Sora',sans-serif" },
  subtitle:{ fontSize:14, color:'#64748B', margin:'4px 0 0' },
  // Tab bar
  tabBar: { display:'flex', gap:4, borderBottom:'1px solid rgba(255,255,255,.07)',
            marginBottom:32, overflowX:'auto', paddingBottom:0 },
  tab:    { padding:'10px 18px', background:'none', border:'none', cursor:'pointer',
            fontSize:14, fontWeight:500, color:'#64748B', display:'flex', alignItems:'center',
            gap:7, whiteSpace:'nowrap', borderBottom:'2px solid transparent',
            transition:'all .15s', marginBottom:'-1px' },
  tabActive: { color:'#A78BFA', borderBottomColor:'#A78BFA' },
  // Cards
  card:   { background:'rgba(15,23,42,.8)', border:'1px solid rgba(255,255,255,.07)',
            borderRadius:16, padding:'20px 24px', marginBottom:16 },
  cardSm: { background:'rgba(15,23,42,.8)', border:'1px solid rgba(255,255,255,.07)',
            borderRadius:12, padding:'14px 18px', marginBottom:10 },
  // Inputs
  input:  { width:'100%', padding:'11px 14px', fontSize:14, background:'rgba(15,23,42,.9)',
            border:'1.5px solid rgba(255,255,255,.08)', borderRadius:10, color:'#F1F5F9',
            outline:'none', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .2s' },
  label:  { display:'block', fontSize:11, fontWeight:700, color:'#94A3B8', marginBottom:6,
            textTransform:'uppercase', letterSpacing:'.8px' },
  // Buttons
  btnPrimary: { padding:'10px 20px', fontSize:14, fontWeight:700,
    background:'linear-gradient(135deg,#6B5CFF,#4845D2)', color:'white',
    border:'none', borderRadius:10, cursor:'pointer', transition:'opacity .15s' },
  btnGhost: { padding:'9px 18px', fontSize:13, fontWeight:600, background:'transparent',
    color:'#94A3B8', border:'1px solid rgba(255,255,255,.1)', borderRadius:10,
    cursor:'pointer', transition:'all .15s' },
  btnDanger: { padding:'9px 18px', fontSize:13, fontWeight:600, background:'rgba(239,68,68,.1)',
    color:'#F87171', border:'1px solid rgba(239,68,68,.25)', borderRadius:10,
    cursor:'pointer', transition:'all .15s' },
  // Avatar
  avatar: { width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0 },
  // Badge
  badge:  { display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700,
            padding:'3px 10px', borderRadius:99, letterSpacing:'.3px' },
  // Row
  row:    { display:'flex', alignItems:'center', gap:14, padding:'14px 0',
            borderBottom:'1px solid rgba(255,255,255,.05)' },
  // Section label
  sectionLabel: { fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
                  letterSpacing:'1px', marginBottom:12 },
  // Nivel chip
  nivelChip: { display:'inline-flex', alignItems:'center', justifyContent:'center',
               width:64, padding:'4px 0', borderRadius:6, fontSize:11, fontWeight:700,
               cursor:'pointer', transition:'all .15s', userSelect:'none' },
  // Stat box
  stat: { background:'rgba(255,255,255,.03)', borderRadius:10, padding:'12px 16px',
          flex:1, minWidth:100 },
  statNum: { fontSize:24, fontWeight:800, color:'#A78BFA', lineHeight:1 },
  statLabel: { fontSize:11, color:'#64748B', marginTop:4, textTransform:'uppercase', letterSpacing:'.5px' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function Avatar({ nombre, email, size=40 }) {
  const initials = (nombre || email || '?').slice(0,2).toUpperCase()
  const colors = [
    ['#6B5CFF','#1e1b4b'],['#3B82F6','#1e3a5f'],['#10B981','#064e3b'],
    ['#F59E0B','#451a03'],['#EC4899','#500724'],['#8B5CF6','#2e1065'],
  ]
  const idx = (nombre||email||'').charCodeAt(0) % colors.length
  const [fg, bg] = colors[idx]
  return (
    <div style={{...S.avatar, width:size, height:size, fontSize:size*.38,
      background:bg, color:fg, border:`1.5px solid ${fg}33`}}>
      {initials}
    </div>
  )
}

function RolBadge({ rol }) {
  const m = ROLE_META[rol] || { label:rol, color:'#94A3B8', bg:'rgba(148,163,184,.15)', icon:'👤' }
  return (
    <span style={{...S.badge, color:m.color, background:m.bg}}>
      <span>{m.icon}</span> {m.label}
    </span>
  )
}

function NivelButton({ val, current, onChange }) {
  const n = NIVELES[val]
  const active = current === val
  return (
    <span
      onClick={() => onChange(val)}
      style={{...S.nivelChip, color:active?n.color:'#475569',
        background:active?n.bg:'transparent',
        border:`1px solid ${active?n.color+'44':'rgba(255,255,255,.07)'}`,
        transform:active?'scale(1.05)':'scale(1)'}}
      title={n.label}
    >
      {n.short}
    </span>
  )
}

// ─── Tab: Miembros ──────────────────────────────────────────────────────────────
function TabMiembros({ users, currentUser, onRefresh }) {
  const [search, setSearch] = useState('')
  const [filterRol, setFilterRol] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || (u.nombre||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)
    const matchR = !filterRol || u.rol === filterRol
    return matchQ && matchR
  })

  async function toggleActivo(u) {
    try {
      await apiFetch(`/users/${u.id}`, { method:'PUT', body:JSON.stringify({ activo: u.activo ? 0 : 1 }) })
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado')
      onRefresh()
    } catch(e) { toast.error(e.message) }
  }

  async function handleDelete() {
    if (!confirmDel) return
    try {
      await apiFetch(`/users/${confirmDel.id}`, { method:'DELETE' })
      toast.success('Usuario eliminado')
      setConfirmDel(null)
      onRefresh()
    } catch(e) { toast.error(e.message) }
  }

  function openEdit(u) {
    setEditUser(u)
    setEditForm({ nombre: u.nombre||'', rol: u.rol, email: u.email })
  }

  async function saveEdit(e) {
    e.preventDefault()
    setSavingEdit(true)
    try {
      await apiFetch(`/users/${editUser.id}`, { method:'PUT', body:JSON.stringify(editForm) })
      toast.success('Usuario actualizado')
      setEditUser(null)
      onRefresh()
    } catch(e) { toast.error(e.message) }
    setSavingEdit(false)
  }

  const stats = {
    total: users.length,
    activos: users.filter(u => u.activo).length,
    pastores: users.filter(u => u.rol === 'PASTOR_GENERAL' || u.rol === 'PASTOR_CULTO').length,
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        {[['total','Miembros'],['activos','Activos'],['pastores','Pastores']].map(([k,l]) => (
          <div key={k} style={S.stat}>
            <div style={S.statNum}>{stats[k]}</div>
            <div style={S.statLabel}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input
          style={{ ...S.input, maxWidth:260, flex:1 }}
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor='#6B5CFF'}
          onBlur={e => e.target.style.borderColor='rgba(255,255,255,.08)'}
        />
        <select
          value={filterRol}
          onChange={e => setFilterRol(e.target.value)}
          style={{ ...S.input, maxWidth:180, cursor:'pointer' }}
        >
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div style={S.card}>
        <div style={S.sectionLabel}>{filtered.length} usuario{filtered.length !== 1 ? 's' : ''}</div>
        {filtered.length === 0 && (
          <p style={{ color:'#475569', fontSize:14, textAlign:'center', padding:'24px 0' }}>
            No se encontraron usuarios con ese criterio.
          </p>
        )}
        {filtered.map(u => (
          <div key={u.id} style={{ ...S.row, opacity: u.activo === 0 ? .45 : 1 }}>
            <Avatar nombre={u.nombre} email={u.email} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:14, color:'#F1F5F9', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                {u.nombre || '—'}
                {u.id === currentUser?.id && (
                  <span style={{ fontSize:10, background:'rgba(167,139,250,.15)', color:'#A78BFA', padding:'1px 7px', borderRadius:99, fontWeight:700 }}>Vos</span>
                )}
                {!u.activo && (
                  <span style={{ fontSize:10, background:'rgba(239,68,68,.1)', color:'#F87171', padding:'1px 7px', borderRadius:99, fontWeight:700 }}>Inactivo</span>
                )}
              </div>
              <div style={{ fontSize:12, color:'#475569', marginTop:2 }}>{u.email}</div>
            </div>
            <RolBadge rol={u.rol} />
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button style={S.btnGhost} onClick={() => openEdit(u)}>Editar</button>
              {u.id !== currentUser?.id && (
                <button
                  style={{ ...S.btnGhost, color: u.activo ? '#F87171' : '#10B981',
                    borderColor: u.activo ? 'rgba(239,68,68,.25)' : 'rgba(16,185,129,.25)' }}
                  onClick={() => toggleActivo(u)}
                >
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar */}
      {editUser && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div style={{ ...S.card, width:'100%', maxWidth:440, margin:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:'#F1F5F9' }}>Editar usuario</h3>
              <button style={{ background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:20 }}
                onClick={() => setEditUser(null)}>✕</button>
            </div>
            <form onSubmit={saveEdit}>
              <div style={{ marginBottom:14 }}>
                <label style={S.label}>Nombre</label>
                <input style={S.input} value={editForm.nombre}
                  onChange={e => setEditForm(f => ({...f, nombre:e.target.value}))}
                  onFocus={e => e.target.style.borderColor='#6B5CFF'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,.08)'} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={S.label}>Rol</label>
                <select style={{ ...S.input, cursor:'pointer' }} value={editForm.rol}
                  onChange={e => setEditForm(f => ({...f, rol:e.target.value}))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" style={S.btnGhost} onClick={() => setEditUser(null)}>Cancelar</button>
                <button type="submit" style={S.btnPrimary} disabled={savingEdit}>
                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDel}
        title="¿Eliminar usuario?"
        message={`Esto eliminará permanentemente a ${confirmDel?.nombre || confirmDel?.email}. Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  )
}

// ─── Tab: Roles & Permisos ──────────────────────────────────────────────────────
function TabRoles({ users }) {
  const [selUser, setSelUser] = useState(null)
  const [permisos, setPermisos] = useState({})
  const [original, setOriginal] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || (u.nombre||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)
  })

  async function selectUser(u) {
    setSelUser(u); setDirty(false)
    try {
      const p = await apiFetch(`/permisos/${u.id}`)
      setPermisos({...p}); setOriginal({...p})
    } catch { setPermisos({}); setOriginal({}) }
  }

  function setNivel(modulo, val) {
    const next = { ...permisos, [modulo]: val }
    setPermisos(next)
    setDirty(JSON.stringify(next) !== JSON.stringify(original))
  }

  async function guardar() {
    setSaving(true)
    try {
      await apiFetch(`/permisos/${selUser.id}`, { method:'PUT', body:JSON.stringify(permisos) })
      setOriginal({...permisos}); setDirty(false)
      toast.success('Permisos guardados')
    } catch(e) { toast.error(e.message) }
    setSaving(false)
  }

  function resetPermiso() { setPermisos({...original}); setDirty(false) }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20, alignItems:'start' }}>
      {/* Lista de usuarios */}
      <div>
        <div style={{ marginBottom:12 }}>
          <input
            style={{ ...S.input, fontSize:13 }}
            placeholder="Buscar usuario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => e.target.style.borderColor='#6B5CFF'}
            onBlur={e => e.target.style.borderColor='rgba(255,255,255,.08)'}
          />
        </div>
        <div style={S.card}>
          {filtered.map(u => (
            <div
              key={u.id}
              onClick={() => selectUser(u)}
              style={{
                ...S.row, cursor:'pointer', borderRadius:8, padding:'10px 12px',
                margin:'2px 0', border:'1px solid transparent',
                background: selUser?.id === u.id ? 'rgba(107,92,255,.1)' : 'transparent',
                borderColor: selUser?.id === u.id ? 'rgba(107,92,255,.3)' : 'transparent',
                transition:'all .15s',
              }}
            >
              <Avatar nombre={u.nombre} email={u.email} size={32} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#F1F5F9',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {u.nombre || u.email}
                </div>
                <div style={{ fontSize:11, color: ROLE_META[u.rol]?.color || '#94A3B8' }}>
                  {ROLE_META[u.rol]?.icon} {ROLE_META[u.rol]?.label || u.rol}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de permisos */}
      <div>
        {!selUser ? (
          <div style={{ ...S.card, textAlign:'center', padding:'48px 24px' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🔐</div>
            <p style={{ color:'#475569', fontSize:14, margin:0 }}>
              Seleccioná un usuario para gestionar sus permisos de módulo
            </p>
          </div>
        ) : (
          <div style={S.card}>
            {/* Header del panel */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <Avatar nombre={selUser.nombre} email={selUser.email} size={44} />
                <div>
                  <div style={{ fontWeight:700, fontSize:16, color:'#F1F5F9' }}>{selUser.nombre || selUser.email}</div>
                  <RolBadge rol={selUser.rol} />
                </div>
              </div>
              {dirty && (
                <div style={{ display:'flex', gap:8 }}>
                  <button style={S.btnGhost} onClick={resetPermiso}>Descartar</button>
                  <button style={S.btnPrimary} onClick={guardar} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              )}
            </div>

            {/* Leyenda de niveles */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {NIVELES.map(n => (
                <span key={n.val} style={{ fontSize:11, color:n.color, background:n.bg,
                  padding:'2px 10px', borderRadius:99, fontWeight:700 }}>
                  {n.short} — {n.label}
                </span>
              ))}
            </div>

            {/* Módulos */}
            <div style={{ display:'grid', gap:6 }}>
              {MODULOS.map(m => {
                const current = permisos[m.key] ?? 0
                return (
                  <div key={m.key} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'10px 14px', borderRadius:10, background:'rgba(255,255,255,.02)',
                    border:'1px solid rgba(255,255,255,.05)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#E2E8F0' }}>{m.label}</div>
                      <div style={{ fontSize:11, color:'#475569' }}>{m.desc}</div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {NIVELES.map(n => (
                        <NivelButton key={n.val} val={n.val} current={current} onChange={v => setNivel(m.key, v)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Invitaciones ──────────────────────────────────────────────────────────
function TabInvitaciones() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email:'', rol:'LIDER' })
  const [sending, setSending] = useState(false)
  const [linkGenerado, setLinkGenerado] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const inputRef = useRef(null)

  async function loadInvites() {
    setLoading(true)
    try { setInvites(await apiFetch('/invitaciones') || []) } catch { setInvites([]) }
    setLoading(false)
  }

  useEffect(() => { loadInvites() }, [])

  async function enviarInvitacion(e) {
    e.preventDefault()
    if (!form.email) return toast.error('Ingresá un email')
    setSending(true)
    try {
      const res = await apiFetch('/invitaciones', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, rol: form.rol })
      })
      toast.success(`Invitación enviada a ${form.email}`)
      if (res?.link) setLinkGenerado(res.link)
      setForm({ email:'', rol:'LIDER' })
      loadInvites()
    } catch(e) { toast.error(e.message) }
    setSending(false)
  }

  async function revocarInvitacion(id) {
    try {
      await apiFetch(`/invitaciones/${id}`, { method:'DELETE' })
      toast.success('Invitación revocada')
      loadInvites()
    } catch(e) { toast.error(e.message) }
  }

  function copiarLink(link) {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  const pendientes = invites.filter(i => i.estado === 'pendiente' || !i.estado)
  const aceptadas  = invites.filter(i => i.estado === 'aceptada')

  return (
    <div>
      {/* Formulario de invitación */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Nueva invitación</div>
        <form onSubmit={enviarInvitacion} style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:2, minWidth:200 }}>
            <label style={S.label}>Email</label>
            <input
              ref={inputRef}
              type="email" required
              style={S.input}
              placeholder="lider@iglesia.com"
              value={form.email}
              onChange={e => setForm(f => ({...f, email:e.target.value}))}
              onFocus={e => e.target.style.borderColor='#6B5CFF'}
              onBlur={e => e.target.style.borderColor='rgba(255,255,255,.08)'}
            />
          </div>
          <div style={{ flex:1, minWidth:160 }}>
            <label style={S.label}>Rol a asignar</label>
            <select
              style={{ ...S.input, cursor:'pointer' }}
              value={form.rol}
              onChange={e => setForm(f => ({...f, rol:e.target.value}))}
            >
              {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
            </select>
          </div>
          <button type="submit" style={{ ...S.btnPrimary, height:42, flexShrink:0 }} disabled={sending}>
            {sending ? 'Enviando...' : '✉️ Invitar'}
          </button>
        </form>

        {/* Link generado */}
        {linkGenerado && (
          <div style={{ marginTop:16, background:'rgba(16,185,129,.07)', border:'1px solid rgba(16,185,129,.2)',
            borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1, fontSize:12, color:'#34D399', fontFamily:'monospace',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {linkGenerado}
            </div>
            <button style={{ ...S.btnGhost, color:'#34D399', borderColor:'rgba(52,211,153,.3)', flexShrink:0 }}
              onClick={() => copiarLink(linkGenerado)}>
              {copiado ? '✓ Copiado' : 'Copiar link'}
            </button>
          </div>
        )}
      </div>

      {/* Invitaciones pendientes */}
      {!loading && (
        <div style={S.card}>
          <div style={S.sectionLabel}>
            Pendientes ({pendientes.length})
          </div>
          {pendientes.length === 0 && (
            <p style={{ color:'#475569', fontSize:13, padding:'12px 0', margin:0 }}>
              No hay invitaciones pendientes.
            </p>
          )}
          {pendientes.map(inv => (
            <div key={inv.id} style={S.row}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(107,92,255,.15)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>✉️</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#F1F5F9' }}>{inv.email}</div>
                <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>
                  {ROLE_META[inv.rol]?.icon} {ROLE_META[inv.rol]?.label || inv.rol}
                  {inv.createdAt && ` · Enviada ${new Date(inv.createdAt).toLocaleDateString('es-AR')}`}
                </div>
              </div>
              {inv.link && (
                <button style={{ ...S.btnGhost, fontSize:12 }} onClick={() => copiarLink(inv.link)}>
                  Copiar link
                </button>
              )}
              <button style={S.btnDanger} onClick={() => revocarInvitacion(inv.id)}>Revocar</button>
            </div>
          ))}
        </div>
      )}

      {/* Invitaciones aceptadas */}
      {aceptadas.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionLabel}>Aceptadas ({aceptadas.length})</div>
          {aceptadas.map(inv => (
            <div key={inv.id} style={{ ...S.row, opacity:.6 }}>
              <span style={{ fontSize:16 }}>✅</span>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#F1F5F9' }}>{inv.email}</div>
                <div style={{ fontSize:11, color:'#475569' }}>
                  {inv.acceptedAt && `Aceptada ${new Date(inv.acceptedAt).toLocaleDateString('es-AR')}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Sesiones ──────────────────────────────────────────────────────────────
function TabSesiones() {
  const [sesiones, setSesiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(null)

  async function loadSesiones() {
    setLoading(true)
    try { setSesiones(await apiFetch('/sesiones') || []) } catch {
      // Fallback: simular sesión actual si no existe el endpoint aún
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      setSesiones([{
        id: 'current',
        dispositivo: navigator.userAgent.includes('Mobile') ? '📱 Móvil' : '💻 Desktop',
        navegador: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Otro',
        ip: '—',
        lastActive: new Date().toISOString(),
        current: true,
      }])
    }
    setLoading(false)
  }

  useEffect(() => { loadSesiones() }, [])

  async function revocarSesion(id) {
    setRevoking(id)
    try {
      await apiFetch(`/sesiones/${id}`, { method:'DELETE' })
      toast.success('Sesión cerrada')
      loadSesiones()
    } catch(e) { toast.error(e.message || 'No se pudo cerrar la sesión') }
    setRevoking(null)
  }

  function formatFecha(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    const ahora = new Date()
    const diff = ahora - d
    if (diff < 60000) return 'Hace un momento'
    if (diff < 3600000) return `Hace ${Math.floor(diff/60000)} min`
    if (diff < 86400000) return `Hace ${Math.floor(diff/3600000)} hs`
    return d.toLocaleDateString('es-AR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
  }

  const deviceIcon = (s) => {
    const ua = (s.dispositivo || s.userAgent || '').toLowerCase()
    if (ua.includes('móvil') || ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return '📱'
    if (ua.includes('tablet') || ua.includes('ipad')) return '📟'
    return '💻'
  }

  return (
    <div>
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={S.sectionLabel}>Sesiones activas</div>
          {sesiones.filter(s => !s.current).length > 0 && (
            <button style={S.btnDanger} onClick={() => sesiones.filter(s=>!s.current).forEach(s=>revocarSesion(s.id))}>
              Cerrar todas las demás
            </button>
          )}
        </div>

        {loading && <p style={{ color:'#475569', fontSize:13 }}>Cargando sesiones...</p>}

        {!loading && sesiones.length === 0 && (
          <p style={{ color:'#475569', fontSize:13, padding:'12px 0' }}>No hay sesiones registradas.</p>
        )}

        {sesiones.map(s => (
          <div key={s.id} style={{ ...S.row, alignItems:'flex-start' }}>
            <div style={{ width:40, height:40, borderRadius:10,
              background: s.current ? 'rgba(16,185,129,.12)' : 'rgba(255,255,255,.04)',
              border: s.current ? '1px solid rgba(16,185,129,.25)' : '1px solid rgba(255,255,255,.06)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
              {deviceIcon(s)}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:14, fontWeight:600, color:'#F1F5F9' }}>
                  {s.dispositivo || s.navegador || 'Dispositivo desconocido'}
                </span>
                {s.current && (
                  <span style={{ fontSize:10, background:'rgba(16,185,129,.15)', color:'#34D399',
                    padding:'2px 8px', borderRadius:99, fontWeight:700 }}>
                    Esta sesión
                  </span>
                )}
              </div>
              <div style={{ fontSize:12, color:'#475569', marginTop:3, display:'flex', gap:12, flexWrap:'wrap' }}>
                {s.ip && s.ip !== '—' && <span>IP: {s.ip}</span>}
                {s.pais && <span>📍 {s.pais}</span>}
                <span>⏱ {formatFecha(s.lastActive || s.updatedAt || s.createdAt)}</span>
              </div>
            </div>
            {!s.current && (
              <button
                style={{ ...S.btnDanger, flexShrink:0, opacity: revoking === s.id ? .6 : 1 }}
                onClick={() => revocarSesion(s.id)}
                disabled={revoking === s.id}
              >
                {revoking === s.id ? '...' : 'Cerrar'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Info de seguridad */}
      <div style={{ ...S.cardSm, background:'rgba(107,92,255,.05)', border:'1px solid rgba(107,92,255,.15)' }}>
        <div style={{ fontSize:13, color:'#A78BFA', fontWeight:600, marginBottom:4 }}>🔒 Sobre la seguridad de sesiones</div>
        <p style={{ fontSize:12, color:'#64748B', margin:0, lineHeight:1.6 }}>
          Cerrá sesiones que no reconocés. Si ves una sesión sospechosa, cambiá tu contraseña inmediatamente.
          Las sesiones expiran automáticamente si no se usan por 30 días.
        </p>
      </div>
    </div>
  )
}

// ─── Componente raíz ────────────────────────────────────────────────────────────
export default function ConfiguracionOrganizacion() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('miembros')
  const [users, setUsers] = useState([])
  const [iglesia, setIglesia] = useState(null)
  const [currentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })

  async function loadData() {
    try {
      const [u, ig] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/mi-perfil').catch(() => null),
      ])
      setUsers(u || [])
      setIglesia(ig?.iglesia || null)
    } catch {}
  }

  useEffect(() => { loadData() }, [])

  // Solo admins y pastores generales
  if (currentUser.rol && currentUser.rol !== 'PASTOR_GENERAL' && currentUser.rol !== 'PASTOR_CULTO') {
    return (
      <div className="layout">
        <Menu />
        <main className="main">
          <div style={{ textAlign:'center', padding:'80px 24px' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔐</div>
            <h2 style={{ color:'#F1F5F9', fontSize:20, fontWeight:700 }}>Acceso restringido</h2>
            <p style={{ color:'#64748B' }}>Esta sección es solo para pastores y administradores.</p>
            <button style={S.btnGhost} onClick={() => navigate('/')}>← Volver al inicio</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="layout">
      <Menu />
      <main className="main" style={{ padding:0, background:'#070C18', minHeight:'100vh' }}>
        <div style={S.inner}>

          {/* Header */}
          <div style={S.header}>
            <div style={S.headerTop}>
              <button style={S.backBtn} onClick={() => navigate(-1)}
                onMouseEnter={e => e.currentTarget.style.color='#A78BFA'}
                onMouseLeave={e => e.currentTarget.style.color='#64748B'}>
                ← Volver
              </button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <div style={{ width:52, height:52, borderRadius:14,
                background:'linear-gradient(135deg,#6B5CFF22,#4845D222)',
                border:'1.5px solid rgba(107,92,255,.3)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
                ⛪
              </div>
              <div>
                <h1 style={S.title}>{iglesia?.nombre || 'Organización'}</h1>
                <p style={S.subtitle}>
                  {users.length} miembro{users.length !== 1 ? 's' : ''} · Gestioná roles, permisos e invitaciones
                </p>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={S.tabBar}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  ...S.tab,
                  ...(tab === t.id ? S.tabActive : {}),
                }}
                onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color='#E2E8F0' }}
                onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color='#64748B' }}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Contenido */}
          {tab === 'miembros'     && <TabMiembros users={users} currentUser={currentUser} onRefresh={loadData} />}
          {tab === 'roles'        && <TabRoles users={users} />}
          {tab === 'invitaciones' && <TabInvitaciones />}
          {tab === 'sesiones'     && <TabSesiones />}

        </div>
      </main>
    </div>
  )
}
