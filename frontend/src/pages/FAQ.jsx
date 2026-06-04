import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CONTACT_CHANNELS, EMAILS } from '../utils/legal.js'

const c = { bg:'#0A0E1A', surf:'rgba(30,41,59,0.85)', border:'rgba(255,255,255,0.08)',
  text:'#F1F5F9', text2:'#CBD5E1', muted:'#64748B', pri:'#6B5CFF' }

const FAQS = [
  {
    cat: 'General',
    items: [
      { q:'¿Qué es Church System?', a:'Church System es una plataforma tecnológica para ayudar a iglesias, comunidades cristianas y ministerios a gestionar personas, grupos, asistencia, reportes y comunicaciones.' },
      { q:'¿Church System es una iglesia?', a:'No. Church System es un proveedor tecnológico. Las decisiones pastorales, administrativas e institucionales corresponden exclusivamente a cada organización usuaria.' },
      { q:'¿Puedo probarla gratis?', a:'Sí. Todos los planes incluyen 14 días de prueba gratuita. No se requiere tarjeta de crédito para empezar.' },
      { q:'¿En qué etapa está la plataforma?', a:'La plataforma está en beta. Algunas funciones pueden cambiar o fallar. No uses Church System como único respaldo de información crítica.' },
    ]
  },
  {
    cat: 'Datos y privacidad',
    items: [
      { q:'¿Church System vende mis datos?', a:'No. Church System no vende, alquila ni comercializa bases de datos. Los datos se procesan para prestar el servicio, brindar soporte y mantener seguridad.' },
      { q:'¿Quién es responsable por los datos cargados?', a:'La organización usuaria es responsable por los datos que carga, modifica, exporta, comparte o elimina. Church System provee la herramienta técnica.' },
      { q:'¿Puedo cargar datos de miembros?', a:'Sí, siempre que la organización tenga base legal o consentimiento suficiente y los datos sean necesarios para la gestión comunitaria.' },
      { q:'¿Puedo cargar datos de menores?', a:'Solo si la organización cuenta con autorización de padres, tutores o representantes legales, y si la carga es estrictamente necesaria.' },
      { q:'¿Puedo exportar mis datos?', a:'Sí. La organización puede solicitar exportación de su información desde el panel o contactando a soporte.' },
      { q:'¿Puedo eliminar mi cuenta?', a:`Sí. Escribí a ${EMAILS.legal}. Algunos datos pueden conservarse temporalmente por obligaciones legales o backups técnicos.` },
    ]
  },
  {
    cat: 'Seguridad',
    items: [
      { q:'¿Cómo protegen mis datos?', a:'Se aplican medidas razonables: HTTPS, contraseñas cifradas, roles y permisos, backups, logs de seguridad y separación lógica entre organizaciones. Ningún sistema es absolutamente seguro.' },
      { q:'¿Cómo reporto una vulnerabilidad?', a:`Escribí a ${EMAILS.seguridad} con descripción del problema, pasos para reproducirlo y captura si es posible. No accedas a datos ajenos ni publiques detalles sin autorización.` },
      { q:'¿Qué hago si creo que alguien accedió a mi cuenta?', a:`Cambiá tu contraseña inmediatamente y escribí a ${EMAILS.seguridad}. Revisá los usuarios activos y revocá accesos sospechosos.` },
    ]
  },
  {
    cat: 'Planes y pagos',
    items: [
      { q:'¿Qué planes están disponibles?', a:'Líder ($15/mes), Culto ($30/mes), Consolidación ($50/mes), Administración ($80/mes) y General ($120/mes). Todos con 14 días de prueba gratis.' },
      { q:'¿Cómo se procesa el pago?', a:'Los pagos se gestionan a través de MercadoPago. Church System no almacena datos de tarjetas.' },
      { q:'¿Puedo cambiar de plan?', a:`Sí. Podés solicitar cambio de plan desde Configuración o escribiendo a ${EMAILS.ventas}.` },
      { q:'¿Qué pasa si no pago?', a:'El acceso a funcionalidades pagas puede suspenderse. La información se conserva durante un período razonable.' },
    ]
  },
  {
    cat: 'Soporte',
    items: [
      { q:'¿Cómo contacto soporte?', a:`Escribí a ${EMAILS.soporte} con: organización, usuario, módulo afectado, pasos para reproducir el error, navegador y dispositivo. No envíes contraseñas.` },
      { q:'¿Cuánto tardan en responder?', a:'Errores críticos: hasta 24hs. Errores altos: 1-3 días hábiles. Consultas generales: 3-7 días hábiles. Los plazos son orientativos durante la etapa beta.' },
      { q:'¿Tienen WhatsApp o chat?', a:'Por ahora el soporte es por email. Próximamente se habilitarán otros canales.' },
    ]
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{borderBottom:`1px solid ${c.border}`}}>
      <button onClick={()=>setOpen(!open)}
        style={{width:'100%', textAlign:'left', padding:'16px 0', background:'none',
          border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between',
          alignItems:'center', gap:12, fontFamily:'inherit'}}>
        <span style={{fontSize:14, fontWeight:600, color:open?'#A78BFA':c.text, lineHeight:1.4}}>{q}</span>
        <span style={{color:c.muted, fontSize:18, flexShrink:0, transition:'transform .2s',
          transform: open?'rotate(45deg)':'rotate(0)'}}>+</span>
      </button>
      {open && (
        <div style={{paddingBottom:16, fontSize:14, color:c.text2, lineHeight:1.7}}>
          {a}
        </div>
      )}
    </div>
  )
}

export default function FAQ() {
  const navigate = useNavigate()
  return (
    <div style={{minHeight:'100vh', background:c.bg, padding:'0 0 60px', fontFamily:"'Inter',sans-serif"}}>
      <div style={{background:'rgba(30,41,59,0.9)', borderBottom:`1px solid ${c.border}`,
        padding:'16px 24px', display:'flex', alignItems:'center', gap:16,
        position:'sticky', top:0, zIndex:10, backdropFilter:'blur(12px)'}}>
        <button onClick={()=>navigate(-1)} style={{background:'none', border:'none',
          cursor:'pointer', color:c.muted, display:'flex', alignItems:'center', gap:6, fontSize:14, padding:0}}>
          ← Volver
        </button>
        <div style={{flex:1, textAlign:'center'}}>
          <span style={{fontFamily:"'Sora',sans-serif", fontWeight:700, color:c.text, fontSize:16}}>
            Preguntas frecuentes
          </span>
        </div>
        <div style={{fontSize:12, color:c.muted}}>FAQ</div>
      </div>

      <div style={{maxWidth:720, margin:'0 auto', padding:'40px 24px'}}>
        <div style={{marginBottom:40}}>
          <h1 style={{fontFamily:"'Sora',sans-serif", fontSize:28, fontWeight:800,
            color:c.text, margin:'0 0 8px'}}>¿En qué podemos ayudarte?</h1>
          <p style={{fontSize:15, color:c.muted}}>
            Respuestas a las preguntas más frecuentes sobre Church System.
          </p>
        </div>

        {FAQS.map(cat => (
          <div key={cat.cat} style={{marginBottom:40}}>
            <div style={{fontSize:12, fontWeight:700, textTransform:'uppercase',
              letterSpacing:2, color:c.pri, marginBottom:16}}>{cat.cat}</div>
            <div style={{background:c.surf, border:`1px solid ${c.border}`,
              borderRadius:14, padding:'0 20px'}}>
              {cat.items.map(item => <FaqItem key={item.q} {...item}/>)}
            </div>
          </div>
        ))}

        {/* Contacto */}
        <div style={{background:c.surf, border:`1px solid ${c.border}`, borderRadius:14, padding:'28px'}}>
          <h3 style={{fontFamily:"'Sora',sans-serif", fontSize:18, fontWeight:700,
            color:c.text, margin:'0 0 6px'}}>¿No encontraste lo que buscabas?</h3>
          <p style={{fontSize:14, color:c.muted, marginBottom:20}}>
            Escribinos directamente. Te respondemos a la brevedad.
          </p>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10}}>
            {CONTACT_CHANNELS.filter(item => item.key !== 'contacto').map(item => (
              <a key={item.label} href={`mailto:${item.email}`}
                style={{padding:'14px', background:'rgba(107,92,255,0.06)',
                  border:'1px solid rgba(107,92,255,0.15)', borderRadius:12,
                  textDecoration:'none', transition:'all .2s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(107,92,255,0.12)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(107,92,255,0.06)'}>
                <div style={{fontSize:13, fontWeight:700, color:c.text, marginBottom:2}}>{item.label}</div>
                <div style={{fontSize:11, color:c.muted, marginBottom:6}}>{item.desc}</div>
                <div style={{fontSize:12, color:c.pri}}>{item.email}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
