# Church System — v3.1.2

Sistema integral de gestión pastoral para iglesias evangélicas.  
Multi-tenant · SaaS · Mobile-first · Productivo en `churchsystem.com.ar`

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20 + Express (ESM) |
| Base de datos | PostgreSQL via [Neon](https://neon.tech) |
| Frontend | React 18 + Vite 5 |
| Deploy | Cloudflare Tunnel local activo / Render pendiente |
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

# Push notifications (VAPID)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:soporte@churchsystem.com.ar

# OAuth (opcional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
# Apple Sign In — obtener en developer.apple.com → Certificates, Identifiers & Profiles
# Convertir .p8 a una línea: cat AuthKey_XXX.p8 | awk 'NF {printf "%s\\n", $0}'
APPLE_CLIENT_ID=com.churchsystem.web       # Services ID identifier
APPLE_TEAM_ID=XXXXXXXXXX                   # 10 chars, en Membership
APPLE_KEY_ID=XXXXXXXXXX                    # ID de la Key con Sign In with Apple
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI=https://churchsystem.com.ar/oauth/apple/callback

# WhatsApp Cloud API (Meta oficial)
META_APP_ID=
META_APP_SECRET=
META_SYSTEM_TOKEN=           # Token permanente de System User en Meta Business Manager
META_PHONE_NUMBER_ID=        # ID del número en Getting Started
META_WABA_ID=                # WhatsApp Business Account ID
META_VERIFY_TOKEN=           # String secreto para verificación de webhook
META_GRAPH_VERSION=v23.0

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
│       │   ├── invitaciones.js    # Invitaciones por link (CRUD + verificar token)
│       │   ├── sesiones.js        # Gestión de sesiones activas por dispositivo
│       │   ├── whatsapp.js        # WhatsApp Cloud API (Meta oficial)
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
│       │   ├── GestionPermisos.jsx # Permisos por rol (legacy)
│       │   ├── ConfiguracionOrganizacion.jsx # Organización estilo Clerk — Miembros/Roles/Invitaciones/Sesiones
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
| **Discipulado + Árbol** | `/discipulado` | CONSOLIDACION | ✅ nuevo |
| Comunicados | `/comunicados` | GENERAL | ✅ |
| Asistente IA | `/asistente-ia` | PREMIUM | ✅ |
| Excel + IA | `/excel-ia` | ADMINISTRACION | ✅ |
| Historial | `/historial` | ADMINISTRACION | ✅ |
| Ministerios | `/ministerios` | GENERAL | ✅ |
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

### Modo actual: Mac + Cloudflare Tunnel (`MODO_CLOUDFLARE_LOCAL`)

El backend corre en la Mac gestionado por **launchd** y Cloudflare Tunnel expone `localhost:4000` como `churchsystem.com.ar`.

**launchd** garantiza reinicio automático:
- Si el proceso Node cae → se levanta solo en 10 segundos.
- Si la Mac se reinicia → arranca automáticamente al loguear.
- Plist: `~/Library/LaunchAgents/com.churchsystem.backend.plist`
- El plist del backend no debe contener secretos: usa `scripts/run-backend-launchd.sh`, que carga `backend/.env` con permisos `600`.
- Cloudflare Tunnel también debe quedar bajo `launchd`: `pnpm setup:cloudflared`.
- El watchdog local revisa salud local y pública; si cae el backend reinicia `com.churchsystem.backend`, y si cae el túnel reinicia `com.churchsystem.cloudflared`.

```bash
# Instalar/reparar backend como LaunchAgent sin secretos en el plist
pnpm setup:backend

# Reiniciar el backend manualmente si fuera necesario
launchctl kickstart -k gui/$(id -u)/com.churchsystem.backend

# Instalar/reparar Cloudflare Tunnel como LaunchAgent
pnpm setup:cloudflared

# Reiniciar Cloudflare Tunnel manualmente si fuera necesario
launchctl kickstart -k gui/$(id -u)/com.churchsystem.cloudflared

# Ver logs en vivo
tail -f /tmp/church-back.log
tail -f /tmp/church-back-err.log
tail -f /tmp/church-cloudflared.log
tail -f /tmp/church-cloudflared-err.log
```

### Migrar a Render / cuenta Business

La rama `master` se auto-despliega en Render cuando se hace push, pero el corte a Render solo se considera completo cuando `pnpm verify:prod:render` pasa sin errores.

**Regla crítica:** `frontend/dist/` está commiteado en git. Render sirve esos archivos directamente. Después de cada cambio de frontend:

```bash
cd frontend && pnpm build
cd ..
git add frontend/dist/
git add -A
git commit -m "tipo(scope): descripción"
git push origin master
```

Checklist de corte:
1. Crear/seleccionar el servicio `church-system` en la cuenta Business.
2. Abrir el Blueprint: `pnpm render:blueprint-link` y entrar al link generado.
3. Copiar todas las variables `sync: false` de `render.yaml` desde el entorno anterior o gestor de secretos.
4. No fijar `PORT` manualmente en Render: el Web Service lo inyecta automáticamente.
5. Ejecutar un deploy manual y verificar logs hasta ver `GET /health` OK.
6. Ejecutar `RENDER_EXTERNAL_URL=https://<servicio>.onrender.com pnpm cutover:preflight`.
7. Configurar DNS en Cloudflare: `@` y `www` → `<servicio>.onrender.com` con proxy ON.
8. Ejecutar `pnpm verify:prod:render`.
9. Recién después, desactivar el túnel local como origen principal.

Rollback rápido:
- Restaurar en Cloudflare el CNAME hacia el túnel existente si Render falla.
- Confirmar que `cloudflared tunnel run church-system` está activo.
- Ejecutar `pnpm verify:prod` y revisar `/tmp/church-back-err.log`.

### Diagnóstico rápido de 502

```bash
pnpm diagnostico        # backend local, launchd, Cloudflare Tunnel y dominio
pnpm migration:env      # inventario seguro de variables para Render Business
pnpm render:diagnose    # estado puntual del candidato .onrender.com
pnpm render:blueprint-link # genera deeplink al Blueprint de Render
pnpm render:validate    # validación local de campos críticos de render.yaml
pnpm cutover:preflight  # valida candidato Render antes de tocar DNS
pnpm verify:prod        # salud pública actual
pnpm verify:prod:render # falla hasta completar el corte a Render
```

### Reset controlado para probar onboarding desde cero

El reset de cuentas es destructivo y por defecto corre en `dry-run`; preserva catálogos globales (`Rol`, `_prisma_migrations`, `promo_codes`, `subscription_plans`) y trunca datos tenant/cuentas/sesiones.

```bash
pnpm reset:accounts

# Ejecutar solo cuando se quiera borrar la data de cuentas de la DB configurada:
pnpm reset:accounts -- --execute --confirm RESET_ACCOUNT_DATA --allow-production

# Flujo completo de fábrica + QA (requiere QA_TEST_PASSWORD en el entorno):
QA_TEST_PASSWORD="tu-clave-qa" pnpm reset:factory:qa

# Smoke no destructivo: health + catálogo de planes/tarjetas
pnpm smoke:signup -- --dry-run

# Smoke completo: crea una iglesia/usuario de prueba y valida trial + billing + onboarding
pnpm smoke:signup
```

Después de un reset completo, ingresar por `/registro`, crear la primera cuenta y, si hace falta GodMode, volver a habilitar el dueño con `node scripts/make-superadmin.mjs <email>`.

### Cuentas QA / GodMode

El seeder crea cuentas de prueba por rol y por plan, sin guardar la contraseña en Git. Si no se pasa `--password`, genera una clave temporal y la imprime una sola vez.

```bash
pnpm seed:test-users
pnpm seed:test-users -- --password "clave-temporal-segura"

# Verificar logins QA + aliases + GodMode overview
QA_TEST_PASSWORD="clave-temporal-segura" pnpm verify:qa-access

# Auditoría objetiva completa con chequeo estricto de contraseña QA
QA_TEST_PASSWORD="clave-temporal-segura" pnpm audit:objective:qa

# Dar GodMode a un usuario existente con su contraseña actual
pnpm godmode:grant -- pastor@tuiglesia.com
```

Emails generados: `qa.godmode@churchsystem.test`, `qa.pastor.general@churchsystem.test`, `qa.pastor.culto@churchsystem.test`, `qa.consolidacion@churchsystem.test`, `qa.staff@churchsystem.test`, `qa.lider@churchsystem.test` y `qa.plan.*@churchsystem.test`.

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

**Versión:** 3.1.2  
**Rama activa:** `master`  
**Producción:** `https://churchsystem.com.ar` vía Cloudflare Tunnel local (`MODO_CLOUDFLARE_LOCAL`)  
**Fuente de verdad del estado:** `/BITACORA.md`

---

## Licencia

Privado — Todos los derechos reservados  
© 2024-2026 Church System
