import { useNavigate } from 'react-router-dom'
import { EMAILS, SITIO, VERSION_LEGAL, FECHA_LEGAL } from '../utils/legal.js'

const c = { bg:'#0A0E1A', surf:'rgba(30,41,59,0.85)', border:'rgba(255,255,255,0.08)',
  text:'#F1F5F9', text2:'#CBD5E1', muted:'#64748B', pri:'#6B5CFF' }

function Section({ title, children }) {
  return (
    <div style={{marginBottom:32}}>
      <h2 style={{fontFamily:"'Sora',sans-serif", fontSize:17, fontWeight:700,
        color:c.text, margin:'0 0 12px', paddingBottom:8,
        borderBottom:`1px solid ${c.border}`}}>{title}</h2>
      <div style={{fontSize:14, color:c.text2, lineHeight:1.8}}>{children}</div>
    </div>
  )
}

function Li({ children }) {
  return <li style={{marginBottom:6}}>{children}</li>
}

export default function Terminos() {
  const navigate = useNavigate()
  return (
    <div style={{minHeight:'100vh', background:c.bg, padding:'0 0 60px',
      fontFamily:"'Inter',sans-serif"}}>
      {/* Header */}
      <div style={{background:'rgba(30,41,59,0.9)', borderBottom:`1px solid ${c.border}`,
        padding:'16px 24px', display:'flex', alignItems:'center', gap:16,
        position:'sticky', top:0, zIndex:10, backdropFilter:'blur(12px)'}}>
        <button onClick={()=>navigate(-1)}
          style={{background:'none', border:'none', cursor:'pointer', color:c.muted,
            display:'flex', alignItems:'center', gap:6, fontSize:14, padding:0}}>
          ← Volver
        </button>
        <div style={{flex:1, textAlign:'center'}}>
          <span style={{fontFamily:"'Sora',sans-serif", fontWeight:700,
            color:c.text, fontSize:16}}>Términos y Condiciones</span>
        </div>
        <div style={{fontSize:12, color:c.muted}}>v{VERSION_LEGAL}</div>
      </div>

      <div style={{maxWidth:780, margin:'0 auto', padding:'40px 24px'}}>
        {/* Intro */}
        <div style={{background:'rgba(107,92,255,0.08)', border:'1px solid rgba(107,92,255,0.2)',
          borderRadius:14, padding:'20px 24px', marginBottom:40}}>
          <div style={{fontSize:12, fontWeight:700, textTransform:'uppercase',
            letterSpacing:1.5, color:c.pri, marginBottom:6}}>Documento legal</div>
          <h1 style={{fontFamily:"'Sora',sans-serif", fontSize:24, fontWeight:800,
            color:c.text, margin:'0 0 6px'}}>Términos y Condiciones de Uso</h1>
          <p style={{fontSize:13, color:c.muted, margin:0}}>
            Versión {VERSION_LEGAL} · Vigente desde {FECHA_LEGAL} · {SITIO}
          </p>
        </div>

        <Section title="1. Identificación del proveedor">
          <p>Church System es una plataforma tecnológica de gestión para iglesias, comunidades
          cristianas, ministerios y organizaciones afines. Contacto legal: <a href={`mailto:${EMAILS.legal}`}
          style={{color:c.pri}}>{EMAILS.legal}</a></p>
        </Section>

        <Section title="2. Aceptación">
          <p>Al registrarse, crear una cuenta o utilizar Church System, el usuario acepta estos
          Términos junto con la Política de Privacidad y Política de Uso Aceptable. Quien utiliza
          Church System en nombre de una organización declara tener facultades suficientes para
          hacerlo.</p>
        </Section>

        <Section title="3. Naturaleza del servicio">
          <p style={{marginBottom:10}}>Church System es un proveedor tecnológico. No es una iglesia,
          autoridad religiosa, asesor legal ni responsable de decisiones institucionales de las
          organizaciones usuarias. El servicio puede incluir:</p>
          <ul style={{paddingLeft:20, margin:0}}>
            {['Gestión de personas y contactos','Grupos, ministerios y áreas','Asistencia, reportes y estadísticas',
              'Roles y permisos','Mensajes y notificaciones','Exportación de datos',
              'Funcionalidades beta o experimentales'].map(f=><Li key={f}>{f}</Li>)}
          </ul>
        </Section>

        <Section title="4. Responsabilidad sobre los datos">
          <p>La organización usuaria es responsable por los datos que cargue. Debe verificar que
          cuenta con base legal, consentimiento o autorización suficiente para registrar, consultar,
          modificar, compartir, exportar o eliminar información personal. Church System no controla
          preventivamente el contenido cargado por cada organización.</p>
        </Section>

        <Section title="5. Datos sensibles y menores de edad">
          <p>Dado que la plataforma es para comunidades religiosas, ciertos datos pueden revelar
          creencias o participación comunitaria. La organización debe tratarlos con especial cuidado.
          Para datos de menores, es obligatorio contar con autorización suficiente de padres, tutores
          o representantes legales.</p>
        </Section>

        <Section title="6. Conductas prohibidas">
          <ul style={{paddingLeft:20, margin:0}}>
            {['Actos ilegales, fraudulentos o discriminatorios',
              'Cargar datos obtenidos sin autorización',
              'Enviar spam o comunicaciones no autorizadas',
              'Vender o comercializar bases de datos sin autorización',
              'Ingeniería inversa o ataques a la plataforma',
              'Compartir credenciales o crear cuentas falsas',
              'Usar la plataforma para fines ajenos a la gestión comunitaria'
            ].map(f=><Li key={f}>{f}</Li>)}
          </ul>
        </Section>

        <Section title="7. Planes, precios y pagos">
          <p>Church System ofrece planes con distintas funcionalidades. Los precios, medios de pago y
          condiciones se informan en el sitio web o panel de contratación. El acceso a funcionalidades
          pagas puede suspenderse ante falta de pago o incumplimiento. Se ofrecen 30 días de prueba
          gratuita sin cargo.</p>
        </Section>

        <Section title="8. Disponibilidad y mantenimiento">
          <p>Church System procurará mantener el servicio operativo pero no garantiza disponibilidad
          ininterrumpida. El servicio puede verse afectado por mantenimiento, actualizaciones o
          factores externos fuera de su control razonable.</p>
        </Section>

        <Section title="9. Beta y funciones experimentales">
          <div style={{background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
            borderRadius:10, padding:'12px 16px', marginBottom:12}}>
            <strong style={{color:'#f59e0b'}}>Advertencia Aviso Beta:</strong>
            <span style={{color:c.text2}}> Esta plataforma está en etapa beta. Algunas funciones
            pueden cambiar, fallar o no estar disponibles. No uses Church System como único respaldo
            de información crítica.</span>
          </div>
        </Section>

        <Section title="10. Limitación de responsabilidad">
          <p>Church System no será responsable por decisiones de la organización usuaria, datos
          cargados sin autorización, pérdida de datos sin respaldo propio, uso de credenciales
          comprometidas, interrupciones de terceros ni daños indirectos.</p>
        </Section>

        <Section title="11. Baja y eliminación">
          <p>La organización puede solicitar baja, exportación o eliminación de datos. Contactar:
          <a href={`mailto:${EMAILS.legal}`} style={{color:c.pri}}> {EMAILS.legal}</a>. La eliminación
          puede no ser inmediata respecto de backups o registros técnicos necesarios por obligaciones
          legales.</p>
        </Section>

        <Section title="12. Ley aplicable">
          <p>Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia
          se somete a los tribunales competentes del domicilio del proveedor.</p>
        </Section>

        {/* Contacto */}
        <div style={{background:c.surf, border:`1px solid ${c.border}`, borderRadius:14,
          padding:'24px', marginTop:40}}>
          <h3 style={{fontFamily:"'Sora',sans-serif", fontSize:16, fontWeight:700,
            color:c.text, margin:'0 0 16px'}}>Contacto legal</h3>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12}}>
            {[['Legal', EMAILS.legal],['Soporte', EMAILS.soporte],['Privacidad', EMAILS.privacidad]].map(([l,e])=>(
              <div key={l} style={{padding:'12px 14px', background:'rgba(255,255,255,0.03)',
                borderRadius:10, border:`1px solid ${c.border}`}}>
                <div style={{fontSize:11, fontWeight:700, color:c.muted, textTransform:'uppercase',
                  letterSpacing:1, marginBottom:4}}>{l}</div>
                <a href={`mailto:${e}`} style={{fontSize:13, color:c.pri,
                  textDecoration:'none'}}>{e}</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
