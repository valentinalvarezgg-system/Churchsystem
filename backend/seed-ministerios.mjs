#!/usr/bin/env node
/**
 * Seed de ministerios — carga datos realistas para todos los tipos.
 * Corre contra la cuenta max@test.com (iglesia 48).
 */
import 'dotenv/config'
import { pgExec, pgOne, pgMany } from './src/lib/pg.js'

const BASE = 'http://localhost:4000'
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'max@test.com', password: 'Test1234!' })
})).json()
const token = login.token
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const api = (path, opts={}) => fetch(`${BASE}${path}`, { headers: H, ...opts }).then(r => r.json())
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
const put  = (path, body) => api(path, { method: 'PUT',  body: JSON.stringify(body) })

console.log('Logged in as max@test.com')

// ── Obtener ministerios existentes ──────────────────────────────────────
const ministerios = await api('/ministerios')
const byTipo = Object.fromEntries(ministerios.map(m => [m.tipo, m]))
console.log('Ministerios existentes:', ministerios.map(m => m.tipo).join(', '))

async function getOrCreate(tipo, data) {
  if (byTipo[tipo]) return byTipo[tipo]
  const m = await post('/ministerios', { tipo, ...data })
  console.log(`  Creado: ${data.nombre} (${tipo})`)
  return m
}

// ── 1. ALABANZA ──────────────────────────────────────────────────────────
console.log('\n🎸 ALABANZA')
const alab = await getOrCreate('ALABANZA', {
  nombre: 'Ministerio de Alabanza',
  descripcion: 'Dirigimos la adoración en cada culto y preparamos el ambiente espiritual.',
  icono: '🎸', color: '#6B5CFF'
})

// Canciones del repertorio
const canciones = [
  { titulo: 'Cuán Grande Es Dios', artista: 'Chris Tomlin', tonalidad: 'G', bpm: 76 },
  { titulo: 'Oceans (Where Feet May Fail)', artista: 'Hillsong United', tonalidad: 'D', bpm: 68 },
  { titulo: 'Way Maker', artista: 'Sinach', tonalidad: 'E', bpm: 84 },
  { titulo: 'Reckless Love', artista: 'Cory Asbury', tonalidad: 'A', bpm: 72 },
  { titulo: 'Goodness of God', artista: 'Bethel Music', tonalidad: 'B', bpm: 78 },
  { titulo: 'What a Beautiful Name', artista: 'Hillsong Worship', tonalidad: 'D', bpm: 70 },
  { titulo: 'Trono de Gracia', artista: 'Marco Barrientos', tonalidad: 'G', bpm: 82 },
  { titulo: 'Eres Todo Poderoso', artista: 'Marcos Witt', tonalidad: 'A', bpm: 88 },
  { titulo: 'Soy Libre', artista: 'Redimi2', tonalidad: 'C', bpm: 90 },
  { titulo: 'En Espíritu y en Verdad', artista: 'Marcos Witt', tonalidad: 'F', bpm: 75 },
  { titulo: 'Dios de lo Imposible', artista: 'Elevation Worship', tonalidad: 'E', bpm: 80 },
  { titulo: 'Build My Life', artista: 'Housefires', tonalidad: 'G', bpm: 68 },
  { titulo: 'Holy Forever', artista: 'Chris Tomlin', tonalidad: 'B', bpm: 72 },
  { titulo: 'Magnificate', artista: 'Elevation Worship', tonalidad: 'A', bpm: 76 },
  { titulo: 'Milagros', artista: 'Miel San Marcos', tonalidad: 'D', bpm: 85 },
]
const cancionIds = []
for (const c of canciones) {
  const r = await post(`/ministerios/${alab.id}/canciones`, c)
  cancionIds.push(r.id)
  process.stdout.write('.')
}
console.log(` ${canciones.length} canciones`)

// Setlists
const setlists = [
  { nombre: 'Culto Domingo 01/06 - Mañana',    fecha: '2026-06-01', canciones: [0,1,2,3] },
  { nombre: 'Culto Domingo 01/06 - Noche',      fecha: '2026-06-01', canciones: [4,5,6,7] },
  { nombre: 'Culto Jóvenes Viernes 06/06',       fecha: '2026-06-06', canciones: [8,9,10,11] },
  { nombre: 'Culto Domingo 08/06 - Mañana',     fecha: '2026-06-08', canciones: [12,13,14,0] },
]
for (const s of setlists) {
  await post(`/ministerios/${alab.id}/setlists`, {
    nombre: s.nombre, fecha: s.fecha,
    canciones: s.canciones.map(i => ({ cancionId: cancionIds[i], tonalidad: canciones[i].tonalidad }))
  })
}
console.log(`  ${setlists.length} setlists`)

// Tareas de alabanza
const tareasAlab = [
  { titulo: 'Enviar setlist al pastor para aprobación',      prioridad: 'ALTA',   fechaVence: '2026-05-31T23:00:00Z' },
  { titulo: 'Preparar partitura de "Milagros" en tonalidad D', prioridad: 'MEDIA', fechaVence: '2026-06-01T08:00:00Z' },
  { titulo: 'Ensayo general sábado 31/05 a las 18hs',        prioridad: 'ALTA',   fechaVence: '2026-05-31T21:00:00Z' },
  { titulo: 'Comprar cuerdas para guitarra eléctrica (0.10)', prioridad: 'BAJA',  fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Actualizar letra de "Way Maker" en proyección',  prioridad: 'MEDIA', fechaVence: '2026-05-31T20:00:00Z' },
  { titulo: 'Confirmar disponibilidad de baterista para el domingo', prioridad: 'ALTA', fechaVence: '2026-05-30T18:00:00Z' },
]
for (const t of tareasAlab) await post(`/ministerios/${alab.id}/tareas`, t)
console.log(`  ${tareasAlab.length} tareas`)

// Checklist de ensayo
await post(`/ministerios/${alab.id}/checklists`, {
  nombre: 'Checklist ensayo semanal', tipo: 'SEMANAL',
  items: [
    'Confirmar asistencia de todos los miembros',
    'Preparar setlist 48hs antes',
    'Enviar tonalidades al pianista',
    'Verificar que todos tengan letra impresa',
    'Revisar afinación de todos los instrumentos',
    'Ensayar transiciones entre canciones',
    'Definir orden de entrada al escenario',
    'Orar antes de comenzar el ensayo',
  ]
})
await post(`/ministerios/${alab.id}/checklists`, {
  nombre: 'Checklist pre-culto alabanza', tipo: 'CULTO',
  items: [
    'Llegar 90 min antes del culto',
    'Verificar monitoreo en escenario',
    'Prueba de micrófonos individuales',
    'Soundcheck con sonidista',
    'Orar como equipo antes de subir',
    'Confirmar tonalidades con el equipo',
    'Setlist impresa o en tablet',
  ]
})
console.log('  2 checklists')

// ── 2. SONIDO ─────────────────────────────────────────────────────────────
console.log('\n🎚️ SONIDO')
const sonido = await getOrCreate('SONIDO', {
  nombre: 'Sonido y Audio', descripcion: 'Manejo de la consola, micrófonos y sistema de sonido del templo.',
  icono: '🎚️', color: '#10B981'
})

const equipos = [
  { nombre: 'Consola Yamaha QL5', tipo: 'consola', marca: 'Yamaha', modelo: 'QL5', estado: 'OPERATIVO', ubicacion: 'Cabina de sonido' },
  { nombre: 'Consola Yamaha MG20', tipo: 'consola_monitoreo', marca: 'Yamaha', modelo: 'MG20', estado: 'OPERATIVO', ubicacion: 'Escenario' },
  { nombre: 'Shure SM58 #1', tipo: 'micrófono', marca: 'Shure', modelo: 'SM58', estado: 'OPERATIVO', ubicacion: 'Escenario' },
  { nombre: 'Shure SM58 #2', tipo: 'micrófono', marca: 'Shure', modelo: 'SM58', estado: 'OPERATIVO', ubicacion: 'Escenario' },
  { nombre: 'Shure SM58 #3', tipo: 'micrófono', marca: 'Shure', modelo: 'SM58', estado: 'FALLA', ubicacion: 'Depósito — falla de cápsula' },
  { nombre: 'Shure Beta 91A (bombo)', tipo: 'micrófono', marca: 'Shure', modelo: 'Beta 91A', estado: 'OPERATIVO', ubicacion: 'Escenario — batería' },
  { nombre: 'DI Box Radial J48 #1', tipo: 'DI box', marca: 'Radial', modelo: 'J48', estado: 'OPERATIVO', ubicacion: 'Escenario' },
  { nombre: 'DI Box Radial J48 #2', tipo: 'DI box', marca: 'Radial', modelo: 'J48', estado: 'OPERATIVO', ubicacion: 'Escenario' },
  { nombre: 'Monitor QSC K10.2 #1', tipo: 'monitor', marca: 'QSC', modelo: 'K10.2', estado: 'OPERATIVO', ubicacion: 'Escenario izquierdo' },
  { nombre: 'Monitor QSC K10.2 #2', tipo: 'monitor', marca: 'QSC', modelo: 'K10.2', estado: 'OPERATIVO', ubicacion: 'Escenario derecho' },
  { nombre: 'Monitor QSC K10.2 #3', tipo: 'monitor', marca: 'QSC', modelo: 'K10.2', estado: 'MANTENIMIENTO', ubicacion: 'Depósito — revisión de tweeter' },
  { nombre: 'Subwoofer JBL SRX828SP', tipo: 'subwoofer', marca: 'JBL', modelo: 'SRX828SP', estado: 'OPERATIVO', ubicacion: 'Platea izquierda' },
  { nombre: 'Subwoofer JBL SRX828SP', tipo: 'subwoofer', marca: 'JBL', modelo: 'SRX828SP', estado: 'OPERATIVO', ubicacion: 'Platea derecha' },
  { nombre: 'IEM Sistema Sennheiser EW 300', tipo: 'in-ear monitor', marca: 'Sennheiser', modelo: 'EW 300 G4', estado: 'OPERATIVO', ubicacion: 'Escenario' },
  { nombre: 'Línea XLR 10m #1 al #6 (pack)', tipo: 'cableado', marca: 'Neutrik', modelo: 'XLR profesional', estado: 'OPERATIVO', ubicacion: 'Bodega' },
  { nombre: 'Patch Bay Hosa PDR-369', tipo: 'patch bay', marca: 'Hosa', modelo: 'PDR-369', estado: 'OPERATIVO', ubicacion: 'Cabina de sonido' },
]
for (const e of equipos) await post(`/ministerios/${sonido.id}/equipos`, e)
console.log(`  ${equipos.length} equipos`)

// Checklists de sonido
await post(`/ministerios/${sonido.id}/checklists`, {
  nombre: 'Checklist técnica pre-culto', tipo: 'CULTO',
  items: [
    'Encender consola y esperar boot completo (90 segundos)',
    'Verificar que todos los canales estén en mute al inicio',
    'Probar señal de cada canal de entrada',
    'Verificar niveles de ganancia por canal',
    'Chequear monitores de escenario (uno a uno)',
    'Test de micrófonos inalámbricos — nivel de batería',
    'Verificar sistema IEM — todos los canales',
    'Prueba de subwoofers y línea principal',
    'Confirmar que no hay feedback antes del culto',
    'Coordinar nivel de ensayo con alabanza',
    'Guardar escena de consola como "backup_domingo"',
  ]
})
await post(`/ministerios/${sonido.id}/checklists`, {
  nombre: 'Checklist cierre post-culto', tipo: 'CULTO',
  items: [
    'Bajar faders a cero gradualmente',
    'Apagar amplificadores antes que la consola',
    'Apagar consola correctamente (no forzar)',
    'Guardar escena del culto con fecha',
    'Colocar tapas protectoras en micrófonos',
    'Guardar cables enrollados en bodega',
    'Reportar cualquier falla o incidente',
    'Cerrar bodega con llave',
  ]
})
const tareasSonido = [
  { titulo: 'Mantenimiento SM58 #3 — cambio de cápsula',  prioridad: 'ALTA',  fechaVence: '2026-06-07T18:00:00Z' },
  { titulo: 'Revisión tweeter monitor K10.2 #3',           prioridad: 'ALTA',  fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Comprar baterías AA para micrófonos inalámbricos (x12)', prioridad: 'MEDIA', fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Catalogar y etiquetar todos los cables XLR',  prioridad: 'BAJA',  fechaVence: '2026-06-14T18:00:00Z' },
  { titulo: 'Actualizar firmware de la consola QL5 a v5.5', prioridad: 'MEDIA', fechaVence: '2026-06-10T10:00:00Z' },
]
for (const t of tareasSonido) await post(`/ministerios/${sonido.id}/tareas`, t)
console.log(`  ${tareasSonido.length} tareas, 2 checklists`)

// ── 3. PROYECCION ─────────────────────────────────────────────────────────
console.log('\n📽️ PROYECCIÓN')
const proy = await getOrCreate('PROYECCION', {
  nombre: 'Proyección y Multimedia', descripcion: 'Letras, videos, visuales y control de pantallas durante el culto.',
  icono: '📽️', color: '#3B82F6'
})
const equiposProy = [
  { nombre: 'Proyector Epson EB-G7500U', tipo: 'proyector', marca: 'Epson', modelo: 'EB-G7500U', estado: 'OPERATIVO', ubicacion: 'Cielorraso — frente de escenario' },
  { nombre: 'Proyector Epson EB-G7500U #2', tipo: 'proyector', marca: 'Epson', modelo: 'EB-G7500U', estado: 'OPERATIVO', ubicacion: 'Cielorraso — fondo' },
  { nombre: 'PC Proyección (ProPresenter)', tipo: 'computadora', marca: 'Apple', modelo: 'Mac mini M2', estado: 'OPERATIVO', ubicacion: 'Cabina multimedia' },
  { nombre: 'Switcher HDMI 4K 8 puertos', tipo: 'switcher', marca: 'Kramer', modelo: 'VS-81H2', estado: 'OPERATIVO', ubicacion: 'Cabina multimedia' },
  { nombre: 'Pantalla LED 85" — escenario', tipo: 'pantalla', marca: 'Samsung', modelo: 'QM85R', estado: 'OPERATIVO', ubicacion: 'Escenario centro' },
  { nombre: 'Tablet control (Stage Display)', tipo: 'tablet', marca: 'Apple', modelo: 'iPad Pro 12.9"', estado: 'OPERATIVO', ubicacion: 'Escenario' },
]
for (const e of equiposProy) await post(`/ministerios/${proy.id}/equipos`, e)
await post(`/ministerios/${proy.id}/checklists`, {
  nombre: 'Checklist pre-culto proyección', tipo: 'CULTO',
  items: [
    'Encender proyectores y esperar calentamiento (15 min)',
    'Verificar alineación de imagen en pantalla',
    'Cargar setlist en ProPresenter desde alabanza',
    'Verificar que todas las letras estén actualizadas',
    'Preparar loop de bienvenida para antes del culto',
    'Sincronizar con el operador de sonido',
    'Verificar que el Stage Display del escenario funcione',
    'Tener PDF del sermón como respaldo de slides',
  ]
})
const tareasProy = [
  { titulo: 'Actualizar letras de canciones del setlist',   prioridad: 'ALTA',  fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Crear loop de bienvenida para junio',          prioridad: 'MEDIA', fechaVence: '2026-06-01T09:00:00Z' },
  { titulo: 'Revisar calibración de proyector #2',         prioridad: 'MEDIA', fechaVence: '2026-06-05T10:00:00Z' },
  { titulo: 'Organizar carpeta de media por fechas',        prioridad: 'BAJA',  fechaVence: '2026-06-10T18:00:00Z' },
]
for (const t of tareasProy) await post(`/ministerios/${proy.id}/tareas`, t)
console.log(`  ${equiposProy.length} equipos, ${tareasProy.length} tareas, 1 checklist`)

// ── 4. UJIERES ───────────────────────────────────────────────────────────
console.log('\n🤝 UJIERES')
const ujieres = await getOrCreate('UJIERES', {
  nombre: 'Ujieres y Bienvenida', descripcion: 'Recibimos a cada persona con amor, asistimos en la organización del culto y garantizamos el orden.',
  icono: '🤝', color: '#F59E0B'
})
await post(`/ministerios/${ujieres.id}/checklists`, {
  nombre: 'Checklist recepción domingo', tipo: 'CULTO',
  items: [
    'Llegar 45 min antes del culto',
    'Verificar puertas de acceso abiertas',
    'Asignar posición a cada ujier (puerta principal, lateral, interior)',
    'Preparar materiales de bienvenida (folletos, boletín)',
    'Verificar que los baños estén limpios y con papel',
    'Posicionar señalización de salidas de emergencia',
    'Contar y reservar sillas para discapacitados',
    'Saludar a cada persona en la puerta con nombre si es conocida',
    'Registrar visitas nuevas en formulario digital',
    'Guiar a familias con niños al sector de niños',
    'Al inicio: cerrar acceso principal y silenciar teléfonos propiamente',
  ]
})
await post(`/ministerios/${ujieres.id}/checklists`, {
  nombre: 'Checklist cierre de culto', tipo: 'CULTO',
  items: [
    'Acompañar a ancianos/personas con movilidad reducida a la salida',
    'Recoger folletos y materiales no usados',
    'Verificar que no queden pertenencias olvidadas',
    'Reportar incidentes al coordinador',
    'Apagar luces de pasillos',
    'Cerrar puertas laterales con llave',
  ]
})
const tareasUjieres = [
  { titulo: 'Reunión de equipo para asignación de turnos junio', prioridad: 'ALTA', fechaVence: '2026-05-30T19:00:00Z' },
  { titulo: 'Imprimir formulario de visitas nuevo',           prioridad: 'MEDIA', fechaVence: '2026-05-31T12:00:00Z' },
  { titulo: 'Capacitar a los 2 ujieres nuevos en protocolo',  prioridad: 'ALTA',  fechaVence: '2026-06-01T08:30:00Z' },
  { titulo: 'Conseguir sillas adicionales para culto especial 15/06', prioridad: 'MEDIA', fechaVence: '2026-06-12T18:00:00Z' },
]
for (const t of tareasUjieres) await post(`/ministerios/${ujieres.id}/tareas`, t)
console.log(`  ${tareasUjieres.length} tareas, 2 checklists`)

// ── 5. NIÑOS ──────────────────────────────────────────────────────────────
console.log('\n🧒 NIÑOS')
const ninos = await getOrCreate('NINOS', {
  nombre: 'Ministerio de Niños', descripcion: 'Cuidado, educación y formación espiritual de los niños de la iglesia en un ambiente seguro.',
  icono: '🧒', color: '#EF4444'
})

// Salas por edad (via API directa en DB ya que no hay endpoint REST de salas aún)
await pgExec(`
  INSERT INTO "MinisterioSala" ("ministerioId","nombre","rangoEdadMin","rangoEdadMax","capacidad","activa")
  VALUES ($1,'Bebés (0-2 años)',0,2,8,true),
         ($1,'Jardín (3-5 años)',3,5,15,true),
         ($1,'Primaria (6-8 años)',6,8,20,true),
         ($1,'Pre-adolescentes (9-11 años)',9,11,20,true)
  ON CONFLICT DO NOTHING
`, [ninos.id])

await post(`/ministerios/${ninos.id}/checklists`, {
  nombre: 'Checklist apertura sala niños', tipo: 'CULTO',
  items: [
    'Verificar que el salón esté limpio y ordenado',
    'Preparar materiales didácticos por sala/edad',
    'Verificar botiquín de primeros auxilios',
    'Lista de alergias conocidas actualizada y visible',
    'Sistema de pulseras/códigos de retiro preparado',
    'Confirmar disponibilidad de todos los maestros',
    'Verificar que las cámaras de seguridad funcionen',
    'Preparar merienda (si corresponde) — verificar alergias',
  ]
})
await post(`/ministerios/${ninos.id}/checklists`, {
  nombre: 'Protocolo de entrega segura', tipo: 'CULTO',
  items: [
    'Registrar a cada niño con nombre y responsable adulto',
    'Generar código único de retiro para cada familia',
    'Verificar identidad del adulto que retira',
    'Solo entregar a adultos con código coincidente',
    'Registrar hora de salida de cada niño',
    'Reportar cualquier incidente al pastor inmediatamente',
  ]
})
const tareasNinos = [
  { titulo: 'Actualizar lista de alergias de todos los niños', prioridad: 'URGENTE', fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Comprar materiales para clase de junio',          prioridad: 'MEDIA',   fechaVence: '2026-06-01T10:00:00Z' },
  { titulo: 'Renovar botiquín de sala Bebés',                  prioridad: 'ALTA',    fechaVence: '2026-06-01T08:00:00Z' },
  { titulo: 'Capacitar maestra nueva en protocolo de seguridad', prioridad: 'ALTA', fechaVence: '2026-06-03T10:00:00Z' },
  { titulo: 'Preparar material didáctico sobre "La Creación" para junio', prioridad: 'MEDIA', fechaVence: '2026-06-05T18:00:00Z' },
]
for (const t of tareasNinos) await post(`/ministerios/${ninos.id}/tareas`, t)
console.log(`  4 salas, ${tareasNinos.length} tareas, 2 checklists`)

// ── 6. JUVENTUD ───────────────────────────────────────────────────────────
console.log('\n⚡ JUVENTUD')
const juventud = await getOrCreate('JUVENTUD', {
  nombre: 'Ministerio de Jóvenes', descripcion: 'Alcanzamos, formamos y enviamos a los jóvenes de 13 a 30 años.',
  icono: '⚡', color: '#8B5CF6'
})
const tareasJuv = [
  { titulo: 'Planificar campamento de invierno julio 2026',    prioridad: 'ALTA',  fechaVence: '2026-06-15T18:00:00Z' },
  { titulo: 'Reunión de líderes — diseño de currículum Q3',   prioridad: 'ALTA',  fechaVence: '2026-06-07T19:00:00Z' },
  { titulo: 'Organizar retiro de discipulado 20-22 junio',    prioridad: 'MEDIA', fechaVence: '2026-06-08T18:00:00Z' },
  { titulo: 'Actualizar lista de jóvenes activos vs inactivos', prioridad: 'MEDIA', fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Contactar jóvenes sin actividad en 30+ días',    prioridad: 'ALTA',  fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Preparar propuesta de servicio comunitario junio', prioridad: 'BAJA', fechaVence: '2026-06-10T18:00:00Z' },
]
for (const t of tareasJuv) await post(`/ministerios/${juventud.id}/tareas`, t)
await post(`/ministerios/${juventud.id}/checklists`, {
  nombre: 'Checklist reunión semanal jóvenes', tipo: 'SEMANAL',
  items: [
    'Confirmar lugar de reunión y acceso',
    'Preparar dinámica de apertura (10 min)',
    'Alabanza — coordinar con líder de música',
    'Palabra o estudio preparado',
    'Actividad de grupo o pequeños grupos',
    'Anuncios y oportunidades de servicio',
    'Tiempo de oración',
    'Cierre y recordatorio de próxima reunión',
  ]
})
console.log(`  ${tareasJuv.length} tareas, 1 checklist`)

// ── 7. EVANGELISMO ────────────────────────────────────────────────────────
console.log('\n🌍 EVANGELISMO')
const evan = await getOrCreate('EVANGELISMO', {
  nombre: 'Ministerio de Evangelismo', descripcion: 'Salidas, campañas y seguimiento de nuevos contactos para el reino.',
  icono: '🌍', color: '#EC4899'
})
const tareasEvan = [
  { titulo: 'Salida evangelística barrio Norte — 07/06',      prioridad: 'ALTA',  fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Campaña plaza central — 14/06',                 prioridad: 'ALTA',  fechaVence: '2026-06-10T18:00:00Z' },
  { titulo: 'Seguimiento de 8 contactos de última salida',   prioridad: 'URGENTE', fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Preparar material de evangelismo digital (Instagram)', prioridad: 'MEDIA', fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Capacitación equipo — método "Un Paso"',        prioridad: 'MEDIA', fechaVence: '2026-06-08T19:00:00Z' },
  { titulo: 'Convertir 3 contactos en "Persona" del sistema', prioridad: 'ALTA',  fechaVence: '2026-05-31T23:59:00Z' },
]
for (const t of tareasEvan) await post(`/ministerios/${evan.id}/tareas`, t)
console.log(`  ${tareasEvan.length} tareas`)

// ── 8. CONSOLIDACIÓN ─────────────────────────────────────────────────────
console.log('\n🌱 CONSOLIDACIÓN')
const consol = await getOrCreate('CONSOLIDACION_MIN', {
  nombre: 'Consolidación y Discipulado', descripcion: 'Ruta de seguimiento por etapas para nuevos creyentes y miembros activos.',
  icono: '🌱', color: '#14B8A6'
})
const tareasConsol = [
  { titulo: 'Seguimiento semana 1: visita a los 4 nuevos del domingo pasado', prioridad: 'URGENTE', fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Enviar kit de bienvenida a nuevos creyentes de mayo',  prioridad: 'ALTA',  fechaVence: '2026-05-31T20:00:00Z' },
  { titulo: 'Actualizar estado de 12 personas en ruta de discipulado', prioridad: 'MEDIA', fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Inicio de "Curso de Fundamentos" grupo A — 05/06',    prioridad: 'ALTA',  fechaVence: '2026-06-04T18:00:00Z' },
  { titulo: 'Revisar personas sin contacto en últimas 2 semanas',  prioridad: 'ALTA',  fechaVence: '2026-05-31T23:59:00Z' },
]
for (const t of tareasConsol) await post(`/ministerios/${consol.id}/tareas`, t)
await post(`/ministerios/${consol.id}/checklists`, {
  nombre: 'Ruta de consolidación — Paso a paso', tipo: 'SEMANAL',
  items: [
    'Semana 1: Primera llamada o visita personal',
    'Semana 1: Invitar a grupo de integración',
    'Semana 2: Entrega de Biblia y material de bienvenida',
    'Semana 2-4: Seguimiento semanal (llamada o WhatsApp)',
    'Mes 1: Inscripción en Curso de Fundamentos',
    'Mes 2: Integración a un grupo celular',
    'Mes 3: Identificación de dones y área de servicio',
    'Mes 4: Unión formal a la iglesia (si corresponde)',
  ]
})
console.log(`  ${tareasConsol.length} tareas, 1 checklist`)

// ── 9. VOLUNTARIADO ───────────────────────────────────────────────────────
console.log('\n🙌 VOLUNTARIADO')
const vol = await getOrCreate('VOLUNTARIADO', {
  nombre: 'Voluntariado y Staff', descripcion: 'Coordinación, reclutamiento y gestión del equipo de voluntarios.',
  icono: '🙌', color: '#F97316'
})
const tareasVol = [
  { titulo: 'Reclutar 5 voluntarios nuevos para el mes de julio',   prioridad: 'MEDIA', fechaVence: '2026-06-20T18:00:00Z' },
  { titulo: 'Actualizar disponibilidad horaria de todo el equipo',  prioridad: 'ALTA',  fechaVence: '2026-05-31T23:59:00Z' },
  { titulo: 'Reconocimiento mensual a voluntarios destacados',      prioridad: 'MEDIA', fechaVence: '2026-06-01T10:00:00Z' },
  { titulo: 'Encuesta de satisfacción al equipo de voluntarios',    prioridad: 'BAJA',  fechaVence: '2026-06-15T18:00:00Z' },
  { titulo: 'Asignar voluntarios para culto especial 15/06',        prioridad: 'ALTA',  fechaVence: '2026-06-10T18:00:00Z' },
]
for (const t of tareasVol) await post(`/ministerios/${vol.id}/tareas`, t)
console.log(`  ${tareasVol.length} tareas`)

// ── 10. COMUNICACIONES ────────────────────────────────────────────────────
console.log('\n📣 COMUNICACIONES')
const com = await getOrCreate('COMUNICACIONES', {
  nombre: 'Comunicaciones y Redes', descripcion: 'Gestión de redes sociales, comunicación institucional y material de diseño.',
  icono: '📣', color: '#06B6D4'
})
const tareasCom = [
  { titulo: 'Diseñar flyer culto especial 15/06',              prioridad: 'ALTA',  fechaVence: '2026-06-08T18:00:00Z' },
  { titulo: 'Post semanal Instagram — lunes y jueves',         prioridad: 'MEDIA', fechaVence: '2026-06-02T10:00:00Z' },
  { titulo: 'Story devocional diario — plantilla junio',       prioridad: 'MEDIA', fechaVence: '2026-05-31T23:59:00Z' },
  { titulo: 'Actualizar bio de Instagram con horario de cultos', prioridad: 'BAJA', fechaVence: '2026-06-01T18:00:00Z' },
  { titulo: 'Grabar y editar highlight "Juventud" para Instagram', prioridad: 'MEDIA', fechaVence: '2026-06-10T18:00:00Z' },
  { titulo: 'Boletín semanal de WhatsApp — preparar plantilla', prioridad: 'ALTA', fechaVence: '2026-05-31T20:00:00Z' },
]
for (const t of tareasCom) await post(`/ministerios/${com.id}/tareas`, t)
await post(`/ministerios/${com.id}/checklists`, {
  nombre: 'Checklist calendario editorial semanal', tipo: 'SEMANAL',
  items: [
    'Lunes: Post de devocional / versículo de la semana',
    'Martes: Contenido sobre ministerios o eventos',
    'Miércoles: Reels o historia corta de la comunidad',
    'Jueves: Anuncio del culto o actividad del fin de semana',
    'Viernes: Testimonio o historia de vida',
    'Sábado: Recordatorio del culto dominical',
    'Domingo: Post en vivo / story durante el culto',
    'Boletín de WhatsApp enviado a todos los grupos',
  ]
})
console.log(`  ${tareasCom.length} tareas, 1 checklist`)

// ── 11. ADMINISTRACIÓN ────────────────────────────────────────────────────
console.log('\n🗂️ ADMINISTRACIÓN')
const adm = await getOrCreate('ADMINISTRACION', {
  nombre: 'Administración y Secretaría', descripcion: 'Gestión operativa, documentación y coordinación interna de todos los ministerios.',
  icono: '🗂️', color: '#64748B'
})
const tareasAdm = [
  { titulo: 'Reunión mensual de coordinadores de ministerios — 01/06', prioridad: 'ALTA', fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Actualizar actas del consejo pastoral mayo 2026',  prioridad: 'ALTA',  fechaVence: '2026-05-31T23:59:00Z' },
  { titulo: 'Preparar informe mensual de actividades para pastores', prioridad: 'ALTA', fechaVence: '2026-06-01T09:00:00Z' },
  { titulo: 'Renovar seguro de inmueble — vence 30/06',         prioridad: 'URGENTE', fechaVence: '2026-06-20T18:00:00Z' },
  { titulo: 'Centralizar contratos de proveedor en carpeta compartida', prioridad: 'MEDIA', fechaVence: '2026-06-10T18:00:00Z' },
  { titulo: 'Revisión de ingresos y egresos de mayo 2026',     prioridad: 'ALTA',  fechaVence: '2026-06-01T12:00:00Z' },
]
for (const t of tareasAdm) await post(`/ministerios/${adm.id}/tareas`, t)
console.log(`  ${tareasAdm.length} tareas`)

// ── 12. ORACIÓN ───────────────────────────────────────────────────────────
console.log('\n🙏 ORACIÓN')
const oracion = await getOrCreate('ORACION_CUIDADO', {
  nombre: 'Oración y Cuidado Pastoral', descripcion: 'Red de intercesión, cadenas de oración y cuidado espiritual de la congregación.',
  icono: '🙏', color: '#A78BFA'
})
const tareasOracion = [
  { titulo: 'Reunión de intercesión viernes 06/06 a las 20hs',    prioridad: 'ALTA',  fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Visita pastoral a familias en duelo (3 pendientes)',  prioridad: 'URGENTE', fechaVence: '2026-05-31T23:59:00Z' },
  { titulo: 'Actualizar lista de peticiones activas de la semana', prioridad: 'ALTA',  fechaVence: '2026-05-31T18:00:00Z' },
  { titulo: 'Cadena de oración por los 5 enfermos críticos',      prioridad: 'URGENTE', fechaVence: '2026-05-31T20:00:00Z' },
]
for (const t of tareasOracion) await post(`/ministerios/${oracion.id}/tareas`, t)
console.log(`  ${tareasOracion.length} tareas`)

// ── 13. EVENTOS ───────────────────────────────────────────────────────────
console.log('\n🎪 EVENTOS')
const eventos = await getOrCreate('EVENTOS_CAMPANAS', {
  nombre: 'Eventos y Campañas', descripcion: 'Planificación integral de cultos especiales, campañas y eventos institucionales.',
  icono: '🎪', color: '#FB7185'
})
const tareasEventos = [
  { titulo: 'Culto de Aniversario 15/06 — coordinación general', prioridad: 'URGENTE', fechaVence: '2026-06-01T18:00:00Z' },
  { titulo: 'Presupuesto para culto de aniversario',             prioridad: 'ALTA',  fechaVence: '2026-06-03T18:00:00Z' },
  { titulo: 'Coordinar sonido + proyección + alabanza para 15/06', prioridad: 'ALTA', fechaVence: '2026-06-08T18:00:00Z' },
  { titulo: 'Flyer y comunicación del evento aniversario',       prioridad: 'ALTA',  fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Lista de invitados especiales para aniversario',    prioridad: 'MEDIA', fechaVence: '2026-06-07T18:00:00Z' },
  { titulo: 'Convivencia post-culto — organizar catering',       prioridad: 'MEDIA', fechaVence: '2026-06-10T18:00:00Z' },
]
for (const t of tareasEventos) await post(`/ministerios/${eventos.id}/tareas`, t)
await post(`/ministerios/${eventos.id}/checklists`, {
  nombre: 'Checklist evento especial — día anterior', tipo: 'EVENTO',
  items: [
    'Confirmar asistencia de oradores invitados',
    'Verificar montaje de escenario completado',
    'Lista de programa finalizada y distribuida al equipo',
    'Sonido y proyección: ensayo general de 1 hora',
    'Material de bienvenida impreso (programas, folletos)',
    'Área de niños preparada con capacidad extra',
    'Sistema de estacionamiento coordinado',
    'Cadena de oración iniciada con el equipo',
    'Transmisión en vivo: plataformas configuradas y probadas',
  ]
})
console.log(`  ${tareasEventos.length} tareas, 1 checklist`)

// ── 14. MANTENIMIENTO ─────────────────────────────────────────────────────
console.log('\n🔧 MANTENIMIENTO')
const mant = await getOrCreate('MANTENIMIENTO', {
  nombre: 'Mantenimiento y Limpieza', descripcion: 'Rutinas de mantenimiento, limpieza y reparaciones del templo y sus instalaciones.',
  icono: '🔧', color: '#78716C'
})
const equiposMant = [
  { nombre: 'Aspiradora industrial Karcher NT50', tipo: 'limpieza', marca: 'Karcher', modelo: 'NT 50/1 Tact', estado: 'OPERATIVO', ubicacion: 'Depósito' },
  { nombre: 'Generador de emergencia Honda EM10000', tipo: 'eléctrico', marca: 'Honda', modelo: 'EM10000', estado: 'OPERATIVO', ubicacion: 'Patio trasero' },
  { nombre: 'Escalera articulada 8m', tipo: 'herramienta', marca: 'Maderplast', estado: 'OPERATIVO', ubicacion: 'Depósito' },
  { nombre: 'Kit herramientas eléctricas', tipo: 'herramienta', estado: 'OPERATIVO', ubicacion: 'Depósito' },
]
for (const e of equiposMant) await post(`/ministerios/${mant.id}/equipos`, e)
const tareasMant = [
  { titulo: 'Limpieza general profunda pre-aniversario 15/06', prioridad: 'ALTA',   fechaVence: '2026-06-14T09:00:00Z' },
  { titulo: 'Cambio de lámparas nave principal (3 quemadas)',  prioridad: 'ALTA',   fechaVence: '2026-06-01T18:00:00Z' },
  { titulo: 'Reparar aire acondicionado sala de reuniones',    prioridad: 'MEDIA',  fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Pintura de pared sur — daño por humedad',         prioridad: 'MEDIA',  fechaVence: '2026-06-15T18:00:00Z' },
  { titulo: 'Mantenimiento preventivo del generador',          prioridad: 'MEDIA',  fechaVence: '2026-06-10T10:00:00Z' },
  { titulo: 'Desinfección completa de baños (mensual)',         prioridad: 'MEDIA',  fechaVence: '2026-06-01T07:00:00Z' },
]
for (const t of tareasMant) await post(`/ministerios/${mant.id}/tareas`, t)
await post(`/ministerios/${mant.id}/checklists`, {
  nombre: 'Rutina semanal de mantenimiento', tipo: 'SEMANAL',
  items: [
    'Limpieza de salón principal y escenario',
    'Limpieza de baños — reposición de insumos',
    'Limpieza de salones secundarios',
    'Verificar luminarias — reportar quemadas',
    'Revisión de accesos y cerraduras',
    'Vaciar cestos de basura en todos los espacios',
    'Verificar nivel de gas/combustible si corresponde',
    'Reporte de incidencias al coordinador',
  ]
})
console.log(`  ${equiposMant.length} equipos, ${tareasMant.length} tareas, 1 checklist`)

// ── 15. SEGURIDAD ─────────────────────────────────────────────────────────
console.log('\n🦺 SEGURIDAD')
const seg = await getOrCreate('SEGURIDAD', {
  nombre: 'Seguridad y Primeros Auxilios', descripcion: 'Protocolo de seguridad durante cultos y eventos, y respuesta ante emergencias médicas.',
  icono: '🦺', color: '#DC2626'
})
const equiposSeg = [
  { nombre: 'Desfibrilador AED Philips HeartStart', tipo: 'primeros auxilios', marca: 'Philips', modelo: 'HeartStart FRx', estado: 'OPERATIVO', ubicacion: 'Nave principal — pared lateral' },
  { nombre: 'Botiquín grande — nave principal', tipo: 'botiquín', estado: 'OPERATIVO', ubicacion: 'Sacristía' },
  { nombre: 'Botiquín sala niños', tipo: 'botiquín', estado: 'OPERATIVO', ubicacion: 'Sala niños' },
  { nombre: 'Extintores (x4)', tipo: 'extintor', marca: 'Kidde', estado: 'OPERATIVO', ubicacion: 'Nave (x2), Cocina (x1), Salida emergencia (x1)' },
  { nombre: 'Cámara de seguridad — entrada principal', tipo: 'cámara CCTV', marca: 'Hikvision', estado: 'OPERATIVO', ubicacion: 'Fachada entrada' },
  { nombre: 'Cámara seguridad — sala niños', tipo: 'cámara CCTV', marca: 'Hikvision', estado: 'OPERATIVO', ubicacion: 'Sala niños — techo' },
]
for (const e of equiposSeg) await post(`/ministerios/${seg.id}/equipos`, e)
const tareasSeg = [
  { titulo: 'Verificación mensual del AED — electrodos y batería', prioridad: 'URGENTE', fechaVence: '2026-06-01T09:00:00Z' },
  { titulo: 'Recarga de extintores vencidos',                    prioridad: 'URGENTE', fechaVence: '2026-06-05T18:00:00Z' },
  { titulo: 'Simulacro de evacuación — culto de mañana',         prioridad: 'MEDIA',   fechaVence: '2026-06-15T18:00:00Z' },
  { titulo: 'Capacitación RCP básica para líderes',              prioridad: 'ALTA',    fechaVence: '2026-06-20T18:00:00Z' },
  { titulo: 'Actualizar plan de evacuación y señalización',      prioridad: 'MEDIA',   fechaVence: '2026-06-10T18:00:00Z' },
]
for (const t of tareasSeg) await post(`/ministerios/${seg.id}/tareas`, t)
await post(`/ministerios/${seg.id}/checklists`, {
  nombre: 'Protocolo de seguridad por culto', tipo: 'CULTO',
  items: [
    'Asignar responsable de seguridad del turno',
    'Verificar que las salidas de emergencia estén libres',
    'Verificar AED funcional y accesible',
    'Confirmar que hay al menos 1 persona con entrenamiento RCP',
    'Verificar extintores accesibles y vigentes',
    'Recorrida pre-culto de todos los espacios',
    'Número de Emergencias (107/100/911) visible para todos',
    'Protocolos de evacuación conocidos por todos los ujieres',
  ]
})
console.log(`  ${equiposSeg.length} equipos, ${tareasSeg.length} tareas, 1 checklist`)

// ─── RESUMEN FINAL ────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
const final = await api('/ministerios')
console.log(`\n✅ SEED COMPLETADO`)
console.log(`Total ministerios: ${final.length}`)
let totalTareas = 0, totalMiembros = 0
for (const m of final) {
  totalTareas += m.tareasPendientes || 0
  totalMiembros += m.totalMiembros || 0
  console.log(`  ${m.icono} ${m.nombre} — ${m.tareasPendientes} tareas, ${m.totalMiembros} miembros`)
}
console.log(`\nTotal tareas: ${totalTareas}  Total miembros: ${totalMiembros}`)
