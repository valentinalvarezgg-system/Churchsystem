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

function Li({ children }) { return <li style={{marginBottom:6}}>{children}</li> }

export default function Privacidad() {
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
            Política de Privacidad
          </span>
        </div>
        <div style={{fontSize:12, color:c.muted}}>v{VERSION_LEGAL}</div>
      </div>

      <div style={{maxWidth:780, margin:'0 auto', padding:'40px 24px'}}>
        <div style={{background:'rgba(107,92,255,0.08)', border:'1px solid rgba(107,92,255,0.2)',
          borderRadius:14, padding:'20px 24px', marginBottom:40}}>
          <div style={{fontSize:12, fontWeight:700, textTransform:'uppercase',
            letterSpacing:1.5, color:c.pri, marginBottom:6}}>Documento legal</div>
          <h1 style={{fontFamily:"'Sora',sans-serif", fontSize:24, fontWeight:800,
            color:c.text, margin:'0 0 6px'}}>Política de Privacidad</h1>
          <p style={{fontSize:13, color:c.muted, margin:0}}>
            Versión {VERSION_LEGAL} · Vigente desde {FECHA_LEGAL} · {SITIO}
          </p>
        </div>

        <div style={{background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)',
          borderRadius:12, padding:'14px 18px', marginBottom:32, fontSize:14, color:c.text2}}>
          <strong style={{color:'#22c55e'}}>Resumen:</strong>{' '}
          Respetamos la privacidad de organizaciones y personas. Church System no vende bases de datos
          y procesa la información para prestar el servicio, brindar soporte y mantener seguridad.
        </div>

        <Section title="1. Sobre esta política">
          <p>Esta Política explica cómo Church System trata datos personales en su sitio web, plataforma,
          panel administrativo, formularios y comunicaciones. Dado que la plataforma está orientada a
          comunidades religiosas, algunos datos pueden revelar participación comunitaria o afiliación
          religiosa, lo que requiere especial cuidado.</p>
        </Section>

        <Section title="2. Roles en el tratamiento">
          <p style={{marginBottom:10}}><strong style={{color:c.text}}>Datos propios de usuarios de Church System</strong> (cuentas,
          soporte, pagos): Church System actúa como responsable.</p>
          <p><strong style={{color:c.text}}>Datos cargados por la organización usuaria</strong> (miembros, asistentes,
          grupos, notas): la organización es responsable de qué carga, con qué finalidad y qué
          consentimiento obtiene. Church System actúa como proveedor tecnológico.</p>
        </Section>

        <Section title="3. Datos que puede tratar Church System">
          <p style={{marginBottom:10}}>Según el uso de la plataforma, pueden tratarse:</p>
          <ul style={{paddingLeft:20, margin:0}}>
            {['Datos de cuenta: nombre, email, contraseña cifrada, rol, organización',
              'Datos de organización: nombre, contacto, configuración, plan',
              'Datos cargados por la org.: contactos, grupos, asistencia, notas',
              'Datos técnicos: IP, navegador, dispositivo, logs de seguridad',
              'Datos de soporte: mensajes, reportes, historial de contacto',
              'Datos de pago: información necesaria para facturación (procesado por MercadoPago)',
            ].map(f=><Li key={f}>{f}</Li>)}
          </ul>
        </Section>

        <Section title="4. Datos sensibles">
          <p>Church System se orienta a comunidades religiosas. La organización debe obtener
          las autorizaciones necesarias antes de cargar datos que puedan revelar convicciones
          religiosas, datos de salud, información íntima, datos de menores o cualquier categoría
          especialmente protegida. Se recomienda cargar únicamente datos necesarios.</p>
        </Section>

        <Section title="5. Finalidades del tratamiento">
          <ul style={{paddingLeft:20, margin:0}}>
            {['Crear y administrar cuentas','Prestar el servicio contratado',
              'Autenticar usuarios y gestionar permisos','Brindar soporte técnico',
              'Prevenir fraude, abuso o incidentes de seguridad',
              'Enviar comunicaciones operativas y de seguridad',
              'Gestionar pagos y facturación','Cumplir obligaciones legales'].map(f=><Li key={f}>{f}</Li>)}
          </ul>
        </Section>

        <Section title="6. Church System no vende datos">
          <p>Church System <strong style={{color:c.text}}>no vende, alquila ni comercializa</strong> bases de
          datos de organizaciones usuarias. Los datos pueden ser tratados por proveedores técnicos
          necesarios (hosting, email, pagos, seguridad) bajo contratos de confidencialidad.</p>
        </Section>

        <Section title="7. Seguridad">
          <p>Se implementan medidas razonables: autenticación, contraseñas cifradas, HTTPS, roles
          y permisos, backups, logs de eventos y separación lógica por organización. Ninguna medida
          garantiza seguridad absoluta.</p>
          <p style={{marginTop:8}}>Para reportar vulnerabilidades: <a href={`mailto:${EMAILS.seguridad}`}
          style={{color:c.pri}}>{EMAILS.seguridad}</a></p>
        </Section>

        <Section title="8. Derechos de los titulares">
          <p>Los titulares pueden ejercer derechos de acceso, rectificación, actualización y
          supresión. Para datos cargados por una organización, Church System puede derivar la
          solicitud a dicha organización.</p>
          <p style={{marginTop:8}}>Contacto: <a href={`mailto:${EMAILS.privacidad}`}
          style={{color:c.pri}}>{EMAILS.privacidad}</a></p>
        </Section>

        <Section title="9. Menores de edad">
          <p>Church System no está dirigido a menores como usuarios autónomos. Si la organización
          carga datos de menores, debe contar con autorización de padres o tutores y limitar el
          acceso a personas habilitadas.</p>
        </Section>

        <Section title="10. Cambios en esta política">
          <p>Church System puede modificar esta Política para reflejar cambios legales, técnicos
          u operativos. Los cambios sustanciales serán comunicados por medios razonables.</p>
        </Section>

        <div style={{background:c.surf, border:`1px solid ${c.border}`, borderRadius:14,
          padding:'24px', marginTop:40}}>
          <h3 style={{fontFamily:"'Sora',sans-serif", fontSize:16, fontWeight:700,
            color:c.text, margin:'0 0 16px'}}>Contacto de privacidad</h3>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12}}>
            {[['Privacidad', EMAILS.privacidad],['Legal', EMAILS.legal],['Seguridad', EMAILS.seguridad]].map(([l,e])=>(
              <div key={l} style={{padding:'12px 14px', background:'rgba(255,255,255,0.03)',
                borderRadius:10, border:`1px solid ${c.border}`}}>
                <div style={{fontSize:11, fontWeight:700, color:c.muted, textTransform:'uppercase',
                  letterSpacing:1, marginBottom:4}}>{l}</div>
                <a href={`mailto:${e}`} style={{fontSize:13, color:c.pri, textDecoration:'none'}}>{e}</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
