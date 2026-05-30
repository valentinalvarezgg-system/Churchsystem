# Church System — v2.7 beta

Sistema integral de gestión pastoral para iglesias evangélicas.  
Multi-tenant · SaaS · Mobile-first · Productivo en `churchsystem.com.ar`

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20 + Express (ESM) |
| Base de datos | PostgreSQL via [Neon](https://neon.tech) |
| Frontend | React 18 + Vite 5 |
| Deploy | Render (web service) |
| Email | Resend (salida + inbound) |
| Pagos | Mercado Pago |
| IA | Anthropic Claude API |
| CSS | Vanilla CSS dark (mobile-first) |
| Notificaciones | Web Push (VAPID) |
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
**Admin seed (solo dev):** `admin@iglesia.com` / `admin123`

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

# CORS adicional (opcional)
CORS_ORIGINS=https://app.example.com
```

---

## Estructura del proyecto

```
Churchsystem/
├── backend/
│   └── src/
│       ├── server.js              # Entry point — rutas, CORS, rate-limit, seed
│       ├── routes/                # 30 endpoints REST
│       │   ├── auth.js            # Login, register, verify email, OAuth
│       │   ├── personas.js        # CRUD personas
│       │   ├── grupos.js          # Grupos + miembros
│       │   ├── cultos.js          # Cultos y horarios
│       │   ├── checkin.js         # QR check-in (público + admin)
│       │   ├── mensajes.js        # Mensajería interna
│       │   ├── alertas.js         # Alertas pastorales push
│       │   ├── notificaciones.js  # Push subscriptions + envío diario
│       │   ├── reportes.js        # Reportes de asistencia (semanal→anual)
│       │   ├── export.js          # Export Excel/PDF de personas
│       │   ├── import.js          # Import Excel de personas
│       │   ├── excel_ia.js        # IA sobre hojas Excel cargadas
│       │   ├── ia.js              # Chat IA pastoral (Claude)
│       │   ├── eventos.js         # Calendario de eventos
│       │   ├── comunicados.js     # Comunicados internos
│       │   ├── consolidacion.js   # Flujo de consolidación
│       │   ├── discipulado.js     # Discipulado / seguimiento espiritual
│       │   ├── seguimiento.js     # Historial de seguimientos
│       │   ├── historial.js       # Log de auditoría de acciones
│       │   ├── stats.js           # KPIs dashboard
│       │   ├── config.js          # Config iglesia + diagnóstico comercial
│       │   ├── iglesia.js         # Token y gestión de iglesia
│       │   ├── plan.js            # Planes y módulos habilitados
│       │   ├── mercadopago.js     # Checkout + webhook de pago
│       │   ├── registro.js        # Registro de nueva iglesia
│       │   ├── verificacion.js    # Verificación de email
│       │   ├── oauth.js           # Google + Apple OAuth
│       │   ├── permisos.js        # Gestión de permisos por rol
│       │   ├── users.js           # Gestión de usuarios de la iglesia
│       │   ├── perfil_usuario.js  # Mi perfil (usuario actual)
│       │   ├── persona_perfil.js  # Perfil de persona (foto, ficha)
│       │   ├── backup.js          # Export backup general
│       │   ├── busqueda.js        # Búsqueda global
│       │   ├── godmode.js         # Panel dueño SaaS (GODMODE)
│       │   ├── promo-codes.js     # Códigos promocionales (GODMODE)
│       │   ├── bug-report.js      # Reporte de bugs vía email
│       │   ├── resend-inbound.js  # Webhook correos entrantes
│       │   ├── oracion.js         # [bloqueado — decisión legal]
│       │   └── finanzas.js        # [bloqueado — decisión legal]
│       ├── middlewares/
│       │   ├── auth.js            # requireAuth, requireRol
│       │   ├── plan.js            # requirePlan, PLANES
│       │   ├── security.js        # sanitizeBody, errorHandler
│       │   └── tenant.js          # iglesiaId en req.user
│       ├── lib/
│       │   ├── pg.js              # pgOne / pgMany / pgExec
│       │   ├── billing.js         # Planes, precios, países, promo
│       │   ├── email.js           # Resend helpers
│       │   ├── env.js             # audit de entorno al arranque
│       │   ├── logger.js          # pino logger
│       │   ├── xlsx-safe.js       # XLSX wrapper
│       │   ├── core-sync.js       # Migración legado SQLite→PG (no-op en prod)
│       │   └── db.js              # SQLite legado [bloqueado en prod]
│       └── utils/
│           └── auditoria.js       # Log de auditoría por acción
│
├── frontend/
│   └── src/
│       ├── main.jsx               # Entry point React (basename="/app")
│       ├── App.jsx                # Router principal + lazy loading + ErrorBoundary
│       ├── index.css              # Estilos globales dark + responsive
│       ├── theme.css              # Variables CSS / design tokens
│       ├── pages/                 # 29 páginas lazy-loaded
│       │   ├── Login.jsx          # Login + OAuth
│       │   ├── Registro.jsx       # Onboarding nueva iglesia
│       │   ├── SetupWizard.jsx    # Wizard inicial para nueva iglesia
│       │   ├── Dashboard.jsx      # KPIs y resumen ejecutivo
│       │   ├── DashboardPremium.jsx # Vista pastor general avanzada
│       │   ├── Personas.jsx       # Lista + ficha rápida de personas
│       │   ├── Perfil.jsx         # Perfil completo de persona
│       │   ├── Grupos.jsx         # Grupos + miembros
│       │   ├── Asistencia.jsx     # Cultos + lista de asistencia
│       │   ├── CheckIn.jsx        # QR check-in admin + página pública
│       │   ├── Calendario.jsx     # Calendario mensual
│       │   ├── Eventos.jsx        # Gestión de eventos
│       │   ├── Mensajes.jsx       # Mensajería interna
│       │   ├── Alertas.jsx        # Alertas pastorales
│       │   ├── Reportes.jsx       # Reportes de asistencia con export
│       │   ├── Comunicados.jsx    # Comunicados al equipo
│       │   ├── Discipulado.jsx    # Consolidación de visitantes (ruta /consolidacion)
│       │   ├── AsistenteIA.jsx    # Chat IA pastoral
│       │   ├── ExcelIA.jsx        # Análisis de Excel con IA
│       │   ├── Configuracion.jsx  # Config iglesia + notificaciones
│       │   ├── GestionPermisos.jsx # Permisos por rol
│       │   ├── Users.jsx          # Gestión de usuarios
│       │   ├── MiPerfil.jsx       # Mi perfil de usuario
│       │   ├── Historial.jsx      # Log de auditoría
│       │   ├── GodMode.jsx        # Panel dueño SaaS
│       │   ├── GodModeLogin.jsx   # Login GODMODE (/vault-login)
│       │   ├── PromoCodes.jsx     # Admin códigos promo
│       │   ├── Terminos.jsx       # Términos y condiciones
│       │   ├── Privacidad.jsx     # Política de privacidad
│       │   └── FAQ.jsx            # Preguntas frecuentes
│       ├── components/
│       │   ├── Layout.jsx         # Sidebar + mobile header + bottom nav + rail
│       │   ├── Menu.jsx           # Navegación + i18n (es/pt/en)
│       │   ├── Toast.jsx          # Notificaciones toast (global)
│       │   ├── Modal.jsx          # Modales reutilizables
│       │   ├── ProtectedRoute.jsx # Guard de autenticación y roles
│       │   ├── UpgradeGate.jsx    # Guard de plan/módulo
│       │   ├── BannerNotificaciones.jsx # Banner push opt-in
│       │   ├── BtnNotificaciones.jsx    # Switch iOS push
│       │   ├── BugReporter.jsx    # Botón flotante ? de reporte
│       │   ├── BusquedaGlobal.jsx # Búsqueda global
│       │   ├── CamaraFoto.jsx     # Captura de foto con cámara
│       │   ├── EmailVerificacion.jsx # Flujo verificación de email
│       │   ├── Icons.jsx          # Iconos SVG inline
│       │   ├── QRScannerNativo.jsx # Scanner QR (Capacitor)
│       │   └── TokenIglesia.jsx   # Input y admin de token de iglesia
│       ├── hooks/
│       │   ├── useNotificaciones.js  # Push subscription + test
│       │   ├── useOrientation.js     # Detección portrait/landscape
│       │   ├── usePlan.js            # Plan activo + módulos habilitados
│       │   └── useRealtimeQuery.js   # Polling con retry
│       ├── services/
│       │   └── api.js             # getApiUrl(), apiFetch(), getUser(), auth
│       └── utils/
│           ├── i18n-auth.js       # Traducciones auth (es/pt/en)
│           └── legal.js           # Emails, textos legales, versión
│
├── landing/
│   └── index.html                 # Landing pública (ruta /)
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
| Personas | `/personas` | GENERAL | ✅ |
| Grupos | `/grupos` | GENERAL | ✅ |
| Asistencia | `/asistencia` | CULTO | ✅ |
| QR Check-in | `/checkin` | CULTO | ✅ |
| Calendario | `/calendario` | CULTO | ✅ |
| Eventos | `/eventos` | CULTO | ✅ |
| Mensajes | `/mensajes` | ADMINISTRACION | ✅ |
| Alertas | `/alertas` | CONSOLIDACION | ✅ |
| Reportes | `/reportes` | CONSOLIDACION | ✅ |
| Consolidación | `/consolidacion` | CONSOLIDACION | ✅ |
| Comunicados | `/comunicados` | GENERAL | ✅ |
| Asistente IA | `/asistente-ia` | PREMIUM | ✅ |
| Excel + IA | `/excel-ia` | ADMINISTRACION | ✅ |
| Historial | `/historial` | ADMINISTRACION | ✅ |
| Configuración | `/configuracion` | admin rol | ✅ |
| Permisos | `/permisos` | admin rol | ✅ |
| Usuarios | `/users` | admin rol | ✅ |
| Mi perfil | `/mi-perfil` | todos | ✅ |
| GodMode | `/vault` | GODMODE | ✅ |
| Finanzas | — | — | 🔒 oculto |
| Oración | — | — | 🔒 oculto |

---

## Roles

| Rol | Acceso |
|-----|--------|
| `PASTOR_GENERAL` | Admin completo de la iglesia |
| `PASTOR_CULTO` | Personas, grupos, asistencia, mensajes |
| `CONSOLIDACION` | Seguimientos, alertas, reportes, historial |
| `STAFF` | Operaciones diarias (personas, grupos, mensajes) |
| `LIDER` | Dashboard y vistas de solo lectura |
| `GODMODE` | Panel dueño SaaS (cross-tenant, solo dueño del producto) |

---

## Deploy

La rama `master` se auto-despliega en Render cuando se hace push.

**Regla crítica:** `frontend/dist/` está commiteado en git. Render sirve esos archivos directamente. Después de cada cambio de frontend:

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

// Helpers
await pgOne(sql, params)   // → fila | null
await pgMany(sql, params)  // → array
await pgExec(sql, params)  // → void
```

### Frontend

```js
import { apiFetch } from '../services/api.js'   // nunca localhost:4000
import { toast }    from '../components/Toast.jsx' // nunca alert()
// Mobile-first: inputs ≥44px, cards en móvil, tablas en desktop
```

---

## QR Check-in

1. Admin genera QR desde `/checkin` para un culto
2. QR apunta a `/app/checkin/:cultoId/:token` (acceso sin login)
3. Token = SHA-256(`QR_SECRET` + cultoId)
4. Para URL pública permanente: configurar `FRONTEND_URL` en Render o ingresar la base URL desde el panel de Check-in

---

## Alertas push

El servidor programa automáticamente `enviarAlertas()` a las 8:30 AM. Notifica:
- Cumpleaños del día
- Seguimientos vencidos
- Visitantes sin consolidar

---

## Backups

- **Neon:** backups automáticos nativos (activar retención ≥ 14 días)
- **GitHub Actions:** workflow `db-backup.yml` — snapshot SQL diario como artifact (14 días)

---

## Estado

**Versión:** 2.7-beta  
**Rama activa:** `master`  
**Producción:** `https://churchsystem.com.ar`  
**Fuente de verdad del estado:** `/BITACORA.md`

---

## Licencia

Privado — Todos los derechos reservados  
© 2024-2026 Church System
