export default function FAQ() {
  return (
    <div className="faq-page">
      <h1>Preguntas Frecuentes</h1>

      <div className="faq-item">
        <h3>¿Cómo empiezo?</h3>
        <p>Registrate en churchsystem.com.ar, completá los datos de tu iglesia y empezá a cargar personas y grupos.</p>
      </div>

      <div className="faq-item">
        <h3>¿Cuánto cuesta?</h3>
        <p>Ofrecemos un trial de 14 días gratis. Después, el plan mensual es $X/mes.</p>
      </div>

      <div className="faq-item">
        <h3>¿Puedo importar mi base de datos existente?</h3>
        <p>Sí, podés importar desde Excel. Andá a Personas → Importar.</p>
      </div>

      <div className="faq-item">
        <h3>¿Cómo tomo asistencia con QR?</h3>
        <p>Andá a Asistencia → Generar QR. Las personas escanean el código con su celular y quedan registradas.</p>
      </div>

      <div className="faq-item">
        <h3>¿Los datos están seguros?</h3>
        <p>Sí, usamos encriptación y backups diarios. Nadie más que vos tiene acceso a tus datos.</p>
      </div>

      <div className="faq-item">
        <h3>¿Puedo cancelar en cualquier momento?</h3>
        <p>Sí, podés cancelar cuando quieras desde Configuración.</p>
      </div>

      <div className="faq-item">
        <h3>¿Tienen soporte?</h3>
        <p>Sí, escribinos a contacto@churchsystem.com.ar o usá el botón "Reportar bug" en la app.</p>
      </div>
    </div>
  )
}
