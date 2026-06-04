# Integraciones de terceros — Church System

Listado completo de plataformas externas que usa la app, sus variables de entorno y dónde están implementadas.
Todas las variables van en `backend/.env` (ver `backend/.env.example`).

---

## 1. Resend — Email transaccional

**Para qué sirve:** Envío de emails automáticos (verificación de cuenta, bienvenida al registrarse, alertas del sistema, notificaciones de token de iglesia).

| Variable | Descripción |
|----------|-------------|
| `RESEND_API_KEY` | API key obtenida en resend.com |
| `EMAIL_FROM` | Dirección remitente (ej. `Church System <no-reply@churchsystem.com.ar>`) |
| `RESEND_INBOUND_SECRET` | Secreto compartido para el webhook inbound de Resend |
| `ADMIN_CONTACT_EMAIL` | Fallback seguro para aliases de contacto (default: `admin@churchsystem.com.ar`) |
| `CONTACT_EMAIL` | Inbox real para `contacto@churchsystem.com.ar` |
| `SALES_EMAIL` | Inbox real para `ventas@churchsystem.com.ar` |
| `SUPPORT_EMAIL` | Inbox real para `soporte@churchsystem.com.ar` |
| `LEGAL_EMAIL` | Inbox real para `legal@churchsystem.com.ar` |
| `SECURITY_EMAIL` | Inbox real para `seguridad@churchsystem.com.ar` |
| `OWNER_REPORTS_EMAIL` | Inbox dueña/operativa; sigue siendo válido como fallback secundario |

**Archivos que lo usan:**
- `backend/src/lib/email.js` — inicialización lazy, funciones `sendSystemEmail()` y `sendNotificationEmail()`
- `backend/src/lib/contact-mail.js` — resolución centralizada de aliases, fallback a admin y smoke tests outbound/inbound
- `backend/src/routes/auth.js` — email de bienvenida al registrarse
- `backend/src/routes/verificacion.js` — código de verificación de 6 dígitos
- `backend/src/routes/iglesia.js` — aviso al regenerar token
- `backend/src/routes/bug-report.js` — reenvío de bug reports
- `backend/src/routes/config.js` — diagnóstico del estado del servicio + smoke test de contacto
- `backend/src/routes/godmode.js` — estado global de aliases + smoke test operativo
- `backend/src/routes/resend-inbound.js` — webhook inbound de Resend con ruteo centralizado
- `backend/scripts/smoke-contact-mail.sh` — smoke flow CLI para outbound + inbound

**Notas:** Si `RESEND_API_KEY` no está definida, el servidor arranca igual y los emails se saltean sin crash. Si los aliases de Google Workspace todavía no existen, el sistema enruta `ventas/soporte/legal/seguridad/contacto` hacia `admin@churchsystem.com.ar` sin romper el flujo.

---

## 2. Meta Cloud API — WhatsApp oficial

**Para qué sirve:** Canal oficial de WhatsApp para OTP, templates aprobados, recordatorios, seguimiento pastoral, estados y webhooks. Base SaaS multi-iglesia y multi-número.

| Variable | Descripción |
|----------|-------------|
| `META_APP_ID` | App ID de Meta for Developers |
| `META_APP_SECRET` | App Secret |
| `META_VERIFY_TOKEN` | Token para verificar el webhook |
| `META_ACCESS_TOKEN` | Access token de Graph API |
| `META_PHONE_NUMBER_ID` | Phone Number ID del sender |
| `META_WABA_ID` | WhatsApp Business Account ID |
| `META_DISPLAY_PHONE_NUMBER` | Número visible (opcional) |
| `META_VERIFIED_NAME` | Nombre verificado (opcional) |

**Archivos que lo usan:**
- `backend/src/services/whatsapp.js` — servicio oficial Graph API, schema, logs, templates y conversaciones
- `backend/src/routes/whatsapp.js` — webhook público, diagnóstico, conexión y envío de templates
- `backend/src/routes/mensajes.js` — envío directo usando Meta Cloud API con fallback legacy
- `backend/src/routes/config.js` — diagnóstico y guardado de credenciales por iglesia
- `backend/src/server.js` — registro del webhook `/whatsapp/webhook`
- `frontend/src/pages/Configuracion.jsx` — carga del `Phone Number ID`, `WABA ID`, token y estado

**Notas:** esta es la integración objetivo para producción. Permite una conexión por iglesia hoy y deja lista la base para múltiples números por tenant.

---

## 3. Twilio — WhatsApp y SMS (legacy / fallback)

**Para qué sirve:** Compatibilidad temporal mientras se migra hacia Meta Cloud API oficial.

| Variable | Descripción |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | SID de la cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | Token de autenticación |
| `TWILIO_WHATSAPP_FROM` | Número remitente (ej. `whatsapp:+14155238886`) |

**Archivos que lo usan:**
- `backend/src/routes/mensajes.js` — lógica de envío de WhatsApp
- `backend/src/routes/config.js` — diagnóstico del estado del servicio
- `backend/src/server.js` — log de startup (`⚠️ Configurar en /configuracion`)
- `frontend/src/pages/Configuracion.jsx` — UI para cargar las credenciales desde el panel

**Notas:** Las credenciales se pueden cargar desde la base de datos vía el panel de Configuración (sin reiniciar el servidor).

---

## 4. MercadoPago — Pagos de suscripción

**Para qué sirve:** Procesamiento de pagos de planes mensuales (sólo para países LATAM: AR, BR, CL, CO, MX, PE, UY). Los pagos en USD no pasan por MercadoPago.

| Variable | Descripción |
|----------|-------------|
| `MP_ACCESS_TOKEN` | Access token de la app MP (modo producción o sandbox) |
| `MP_PUBLIC_KEY` | Public key (referencia para el frontend si se integra Checkout Pro) |
| `MP_MODO` | `production` o `sandbox` |
| `MP_WEBHOOK_SECRET` | Secreto para validar notificaciones IPN |

**Archivos que lo usan:**
- `backend/src/routes/mercadopago.js` — creación de preferencias, webhook IPN, consulta de estado
- `backend/src/lib/billing.js` — campo `mercadoPago: true/false` por país
- `frontend/src/pages/Registro.jsx` — muestra info de pago MercadoPago según el país seleccionado

---

## 5. Google OAuth — Sign-in con Google

**Para qué sirve:** Permite registrarse e iniciar sesión con cuenta de Google (sin necesidad de contraseña).

| Variable | Descripción |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Client ID de la app en Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret |

**URLs a configurar en Google Cloud Console:**
- Redirect URI autorizada: `https://churchsystem.com.ar/oauth/google/callback`

**Archivos que lo usan:**
- `backend/src/routes/oauth.js` — flujo completo: redirect → token exchange → userinfo → JWT
- `backend/src/routes/config.js` — diagnóstico
- `frontend/src/pages/Login.jsx` — botón "Google"
- `frontend/src/pages/Registro.jsx` — botón "Continuar con Google"

---

## 6. Apple Sign-In — Sign-in con Apple

**Para qué sirve:** Permite registrarse e iniciar sesión con Apple ID (requerido por App Store si se ofrece otro OAuth).

| Variable | Descripción |
|----------|-------------|
| `APPLE_CLIENT_ID` | Services ID de la app (ej. `com.churchsystem.web`) |
| `APPLE_TEAM_ID` | Team ID del Developer Account de Apple |
| `APPLE_KEY_ID` | Key ID de la Sign-in key generada en el portal |
| `APPLE_PRIVATE_KEY` | Clave privada ES256 en formato PEM (con saltos de línea como `\n`) |
| `APPLE_REDIRECT_URI` | `https://churchsystem.com.ar/oauth/apple/callback` |

**Archivos que lo usan:**
- `backend/src/routes/oauth.js` — flujo JWT client_secret + token exchange
- `backend/src/routes/config.js` — diagnóstico
- `frontend/src/pages/Login.jsx` — botón "Apple"
- `frontend/src/pages/Registro.jsx` — botón "Continuar con Apple"

---

## 7. Web Push / VAPID — Notificaciones push

**Para qué sirve:** Envío de notificaciones push al navegador de los pastores/líderes (alertas de cumpleaños, seguimientos vencidos, visitantes sin consolidar). Se envían diariamente a las 8:30 AM.

| Variable | Descripción |
|----------|-------------|
| `VAPID_PUBLIC_KEY` | Clave pública VAPID (se comparte con el frontend) |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID (sólo backend) |
| `VAPID_EMAIL` | Email de contacto requerido por la spec (ej. `mailto:admin@churchsystem.com.ar`) |

**Generar claves VAPID:**
```bash
npx web-push generate-vapid-keys
```

**Archivos que lo usan:**
- `backend/src/routes/notificaciones.js` — suscripción, prueba, `enviarAlertas()` diaria
- `backend/src/server.js` — scheduler de alertas (8:30 AM con setTimeout)
- `frontend/src/hooks/useNotificaciones.js` — solicitud de permiso y suscripción del navegador

---

## 8. Groq — IA (proveedor principal)

**Para qué sirve:** Asistente pastoral con IA: análisis de miembros, sugerencias pastorales, respuestas a consultas. Es el proveedor por defecto (gratuito y rápido).

| Variable | Descripción |
|----------|-------------|
| `GROQ_API_KEY` | API key de console.groq.com |

**Modelo por defecto:** `llama-3.3-70b-versatile`

**Archivos que lo usan:**
- `backend/src/routes/ia.js` — router multi-proveedor, usa Groq como fallback si no hay Anthropic/OpenAI
- `backend/src/routes/config.js` — diagnóstico
- `backend/src/server.js` — log de startup
- `frontend/src/pages/Configuracion.jsx` — UI para cargar la key

---

## 9. Anthropic — IA (Claude)

**Para qué sirve:** Alternativa premium al asistente pastoral. Usa Claude Haiku por defecto.

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key de console.anthropic.com |

**Modelo por defecto:** `claude-haiku-4-5-20251001`

**Archivos que lo usan:**
- `backend/src/routes/ia.js` — proveedor principal si está configurado
- `backend/src/routes/config.js` — diagnóstico
- `frontend/src/pages/Configuracion.jsx` — UI para cargar la key

---

## 10. OpenAI — IA (ChatGPT)

**Para qué sirve:** Segunda alternativa al asistente pastoral.

| Variable | Descripción |
|----------|-------------|
| `OPENAI_API_KEY` | API key de platform.openai.com |

**Modelo por defecto:** `gpt-4o-mini`

**Archivos que lo usan:**
- `backend/src/routes/ia.js` — proveedor secundario
- `backend/src/routes/config.js` — diagnóstico
- `frontend/src/pages/Configuracion.jsx` — UI para cargar la key

---

## Resumen rápido

| Servicio | Tipo | Variables clave | Obligatorio |
|----------|------|-----------------|-------------|
| Resend | Email | `RESEND_API_KEY` | No (app funciona sin él) |
| Meta Cloud API | WhatsApp oficial | `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID` | No |
| Twilio | WhatsApp legacy/fallback | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | No |
| MercadoPago | Pagos LATAM | `MP_ACCESS_TOKEN` | No (solo para cobros) |
| Google OAuth | Login social | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No |
| Apple Sign-In | Login social | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | No |
| Web Push VAPID | Notificaciones | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | No |
| Groq | IA (principal) | `GROQ_API_KEY` | No |
| Anthropic | IA (Claude) | `ANTHROPIC_API_KEY` | No |
| OpenAI | IA (GPT) | `OPENAI_API_KEY` | No |

**Ninguna integración es obligatoria para arrancar el servidor.** El sistema detecta automáticamente cuáles están configuradas y habilita las funciones correspondientes. Las que faltan simplemente muestran una advertencia en el panel de Configuración.

---

## Dónde configurarlas

**Opción A — Archivo `.env`:**
```
backend/.env   ←  copiar de backend/.env.example y completar
```

**Opción B — Panel de administración:**
Ir a `/configuracion` en la app → sección "Integraciones". Los cambios se aplican en caliente sin reiniciar el servidor.
