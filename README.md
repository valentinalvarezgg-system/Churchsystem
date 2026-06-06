# Church System — v2.9

Sistema integral de gestión pastoral para iglesias evangélicas.  
Multi-tenant · SaaS · Mobile-first · Productivo en `churchsystem.com.ar`

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20 + Express 4 (ESM) |
| Base de datos | PostgreSQL via [Neon](https://neon.tech) |
| Frontend | React 18 + Vite 5 |
| Deploy | Render (web service) / Mac + Cloudflare Tunnel |
| Email | Resend (salida + inbound `@churchsystem.com.ar`) |
| Pagos | Mercado Pago · Stripe · PayPal · Transferencia bancaria |
| Mensajería | WhatsApp Cloud API (Meta oficial) con fallback Twilio |
| IA | Anthropic Claude API (chat pastoral + análisis Excel) |
| Notificaciones | Web Push (VAPID) |
| CSS | Vanilla CSS dark/light (mobile-first) |
| Build | pnpm |

---

## Inicio rápido

```bash
git clone git@github.com:valentinalvarezgg-system/Churchsystem.git
cd Churchsystem

# Backend
cd backend
cp .env.example .env   # completar variables obligatorias
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

# URLs
BASE_URL=https://churchsystem.com.ar
FRONTEND_URL=https://churchsystem.com.ar

# Email (Resend)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Church System <no-reply@send.churchsystem.com.ar>
RESEND_INBOUND_SECRET=secreto_webhook_resend

# QR Check-in (sin esto los QR se invalidan en cada redeploy)
QR_SECRET=aleatorio_estable_32chars

# Pagos
MP_ACCESS_TOKEN=APP_USR-xxxxx
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# WhatsApp Cloud API (Meta)
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_SYSTEM_TOKEN=
META_VERIFY_TOKEN=
META_GRAPH_VERSION=v23.0

# IA
ANTHROPIC_API_KEY=sk-ant-xxxxx

# GodMode (dueño del SaaS)
GODMODE_USER_EMAIL=owner@churchsystem.com.ar
GODMODE_USER_PASSWORD=contraseña_segura

# Push notifications (VAPID)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:soporte@churchsystem.com.ar

# OAuth (opcional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
APPLE_CLIENT_ID=com.churchsystem.web
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI=https://churchsystem.com.ar/oauth/apple/callback
```

---

## Estructura del proyecto

```
Churchsystem/
├── backend/src/
│   ├── server.js              # Entry point
│   ├── routes/                # ~40 endpoints REST
│   │   ├── auth.js            # Login, registro, verify, OAuth, forgot/reset password
│   │   ├── personas.js        # CRUD personas + búsqueda avanzada con filtros
│   │   ├── grupos.js          # Grupos + miembros
│   │   ├── cultos.js          # Cultos y horarios
│   │   ├── checkin.js         # QR check-in (público + admin)
│   │   ├── mensajes.js        # Mensajería (WhatsApp + fallback Twilio)
│   │   ├── alertas.js         # Alertas pastorales push
│   │   ├── notificaciones.js  # Push subscriptions + envío diario 8:30 AM
│   │   ├── reportes.js        # Reportes asistencia (semanal→anual)
│   │   ├── export.js          # Excel/PDF (fetch+blob, sin JWT en URL)
│   │   ├── import.js          # Import Excel de personas
│   │   ├── excel_ia.js        # IA sobre hojas Excel
│   │   ├── ia.js              # Chat IA pastoral (Claude)
│   │   ├── ministerios.js     # Ministerios + 10 sub-recursos
│   │   ├── eventos.js         # Calendario de eventos
│   │   ├── comunicados.js     # Comunicados internos
│   │   ├── consolidacion.js   # Flujo de consolidación
│   │   ├── discipulado.js     # Discipulado / seguimiento espiritual
│   │   ├── analytics.js       # KPIs y gráficos (por plan)
│   │   ├── stats.js           # KPIs dashboard rápido
│   │   ├── config.js          # Config iglesia + diagnósticos
│   │   ├── plan.js            # Plan activo + catálogo comercial
│   │   ├── billing.js         # Planes, precios, países
│   │   ├── mercadopago.js     # Checkout + webhook MP
│   │   ├── stripe.js          # Checkout + webhook Stripe
│   │   ├── paypal.js          # Órdenes + captura PayPal
│   │   ├── transferencia.js   # Solicitud de pago manual
│   │   ├── whatsapp.js        # WhatsApp Cloud API (Meta oficial)
│   │   ├── godmode.js         # Panel dueño SaaS
│   │   ├── promo-codes.js     # Códigos promo (GODMODE)
│   │   ├── users.js           # Usuarios de la iglesia
│   │   ├── permisos.js        # Permisos por rol
│   │   ├── historial.js       # Log de auditoría
│   │   ├── busqueda.js        # Búsqueda global full-text
│   │   ├── invitaciones.js    # Invitaciones por link
│   │   ├── sesiones.js        # Sesiones activas por dispositivo
│   │   ├── backup.js          # Export backup general
│   │   ├── oracion.js         # [bloqueado — decisión legal]
│   │   └── finanzas.js        # [bloqueado — decisión legal]
│   ├── middlewares/
│   │   ├── auth.js            # requireAuth, requireRol
│   │   ├── plan.js            # requirePlan, PLANES (STARTER/PRO/MAX)
│   │   └── security.js        # sanitizeBody, errorHandler
│   └── lib/
│       ├── pg.js              # pgOne / pgMany / pgExec
│       ├── billing.js         # Catálogo 7 planes + tier mapper
│       ├── email.js           # Resend helpers
│       └── env.js             # Audit de entorno al arranque
│
├── frontend/src/
│   ├── pages/                 # ~35 páginas lazy-loaded
│   │   ├── Login.jsx          # Login + OAuth
│   │   ├── Registro.jsx       # Onboarding (2 líneas: liderazgo / iglesia)
│   │   ├── Dashboard.jsx      # KPIs y resumen ejecutivo
│   │   ├── DashboardPremium.jsx # Vista pastor general avanzada
│   │   ├── Analytics.jsx      # Gráficos de actividad pastoral (por plan)
│   │   ├── Personas.jsx       # Lista + filtros avanzados + ficha rápida
│   │   ├── Perfil.jsx         # Perfil completo de persona
│   │   ├── Grupos.jsx         # Grupos + miembros
│   │   ├── Asistencia.jsx     # Cultos + asistencia con check
│   │   ├── CheckIn.jsx        # QR check-in admin + página pública
│   │   ├── Calendario.jsx     # Calendario mensual
│   │   ├── Eventos.jsx        # Gestión de eventos
│   │   ├── Mensajes.jsx       # Mensajería interna
│   │   ├── Alertas.jsx        # Alertas pastorales
│   │   ├── Reportes.jsx       # Reportes con export Excel/PDF
│   │   ├── Comunicados.jsx    # Comunicados al equipo
│   │   ├── Discipulado.jsx    # Consolidación de visitantes
│   │   ├── Ministerios.jsx    # Lista de ministerios
│   │   ├── MinisterioDetalle.jsx # Detalle: panel, tareas, miembros, turnos, evaluaciones, inventario…
│   │   ├── AsistenteIA.jsx    # Chat IA pastoral (Claude)
│   │   ├── ExcelIA.jsx        # Análisis de Excel con IA
│   │   ├── Planes.jsx         # Catálogo de planes + checkout (mobile-friendly)
│   │   ├── Configuracion.jsx  # Config iglesia + pagos + notificaciones + WhatsApp
│   │   ├── ConfiguracionOrganizacion.jsx # Miembros/Roles/Invitaciones/Sesiones
│   │   ├── Users.jsx          # Gestión de usuarios
│   │   ├── MiPerfil.jsx       # Mi perfil de usuario
│   │   ├── Historial.jsx      # Log de auditoría
│   │   ├── GodMode.jsx        # Panel dueño SaaS (cross-tenant)
│   │   └── PromoCodes.jsx     # Admin códigos promo
│   ├── components/
│   │   ├── Menu.jsx           # Sidebar + i18n (es/pt/en) + plan logic
│   │   ├── Layout.jsx         # Wrapper con sidebar/header/bottom-nav
│   │   ├── Toast.jsx          # Notificaciones toast (no alert())
│   │   ├── Modal.jsx          # Modal + ConfirmModal reutilizables
│   │   ├── Icons.jsx          # Iconos SVG inline (lucide-react)
│   │   ├── UpgradeGate.jsx    # Guard de plan/módulo → redirige a /planes
│   │   └── BusquedaGlobal.jsx # Búsqueda global (⌘K)
│   ├── hooks/
│   │   ├── useOrientation.js  # portrait/landscape + isPhone/isTablet/isDesktop
│   │   ├── usePlan.js         # Plan activo + commercialPlan
│   │   └── useNotificaciones.js # Push subscription
│   ├── lib/
│   │   ├── i18n.js            # makeI18n() helper + COMMON dict
│   │   └── commercialPlans.js # Catálogo 7 planes + resolveAccessTier()
│   └── services/
│       └── api.js             # apiFetch(), getUser(), getApiUrl()
│
├── landing/index.html         # Landing pública (ruta /)
├── scripts/audit.mjs          # Auditoría integral (13 checks)
├── render.yaml                # Config deploy Render
├── CLAUDE.md                  # Instrucciones de trabajo para IA
└── BITACORA.md                # Estado real del proyecto (leer primero)
```

---

## Planes comerciales

| Plan | Audiencia | Personas | USD/mes |
|------|-----------|----------|---------|
| FREE | Nuevas cuentas | 50 | — |
| STARTER | Líderes / pastores individuales | 300 | 29 |
| PRO | Equipos pastorales | 1.000 | 59 |
| MAX | Iglesias medianas | ilimitadas | 99 |
| CHURCH 100 | Iglesia hasta 100 personas | 100 | 79 |
| CHURCH 500 | Iglesia hasta 500 personas | 500 | 149 |
| CHURCH 1000 | Iglesia hasta 1000 personas | 1.000 | 249 |

Los planes se agrupan internamente en 3 **tiers de acceso**: `STARTER`, `PRO`, `MAX`.  
El catálogo comercial y el sistema de permisos están desacoplados (`commercialPlans.js`).

---

## Módulos del sistema

| Módulo | Ruta | Tier mínimo | Estado |
|--------|------|-------------|--------|
| Dashboard | `/` | todos | ✅ |
| Dashboard Premium | `/premium` | MAX | ✅ |
| Analytics | `/analytics` | todos (KPIs por tier) | ✅ |
| Personas + filtros | `/personas` | todos | ✅ |
| Perfil de persona | `/personas/:id` | todos | ✅ |
| Grupos | `/grupos` | todos | ✅ |
| Asistencia | `/asistencia` | PRO | ✅ |
| QR Check-in | `/checkin` | PRO | ✅ |
| Calendario | `/calendario` | PRO | ✅ |
| Eventos | `/eventos` | PRO | ✅ |
| Consolidación | `/consolidacion` | PRO | ✅ |
| Ministerios | `/ministerios` | todos | ✅ |
| Mensajes | `/mensajes` | MAX | ✅ |
| Alertas | `/alertas` | MAX | ✅ |
| Reportes | `/reportes` | MAX | ✅ |
| Comunicados | `/comunicados` | todos | ✅ |
| Asistente IA | `/asistente-ia` | MAX | ✅ |
| Excel + IA | `/excel-ia` | MAX | ✅ |
| Planes | `/planes` | todos | ✅ |
| Configuración | `/configuracion` | admin | ✅ |
| Organización | `/organizacion` | MAX | ✅ |
| Usuarios | `/users` | MAX | ✅ |
| Mi perfil | `/mi-perfil` | todos | ✅ |
| Historial | `/historial` | MAX | ✅ |
| GodMode | `/vault` | GODMODE | ✅ |
| Finanzas | — | — | 🔒 oculto |
| Oración | — | — | 🔒 oculto |

---

## Roles

| Rol | Acceso |
|-----|--------|
| `PASTOR_GENERAL` | Admin completo de la iglesia (tier MAX) |
| `PASTOR_CULTO` | Personas, asistencia, mensajes del día |
| `CONSOLIDACION` | Seguimientos, alertas, reportes, historial |
| `STAFF` | Operaciones diarias (personas, grupos, mensajes) |
| `LIDER` | Dashboard y lectura básica |
| `GODMODE` | Panel dueño SaaS (cross-tenant) |

---

## Deploy

### Modo actual: Mac + Cloudflare Tunnel

El backend corre en la Mac gestionado por **launchd**. Cloudflare Tunnel expone `localhost:4000` como `churchsystem.com.ar`.

```bash
# Reiniciar backend
launchctl unload ~/Library/LaunchAgents/com.churchsystem.backend.plist
launchctl load  ~/Library/LaunchAgents/com.churchsystem.backend.plist

# Logs en vivo
tail -f /tmp/church-back.log
```

### Deploy a Render

La rama `master` dispara auto-deploy en Render.

**Regla crítica:** `frontend/dist/` está commiteado en git. Después de cada cambio de frontend:

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

```js
// Backend — multi-tenant siempre + soft-delete
WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL
// Tablas: "PascalCase" | Columnas: "camelCase" | Params: $1 $2 $3
await pgOne(sql, params)   // → fila | null
await pgMany(sql, params)  // → array
await pgExec(sql, params)  // → void

// Frontend
import { apiFetch } from '../services/api.js'   // nunca localhost:4000
import { toast }    from '../components/Toast.jsx' // nunca alert()/confirm()
// Mobile-first: inputs ≥44px, cards en móvil, no emojis (usar Icons.jsx)
```

---

## QR Check-in

1. Admin genera QR desde `/checkin` para un culto
2. QR apunta a `/app/checkin/:cultoId/:token` (sin login)
3. Token = SHA-256(`QR_SECRET` + cultoId)
4. Configurar `FRONTEND_URL` en Render o la URL base desde el panel

---

## Alertas push

`enviarAlertas()` corre automáticamente a las 8:30 AM y notifica:
- Cumpleaños del día
- Seguimientos vencidos
- Visitantes sin consolidar

---

## Estado

**Versión:** v2.9  
**Rama activa:** `master`  
**Producción:** `https://churchsystem.com.ar`  
**Fuente de verdad del estado:** `/BITACORA.md`

---

## Licencia

Privado — Todos los derechos reservados  
© 2024-2026 Church System
