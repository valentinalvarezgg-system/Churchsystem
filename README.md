# Church System — v3.0.0

Sistema integral de gestión pastoral para iglesias evangélicas.  
Multi-tenant · SaaS · Mobile-first · Productivo en `churchsystem.com.ar`

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20 + Express 4 (ESM) |
| Base de datos | PostgreSQL via [Neon](https://neon.tech) |
| Frontend | React 18 + Vite 5 |
| Deploy | Mac + Cloudflare Tunnel (prod) / Render (alternativo) |
| Email | Resend (salida + inbound) |
| Pagos | Mercado Pago · Stripe · PayPal · Transferencia bancaria |
| IA | Anthropic Claude API |
| CSS | Vanilla CSS dark (mobile-first) |
| Notificaciones | Web Push (VAPID) |
| WhatsApp | Meta Cloud API (oficial) |
| Build | pnpm |

---

## Inicio rápido (desarrollo local)

```bash
git clone git@github.com:valentinalvarezgg-system/Churchsystem.git
cd Churchsystem

# Backend
cd backend
cp .env.example .env   # completar variables
pnpm install
node src/server.js

# Frontend (otra terminal)
cd ../frontend
pnpm install
pnpm dev
```

**Backend:** `http://localhost:4000`  
**Frontend dev:** `http://localhost:5173`

---

## Variables de entorno (backend `.env`)

```env
# Obligatorias — el servidor no arranca sin estas
JWT_SECRET=min32chars_aleatorio
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Email
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Church System <no-reply@send.churchsystem.com.ar>
RESEND_INBOUND_SECRET=secreto_webhook_resend

# URLs
BASE_URL=https://churchsystem.com.ar
FRONTEND_URL=https://churchsystem.com.ar
PUBLIC_URL=https://churchsystem.com.ar

# QR Check-in (si no se setea, los QR se invalidan en cada redeploy)
QR_SECRET=aleatorio_estable_32chars

# Pagos
MP_ACCESS_TOKEN=APP_USR-xxxxx
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox
TRANSFERENCIA_CBU=...
TRANSFERENCIA_ALIAS=churchsystem.mp
TRANSFERENCIA_BANCO=Banco Galicia
TRANSFERENCIA_TITULAR=Church System SAS

# IA
ANTHROPIC_API_KEY=sk-ant-xxxxx

# GodMode (dueño del SaaS)
GODMODE_USER_EMAIL=owner@churchsystem.com.ar
GODMODE_USER_PASSWORD=contraseña_segura

# Push notifications (VAPID)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:soporte@churchsystem.com.ar

# WhatsApp Cloud API (Meta oficial)
META_SYSTEM_TOKEN=
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_VERIFY_TOKEN=
META_GRAPH_VERSION=v23.0

# OAuth (opcional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
APPLE_CLIENT_ID=com.churchsystem.web
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI=https://churchsystem.com.ar/oauth/apple/callback

# CORS adicional (opcional)
CORS_ORIGINS=https://app.example.com
```

---

## Estructura del proyecto

```
Churchsystem/
├── backend/
│   └── src/
│       ├── server.js              # Entry point — rutas, CORS, rate-limit, seed, async patch
│       ├── routes/                # ~50 endpoints REST
│       │   ├── auth.js            # Login, register, OAuth, forgot/reset password
│       │   ├── personas.js        # CRUD personas + búsqueda avanzada
│       │   ├── grupos.js          # Grupos + miembros
│       │   ├── cultos.js          # Cultos y horarios
│       │   ├── culto-asignaciones.js # Asignaciones de roles a cultos
│       │   ├── checkin.js         # QR check-in (público + admin)
│       │   ├── mensajes.js        # Mensajería interna + WhatsApp
│       │   ├── alertas.js         # Alertas pastorales push
│       │   ├── notificaciones.js  # Push subscriptions + envío diario
│       │   ├── reportes.js        # Reportes de asistencia (semanal→anual)
│       │   ├── analytics.js       # KPIs y gráficos avanzados
│       │   ├── stats.js           # KPIs dashboard
│       │   ├── export.js          # Export Excel/PDF de personas
│       │   ├── import.js          # Import Excel de personas
│       │   ├── excel_ia.js        # IA sobre hojas Excel cargadas
│       │   ├── ia.js              # Chat IA pastoral (Claude)
│       │   ├── chat.js            # Chat interno
│       │   ├── eventos.js         # Calendario de eventos
│       │   ├── comunicados.js     # Comunicados internos
│       │   ├── consolidacion.js   # Flujo de consolidación
│       │   ├── discipulado.js     # Discipulado / árbol espiritual
│       │   ├── seguimiento.js     # Historial de seguimientos
│       │   ├── historial.js       # Log de auditoría de acciones
│       │   ├── ministerios.js     # Ministerios + equipos
│       │   ├── documentos.js      # Documentos compartidos
│       │   ├── miembro.js         # Portal del miembro (autoservicio)
│       │   ├── config.js          # Config iglesia + diagnóstico comercial
│       │   ├── iglesia.js         # Token y gestión de iglesia
│       │   ├── plan.js            # Planes y módulos habilitados
│       │   ├── subscriptions.js   # Gestión de suscripciones
│       │   ├── mercadopago.js     # Checkout MP + webhook
│       │   ├── stripe.js          # Checkout Stripe + webhook
│       │   ├── paypal.js          # Checkout PayPal
│       │   ├── transferencia.js   # Pago por transferencia bancaria
│       │   ├── registro.js        # Registro de nueva iglesia
│       │   ├── verificacion.js    # Verificación de email
│       │   ├── oauth.js           # Google + Apple OAuth
│       │   ├── permisos.js        # Gestión de permisos por rol
│       │   ├── users.js           # Gestión de usuarios de la iglesia
│       │   ├── perfil_usuario.js  # Mi perfil (usuario actual)
│       │   ├── persona_perfil.js  # Perfil de persona (foto, ficha)
│       │   ├── invitaciones.js    # Invitaciones por link
│       │   ├── sesiones.js        # Sesiones activas por dispositivo
│       │   ├── whatsapp.js        # WhatsApp Cloud API (Meta oficial)
│       │   ├── backup.js          # Export backup general
│       │   ├── busqueda.js        # Búsqueda global
│       │   ├── godmode.js         # Panel dueño SaaS (GODMODE)
│       │   ├── promo-codes.js     # Códigos promocionales (GODMODE)
│       │   ├── bug-report.js      # Reporte de bugs vía email
│       │   ├── resend-inbound.js  # Webhook correos entrantes
│       │   ├── oracion.js         # [oculto — decisión legal]
│       │   └── finanzas.js        # [oculto — decisión legal]
│       ├── middlewares/
│       │   ├── auth.js            # requireAuth, requireRol
│       │   ├── plan.js            # requirePlan, PLANES
│       │   ├── security.js        # sanitizeBody, errorHandler
│       │   └── tenant.js          # iglesiaId en req.user
│       ├── lib/
│       │   ├── pg.js              # pgOne / pgMany / pgExec
│       │   ├── billing.js         # Planes, precios, países, promo
│       │   ├── email.js           # Resend helpers
│       │   ├── contact-mail.js    # Resolución centralizada de aliases de contacto
│       │   ├── env.js             # audit de entorno al arranque
│       │   ├── logger.js          # pino logger
│       │   ├── xlsx-safe.js       # XLSX wrapper
│       │   └── core-sync.js       # Migración legado SQLite→PG (no-op en prod)
│       └── utils/
│           └── auditoria.js       # Log de auditoría por acción
│
├── frontend/
│   └── src/
│       ├── main.jsx               # Entry point React (basename="/app")
│       ├── App.jsx                # Router principal + lazy loading + ErrorBoundary
│       ├── index.css              # Estilos globales dark + responsive
│       ├── theme.css              # Variables CSS / design tokens
│       ├── version.js             # APP_VERSION — fuente única de versión frontend
│       ├── pages/                 # 40+ páginas lazy-loaded
│       │   ├── Login.jsx          # Login + OAuth
│       │   ├── Registro.jsx       # Onboarding nueva iglesia
│       │   ├── SetupWizard.jsx    # Wizard inicial para nueva iglesia
│       │   ├── Dashboard.jsx      # KPIs y resumen ejecutivo
│       │   ├── DashboardPremium.jsx # Vista pastor general avanzada
│       │   ├── Analytics.jsx      # Métricas avanzadas y gráficos
│       │   ├── Personas.jsx       # Lista + búsqueda avanzada + ficha rápida
│       │   ├── Perfil.jsx         # Perfil completo de persona
│       │   ├── Grupos.jsx         # Grupos + miembros
│       │   ├── Liderazgo.jsx      # Vista de estructura de liderazgo
│       │   ├── Ministerios.jsx    # Lista de ministerios
│       │   ├── MinisterioDetalle.jsx # Detalle de ministerio + equipo
│       │   ├── Asistencia.jsx     # Cultos + lista de asistencia
│       │   ├── CheckIn.jsx        # QR check-in admin + página pública
│       │   ├── Calendario.jsx     # Calendario mensual
│       │   ├── Eventos.jsx        # Gestión de eventos
│       │   ├── Mensajes.jsx       # Mensajería interna
│       │   ├── Alertas.jsx        # Alertas pastorales
│       │   ├── Reportes.jsx       # Reportes de asistencia con export
│       │   ├── Comunicados.jsx    # Comunicados al equipo
│       │   ├── Discipulado.jsx    # Árbol de discipulado + consolidación
│       │   ├── Consolidacion.jsx  # Seguimiento de nuevos creyentes
│       │   ├── AsistenteIA.jsx    # Chat IA pastoral
│       │   ├── ExcelIA.jsx        # Análisis de Excel con IA
│       │   ├── Documentos.jsx     # Documentos compartidos
│       │   ├── MapaGrupos.jsx     # Mapa geográfico de grupos
│       │   ├── Planes.jsx         # Planes y precios (checkout)
│       │   ├── PortalMiembro.jsx  # Portal autoservicio del miembro
│       │   ├── Configuracion.jsx  # Config iglesia + notificaciones
│       │   ├── ConfiguracionOrganizacion.jsx # Miembros/Roles/Invitaciones/Sesiones
│       │   ├── GestionPermisos.jsx # Permisos por rol
│       │   ├── Users.jsx          # Gestión de usuarios
│       │   ├── MiPerfil.jsx       # Mi perfil de usuario
│       │   ├── Historial.jsx      # Log de auditoría
│       │   ├── GodMode.jsx        # Panel dueño SaaS
│       │   ├── GodModeLogin.jsx   # Login GODMODE (/vault-login)
│       │   ├── PromoCodes.jsx     # Admin códigos promo
│       │   ├── RecuperarPassword.jsx # Recupero de contraseña en 2 pasos
│       │   ├── Terminos.jsx       # Términos y condiciones
│       │   ├── Privacidad.jsx     # Política de privacidad
│       │   └── FAQ.jsx            # Preguntas frecuentes
│       ├── components/
│       │   ├── Layout.jsx         # Sidebar + mobile header + bottom nav + rail
│       │   ├── Menu.jsx           # Navegación + i18n (es/pt/en)
│       │   ├── Toast.jsx          # Notificaciones toast (global)
│       │   ├── Modal.jsx          # Modales reutilizables + ConfirmModal
│       │   ├── Icons.jsx          # Iconos SVG inline
│       │   ├── ProtectedRoute.jsx # Guard de autenticación y roles
│       │   ├── UpgradeGate.jsx    # Guard de plan/módulo
│       │   ├── BannerNotificaciones.jsx # Banner push opt-in
│       │   ├── BtnNotificaciones.jsx    # Switch iOS push
│       │   ├── BugReporter.jsx    # Botón flotante ? de reporte
│       │   ├── BusquedaGlobal.jsx # Búsqueda global
│       │   ├── CamaraFoto.jsx     # Captura de foto con cámara
│       │   ├── EmailVerificacion.jsx # Flujo verificación de email
│       │   ├── QRScannerNativo.jsx # Scanner QR (Capacitor)
│       │   └── TokenIglesia.jsx   # Input y admin de token de iglesia
│       ├── hooks/
│       │   ├── useNotificaciones.js  # Push subscription + test
│       │   ├── useOrientation.js     # Detección phone/tablet/desktop en tiempo real
│       │   ├── usePlan.js            # Plan activo + módulos habilitados
│       │   └── useRealtimeQuery.js   # Polling con retry
│       ├── lib/
│       │   ├── i18n.js            # makeI18n() + COMMON (es/pt/en)
│       │   └── commercialPlans.js # Catálogo de planes comerciales frontend
│       ├── services/
│       │   └── api.js             # getApiUrl(), apiFetch(), getUser(), auth
│       └── utils/
│           ├── i18n-auth.js       # Traducciones auth (es/pt/en)
│           └── legal.js           # Emails de contacto, textos legales, versión
│
├── landing/
│   └── index.html                 # Landing pública (ruta /)
│
├── scripts/
│   └── audit.mjs                  # Auditoría integral (13 checks)
│
├── render.yaml                    # Config deploy Render
├── CLAUDE.md                      # Instrucciones de trabajo para IA
└── BITACORA.md                    # Estado real del proyecto (leer primero)
```

---

## Módulos del sistema

| Módulo | Ruta | Plan mínimo | Estado |
|--------|------|------------|--------|
| Dashboard | `/` | GENERAL | ✅ |
| Dashboard Premium | `/premium` | GENERAL (admin) | ✅ |
| Analytics | `/analytics` | PRO | ✅ |
| Personas | `/personas` | GENERAL | ✅ búsqueda avanzada |
| Grupos | `/grupos` | GENERAL | ✅ |
| Liderazgo | `/liderazgo` | GENERAL | ✅ |
| Ministerios | `/ministerios` | GENERAL | ✅ |
| Asistencia | `/asistencia` | STARTER | ✅ |
| QR Check-in | `/checkin` | STARTER | ✅ |
| Calendario | `/calendario` | STARTER | ✅ |
| Eventos | `/eventos` | STARTER | ✅ |
| Mensajes | `/mensajes` | PRO | ✅ |
| Alertas | `/alertas` | PRO | ✅ |
| Reportes | `/reportes` | PRO | ✅ |
| Consolidación | `/consolidacion` | PRO | ✅ |
| Discipulado + Árbol | `/discipulado` | PRO | ✅ |
| Comunicados | `/comunicados` | GENERAL | ✅ |
| Documentos | `/documentos` | PRO | ✅ |
| Mapa de grupos | `/mapa-grupos` | PRO | ✅ |
| Portal miembro | `/portal-miembro` | GENERAL | ✅ |
| Asistente IA | `/asistente-ia` | MAX | ✅ |
| Excel + IA | `/excel-ia` | PRO | ✅ |
| Historial | `/historial` | PRO | ✅ |
| Configuración | `/configuracion` | admin rol | ✅ |
| Org + Usuarios | `/configuracion-organizacion` | admin rol | ✅ |
| Mi perfil | `/mi-perfil` | todos | ✅ |
| Planes | `/planes` | todos | ✅ |
| GodMode | `/vault` | GODMODE | ✅ |
| Finanzas | — | — | 🔒 oculto (legal) |
| Oración | — | — | 🔒 oculto (legal) |

---

## Roles

| Rol | Acceso |
|-----|--------|
| `PASTOR_GENERAL` | Admin completo de la iglesia |
| `PASTOR_CULTO` | Personas de su culto, asistencia, mensajes |
| `CONSOLIDACION` | Seguimientos, alertas, reportes, historial |
| `STAFF` | Operaciones diarias (personas, grupos, mensajes) |
| `LIDER` | Dashboard y vistas de solo lectura |
| `GODMODE` | Panel dueño SaaS (cross-tenant, solo dueño del producto) |

---

## Planes comerciales

| Plan | Audiencia | Personas | Precio USD |
|------|-----------|----------|-----------|
| `FREE` | Organizaciones pequeñas | 50 | $0 |
| `STARTER` | Inicio | 300 | $29/mes |
| `PRO` | Crecimiento | 1 000 | $59/mes |
| `MAX` | Escala | ilimitadas | $99/mes |
| `CHURCH_100` | Iglesias ~100 miembros | 150 | $49/mes |
| `CHURCH_500` | Iglesias ~500 miembros | 600 | $89/mes |
| `CHURCH_1000` | Iglesias grandes | 1 200 | $149/mes |

---

## Deploy

### Modo activo: Mac + Cloudflare Tunnel (`MODO_CLOUDFLARE_LOCAL`)

El backend corre en la Mac gestionado por **launchd** y Cloudflare Tunnel expone `localhost:4000` como `churchsystem.com.ar`.

```bash
# Reiniciar el backend
launchctl unload ~/Library/LaunchAgents/com.churchsystem.backend.plist
launchctl load  ~/Library/LaunchAgents/com.churchsystem.backend.plist

# Ver logs en vivo
tail -f /tmp/church-back.log
tail -f /tmp/church-back-err.log
```

### Deploy de frontend (obligatorio antes de cada push)

`frontend/dist/` está commiteado en git. Render (o el túnel) sirve esos archivos directamente.

```bash
cd frontend && pnpm build
cd ..
git add frontend/dist/
git add -A
git commit -m "tipo(scope): descripción"
git push origin master
```

---

## Convenciones de código

### Backend

```js
// Multi-tenant siempre + soft-delete
WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL

// Tablas: "PascalCase" | Columnas: "camelCase" | Params: $1 $2 $3
await pgOne(sql, params)   // → fila | null
await pgMany(sql, params)  // → array
await pgExec(sql, params)  // → void
```

### Frontend

```js
import { apiFetch } from '../services/api.js'      // nunca localhost:4000
import { toast }    from '../components/Toast.jsx' // nunca alert()
import { makeI18n } from '../lib/i18n.js'           // i18n en cada página
import { useOrientation } from '../hooks/useOrientation.js' // phone/tablet/desktop
```

---

## QR Check-in

1. Admin genera QR desde `/checkin` para un culto
2. QR apunta a `/app/checkin/:cultoId/:token` (acceso sin login)
3. Token = SHA-256(`QR_SECRET` + cultoId)
4. Configurar `FRONTEND_URL` o usar el widget "URL base QR" en el panel para URLs permanentes

---

## Alertas push

El servidor envía alertas diarias a las 8:30 AM notificando:
- Cumpleaños del día
- Seguimientos vencidos
- Visitantes sin consolidar

---

## Auditoría y QA

```bash
node scripts/audit.mjs           # 13 checks de salud del sistema
node scripts/audit.mjs --json    # output JSON
```

---

## Estado

**Versión:** 2.9.5  
**Rama activa:** `master`  
**Producción:** `https://churchsystem.com.ar`  
**Fuente de verdad del estado:** `/BITACORA.md`

---

## Licencia

Privado — Todos los derechos reservados  
© 2024-2026 Church System
