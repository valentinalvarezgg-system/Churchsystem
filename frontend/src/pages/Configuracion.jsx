import { TokenIglesiaAdmin } from '../components/TokenIglesia.jsx'
import React, { useEffect, useState } from 'react'
import Icons from '../components/Icons.jsx'
import { useOrientation } from '../hooks/useOrientation.js'
import Menu from '../components/Menu.jsx'
import BtnNotificaciones from '../components/BtnNotificaciones.jsx'
import { apiFetch, getStoredContext } from '../services/api.js'
import { CONTACT_CHANNELS, EMAILS } from '../utils/legal.js'
import { APP_VERSION } from '../version.js'
import { makeI18n } from '../lib/i18n.js'

const I18N = {
  es: {
    // Categorías
    catIglesia:'Iglesia', catSuscripcion:'Suscripción', catIntegraciones:'Integraciones',
    catPastoral:'Pastoral', catSistema:'Sistema',
    // Secciones
    secGeneral:'General', secCultos:'Cultos', secApariencia:'Apariencia',
    secWhatsapp:'WhatsApp', secDrive:'Google Drive', secIa:'Inteligencia Artificial',
    secEmail:'Email', secAlertas:'Alertas', secSeguimiento:'Seguimiento',
    secSeguridad:'Seguridad', secBackup:'Backup y datos',
    // Descripciones de secciones
    descGeneral:'Nombre, pastor, contacto', descCultos:'Días, turnos y horarios',
    descApariencia:'Color y logo', descWhatsapp:'Meta Cloud API oficial',
    descDrive:'Carpetas y archivos por ministerio', descIa:'Groq · Anthropic · OpenAI',
    descEmail:'Resend — emails masivos', descAlertas:'Umbrales automáticos',
    descSeguimiento:'Frecuencias', descSeguridad:'Sesiones y acceso',
    descBackup:'PostgreSQL · Neon',
    // Medios de pago
    mpMercadopago:'MercadoPago', mpMercadopagoDesc:'Tarjeta, débito, efectivo (Latinoamérica)',
    mpStripe:'Stripe', mpStripeDesc:'Tarjeta de crédito/débito (internacional)',
    mpPayPal:'PayPal', mpPayPalDesc:'Cuenta PayPal (USD, internacional)',
    mpTransferencia:'Transferencia', mpTransferenciaDesc:'Transferencia bancaria manual (24hs hábiles)',
    // Suscripción
    pago:'Pago', cargando:'Cargando...',
    errorLinkPago:'Error al crear el link de pago',
    errorSesionStripe:'Error al crear sesión Stripe',
    errorOrdenPaypal:'Error al crear orden PayPal',
    solicitudRegistrada:'Solicitud registrada. Revisá los datos bancarios.',
    errorSolicitud:'Error al registrar la solicitud',
    estadoSuscripcion:'Estado de tu suscripción',
    ok:'OK', advertencia:'Advertencia',
    trialDias:'Trial — {dias} días restantes',
    suscripcionActiva:'Suscripción activa',
    sinSuscripcion:'Sin suscripción activa',
    vence:'Vence: {fecha}', renovacion:'Renovación: {fecha}',
    activaPlan:'Activá un plan para continuar',
    pagoPendiente:'Pago pendiente para plan {plan}. Se activa al aprobarse.',
    planLabel:'Plan {label}',
    personasIlimitadas:'Personas ilimitadas',
    hastaPersonas:'Hasta {n} personas',
    medioPago:'Medio de pago',
    datosTransferencia:'Datos para transferencia',
    banco:'Banco:', titular:'Titular:', cbu:'CBU:', alias:'Alias:', cuit:'CUIT:', monto:'Monto:',
    diagComercial:'Diagnóstico comercial',
    pendiente:'Pendiente',
    readiness:'Readiness de lanzamiento',
    estado:'Estado:', listoPublicar:'Listo para publicar', faltanAjustes:'Faltan ajustes',
    score:'Score {score}',
    planesDisponibles:'Planes disponibles',
    pagandoCon:'Pagando con {label}',
    okActual:'OK Actual',
    porMes:'/mes',
    ilimitadas:'Ilimitadas',
    solicitar:'Solicitar', suscribirse:'Suscribirse',
    // General
    noSePudoCargar:'No se pudo cargar configuración',
    driveConectado:'Google Drive conectado correctamente.',
    driveError:'No se pudo conectar Google Drive.',
    guardado:'Guardado',
    pruebaSimulada:'Prueba simulada: falta RESEND_API_KEY en producción.',
    emailPruebaEnviado:'Email de prueba enviado.',
    smokeInbound:'Smoke inbound', smokeOutbound:'Smoke outbound',
    smokeEnviado:'{mode} enviado para {email} y ruteado a {routed}.',
    errorUrlConexion:'No se pudo generar la URL de conexión',
    reintentar:'Reintentar',
    configuracion:'Configuración',
    // Campos generales
    nombreIglesia:'Nombre de la iglesia',
    placeholderIglesia:'Iglesia Evangélica...',
    direccion:'Dirección',
    telefono:'Teléfono',
    placeholderTelefono:'+54 11 1234-5678',
    email:'Email',
    pastorPrincipal:'Pastor/a principal',
    placeholderPastor:'Pr. Juan González',
    sitioWeb:'Sitio web',
    placeholderSitioWeb:'https://iglesia.com',
    // Cultos
    diasCulto:'Días de culto (separados por coma)',
    placeholderDiasCulto:'DOMINGO,MIERCOLES',
    ayudaDiasCulto:'En mayúsculas. Ej: DOMINGO,MIERCOLES,VIERNES',
    turnosPorCulto:'Turnos por culto',
    turno:'{n} turno', turnos:'{n} turnos',
    duracionMin:'Duración (minutos)',
    capacidadLugar:'Capacidad del lugar',
    placeholderCapacidad:'200',
    vistaPrevia:'Vista previa',
    // Apariencia
    colorPrincipal:'Color principal',
    urlLogo:'URL del logo',
    placeholderUrl:'https://...',
    temaDefault:'Tema por defecto',
    claro:'Claro', oscuro:'Oscuro',
    churchSystem:'Church System',
    pastor:'Pastor',
    boton:'Botón',
    // WhatsApp
    metaCloudActiva:'Meta Cloud API activa',
    sinConfigurarDemo:'Sin configurar — modo demo / fallback',
    iglesiaWaOficial:'La iglesia ya puede enviar por WhatsApp oficial',
    mensajesRegistrados:'Los mensajes se registran; podés seguir con Twilio solo como legado temporal',
    irAMeta:'Ir a Meta →',
    recomendadoProduccion:'Recomendado para producción. Cada iglesia puede conectar su propio número y sus propios templates, dejando Twilio solo como compatibilidad de transición.',
    provider:'Provider',
    placeholderProvider:'meta_cloud',
    phoneNumberId:'Phone Number ID',
    placeholderPhoneId:'123456789012345',
    waBusinessId:'WhatsApp Business Account ID',
    placeholderBusinessId:'987654321098765',
    accessToken:'Access Token',
    vacioNoCambiar:' — vacío = no cambiar',
    placeholderTokenConfig:'EAAG••••••••', placeholderTokenNuevo:'EAAG...',
    verifyToken:'Verify Token',
    placeholderVerifyToken:'churchsystem-whatsapp-verify',
    estadoLabel:'Estado',
    placeholderEstado:'connected',
    displayPhone:'Display Phone Number',
    placeholderDisplayPhone:'+54 9 11 0000 0000',
    verifiedName:'Verified Name',
    placeholderVerifiedName:'Church System',
    webhookOficial:'Webhook oficial',
    getPost:'GET / POST',
    ayudaWebhook:'Si querés usar un verify token distinto por iglesia, cargalo acá y luego verificá el endpoint con esa conexión.',
    // Google Drive
    drive:'Drive',
    driveConectadoLabel:'Google Drive conectado',
    driveNoConectado:'Google Drive no conectado',
    conectaDrive:'Conectá Drive para leer carpetas y archivos de ministerios.',
    conectando:'Conectando...',
    reconectar:'Reconectar', conectarDrive:'Conectar Drive',
    estadoConexion:'Estado de conexión',
    disconnected:'disconnected',
    correoConectado:'Correo conectado',
    sinConectar:'Sin conectar todavía',
    ultimaConexion:'Última conexión',
    pendienteLabel:'Pendiente',
    comoSeUsa:'Cómo se usa',
    paso1Drive:'Conectá una sola vez la cuenta de Google Drive de la iglesia.',
    paso2Drive:'Luego, en cada ministerio, pegá la carpeta correspondiente.',
    paso3Drive:'La app leerá PDFs, Docs, Sheets y archivos comunes en solo lectura.',
    googleCloudConsole:'Google Cloud Console',
    agregaRedirect:'Agregá este redirect URI en tu cliente OAuth:',
    // IA
    elegirProveedor:'Elegí un proveedor. Groq es gratuito y no necesita tarjeta de crédito.',
    groq:'Groq', groqSub:'Gratis · Llama 3.1', groqUrl:'https://console.groq.com',
    anthropic:'Anthropic', anthropicSub:'Claude · Más preciso', anthropicUrl:'https://console.anthropic.com',
    openai:'OpenAI', openaiSub:'ChatGPT · Popular', openaiUrl:'https://platform.openai.com',
    configurado:'● Configurado',
    obtenerKey:'Obtener key →',
    groqApiKey:'Groq API Key',
    placeholderGroqConfig:'gsk_•••••••', placeholderGroqNuevo:'gsk_...',
    gratisGroq:'Gratis en console.groq.com — sin tarjeta de crédito',
    anthropicApiKey:'Anthropic API Key',
    placeholderAnthropicConfig:'sk-ant-•••', placeholderAnthropicNuevo:'sk-ant-api03-...',
    openaiApiKey:'OpenAI API Key',
    placeholderOpenaiConfig:'sk-•••', placeholderOpenaiNuevo:'sk-proj-...',
    modelos:'Modelos',
    modeloGroq:'llama-3.1-8b-instant', modeloGroqDesc:'Gratis · Muy rápido',
    modeloAnthropic:'claude-haiku-4-5-20251001', modeloAnthropicDesc:'Económico · Preciso',
    modeloOpenai:'gpt-4o-mini', modeloOpenaiDesc:'Equilibrado · Popular',
    activo:'ACTIVO',
    // Email
    emailActivo:'Email activo — Resend configurado',
    sinConfigurarEmail:'Sin configurar — modo demo',
    emailsReales:'Los emails se envían realmente',
    mensajesGuardados:'Los mensajes se guardan pero no se envían',
    irAResend:'Ir a Resend →',
    resendApiKey:'Resend API Key',
    placeholderResendConfig:'re_•••••••', placeholderResendNuevo:'re_...',
    gratisResend:'Gratis hasta 3.000 emails/mes en resend.com',
    emailRemitente:'Email remitente',
    placeholderRemitente:'noreply@tuiglesia.com',
    nombreRemitente:'Nombre del remitente',
    placeholderNombreRemitente:'Iglesia Evangelica',
    diagRenderEmail:'Diagnóstico Render / Email',
    configCompleta:'Configuración completa',
    revisarConfig:'Revisar configuración',
    enviando:'Enviando...', enviarPrueba:'Enviar prueba',
    faltaApiKey:'Falta API key',
    sinDetectar:'Sin detectar',
    dominio:'Dominio', verificar:'(verificar)',
    variablesFaltantes:'Variables faltantes', ninguna:'Ninguna',
    aliasesContacto:'Aliases de contacto',
    fallbackActual:'Fallback seguro actual:',
    probando:'Probando...',
    destino:'Destino:',
    fallbackActivo:'Fallback admin activo',
    configuradoVia:'Configurado via {from}',
    activarResend:'Para activar Resend',
    paso1Resend:'Creá cuenta gratis en resend.com',
    paso2Resend:'Verificá tu dominio (o usá el sandbox de Resend para tests)',
    paso3Resend:'Copiá tu API key y pegála arriba',
    paso4Resend:'Configurá el email remitente con tu dominio verificado',
    // Alertas
    cuandoAlertas:'Cuándo se disparan las alertas pastorales automáticas.',
    sinAsistir:'Sin asistir', cultosConsecutivos:'cultos consecutivos',
    sinSeguimiento:'Sin seguimiento', diasSinContacto:'días sin contacto',
    visitanteSinConsolidar:'Visitante sin consolidar', diasDesdeIngreso:'días desde el ingreso',
    cumpleanos:'Cumpleaños', diasAnticipacion:'días de anticipación',
    cultos:'cultos', dias:'días',
    // Seguimiento
    configSeguimiento:'Configuración del seguimiento pastoral.',
    frecuenciaRecomendada:'Frecuencia recomendada (días entre seguimientos)',
    // Seguridad
    duracionSesion:'Duración de sesión',
    horas:'horas',
    maxIntentos:'Máx. intentos de login',
    bloqueo15min:'→ bloqueo 15 min',
    proteccionesActivas:'Protecciones activas',
    prot1:'JWT con expiración configurable',
    prot2:'Verificación de usuario activo en cada request',
    prot3:'Rate limiting en login y API de IA',
    prot4:'Sanitización de inputs en todos los endpoints',
    prot5:'Aislamiento multi-tenant (datos por iglesia)',
    prot6:'Helmet — headers HTTP de seguridad',
    prot7:'CORS estricto — whitelist de orígenes',
    prot8:'Auditoría de acciones en historial',
    // Backup
    backupDescripcion:'Tus datos viven en PostgreSQL (Neon). Los respaldos automáticos se gestionan desde el panel de Neon o con pg_dump. Acá ves el resumen de tu información.',
    motor:'Motor', postgresql:'PostgreSQL',
    estadoBackup:'Estado', activoNeon:'Activo (Neon)',
    actualizado:'Actualizado',
    resumen:'Resumen',
    backupNeon:'Los respaldos de PostgreSQL se administran desde Neon (recuperación point-in-time automática). Para exportar manualmente usá pg_dump con tu DATABASE_URL.',
    // Footer
    guardando:'Guardando...', guardarCambios:'Guardar cambios',
    notificaciones:'Notificaciones',
    contactoSoporte:'Contacto y soporte',
    documentosLegales:'Documentos legales',
    terminos:'Términos y Condiciones',
    privacidad:'Política de Privacidad',
    faq:'Preguntas frecuentes',
    advertenciaBeta:'Advertencia Beta v{version}:',
    plataformaBeta:'Plataforma en etapa beta. Algunas funciones pueden cambiar o fallar.',
    bajaExportacion:'Para baja o exportación de datos:',
  },
  pt: {
    catIglesia:'Igreja', catSuscripcion:'Assinatura', catIntegraciones:'Integrações',
    catPastoral:'Pastoral', catSistema:'Sistema',
    secGeneral:'Geral', secCultos:'Cultos', secApariencia:'Aparência',
    secWhatsapp:'WhatsApp', secDrive:'Google Drive', secIa:'Inteligência Artificial',
    secEmail:'Email', secAlertas:'Alertas', secSeguimiento:'Acompanhamento',
    secSeguridad:'Segurança', secBackup:'Backup e dados',
    descGeneral:'Nome, pastor, contato', descCultos:'Dias, turnos e horários',
    descApariencia:'Cor e logo', descWhatsapp:'Meta Cloud API oficial',
    descDrive:'Pastas e arquivos por ministério', descIa:'Groq · Anthropic · OpenAI',
    descEmail:'Resend — emails em massa', descAlertas:'Limiares automáticos',
    descSeguimento:'Frequências', descSeguridad:'Sessões e acesso',
    descBackup:'PostgreSQL · Neon',
    mpMercadopago:'MercadoPago', mpMercadopagoDesc:'Cartão, débito, dinheiro (América Latina)',
    mpStripe:'Stripe', mpStripeDesc:'Cartão de crédito/débito (internacional)',
    mpPayPal:'PayPal', mpPayPalDesc:'Conta PayPal (USD, internacional)',
    mpTransferencia:'Transferência', mpTransferenciaDesc:'Transferência bancária manual (24h úteis)',
    pago:'Pagamento', cargando:'Carregando...',
    errorLinkPago:'Erro ao criar link de pagamento',
    errorSesionStripe:'Erro ao criar sessão Stripe',
    errorOrdenPaypal:'Erro ao criar ordem PayPal',
    solicitudRegistrada:'Solicitação registrada. Verifique os dados bancários.',
    errorSolicitud:'Erro ao registrar a solicitação',
    estadoSuscripcion:'Estado da sua assinatura',
    ok:'OK', advertencia:'Aviso',
    trialDias:'Trial — {dias} dias restantes',
    suscripcionActiva:'Assinatura ativa',
    sinSuscripcion:'Sem assinatura ativa',
    vence:'Vence: {fecha}', renovacion:'Renovação: {fecha}',
    activaPlan:'Ative um plano para continuar',
    pagoPendiente:'Pagamento pendente para plano {plan}. Ativa ao ser aprovado.',
    planLabel:'Plano {label}',
    personasIlimitadas:'Pessoas ilimitadas',
    hastaPersonas:'Até {n} pessoas',
    meioPago:'Meio de pagamento',
    datosTransferencia:'Dados para transferência',
    banco:'Banco:', titular:'Titular:', cbu:'CBU:', alias:'Alias:', cuit:'CUIT:', monto:'Valor:',
    diagComercial:'Diagnóstico comercial',
    pendiente:'Pendente',
    readiness:'Readiness de lançamento',
    estado:'Estado:', listoPublicar:'Pronto para publicar', faltanAjustes:'Faltam ajustes',
    score:'Score {score}',
    planesDisponibles:'Planos disponíveis',
    pagandoCon:'Pagando com {label}',
    okActual:'OK Atual',
    porMes:'/mês',
    ilimitadas:'Ilimitadas',
    solicitar:'Solicitar', suscribirse:'Assinar',
    noSePudoCargar:'Não foi possível carregar configuração',
    driveConectado:'Google Drive conectado com sucesso.',
    driveError:'Não foi possível conectar o Google Drive.',
    guardado:'Salvo',
    pruebaSimulada:'Teste simulado: falta RESEND_API_KEY em produção.',
    emailPruebaEnviado:'Email de teste enviado.',
    smokeInbound:'Smoke inbound', smokeOutbound:'Smoke outbound',
    smokeEnviado:'{mode} enviado para {email} e roteado para {routed}.',
    errorUrlConexion:'Não foi possível gerar a URL de conexão',
    reintentar:'Tentar novamente',
    configuracion:'Configuração',
    nomeIglesia:'Nome da igreja',
    placeholderIglesia:'Igreja Evangélica...',
    direccion:'Endereço',
    telefone:'Telefone',
    placeholderTelefone:'+55 11 1234-5678',
    email:'Email',
    pastorPrincipal:'Pastor/a principal',
    placeholderPastor:'Pr. João Silva',
    sitioWeb:'Site',
    placeholderSitioWeb:'https://igreja.com',
    diasCulto:'Dias de culto (separados por vírgula)',
    placeholderDiasCulto:'DOMINGO,QUARTA',
    ayudaDiasCulto:'Em maiúsculas. Ex: DOMINGO,QUARTA,SEXTA',
    turnosPorCulto:'Turnos por culto',
    turno:'{n} turno', turnos:'{n} turnos',
    duracionMin:'Duração (minutos)',
    capacidadeLugar:'Capacidade do local',
    placeholderCapacidad:'200',
    vistaPrevia:'Pré-visualização',
    colorPrincipal:'Cor principal',
    urlLogo:'URL do logo',
    placeholderUrl:'https://...',
    temaDefault:'Tema padrão',
    claro:'Claro', oscuro:'Escuro',
    churchSystem:'Church System',
    pastor:'Pastor',
    boton:'Botão',
    metaCloudActiva:'Meta Cloud API ativa',
    sinConfigurarDemo:'Sem configurar — modo demo / fallback',
    igrejaWaOficial:'A igreja já pode enviar pelo WhatsApp oficial',
    mensajesRegistrados:'As mensagens são registradas; você pode continuar com o Twilio apenas como legado temporário',
    irAMeta:'Ir para Meta →',
    recomendadoProduccion:'Recomendado para produção. Cada igreja pode conectar seu próprio número e seus próprios templates, deixando o Twilio apenas como compatibilidade de transição.',
    provider:'Provedor',
    placeholderProvider:'meta_cloud',
    phoneNumberId:'Phone Number ID',
    placeholderPhoneId:'123456789012345',
    waBusinessId:'WhatsApp Business Account ID',
    placeholderBusinessId:'987654321098765',
    accessToken:'Access Token',
    vacioNoCambiar:' — vazio = não alterar',
    placeholderTokenConfig:'EAAG••••••••', placeholderTokenNuevo:'EAAG...',
    verifyToken:'Verify Token',
    placeholderVerifyToken:'churchsystem-whatsapp-verify',
    estadoLabel:'Estado',
    placeholderEstado:'connected',
    displayPhone:'Display Phone Number',
    placeholderDisplayPhone:'+55 9 11 0000 0000',
    verifiedName:'Verified Name',
    placeholderVerifiedName:'Church System',
    webhookOficial:'Webhook oficial',
    getPost:'GET / POST',
    ayudaWebhook:'Se quiser usar um verify token diferente por igreja, carregue aqui e depois verifique o endpoint com essa conexão.',
    drive:'Drive',
    driveConectadoLabel:'Google Drive conectado',
    driveNoConectado:'Google Drive não conectado',
    conectaDrive:'Conecte o Drive para ler pastas e arquivos dos ministérios.',
    conectando:'Conectando...',
    reconectar:'Reconectar', conectarDrive:'Conectar Drive',
    estadoConexion:'Estado da conexão',
    disconnected:'disconnected',
    correoConectado:'Email conectado',
    sinConectar:'Ainda não conectado',
    ultimaConexion:'Última conexão',
    pendienteLabel:'Pendente',
    comoSeUsa:'Como usar',
    passo1Drive:'Conecte uma única vez a conta do Google Drive da igreja.',
    passo2Drive:'Depois, em cada ministério, cole a pasta correspondente.',
    passo3Drive:'O app lerá PDFs, Docs, Sheets e arquivos comuns em modo somente leitura.',
    googleCloudConsole:'Google Cloud Console',
    agregaRedirect:'Adicione este redirect URI no seu cliente OAuth:',
    elegirProveedor:'Escolha um provedor. O Groq é gratuito e não precisa de cartão de crédito.',
    groq:'Groq', groqSub:'Grátis · Llama 3.1', groqUrl:'https://console.groq.com',
    anthropic:'Anthropic', anthropicSub:'Claude · Mais preciso', anthropicUrl:'https://console.anthropic.com',
    openai:'OpenAI', openaiSub:'ChatGPT · Popular', openaiUrl:'https://platform.openai.com',
    configurado:'● Configurado',
    obterKey:'Obter key →',
    groqApiKey:'Groq API Key',
    placeholderGroqConfig:'gsk_•••••••', placeholderGroqNuevo:'gsk_...',
    gratisGroq:'Grátis em console.groq.com — sem cartão de crédito',
    anthropicApiKey:'Anthropic API Key',
    placeholderAnthropicConfig:'sk-ant-•••', placeholderAnthropicNuevo:'sk-ant-api03-...',
    openaiApiKey:'OpenAI API Key',
    placeholderOpenaiConfig:'sk-•••', placeholderOpenaiNuevo:'sk-proj-...',
    modelos:'Modelos',
    modeloGroq:'llama-3.1-8b-instant', modeloGroqDesc:'Grátis · Muito rápido',
    modeloAnthropic:'claude-haiku-4-5-20251001', modeloAnthropicDesc:'Econômico · Preciso',
    modeloOpenai:'gpt-4o-mini', modeloOpenaiDesc:'Equilibrado · Popular',
    activo:'ATIVO',
    emailActivo:'Email ativo — Resend configurado',
    sinConfigurarEmail:'Sem configurar — modo demo',
    emailsReais:'Os emails são enviados de verdade',
    mensajesGuardados:'As mensagens são salvas mas não enviadas',
    irAResend:'Ir para Resend →',
    resendApiKey:'Resend API Key',
    placeholderResendConfig:'re_•••••••', placeholderResendNuevo:'re_...',
    gratisResend:'Grátis até 3.000 emails/mês em resend.com',
    emailRemitente:'Email remetente',
    placeholderRemitente:'noreply@suaigreja.com',
    nombreRemitente:'Nome do remetente',
    placeholderNombreRemitente:'Igreja Evangélica',
    diagRenderEmail:'Diagnóstico Render / Email',
    configCompleta:'Configuração completa',
    revisarConfig:'Revisar configuração',
    enviando:'Enviando...', enviarPrueba:'Enviar teste',
    faltaApiKey:'Falta API key',
    sinDetectar:'Não detectado',
    dominio:'Domínio', verificar:'(verificar)',
    variablesFaltantes:'Variáveis faltantes', nenhuma:'Nenhuma',
    aliasesContacto:'Aliases de contato',
    fallbackActual:'Fallback seguro atual:',
    probando:'Testando...',
    destino:'Destino:',
    fallbackActivo:'Fallback admin ativo',
    configuradoVia:'Configurado via {from}',
    activarResend:'Para ativar o Resend',
    passo1Resend:'Crie conta grátis em resend.com',
    passo2Resend:'Verifique seu domínio (ou use o sandbox do Resend para testes)',
    passo3Resend:'Copie sua API key e cole acima',
    passo4Resend:'Configure o email remetente com seu domínio verificado',
    cuandoAlertas:'Quando os alertas pastorais automáticos são disparados.',
    sinAsistir:'Sem presença', cultosConsecutivos:'cultos consecutivos',
    sinSeguimiento:'Sem acompanhamento', diasSinContacto:'dias sem contato',
    visitanteSinConsolidar:'Visitante sem consolidação', diasDesdeIngreso:'dias desde a entrada',
    cumpleanos:'Aniversários', diasAnticipacion:'dias de antecedência',
    cultos:'cultos', dias:'dias',
    configSeguimiento:'Configuração do acompanhamento pastoral.',
    frecuenciaRecomendada:'Frequência recomendada (dias entre acompanhamentos)',
    duracionSesion:'Duração da sessão',
    horas:'horas',
    maxIntentos:'Máx. tentativas de login',
    bloqueo15min:'→ bloqueio 15 min',
    proteccionesActivas:'Proteções ativas',
    prot1:'JWT com expiração configurável',
    prot2:'Verificação de usuário ativo em cada request',
    prot3:'Rate limiting no login e API de IA',
    prot4:'Sanitização de inputs em todos os endpoints',
    prot5:'Isolamento multi-tenant (dados por igreja)',
    prot6:'Helmet — headers HTTP de segurança',
    prot7:'CORS restrito — whitelist de origens',
    prot8:'Auditoria de ações no histórico',
    backupDescripcion:'Seus dados vivem no PostgreSQL (Neon). Os backups automáticos são gerenciados no painel do Neon ou com pg_dump. Aqui você vê o resumo das suas informações.',
    motor:'Motor', postgresql:'PostgreSQL',
    estadoBackup:'Estado', activoNeon:'Ativo (Neon)',
    actualizado:'Atualizado',
    resumen:'Resumo',
    backupNeon:'Os backups do PostgreSQL são gerenciados no Neon (recuperação point-in-time automática). Para exportar manualmente use pg_dump com seu DATABASE_URL.',
    guardando:'Salvando...', guardarCambios:'Salvar alterações',
    notificaciones:'Notificações',
    contactoSoporte:'Contato e suporte',
    documentosLegales:'Documentos legais',
    terminos:'Termos e Condições',
    privacidad:'Política de Privacidade',
    faq:'Perguntas frequentes',
    advertenciaBeta:'Aviso Beta v{version}:',
    plataformaBeta:'Plataforma em fase beta. Algumas funções podem mudar ou falhar.',
    baixaExportacao:'Para exclusão ou exportação de dados:',
  },
  en: {
    catIglesia:'Church', catSuscripcion:'Subscription', catIntegraciones:'Integrations',
    catPastoral:'Pastoral', catSistema:'System',
    secGeneral:'General', secCultos:'Services', secApariencia:'Appearance',
    secWhatsapp:'WhatsApp', secDrive:'Google Drive', secIa:'Artificial Intelligence',
    secEmail:'Email', secAlertas:'Alerts', secSeguimiento:'Follow-up',
    secSeguridad:'Security', secBackup:'Backup & data',
    descGeneral:'Name, pastor, contact', descCultos:'Days, shifts and schedules',
    descApariencia:'Color and logo', descWhatsapp:'Official Meta Cloud API',
    descDrive:'Folders and files by ministry', descIa:'Groq · Anthropic · OpenAI',
    descEmail:'Resend — bulk emails', descAlertas:'Automatic thresholds',
    descSeguimento:'Frequencies', descSeguridad:'Sessions and access',
    descBackup:'PostgreSQL · Neon',
    mpMercadopago:'MercadoPago', mpMercadopagoDesc:'Card, debit, cash (Latin America)',
    mpStripe:'Stripe', mpStripeDesc:'Credit/debit card (international)',
    mpPayPal:'PayPal', mpPayPalDesc:'PayPal account (USD, international)',
    mpTransferencia:'Transfer', mpTransferenciaDesc:'Manual bank transfer (24 business hours)',
    pago:'Payment', cargando:'Loading...',
    errorLinkPago:'Error creating payment link',
    errorSesionStripe:'Error creating Stripe session',
    errorOrdenPaypal:'Error creating PayPal order',
    solicitudRegistrada:'Request registered. Check your bank details.',
    errorSolicitud:'Error registering request',
    estadoSuscripcion:'Your subscription status',
    ok:'OK', advertencia:'Warning',
    trialDias:'Trial — {dias} days left',
    suscripcionActive:'Active subscription',
    sinSuscripcion:'No active subscription',
    vence:'Expires: {fecha}', renovacion:'Renewal: {fecha}',
    activaPlan:'Activate a plan to continue',
    pagoPendiente:'Pending payment for plan {plan}. Activates upon approval.',
    planLabel:'Plan {label}',
    personasIlimitadas:'Unlimited people',
    hastaPersonas:'Up to {n} people',
    medioPago:'Payment method',
    datosTransferencia:'Bank transfer details',
    banco:'Bank:', titular:'Holder:', cbu:'CBU:', alias:'Alias:', cuit:'CUIT:', monto:'Amount:',
    diagComercial:'Commercial diagnostics',
    pendiente:'Pending',
    readiness:'Launch readiness',
    estado:'Status:', listoPublicar:'Ready to publish', faltanAjustes:'Missing settings',
    score:'Score {score}',
    planesDisponibles:'Available plans',
    pagandoCon:'Paying with {label}',
    okActual:'Current OK',
    porMes:'/month',
    ilimitadas:'Unlimited',
    solicitar:'Request', suscribirse:'Subscribe',
    noSePudoCargar:'Could not load configuration',
    driveConectado:'Google Drive connected successfully.',
    driveError:'Could not connect Google Drive.',
    guardado:'Saved',
    pruebaSimulada:'Simulated test: RESEND_API_KEY missing in production.',
    emailPruebaEnviado:'Test email sent.',
    smokeInbound:'Smoke inbound', smokeOutbound:'Smoke outbound',
    smokeEnviado:'{mode} sent for {email} and routed to {routed}.',
    errorUrlConexion:'Could not generate connection URL',
    reintentar:'Retry',
    configuracion:'Settings',
    nombreIglesia:'Church name',
    placeholderIglesia:'Evangelical Church...',
    direccion:'Address',
    telefono:'Phone',
    placeholderTelefono:'+1 555 123-4567',
    email:'Email',
    pastorPrincipal:'Lead pastor',
    placeholderPastor:'Pr. John Smith',
    sitioWeb:'Website',
    placeholderSitioWeb:'https://church.com',
    diasCulto:'Service days (comma separated)',
    placeholderDiasCulto:'SUNDAY,WEDNESDAY',
    ayudaDiasCulto:'Uppercase. Ex: SUNDAY,WEDNESDAY,FRIDAY',
    turnosPorCulto:'Shifts per service',
    turno:'{n} shift', turnos:'{n} shifts',
    duracionMin:'Duration (minutes)',
    capacidadLugar:'Venue capacity',
    placeholderCapacidad:'200',
    vistaPrevia:'Preview',
    colorPrincipal:'Primary color',
    urlLogo:'Logo URL',
    placeholderUrl:'https://...',
    temaDefault:'Default theme',
    claro:'Light', oscuro:'Dark',
    churchSystem:'Church System',
    pastor:'Pastor',
    boton:'Button',
    metaCloudActiva:'Meta Cloud API active',
    sinConfigurarDemo:'Not configured — demo mode / fallback',
    igrejaWaOficial:'The church can now send via official WhatsApp',
    mensajesRegistrados:'Messages are registered; you can keep using Twilio as a temporary legacy',
    irAMeta:'Go to Meta →',
    recomendadoProduccion:'Recommended for production. Each church can connect its own number and templates, leaving Twilio as transition compatibility only.',
    provider:'Provider',
    placeholderProvider:'meta_cloud',
    phoneNumberId:'Phone Number ID',
    placeholderPhoneId:'123456789012345',
    waBusinessId:'WhatsApp Business Account ID',
    placeholderBusinessId:'987654321098765',
    accessToken:'Access Token',
    vacioNoCambiar:' — empty = no change',
    placeholderTokenConfig:'EAAG••••••••', placeholderTokenNuevo:'EAAG...',
    verifyToken:'Verify Token',
    placeholderVerifyToken:'churchsystem-whatsapp-verify',
    estadoLabel:'Status',
    placeholderEstado:'connected',
    displayPhone:'Display Phone Number',
    placeholderDisplayPhone:'+1 555 000 0000',
    verifiedName:'Verified Name',
    placeholderVerifiedName:'Church System',
    webhookOficial:'Official webhook',
    getPost:'GET / POST',
    ayudaWebhook:'If you want to use a different verify token per church, load it here and then verify the endpoint with that connection.',
    drive:'Drive',
    driveConectadoLabel:'Google Drive connected',
    driveNoConectado:'Google Drive not connected',
    conectaDrive:'Connect Drive to read ministry folders and files.',
    conectando:'Connecting...',
    reconectar:'Reconnect', conectarDrive:'Connect Drive',
    estadoConexion:'Connection status',
    disconnected:'disconnected',
    correoConectado:'Connected email',
    sinConectar:'Not connected yet',
    ultimaConexion:'Last connection',
    pendienteLabel:'Pending',
    comoSeUsa:'How it works',
    passo1Drive:'Connect the church\'s Google Drive account once.',
    passo2Drive:'Then, in each ministry, paste the corresponding folder.',
    passo3Drive:'The app will read PDFs, Docs, Sheets and common files in read-only mode.',
    googleCloudConsole:'Google Cloud Console',
    agregaRedirect:'Add this redirect URI in your OAuth client:',
    elegirProveedor:'Choose a provider. Groq is free and requires no credit card.',
    groq:'Groq', groqSub:'Free · Llama 3.1', groqUrl:'https://console.groq.com',
    anthropic:'Anthropic', anthropicSub:'Claude · More precise', anthropicUrl:'https://console.anthropic.com',
    openai:'OpenAI', openaiSub:'ChatGPT · Popular', openaiUrl:'https://platform.openai.com',
    configurado:'● Configured',
    obtenerKey:'Get key →',
    groqApiKey:'Groq API Key',
    placeholderGroqConfig:'gsk_•••••••', placeholderGroqNuevo:'gsk_...',
    gratisGroq:'Free at console.groq.com — no credit card',
    anthropicApiKey:'Anthropic API Key',
    placeholderAnthropicConfig:'sk-ant-•••', placeholderAnthropicNuevo:'sk-ant-api03-...',
    openaiApiKey:'OpenAI API Key',
    placeholderOpenaiConfig:'sk-•••', placeholderOpenaiNuevo:'sk-proj-...',
    modelos:'Models',
    modeloGroq:'llama-3.1-8b-instant', modeloGroqDesc:'Free · Very fast',
    modeloAnthropic:'claude-haiku-4-5-20251001', modeloAnthropicDesc:'Economical · Precise',
    modeloOpenai:'gpt-4o-mini', modeloOpenaiDesc:'Balanced · Popular',
    activo:'ACTIVE',
    emailActivo:'Email active — Resend configured',
    sinConfigurarEmail:'Not configured — demo mode',
    emailsReais:'Emails are actually sent',
    mensajesGuardados:'Messages are saved but not sent',
    irAResend:'Go to Resend →',
    resendApiKey:'Resend API Key',
    placeholderResendConfig:'re_•••••••', placeholderResendNuevo:'re_...',
    gratisResend:'Free up to 3,000 emails/month at resend.com',
    emailRemitente:'Sender email',
    placeholderRemitente:'noreply@yourchurch.com',
    nombreRemitente:'Sender name',
    placeholderNombreRemitente:'Evangelical Church',
    diagRenderEmail:'Render / Email diagnostics',
    configCompleta:'Configuration complete',
    revisarConfig:'Review configuration',
    enviando:'Sending...', enviarPrueba:'Send test',
    faltaApiKey:'API key missing',
    sinDetectar:'Not detected',
    dominio:'Domain', verificar:'(verify)',
    variablesFaltantes:'Missing variables', ninguna:'None',
    aliasesContacto:'Contact aliases',
    fallbackActual:'Current safe fallback:',
    probando:'Testing...',
    destino:'Destination:',
    fallbackActivo:'Admin fallback active',
    configuradoVia:'Configured via {from}',
    activarResend:'To activate Resend',
    passo1Resend:'Create a free account at resend.com',
    passo2Resend:'Verify your domain (or use the Resend sandbox for tests)',
    passo3Resend:'Copy your API key and paste it above',
    passo4Resend:'Configure the sender email with your verified domain',
    cuandoAlertas:'When automatic pastoral alerts are triggered.',
    sinAsistir:'Not attending', cultosConsecutivos:'consecutive services',
    sinSeguimiento:'No follow-up', diasSinContacto:'days without contact',
    visitanteSinConsolidar:'Unconsolidated visitor', diasDesdeIngreso:'days since joining',
    cumpleanos:'Birthdays', diasAnticipacion:'days in advance',
    cultos:'services', dias:'days',
    configSeguimiento:'Pastoral follow-up configuration.',
    frecuenciaRecomendada:'Recommended frequency (days between follow-ups)',
    duracionSesion:'Session duration',
    horas:'hours',
    maxIntentos:'Max login attempts',
    bloqueo15min:'→ 15 min lock',
    proteccionesActivas:'Active protections',
    prot1:'JWT with configurable expiration',
    prot2:'Active user verification on every request',
    prot3:'Rate limiting on login and AI API',
    prot4:'Input sanitization on all endpoints',
    prot5:'Multi-tenant isolation (data per church)',
    prot6:'Helmet — HTTP security headers',
    prot7:'Strict CORS — origin whitelist',
    prot8:'Action audit in history',
    backupDescripcion:'Your data lives in PostgreSQL (Neon). Automatic backups are managed from the Neon panel or with pg_dump. Here you see a summary of your information.',
    motor:'Engine', postgresql:'PostgreSQL',
    estadoBackup:'Status', activoNeon:'Active (Neon)',
    actualizado:'Updated',
    resumen:'Summary',
    backupNeon:'PostgreSQL backups are managed from Neon (automatic point-in-time recovery). To export manually use pg_dump with your DATABASE_URL.',
    guardando:'Saving...', guardarCambios:'Save changes',
    notificaciones:'Notifications',
    contactoSoporte:'Contact & support',
    documentosLegales:'Legal documents',
    terminos:'Terms & Conditions',
    privacidad:'Privacy Policy',
    faq:'FAQ',
    advertenciaBeta:'Beta warning v{version}:',
    plataformaBeta:'Platform in beta stage. Some features may change or fail.',
    bajaExportacion:'For data deletion or export:',
  },
}

const CAMPOS = {
  general:     ['nombre_iglesia','direccion','telefono_iglesia','email_iglesia','pastor_nombre','sitio_web'],
  cultos:      ['cultos_dias','cultos_turnos','culto_duracion','culto_capacidad'],
  apariencia:  ['color_primario','logo_url','modo_oscuro_default'],
  whatsapp:    ['wa_phone_number_id','wa_business_account_id','wa_status'],
  ia:          ['ia_proveedor'],
  email:       ['resend_key','email_from','email_nombre'],
  alertas:     ['alerta_sin_asistir','alerta_sin_seguimiento','alerta_visitante','alerta_cumple'],
  seguimiento: ['seg_frecuencia_default'],
  seguridad:   ['sesion_horas','max_intentos'],
  backup:      [],
}

function getCategorias(t) {
  return [
    { key:'iglesia', label:t('catIglesia'), icon:'', secciones:[
      { key:'general',    icon:Icons.Building, label:t('secGeneral'),    desc:t('descGeneral') },
      { key:'cultos',     icon:Icons.Calendar, label:t('secCultos'),     desc:t('descCultos') },
      { key:'apariencia', icon:Icons.Settings, label:t('secApariencia'), desc:t('descApariencia') },
    ]},
    { key:'suscripcion', label:t('catSuscripcion'), icon:Icons.Premium, secciones:[] },
    { key:'integraciones', label:t('catIntegraciones'), icon:'', secciones:[
      { key:'whatsapp', icon:Icons.Messages, label:t('secWhatsapp'), desc:t('descWhatsapp') },
      { key:'drive',    icon:Icons.FileText, label:t('secDrive'),    desc:t('descDrive') },
      { key:'ia',       icon:Icons.AI, label:t('secIa'),             desc:t('descIa') },
      { key:'email',    icon:Icons.Mail, label:t('secEmail'),         desc:t('descEmail') },
    ]},
    { key:'pastoral', label:t('catPastoral'), icon:Icons.History, secciones:[
      { key:'alertas',     icon:Icons.Comunicados, label:t('secAlertas'),     desc:t('descAlertas') },
      { key:'seguimiento', icon:Icons.Clock, label:t('secSeguimiento'), desc:t('descSeguimiento') },
    ]},
    { key:'sistema', label:t('catSistema'), icon:Icons.Settings, secciones:[
      { key:'seguridad', icon:Icons.Shield, label:t('secSeguridad'), desc:t('descSeguridad') },
      { key:'backup',    icon:Icons.Archive, label:t('secBackup'),    desc:t('descBackup') },
    ]},
  ]
}

function getMetodosPago(t) {
  return [
    { key:'mercadopago', label:t('mpMercadopago'), icon:'', desc:t('mpMercadopagoDesc') },
    { key:'stripe',      label:t('mpStripe'),      icon:'', desc:t('mpStripeDesc') },
    { key:'paypal',      label:t('mpPayPal'),      icon:'🅿',  desc:t('mpPayPalDesc') },
    { key:'transferencia', label:t('mpTransferencia'), icon:'', desc:t('mpTransferenciaDesc') },
  ]
}

function badge(sec, cfg) {
  if (sec==='whatsapp') return cfg.whatsapp_cloud_configurado ? 'ok' : 'warn'
  if (sec==='drive')    return cfg.google_drive_configurado ? 'ok' : 'warn'
  if (sec==='ia')       return (cfg.anthropic_ok||cfg.openai_ok||cfg.groq_ok) ? 'ok' : 'warn'
  if (sec==='email')    return cfg.email_configurado ? 'ok' : 'warn'
  return null
}


function SuscripcionTab() {
  const t = makeI18n(I18N)
  const [estado, setEstado]     = React.useState(null)
  const [planes, setPlanes]     = React.useState([])
  const [loading, setLoading]   = React.useState(false)
  const [msg, setMsg]           = React.useState(null)
  const [billingCtx, setBillingCtx] = React.useState(getStoredContext())
  const [diag, setDiag]         = React.useState(null)
  const [readiness, setReadiness] = React.useState(null)
  const [metodo, setMetodo]     = React.useState('mercadopago')
  const [datosTransf, setDatosTransf] = React.useState(null)
  const metodosPago = getMetodosPago(t)

  React.useEffect(() => {
    Promise.all([
      apiFetch('/mp/estado').catch(() => null),
      apiFetch('/config').catch(() => ({})),
    ]).then(([estadoRes, cfg]) => {
      if (estadoRes) setEstado(estadoRes)
      const ctx = {
        country: cfg.pais || cfg.country || billingCtx.country || 'AR',
        currency: cfg.divisa || cfg.currency || billingCtx.currency || 'ARS',
        lang: cfg.idioma || cfg.lang || billingCtx.lang || 'es',
        promo: cfg.promoCode || billingCtx.promo || '',
      }
      setBillingCtx(ctx)
      apiFetch(`/mp/planes?country=${ctx.country}&lang=${ctx.lang}`).then(setPlanes).catch(() => {})
      apiFetch('/config/commercial-diagnostics').then(setDiag).catch(() => {})
      apiFetch('/config/launch-readiness').then(setReadiness).catch(() => {})
    })
  }, [])

  async function pagar(planId) {
    setLoading(true); setMsg(null)
    try {
      if (metodo === 'mercadopago') {
        const r = await apiFetch('/mp/crear-preferencia', {
          method:'POST',
          body: JSON.stringify({ plan: planId, country: billingCtx.country, currency: billingCtx.currency, promo: billingCtx.promo }),
        })
        if (r.initPoint) window.open(r.initPoint, '_blank')
        else setMsg({ type:'error', text: r.error || t('errorLinkPago') })

      } else if (metodo === 'stripe') {
        const r = await apiFetch('/stripe/crear-sesion', {
          method:'POST',
          body: JSON.stringify({ plan: planId, currency: 'USD', promo: billingCtx.promo }),
        })
        if (r.url) window.open(r.url, '_blank')
        else setMsg({ type:'error', text: r.error || t('errorSesionStripe') })

      } else if (metodo === 'paypal') {
        const r = await apiFetch('/paypal/crear-orden', {
          method:'POST',
          body: JSON.stringify({ plan: planId, promo: billingCtx.promo }),
        })
        if (r.approveUrl) window.open(r.approveUrl, '_blank')
        else setMsg({ type:'error', text: r.error || t('errorOrdenPaypal') })

      } else if (metodo === 'transferencia') {
        const r = await apiFetch('/transferencia/solicitar', {
          method:'POST',
          body: JSON.stringify({ plan: planId }),
        })
        if (r.ok) {
          setDatosTransf(r)
          setMsg({ type:'success', text: r.mensaje || t('solicitudRegistrada') })
        } else {
          setMsg({ type:'error', text: r.error || t('errorSolicitud') })
        }
      }
    } catch(e) { setMsg({ type:'error', text: e.message }) }
    setLoading(false)
  }

  if (!estado) return <div className="empty"><div className="empty-icon">{t('pago')}</div><p>{t('cargando')}</p></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Estado actual */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>{t('estadoSuscripcion')}</h3>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:160, padding:'14px 16px', borderRadius:'var(--r-lg)', background: estado.activo ? 'var(--c-success-bg)' : 'var(--c-warning-bg)', border: `1px solid ${estado.activo ? 'var(--c-success-brd)' : 'var(--c-warning-brd)'}` }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{estado.activo ? t('ok') : t('advertencia')}</div>
            <div style={{ fontSize:14, fontWeight:700, color: estado.activo ? 'var(--c-success)' : 'var(--c-warning)' }}>
              {estado.enTrial ? t('trialDias').replace('{dias}', estado.diasTrial) : estado.suscActiva ? t('suscripcionActiva') : t('sinSuscripcion')}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {estado.enTrial ? t('vence').replace('{fecha}', estado.trialFin) : estado.suscVence ? t('renovacion').replace('{fecha}', estado.suscVence) : t('activaPlan')}
            </div>
            {!!estado.planPendiente && (
              <div style={{ fontSize:11, color:'var(--c-warning)', marginTop:6, fontWeight:600 }}>
                {t('pagoPendiente').replace('{plan}', estado.planPendiente)}
              </div>
            )}
          </div>
          <div style={{ flex:1, minWidth:160, padding:'14px 16px', borderRadius:'var(--r-lg)', background:'var(--c-info-bg)', border:'1px solid var(--c-info-brd)' }}>
            <div style={{ fontSize:22, marginBottom:4 }}></div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--c-info)' }}>{t('planLabel').replace('{label}', estado.planLabel)}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {estado.personasMax === 99999 ? t('personasIlimitadas') : t('hastaPersonas').replace('{n}', estado.personasMax)}
            </div>
          </div>
        </div>
      </div>

      {/* Selector de medio de pago */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>{t('medioPago')}</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:8 }}>
          {metodosPago.map(m => (
            <button key={m.key} onClick={() => setMetodo(m.key)} style={{
              padding:'12px 14px',
              borderRadius:'var(--r-lg)',
              border: metodo === m.key ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: metodo === m.key ? 'var(--primary-soft)' : 'var(--surface)',
              cursor:'pointer',
              textAlign:'left',
            }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{m.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color: metodo === m.key ? 'var(--primary)' : 'var(--text)' }}>{m.label}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, lineHeight:1.3 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Datos bancarios (transferencia) */}
      {datosTransf?.datos && (
        <div className="card" style={{ padding:'20px 24px', border:'1px solid var(--c-info-brd)', background:'var(--c-info-bg)' }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>{t('datosTransferencia')}</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13 }}>
            {datosTransf.datos.banco   && <div><b>{t('banco')}</b> {datosTransf.datos.banco}</div>}
            {datosTransf.datos.titular && <div><b>{t('titular')}</b> {datosTransf.datos.titular}</div>}
            {datosTransf.datos.cbu     && <div><b>{t('cbu')}</b> {datosTransf.datos.cbu}</div>}
            {datosTransf.datos.alias   && <div><b>{t('alias')}</b> {datosTransf.datos.alias}</div>}
            {datosTransf.datos.cuit    && <div><b>{t('cuit')}</b> {datosTransf.datos.cuit}</div>}
            {datosTransf.monto         && <div><b>{t('monto')}</b> {datosTransf.monto}</div>}
            {datosTransf.datos.nota    && <div style={{ marginTop:6, color:'var(--c-info)', fontStyle:'italic' }}>{datosTransf.datos.nota}</div>}
          </div>
        </div>
      )}

      {/* Diagnóstico comercial */}
      {diag && (
        <div className="card" style={{ padding:'20px 24px' }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>{t('diagComercial')}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
            {(diag.checks || []).map(c => (
              <div key={c.key} style={{
                padding:'10px 12px', borderRadius:'var(--r)',
                border:`1px solid ${c.ok ? 'var(--c-success-brd)' : 'var(--c-warning-brd)'}`,
                background: c.ok ? 'var(--c-success-bg)' : 'var(--c-warning-bg)',
              }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.4, color:'var(--text-muted)' }}>{c.key}</div>
                <div style={{ fontSize:13, fontWeight:700, color:c.ok ? 'var(--c-success)' : 'var(--c-warning)' }}>{c.ok ? t('ok') : t('pendiente')}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{c.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {readiness && (
        <div className="card" style={{ padding:'20px 24px' }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>{t('readiness')}</h3>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>
            {t('estado')} <b style={{ color: readiness.ok ? 'var(--c-success)' : 'var(--c-warning)' }}>{readiness.ok ? t('listoPublicar') : t('faltanAjustes')}</b> · {t('score').replace('{score}', readiness.score)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10 }}>
            {(readiness.checks || []).map(c => (
              <div key={c.key} style={{ padding:'10px 12px', borderRadius:'var(--r)', border:`1px solid ${c.ok ? 'var(--c-success-brd)' : 'var(--c-warning-brd)'}`, background: c.ok ? 'var(--c-success-bg)' : 'var(--c-warning-bg)' }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)' }}>{c.key}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{c.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Planes */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>{t('planesDisponibles')}</h3>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
          {t('pagandoCon').replace('{label}', metodosPago.find(m => m.key === metodo)?.label)}
          {metodo === 'paypal' ? ' (USD)' : metodo === 'stripe' ? ' (USD)' : ` (${billingCtx.currency || 'ARS'})`}
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
          {planes.map(p => (
            <div key={p.id} style={{
              padding:'16px', borderRadius:'var(--r-lg)',
              border: p.id === estado.plan ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: p.id === estado.plan ? 'var(--primary-soft)' : 'var(--surface)',
            }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                {p.label} {p.id === estado.plan && t('okActual')}
              </div>
              <div style={{ fontSize:26, fontWeight:800, marginBottom:4 }}>
                {p.currency || 'ARS'} {Number(p.precio || 0).toLocaleString('es-AR')}
                <span style={{ fontSize:13, fontWeight:400, color:'var(--text-muted)' }}>{t('porMes')}</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>
                {p.personas === 99999 ? t('ilimitadas') : `${t('hastaPersonas').replace('{n}', p.personas)}`}
              </div>
              <button className="btn btn-primary btn-sm" style={{ width:'100%' }}
                onClick={() => pagar(p.id)} disabled={loading}>
                {loading ? '…' : metodo === 'transferencia' ? t('solicitar') : t('suscribirse')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const t = makeI18n(I18N)
  const categorias = getCategorias(t)
  const { isPhone } = useOrientation()
  const [sec, setSec]         = useState(() => new URLSearchParams(window.location.search).get('sec') || 'general')
  const [config, setConfig]   = useState({})
  const [form, setForm]       = useState({})
  const [msg, setMsg]         = useState(null)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [backupInfo, setBackupInfo] = useState(null)
  const [collapsed, setCollapsed]   = useState({})
  const [emailDiag, setEmailDiag]   = useState(null)
  const [testingEmail, setTestingEmail] = useState(false)
  const [contactAlias, setContactAlias] = useState('soporte')
  const [smokeRunning, setSmokeRunning] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [driveConnecting, setDriveConnecting] = useState(false)
  const publicOrigin = window.location.origin.replace('/app', '')

  useEffect(() => {
    setLoadError(null)
    Promise.all([
      apiFetch('/config').catch(() => ({})),
      apiFetch('/backup/info').catch(() => null),
      apiFetch('/config/email-diagnostics').catch(() => null),
    ]).then(([c, b, diag]) => {
      const cfg = c || {}
      setConfig(cfg)
      setForm({
        nombre_iglesia:    cfg.nombre_iglesia    || '',
        direccion:         cfg.direccion         || '',
        telefono_iglesia:  cfg.telefono_iglesia  || '',
        email_iglesia:     cfg.email_iglesia     || '',
        pastor_nombre:     cfg.pastor_nombre     || '',
        sitio_web:         cfg.sitio_web         || '',
        cultos_dias:       cfg.cultos_dias       || 'DOMINGO',
        cultos_turnos:     cfg.cultos_turnos     || '1',
        culto_duracion:    cfg.culto_duracion    || '90',
        culto_capacidad:   cfg.culto_capacidad   || '',
        color_primario:    cfg.color_primario    || '#2563EB',
        logo_url:          cfg.logo_url          || '',
        modo_oscuro_default: cfg.modo_oscuro_default || '0',
        twilio_sid:        cfg.twilio_sid        || '',
        twilio_token:      '',
        resend_key:        '',
        email_from:        cfg.email_from     || '',
        email_nombre:      cfg.email_nombre   || '',
        twilio_from:       cfg.twilio_from       || '',
        ia_proveedor:      cfg.ia_proveedor      || 'groq',
        anthropic_key:     '',
        openai_key:        '',
        groq_key:          '',
        alerta_sin_asistir:     cfg.alerta_sin_asistir     || '3',
        alerta_sin_seguimiento: cfg.alerta_sin_seguimiento || '30',
        alerta_visitante:       cfg.alerta_visitante       || '14',
        alerta_cumple:          cfg.alerta_cumple          || '7',
        seg_frecuencia_default: cfg.seg_frecuencia_default || '30',
        sesion_horas:      cfg.sesion_horas      || '8',
        max_intentos:      cfg.max_intentos      || '10',
      })
      setBackupInfo(b)
      setEmailDiag(diag)
      setLoading(false)
    }).catch((e) => {
      setLoadError(e.message || t('noSePudoCargar'))
      setLoading(false)
    })

    const params = new URLSearchParams(window.location.search)
    if (params.get('drive') === 'connected') {
      setMsg({ type: 'success', text: t('driveConectado') })
    } else if (params.get('error') === 'drive_failed') {
      setMsg({ type: 'error', text: t('driveError') })
    }
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg(null)
    const payload = {}
    for (const k of (CAMPOS[sec] || [])) if (form[k] !== undefined && form[k] !== '') payload[k] = form[k]
    if (sec === 'whatsapp' && form.twilio_token) payload.twilio_token = form.twilio_token
    if (sec === 'email' && form.resend_key) payload.resend_key = form.resend_key
    if (sec === 'ia') {
      if (form.anthropic_key) payload.anthropic_key = form.anthropic_key
      if (form.openai_key)    payload.openai_key    = form.openai_key
      if (form.groq_key)      payload.groq_key      = form.groq_key
    }
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify(payload) })
      setMsg({ type: 'success', text: t('guardado') })
      const c = await apiFetch('/config').catch(() => config)
      setConfig(c || config)
      if (sec === 'email') {
        apiFetch('/config/email-diagnostics').then(setEmailDiag).catch(() => {})
      }
    } catch (err) { setMsg({ type: 'error', text: err.message }) }
    setSaving(false)
  }

  async function testEmail() {
    setTestingEmail(true); setMsg(null)
    try {
      const res = await apiFetch('/config/email-test', { method:'POST' })
      setEmailDiag(res.diagnostics || emailDiag)
      setMsg({ type:'success', text: res.result?.demo ? t('pruebaSimulada') : t('emailPruebaEnviado') })
    } catch (err) {
      setMsg({ type:'error', text: err.message })
    } finally {
      setTestingEmail(false)
    }
  }

  async function runContactMailSmoke(mode) {
    setSmokeRunning(mode)
    setMsg(null)
    try {
      const res = await apiFetch('/config/contact-mail-smoke', {
        method: 'POST',
        body: JSON.stringify({ mode, alias: contactAlias }),
      })
      setEmailDiag(prev => ({ ...(prev || {}), contactMail: res.contactMail || prev?.contactMail }))
      setMsg({
        type: 'success',
        text: t('smokeEnviado').replace('{mode}', mode === 'inbound' ? t('smokeInbound') : t('smokeOutbound')).replace('{email}', res.publicEmail).replace('{routed}', res.routedTo),
      })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSmokeRunning('')
    }
  }

  async function connectGoogleDrive() {
    setDriveConnecting(true)
    setMsg(null)
    try {
      const res = await apiFetch('/config/google-drive/connect-url', { method: 'POST', body: JSON.stringify({}) })
      if (!res.url) throw new Error(t('errorUrlConexion'))
      window.location.href = res.url
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
      setDriveConnecting(false)
    }
  }

  const catActiva = categorias.find(c => c.secciones.some(s => s.key === sec))
  const secActiva = categorias.flatMap(c => c.secciones).find(s => s.key === sec)

  if (loading) return <div className="layout"><Menu /><main className="main"><div className="empty"><p>{t('cargando')}</p></div></main></div>
  if (loadError) return (
    <div className="layout"><Menu /><main className="main">
      <div className="empty">
        <div className="empty-icon"><Icons.Settings /></div>
        <p>{loadError}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>{t('reintentar')}</button>
      </div>
    </main></div>
  )

  return (
    <div className="layout"><Menu />
      <main className="main">
        <TokenIglesiaAdmin />
      <div className="page-header">
          <div>
            <h1 className="page-title"><Icons.Settings /> {t('configuracion')}</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginTop:3}}>{catActiva?.label} · {secActiva?.label}</p>
          </div>
        </div>
        {/* ── PHONE: tabs horizontales scrollables ───────────────── */}
        {isPhone && (
          <nav style={{overflowX:'auto',display:'flex',gap:6,paddingBottom:8,marginBottom:8,scrollbarWidth:'none'}}>
            {categorias.flatMap(cat => (cat.secciones||[]).map(s => {
              const b = badge(s.key, config)
              const active = sec === s.key
              return (
                <button key={s.key} onClick={() => { setSec(s.key); setMsg(null) }}
                  style={{flexShrink:0,padding:'8px 14px',border:'none',borderRadius:20,cursor:'pointer',fontSize:13,fontWeight:active?700:500,
                    background:active?'var(--primary)':'var(--bg-2)',color:active?'#fff':'var(--text)',whiteSpace:'nowrap',
                    position:'relative',transition:'background .15s'}}>
                  {s.label}
                  {b && <span style={{position:'absolute',top:4,right:6,width:6,height:6,borderRadius:'50%',background:b==='ok'?'#16A34A':'#F59E0B'}}/>}
                </button>
              )
            }))}
          </nav>
        )}

        <div className="settings-shell" style={{display:'grid',gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fit,minmax(220px,1fr))',gap:16,alignItems:'start'}}>

          {/* ── TABLET / DESKTOP: sidebar ────────────────────────── */}
          {!isPhone && (
            <nav className="card settings-nav" style={{padding:6}}>
              {categorias.map(cat => {
                const open = !collapsed[cat.key]
                return (
                  <div key={cat.key} style={{marginBottom:4}}>
                    <button onClick={() => setCollapsed(p=>({...p,[cat.key]:!p[cat.key]}))}
                      style={{width:'100%',padding:'7px 10px',border:'none',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:8,borderRadius:'var(--r)'}}>
                      <span style={{fontSize:13, display:'flex', alignItems:'center'}}>{typeof cat.icon === 'function' ? <cat.icon size={14} /> : cat.icon}</span>
                      <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'var(--text-muted)',flex:1,textAlign:'left'}}>{cat.label}</span>
                      <span style={{fontSize:10,color:'var(--text-faint)'}}>{open?'▾':'▸'}</span>
                    </button>
                    {open && (cat?.secciones || []).map(s => {
                      const b = badge(s.key, config)
                      const active = sec === s.key
                      return (
                        <button key={s.key} onClick={() => { setSec(s.key); setMsg(null) }}
                          style={{width:'100%',padding:'8px 10px 8px 28px',border:'none',borderRadius:'var(--r)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:9,marginBottom:1,background:active?'var(--primary)':'transparent',color:active?'var(--surface)':'var(--text)'}}>
                          <span style={{fontSize:13,flexShrink:0,display:'flex',alignItems:'center'}}>{typeof s.icon === 'function' ? <s.icon size={14} /> : s.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:active?600:450,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.label}</div>
                            {!active && <div style={{fontSize:10,opacity:.55,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.desc}</div>}
                          </div>
                          {b && <span style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:b==='ok'?'#16A34A':'#F59E0B'}}/>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </nav>
          )}

          {/* Panel */}
          <form className="settings-form" onSubmit={handleSave}>
            <div className="card settings-panel">
              <div className="settings-panel-header" style={{display:'flex',alignItems:'center',gap:12,marginBottom:24,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:22}}>{secActiva?.icon}</span>
                <div><h2 style={{fontSize:16,fontWeight:700,margin:0}}>{secActiva?.label}</h2><p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>{secActiva?.desc}</p></div>
              </div>

              {msg && <div className={`alert alert-${msg.type}`} style={{marginBottom:20}}>{msg.text}</div>}

              {/* GENERAL */}
              {sec==='general' && (
                <div className="form-grid">
                  <div className="form-group full"><label>{t('nombreIglesia')}</label><input name="nombre_iglesia" className="form-input" value={form.nombre_iglesia} onChange={e=>f('nombre_iglesia',e.target.value)} placeholder={t('placeholderIglesia')}/></div>
                  <div className="form-group full"><label>{t('direccion')}</label><input name="direccion" className="form-input" value={form.direccion} onChange={e=>f('direccion',e.target.value)}/></div>
                  <div className="form-group"><label>{t('telefono')}</label><input name="telefono_iglesia" className="form-input" value={form.telefono_iglesia} onChange={e=>f('telefono_iglesia',e.target.value)} placeholder={t('placeholderTelefono')}/></div>
                  <div className="form-group"><label>{t('email')}</label><input name="email_iglesia" className="form-input" type="email" value={form.email_iglesia} onChange={e=>f('email_iglesia',e.target.value)}/></div>
                  <div className="form-group"><label>{t('pastorPrincipal')}</label><input name="pastor_nombre" className="form-input" value={form.pastor_nombre} onChange={e=>f('pastor_nombre',e.target.value)} placeholder={t('placeholderPastor')}/></div>
                  <div className="form-group"><label>{t('sitioWeb')}</label><input name="sitio_web" className="form-input" value={form.sitio_web} onChange={e=>f('sitio_web',e.target.value)} placeholder={t('placeholderSitioWeb')}/></div>
                </div>
              )}

              {/* CULTOS */}
              {sec==='cultos' && <>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>{t('diasCulto')}</label>
                    <input name="cultos_dias" className="form-input" value={form.cultos_dias} onChange={e=>f('cultos_dias',e.target.value)} placeholder={t('placeholderDiasCulto')}/>
                    <span style={{fontSize:11,color:'var(--text-muted)',marginTop:3,display:'block'}}>{t('ayudaDiasCulto')}</span>
                  </div>
                  <div className="form-group"><label>{t('turnosPorCulto')}</label>
                    <select name="cultos_turnos" className="form-input" value={form.cultos_turnos} onChange={e=>f('cultos_turnos',e.target.value)}>
                      {['1','2','3','4'].map(n=><option key={n} value={n}>{Number(n)===1 ? t('turno').replace('{n}', n) : t('turnos').replace('{n}', n)}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>{t('duracionMin')}</label><input name="culto_duracion" className="form-input" type="number" min={30} max={300} value={form.culto_duracion} onChange={e=>f('culto_duracion',e.target.value)}/></div>
                  <div className="form-group"><label>{t('capacidadLugar')}</label><input name="culto_capacidad" className="form-input" type="number" min={1} value={form.culto_capacidad} onChange={e=>f('culto_capacidad',e.target.value)} placeholder={t('placeholderCapacidad')}/></div>
                </div>
                <div style={{marginTop:16,padding:'12px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('vistaPrevia')}</p>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {form.cultos_dias.split(',').filter(Boolean).map(dia=>
                      Array.from({length:Number(form.cultos_turnos)||1},(_,i)=>(
                        <span key={`${dia}-${i}`} style={{padding:'4px 12px',background:'var(--primary)',color:'var(--surface)',borderRadius:'var(--r)',fontSize:12,fontWeight:600}}>{dia.trim()} · T{i+1}</span>
                      ))
                    )}
                  </div>
                </div>
              </>}

              {/* APARIENCIA */}
              {sec==='apariencia' && <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>{t('colorPrincipal')}</label>
                    <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                      <input name="color_primario" type="color" value={form.color_primario} onChange={e=>f('color_primario',e.target.value)} style={{width:44,height:36,padding:2,border:'1px solid var(--border)',borderRadius:'var(--r)',cursor:'pointer'}}/>
                      <input name="color_primario" className="form-input" value={form.color_primario} onChange={e=>f('color_primario',e.target.value)}/>
                    </div>
                  </div>
                  <div className="form-group"><label>{t('urlLogo')}</label><input name="logo_url" className="form-input" value={form.logo_url} onChange={e=>f('logo_url',e.target.value)} placeholder={t('placeholderUrl')}/></div>
                  <div className="form-group full"><label>{t('temaDefault')}</label>
                    <div style={{display:'flex',gap:10}}>
                      {[['0',t('claro')],['1',t('oscuro')]].map(([val,lbl])=>(
                        <label key={val} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 16px',border:`1px solid ${form.modo_oscuro_default===val?'var(--primary)':'var(--border)'}`,borderRadius:'var(--r)',cursor:'pointer',background:form.modo_oscuro_default===val?'var(--primary-soft)':'transparent',fontSize:13,fontWeight:form.modo_oscuro_default===val?600:400}}>
                          <input type="radio" name="modo" value={val} checked={form.modo_oscuro_default===val} onChange={()=>f('modo_oscuro_default',val)} style={{accentColor:'var(--primary)'}}/>{lbl}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{marginTop:16,padding:16,background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:10,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('vistaPrevia')}</p>
                  <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:form.color_primario,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--surface)',fontSize:18,flexShrink:0}}><Icons.Dashboard /></div>
                    <div><div style={{fontSize:14,fontWeight:700,color:form.color_primario}}>{form.nombre_iglesia||t('churchSystem')}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{form.pastor_nombre||t('pastor')}</div></div>
                    <button type="button" style={{marginLeft:'auto',padding:'6px 14px',background:form.color_primario,border:'none',borderRadius:'var(--r)',color:'var(--surface)',fontSize:12,fontWeight:600}}>{t('boton')}</button>
                  </div>
                </div>
              </>}

              {/* WHATSAPP */}
              {sec==='whatsapp' && <>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:20,borderRadius:'var(--r)',background:config.whatsapp_cloud_configurado?'#F0FDF4':'#FFFBEB',border:`1px solid ${config.whatsapp_cloud_configurado?'#86EFAC':'#FDE68A'}`}}>
                  <span style={{fontSize:20}}>{config.whatsapp_cloud_configurado?t('ok'):t('advertencia')}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:config.whatsapp_cloud_configurado?'var(--c-success)':'var(--c-warning)'}}>{config.whatsapp_cloud_configurado?t('metaCloudActiva'):t('sinConfigurarDemo')}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{config.whatsapp_cloud_configurado?t('iglesiaWaOficial'):t('mensajesRegistrados')}</div>
                  </div>
                  <a href="https://developers.facebook.com/docs/whatsapp" target="_blank" rel="noreferrer" style={{marginLeft:'auto',fontSize:12,color:'var(--primary)',fontWeight:600,whiteSpace:'nowrap'}}>{t('irAMeta')}</a>
                </div>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:18}}>
                  {t('recomendadoProduccion')}
                </p>
                <div className="form-grid">
                  <div className="form-group full"><label>{t('provider')}</label><input name="wa_provider" className="form-input" value={form.wa_provider} onChange={e=>f('wa_provider',e.target.value)} placeholder={t('placeholderProvider')}/></div>
                  <div className="form-group full"><label>{t('phoneNumberId')}</label><input name="wa_phone_number_id" className="form-input" value={form.wa_phone_number_id} onChange={e=>f('wa_phone_number_id',e.target.value)} placeholder={t('placeholderPhoneId')}/></div>
                  <div className="form-group full"><label>{t('waBusinessId')}</label><input name="wa_business_account_id" className="form-input" value={form.wa_business_account_id} onChange={e=>f('wa_business_account_id',e.target.value)} placeholder={t('placeholderBusinessId')}/></div>
                  <div className="form-group full"><label>{t('accessToken')}{config.whatsapp_cloud_configurado&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> {t('vacioNoCambiar')}</span>}</label><input name="wa_access_token" className="form-input" type="password" value={form.wa_access_token} onChange={e=>f('wa_access_token',e.target.value)} placeholder={config.whatsapp_cloud_configurado?t('placeholderTokenConfig'):t('placeholderTokenNuevo')} /></div>
                  <div className="form-group"><label>{t('verifyToken')}</label><input name="wa_verify_token" className="form-input" value={form.wa_verify_token} onChange={e=>f('wa_verify_token',e.target.value)} placeholder={t('placeholderVerifyToken')}/></div>
                  <div className="form-group"><label>{t('estadoLabel')}</label><input name="wa_status" className="form-input" value={form.wa_status} onChange={e=>f('wa_status',e.target.value)} placeholder={t('placeholderEstado')}/></div>
                  <div className="form-group"><label>{t('displayPhone')}</label><input name="wa_display_phone_number" className="form-input" value={form.wa_display_phone_number} onChange={e=>f('wa_display_phone_number',e.target.value)} placeholder={t('placeholderDisplayPhone')}/></div>
                  <div className="form-group"><label>{t('verifiedName')}</label><input name="wa_verified_name" className="form-input" value={form.wa_verified_name} onChange={e=>f('wa_verified_name',e.target.value)} placeholder={t('placeholderVerifiedName')}/></div>
                </div>
                <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('webhookOficial')}</div>
                  <div style={{fontSize:13,color:'var(--text)',marginBottom:6}}><strong>{t('getPost')}</strong> {publicOrigin}/whatsapp/webhook</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{t('ayudaWebhook')}</div>
                </div>
              </>}

              {/* GOOGLE DRIVE */}
              {sec==='drive' && <>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:20,borderRadius:'var(--r)',background:config.google_drive_configurado?'#F0FDF4':'#EFF6FF',border:`1px solid ${config.google_drive_configurado?'#86EFAC':'#BFDBFE'}`}}>
                  <span style={{fontSize:20}}>{config.google_drive_configurado ? t('ok') : t('drive')}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:config.google_drive_configurado?'var(--c-success)':'var(--primary)'}}>
                      {config.google_drive_configurado ? t('driveConectadoLabel') : t('driveNoConectado')}
                    </div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>
                      {config.google_drive_email || t('conectaDrive')}
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={connectGoogleDrive} disabled={driveConnecting} style={{marginLeft:'auto'}}>
                    {driveConnecting ? t('conectando') : config.google_drive_configurado ? t('reconectar') : t('conectarDrive')}
                  </button>
                </div>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>{t('estadoConexion')}</label>
                    <input className="form-input" value={config.google_drive_status || t('disconnected')} readOnly />
                  </div>
                  <div className="form-group full">
                    <label>{t('correoConectado')}</label>
                    <input className="form-input" value={config.google_drive_email || ''} readOnly placeholder={t('sinConectar')} />
                  </div>
                  <div className="form-group full">
                    <label>{t('ultimaConexion')}</label>
                    <input className="form-input" value={config.google_drive_connected_at ? new Date(config.google_drive_connected_at).toLocaleString('es-AR') : ''} readOnly placeholder={t('pendienteLabel')} />
                  </div>
                </div>
                <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('comoSeUsa')}</p>
                  <ol style={{paddingLeft:16,fontSize:13,color:'var(--text-2)',lineHeight:1.9,margin:0}}>
                    <li>{t('passo1Drive')}</li>
                    <li>{t('passo2Drive')}</li>
                    <li>{t('passo3Drive')}</li>
                  </ol>
                </div>
                <div style={{marginTop:12,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('googleCloudConsole')}</p>
                  <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7}}>
                    {t('agregaRedirect')}
                    <div style={{marginTop:6,fontFamily:'monospace',fontSize:12,color:'var(--primary)',wordBreak:'break-all'}}>
                      {publicOrigin}/oauth/google/drive/callback
                    </div>
                  </div>
                </div>
              </>}

              {/* IA */}
              {sec==='ia' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>{t('elegirProveedor')}</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:24}}>
                  {[
                    {key:'groq',      icon:'Groq',name:t('groq'),      sub:t('groqSub'),     url:t('groqUrl'),       ok:config.groq_ok},
                    {key:'anthropic', icon:'',name:t('anthropic'), sub:t('anthropicSub'), url:t('anthropicUrl'),  ok:config.anthropic_ok},
                    {key:'openai',    icon:'',name:t('openai'),    sub:t('openaiSub'),    url:t('openaiUrl'),    ok:config.openai_ok},
                  ].map(p=>{
                    const sel = form.ia_proveedor===p.key
                    return (
                      <div key={p.key} onClick={()=>f('ia_proveedor',p.key)}
                        style={{padding:'14px 12px',borderRadius:'var(--r-lg)',cursor:'pointer',textAlign:'center',border:`2px solid ${sel?'var(--primary)':'var(--border)'}`,background:sel?'var(--primary-soft)':'var(--surface)',transition:'var(--t)'}}>
                        <div style={{fontSize:24,marginBottom:6}}>{p.icon}</div>
                        <div style={{fontSize:13,fontWeight:700,color:sel?'var(--primary)':'var(--text)'}}>{p.name}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{p.sub}</div>
                        {p.ok&&<div style={{fontSize:10,marginTop:6,color:'var(--c-success)',fontWeight:600}}>{t('configurado')}</div>}
                        <a href={p.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,color:'var(--primary)',display:'block',marginTop:4}}>{t('obtenerKey')}</a>
                      </div>
                    )
                  })}
                </div>
                {form.ia_proveedor==='groq' && (
                  <div className="form-group" style={{marginBottom:16}}>
                    <label>{t('groqApiKey')}{config.groq_ok&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> {t('vacioNoCambiar')}</span>}</label>
                    <input name="groq_key" className="form-input" type="password" value={form.groq_key} onChange={e=>f('groq_key',e.target.value)} placeholder={config.groq_ok?t('placeholderGroqConfig'):t('placeholderGroqNuevo')}/>
                    <span style={{fontSize:11,color:'var(--text-muted)',marginTop:4,display:'block'}}>{t('gratisGroq')}</span>
                  </div>
                )}
                {form.ia_proveedor==='anthropic' && (
                  <div className="form-group" style={{marginBottom:16}}>
                    <label>{t('anthropicApiKey')}{config.anthropic_ok&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> {t('vacioNoCambiar')}</span>}</label>
                    <input name="anthropic_key" className="form-input" type="password" value={form.anthropic_key} onChange={e=>f('anthropic_key',e.target.value)} placeholder={config.anthropic_ok?t('placeholderAnthropicConfig'):t('placeholderAnthropicNuevo')}/>
                  </div>
                )}
                {form.ia_proveedor==='openai' && (
                  <div className="form-group" style={{marginBottom:16}}>
                    <label>{t('openaiApiKey')}{config.openai_ok&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> {t('vacioNoCambiar')}</span>}</label>
                    <input name="openai_key" className="form-input" type="password" value={form.openai_key} onChange={e=>f('openai_key',e.target.value)} placeholder={config.openai_ok?t('placeholderOpenaiConfig'):t('placeholderOpenaiNuevo')}/>
                  </div>
                )}
                <div style={{background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',overflow:'hidden'}}>
                  <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('modelos')}</div>
                  {[
                    {prov:'groq',      modelo:t('modeloGroq'),    desc:t('modeloGroqDesc')},
                    {prov:'anthropic', modelo:t('modeloAnthropic'), desc:t('modeloAnthropicDesc')},
                    {prov:'openai',    modelo:t('modeloOpenai'),    desc:t('modeloOpenaiDesc')},
                  ].map(m=>(
                    <div key={m.prov} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 14px',borderBottom:'1px solid var(--border)',fontSize:13,background:form.ia_proveedor===m.prov?'var(--primary-soft)':'transparent'}}>
                      <div><span style={{fontWeight:600,color:form.ia_proveedor===m.prov?'var(--primary)':'var(--text)'}}>{m.modelo}</span><span style={{fontSize:11,color:'var(--text-muted)',marginLeft:8}}>{m.desc}</span></div>
                      {form.ia_proveedor===m.prov&&<span style={{fontSize:10,color:'var(--primary)',fontWeight:700}}>{t('activo')}</span>}
                    </div>
                  ))}
                </div>
              </>}


              {/* EMAIL */}
              {sec==='email' && <>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:20,borderRadius:'var(--r)',background:config.email_configurado?'#F0FDF4':'#FFFBEB',border:`1px solid ${config.email_configurado?'#86EFAC':'#FDE68A'}`}}>
                  <span style={{fontSize:20}}>{config.email_configurado?t('ok'):t('advertencia')}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:config.email_configurado?'var(--c-success)':'var(--c-warning)'}}>{config.email_configurado?t('emailActivo'):t('sinConfigurarEmail')}</div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>{config.email_configurado?t('emailsReais'):t('mensajesGuardados')}</div>
                  </div>
                  <a href="https://resend.com" target="_blank" rel="noreferrer" style={{marginLeft:'auto',fontSize:12,color:'var(--primary)',fontWeight:600,whiteSpace:'nowrap'}}>{t('irAResend')}</a>
                </div>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>{t('resendApiKey')}{config.email_configurado&&<span style={{fontWeight:400,color:'var(--text-muted)'}}> {t('vacioNoCambiar')}</span>}</label>
                    <input className="form-input" type="password" value={form.resend_key} onChange={e=>f('resend_key',e.target.value)} placeholder={config.email_configurado?t('placeholderResendConfig'):t('placeholderResendNuevo')}/>
                    <span style={{fontSize:11,color:'var(--text-muted)',marginTop:4,display:'block'}}>{t('gratisResend')}</span>
                  </div>
                  <div className="form-group">
                    <label>{t('emailRemitente')}</label>
                    <input className="form-input" type="email" value={form.email_from} onChange={e=>f('email_from',e.target.value)} placeholder={t('placeholderRemitente')}/>
                  </div>
                  <div className="form-group">
                    <label>{t('nombreRemitente')}</label>
                    <input className="form-input" value={form.email_nombre} onChange={e=>f('email_nombre',e.target.value)} placeholder={t('placeholderNombreRemitente')}/>
                  </div>
                </div>
                {emailDiag && (
                  <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:10}}>
                      <div>
                        <p style={{fontSize:11,fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('diagRenderEmail')}</p>
                        <div style={{fontSize:13,color:emailDiag.ok?'var(--c-success)':'var(--c-warning)',fontWeight:700}}>
                          {emailDiag.ok?t('configCompleta'):t('revisarConfig')}
                        </div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={testEmail} disabled={testingEmail}>
                        {testingEmail ? t('enviando') : t('enviarPrueba')}
                      </button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,marginBottom:10}}>
                      {[
                        ['Resend', emailDiag.resendConfigured ? t('ok') : t('faltaApiKey')],
                        [t('emailRemitente'), emailDiag.fromEmail || t('sinDetectar')],
                        [t('dominio'), emailDiag.domainLooksValid ? emailDiag.domain : `${emailDiag.domain || 'N/A'} ${t('verificar')}`],
                        [t('variablesFaltantes'), emailDiag.render?.missing?.length ? emailDiag.render.missing.join(', ') : t('ninguna')],
                      ].map(([l,v])=>(
                        <div key={l} style={{padding:'9px 10px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)'}}>
                          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:3}}>{l}</div>
                          <div style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {emailDiag.warnings?.length > 0 && (
                      <ul style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.7,paddingLeft:18,margin:0}}>
                        {emailDiag.warnings.map(w => <li key={w}>{w}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                {emailDiag?.contactMail && (
                  <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                      <div>
                        <p style={{fontSize:11,fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('aliasesContacto')}</p>
                        <div style={{fontSize:13,color:'var(--text)'}}>
                          {t('fallbackActual')} <strong>{emailDiag.contactMail.adminFallbackEmail}</strong>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                        <select className="form-input" value={contactAlias} onChange={e => setContactAlias(e.target.value)} style={{minWidth:140}}>
                          {(emailDiag.contactMail.aliases || []).map(alias => (
                            <option key={alias.key} value={alias.key}>{alias.label}</option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => runContactMailSmoke('outbound')} disabled={!!smokeRunning}>
                          {smokeRunning === 'outbound' ? t('enviando') : t('smokeOutbound')}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => runContactMailSmoke('inbound')} disabled={!!smokeRunning}>
                          {smokeRunning === 'inbound' ? t('probando') : t('smokeInbound')}
                        </button>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8}}>
                      {(emailDiag.contactMail.aliases || []).map(alias => (
                        <div key={alias.key} style={{padding:'10px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)'}}>
                          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.4,marginBottom:4}}>{alias.label}</div>
                          <div style={{fontSize:12,fontWeight:700,color:'var(--text)',marginBottom:2}}>{alias.publicEmail}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5}}>
                            {t('destino')} {alias.targetEmail}
                            <br />
                            {alias.usingFallback ? t('fallbackActivo') : t('configuradoVia').replace('{from}', alias.resolvedFrom)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:10,lineHeight:1.6}}>
                      {emailDiag.contactMail.recommendedNextStep}
                    </div>
                  </div>
                )}
                <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                  <p style={{fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('activarResend')}</p>
                  <ol style={{paddingLeft:16,fontSize:13,color:'var(--text-2)',lineHeight:2}}>
                    <li>{t('passo1Resend')}</li>
                    <li>{t('passo2Resend')}</li>
                    <li>{t('passo3Resend')}</li>
                    <li>{t('passo4Resend')}</li>
                  </ol>
                </div>
              </>}

              {/* ALERTAS */}
              {sec==='alertas' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>{t('cuandoAlertas')}</p>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {[
                    {k:'alerta_sin_asistir',     label:t('sinAsistir'),           unit:t('cultosConsecutivos'),   min:1,max:10},
                    {k:'alerta_sin_seguimiento', label:t('sinSeguimiento'),         unit:t('diasSinContacto'),     min:7,max:90},
                    {k:'alerta_visitante',       label:t('visitanteSinConsolidar'),unit:t('diasDesdeIngreso'), min:7,max:60},
                    {k:'alerta_cumple',          label:t('cumpleanos'),              unit:t('diasAnticipacion'),  min:1,max:14},
                  ].map(({k,label,unit,min,max})=>(
                    <div key={k} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{label}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{unit}</div></div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <input name="field_329" type="number" min={min} max={max} value={form[k]} onChange={e=>f(k,e.target.value)}
                          style={{width:60,padding:'6px 10px',border:'1px solid var(--border-strong)',borderRadius:'var(--r)',fontSize:15,fontWeight:700,textAlign:'center',outline:'none',background:'var(--surface)',color:'var(--text)'}}/>
                        <span style={{fontSize:12,color:'var(--text-muted)',minWidth:40}}>{k==='alerta_sin_asistir'?t('cultos'):t('dias')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>}

              {/* SEGUIMIENTO */}
              {sec==='seguimiento' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>{t('configSeguimiento')}</p>
                <div className="form-group" style={{marginBottom:20}}>
                  <label>{t('frecuenciaRecomendada')}</label>
                  <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
                    <input name="seg_frecuencia_default" className="form-input" type="number" min={7} max={90} value={form.seg_frecuencia_default} onChange={e=>f('seg_frecuencia_default',e.target.value)} style={{width:80}}/>
                    <span style={{fontSize:13,color:'var(--text-muted)'}}>{t('dias')}</span>
                  </div>
                </div>
              </>}

              {/* SEGURIDAD */}
              {sec==='seguridad' && <>
                <div className="form-grid" style={{marginBottom:20}}>
                  <div className="form-group"><label>{t('duracionSesion')}</label>
                    <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}><input name="sesion_horas" className="form-input" type="number" min={1} max={72} value={form.sesion_horas} onChange={e=>f('sesion_horas',e.target.value)} style={{width:70}}/><span style={{fontSize:13,color:'var(--text-muted)'}}>{t('horas')}</span></div>
                  </div>
                  <div className="form-group"><label>{t('maxIntentos')}</label>
                    <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}><input name="max_intentos" className="form-input" type="number" min={3} max={20} value={form.max_intentos} onChange={e=>f('max_intentos',e.target.value)} style={{width:70}}/><span style={{fontSize:13,color:'var(--text-muted)'}}>{t('bloqueo15min')}</span></div>
                  </div>
                </div>
                <div style={{background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',overflow:'hidden'}}>
                  <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('proteccionesActivas')}</div>
                  {[t('prot1'),t('prot2'),t('prot3'),t('prot4'),t('prot5'),t('prot6'),t('prot7'),t('prot8')].map((item,i)=>(
                    <div key={i} style={{display:'flex',gap:10,padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:13,alignItems:'center'}}>
                      <Icons.CheckCircle width={14} height={14} color="var(--c-success)" style={{flexShrink:0}} />{item}
                    </div>
                  ))}
                </div>
              </>}

              {/* BACKUP */}
              {sec==='backup' && <>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>{t('backupDescripcion')}</p>
                {backupInfo && (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:16}}>
                      {[[t('motor'),t('postgresql')],[t('estadoBackup'),t('activoNeon')],[t('actualizado'),backupInfo.modificado?.slice(0,10)||'—']].map(([l,v])=>(
                        <div key={l} style={{padding:'12px 14px',background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                          <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)',marginBottom:4}}>{l}</div>
                          <div style={{fontSize:18,fontWeight:800,color:'var(--primary)'}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {backupInfo.totales && (
                      <div style={{background:'var(--bg)',borderRadius:'var(--r)',border:'1px solid var(--border)',overflow:'hidden',marginBottom:16}}>
                        <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,color:'var(--text-muted)'}}>{t('resumen')}</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))'}}>
                          {Object.entries(backupInfo.totales).map(([k,v])=>(
                            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 14px',borderBottom:'1px solid var(--border)',fontSize:13}}>
                              <span style={{color:'var(--text-muted)',textTransform:'capitalize'}}>{k}</span><strong>{v}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:14,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--r)'}}>
                  <span style={{fontSize:18,flexShrink:0}}></span>
                  <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.5}}>
                    {t('backupNeon')}
                  </div>
                </div>
              </>}

              {sec!=='backup' && (
                <div style={{marginTop:24,paddingTop:16,borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving?t('guardando'):t('guardarCambios')}</button>
                  {msg?.type==='success'&&<span style={{fontSize:13,color:'var(--c-success)'}}>{msg.text}</span>}
                </div>
              )}
            </div>
          </form>
        </div>
      {/* Notificaciones */}
      <div style={{marginTop:20}}>
        <h2 style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--text-muted)',marginBottom:12}}>
          <Icons.Comunicados /> {t('notificaciones')}
        </h2>
        <BtnNotificaciones />
      </div>

      {/* Contacto y soporte */}
      <div style={{marginTop:32}}>
        <h2 style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--text-muted)',marginBottom:16}}>{t('contactoSoporte')}</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
          {CONTACT_CHANNELS.map(item=>(
            <a key={item.label} href={`mailto:${item.email}`}
              style={{padding:'14px 16px',background:'var(--surface)',border:'1px solid var(--border)',
                borderRadius:12,textDecoration:'none',display:'block',transition:'border-color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:2}}>{item.label}</div>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>{item.desc}</div>
              <div style={{fontSize:12,color:'var(--primary)'}}>{item.email}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Documentos legales */}
      <div style={{marginTop:32}}>
        <h2 style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,color:'var(--text-muted)',marginBottom:16}}>{t('documentosLegales')}</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
          {[
            {label:t('terminos'),href:'/app/terminos'},
            {label:t('privacidad'),href:'/app/privacidad'},
            {label:t('faq'),href:'/app/faq'},
          ].map(item=>(
            <a key={item.label} href={item.href}
              style={{padding:'14px 16px',background:'var(--surface)',border:'1px solid var(--border)',
                borderRadius:12,textDecoration:'none',display:'flex',alignItems:'center',
                gap:8,fontSize:13,fontWeight:600,color:'var(--text)',transition:'border-color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <span style={{color:'var(--primary)'}}>▤</span>{item.label}
            </a>
          ))}
        </div>
        <div style={{marginTop:12,padding:'12px 16px',background:'rgba(245,158,11,0.08)',
          border:'1px solid rgba(245,158,11,0.2)',borderRadius:12,fontSize:12,
          color:'var(--text-muted)',lineHeight:1.6}}>
          <strong style={{color:'var(--c-warning)'}}>{t('advertenciaBeta').replace('{version}', APP_VERSION)}</strong>{' '}
          {t('plataformaBeta')}{' '}
          {t('bajaExportacion')}{' '}
          <a href={`mailto:${EMAILS.legal}`} style={{color:'var(--primary)'}}>{EMAILS.legal}</a>
        </div>
      </div>

      </main>
    </div>
  )
}
