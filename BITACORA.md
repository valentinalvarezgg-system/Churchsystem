# BITÁCORA — Church System
---

## v3.1.0 — 2026-06-11 — MP Subscriptions + trial 30 días + onboarding de engagement

### Suscripciones recurrentes con Mercado Pago Preapproval
- `backend/src/routes/subscriptions.js` — nuevas rutas: POST `/subscriptions/crear`, GET `/subscriptions/billing-estado`, GET `/subscriptions/onboarding-progreso`; función `procesarWebhookSuscripcion` conectada al webhook MP
- `backend/src/lib/pricing.js` (NEW) — cotización USD/ARS desde BCRA (dolarapi.com), caché 23h, fallback env `COTIZACION_USD_ARS`
- `backend/src/lib/billing.js` — precios PRO/MAX actualizados: PRO=USD12, MAX=USD25
- Tabla `suscripciones` (auto-create): UUID PK, preapproval_id UNIQUE, gracia_hasta, last_event (idempotente)
- Columna `trial_hasta` en tabla `Iglesia` (ALTER TABLE idempotente)

### Trial 30 días automático
- `backend/src/routes/registro.js` — al crear iglesia nueva: trial_hasta en Iglesia + Configuracion (`trial_inicio`, `trial_fin`)
- `backend/src/middlewares/plan.js` — `effectivePlan()` async: trial_fin → PRO, suscripcion_activa, gracia_hasta desde suscripciones

### Jobs diarios
- `backend/src/lib/jobs.js` (NEW) — `tickDiario()`: trials venciendo (7/3/1 días → email CTA), trials vencidos → FREE, gracia reminders, gracia vencida → FREE, secuencia onboarding (días 1/7/23/29) con stats reales
- `backend/src/server.js` — registra `tickDiario` con `setTimeout` recursivo a las 8:30 AM

### Frontend
- `frontend/src/pages/Billing.jsx` (NEW) — estado trial/suscripción, tarjetas PRO/MAX, botón MP Preapproval redirect, FAQ
- `frontend/src/components/BannerTrial.jsx` (NEW) — banner superior: trial (días restantes), gracia (rojo urgente), degradado post-trial
- `frontend/src/App.jsx` — lazy import Billing + Route `/billing` + BannerTrial
- `frontend/src/pages/Dashboard.jsx` — `OnboardingChecklist` visible durante trial (5 pasos con progreso real)

### Archivos nuevos
- `backend/src/lib/jobs.js`
- `backend/src/lib/pricing.js`
- `frontend/src/pages/Billing.jsx`
- `frontend/src/components/BannerTrial.jsx`

### Env vars nuevas
- `COTIZACION_USD_ARS` — override manual tipo de cambio (opcional, se auto-obtiene del BCRA)
- `MP_WEBHOOK_SECRET` — clave secreta para verificar webhooks de MP

---

## v3.0.0 — 2026-06-10 — Offline-first + background sync

**Feature importante:** App standalone con soporte offline completo.

### Nuevas capacidades
- **Offline-first:** acceso a datos cacheados sin internet (GETs de lecturas comunes)
- **Cambios pendientes:** mientras está offline, POST/PUT/DELETE se encolan en IndexedDB
- **Background sync:** automático al volver online, manual con botón "Sincronizar ahora"
- **Badge de estado:** indicador visual offline/sincronizando/pendiente en bottom-right
- **Arquitectura:** Service Worker mejorado + IndexedDB + React hooks + Message API

### Archivos nuevos
- `frontend/src/lib/indexed-db-helper.js` — manejo IndexedDB
- `frontend/src/hooks/useSync.js` — hook React para detección online/offline y sync
- `frontend/src/components/OfflineBadge.jsx` — badge visual + botón de sync
- `frontend/public/sw.js` — mejorado con queue y background sync

### Cambios en existentes
- `frontend/src/App.jsx` — integrar OfflineBadge
- `frontend/src/main.jsx` — inicializar IndexedDB al startup
- `backend/package.json`, `frontend/package.json`, `package.json` — bump a 3.0.0
- `README.md` — actualización de versión

### Flujo offline-first
1. **Online:** cambios se sincronizan al instante (normal)
2. **Offline:** puedo seguir leyendo datos en cache, POST/PUT/DELETE se encolan
3. **Reconecta:** cambios se sincronizan automáticamente (o manualmente con botón)
4. **Badge muestra estado** en tiempo real (online/offline/sincronizando/X pendientes)

### Testing offline
```bash
# Chrome Dev: Devtools → Network → "Offline"
# Móvil: airplane mode
# Esperado: app sigue funcionando, cambios se encolan, badge muestra "N cambios pendientes"
# Al volver online: cambios suben automáticamente
```


> Fuente única de verdad operativa del proyecto.  
> Leer esto antes de tocar cualquier archivo.

**Versión:** v2.9.6 · **Fecha:** 2026-06-08 · **Rama:** `master`  
**Deploy activo:** `MODO_RENDER` (Render Web Service → `churchsystem.com.ar`)

---

## Estado del producto

| Área | % | Notas |
|------|---|-------|
| Infraestructura backend | 97% | ✅ PG/Neon, ESM, async patch, healthcheck, CORS |
| Autenticación y seguridad | 90% | ✅ OAuth, 2FA email, sessions, forgot-password |
| Gestión de personas | 92% | ✅ CRUD, búsqueda avanzada, seguimiento, import IA |
| Grupos y discipulado | 85% | ✅ árbol, consolidación, ministerios |
| Asistencia y QR | 87% | ✅ check-in QR, cultos, turnos |
| Reportes | 82% | 🟡 PDF con logo pendiente |
| Mensajería | 87% | ✅ push on-message WA, historial ENTRANTE/SALIENTE |
| Comunicados | 83% | ✅ cards, programación, variables, sin emojis |
| Alertas push | 87% | ✅ VAPID, cumpleaños, seguimientos |
| Calendario/Eventos | 72% | 🟡 recurrencias pendientes |
| IA pastoral | 65% | 🟡 contexto histórico pendiente |
| WhatsApp | 60% | 🟡 requiere aprobación Meta |
| Comercial/pagos | 92% | ✅ MP, Stripe, PayPal, Transferencia, 7 planes |
| Configuración | 87% | ✅ tabs móvil, org, sesiones, notificaciones |
| GodMode | 82% | ✅ métricas, transferencias, mail |
| Mobile/responsive | 90% | ✅ cards, device-split (phone/tablet/desktop) |
| i18n | 72% | 🟡 Configuracion, Reportes, Eventos, Discipulado pendientes |
| Testing | 20% | 🔴 prioridad baja aún |
| Documentación | 90% | ✅ README, CLAUDE.md, audit.mjs |
| **PROMEDIO GLOBAL** | **83%** | |

---

## Roadmap activo

### P0 — Completar en próximas sesiones

| # | Tarea | Dónde | Notas |
|---|-------|-------|-------|
| 1 | **i18n restante** | `Configuracion`, `Reportes`, `Eventos`, `Discipulado` | 72% → 85%; usar `makeI18n()` |
| 2 | **Estadísticas por culto** en Asistencia | `Asistencia.jsx` + `backend/routes/reportes.js` | Tendencias, ausencias, comparativo |
| ~~3~~ | ~~Push on-message en Mensajería~~ | ~~`mensajes.js` + `notificaciones.js`~~ | ✅ Completado — push WA + historial ENTRANTE/SALIENTE |

### P1 — Alta prioridad

| # | Tarea | Notas |
|---|-------|-------|
| 4 | PDF con logo en Reportes | `export.js` + `Reportes.jsx` |
| 5 | Recurrencias en Eventos | `eventos.js` + `Calendario.jsx` |
| 6 | Contexto histórico en IA | `ia.js` — incluir asistencias + seguimientos recientes |
| 7 | Versión sincronizada en package.json | Hoy fija en `2.8.1`, debería ser `2.9.5` |

### P2 — Cuando P0/P1 estén cerrados

| # | Tarea | Notas |
|---|-------|-------|
| 8 | Testing unitario (backend) | Routes críticos: auth, personas, pagos |
| 9 | WhatsApp templates activos | Requiere aprobación Meta + número verificado |
| 10 | App iOS (Capacitor) | Setup wizard ya existe; falta build nativo |
| 11 | Finanzas + Oración | Bloqueados por decisión legal — revisar |

---

## Reglas de trabajo

1. **Un solo canal de verdad.** Si hay conflicto entre conversación y bitácora, corregir bitácora.
2. **Siempre construir el dist.** Antes de cualquier push: `cd frontend && pnpm build`, luego `git add frontend/dist/`.
3. **Sin emojis en UI.** Usar iconos SVG (`Icons.jsx`) o texto. Los emojis en código legado se retiran por bloques.
4. **Sin `alert()`/`confirm()`.** Siempre `toast.success/error/info` o `<ConfirmModal>`.
5. **Multi-tenant siempre.** Toda query lleva `WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`.
6. **Sin `localhost:4000` en frontend.** Solo `apiFetch()` de `services/api.js`.
7. **Sin JWT en URL.** Exports de archivos: `fetch + blob + Authorization: Bearer`.
8. **Commits descriptivos.** Formato `tipo(scope): descripción` (fix/feat/docs/refactor).

---

## Changelog reciente

### v2.9.6 — 2026-06-08

**Infraestructura**
- Migración de deploy: `MODO_CLOUDFLARE_LOCAL` → `MODO_RENDER`. El backend ya no depende de la Mac. `render.yaml` configurado con `plan: starter` (always-on, sin sleep), región ohio, `autoDeploy: true`.

**Backend**
- `notificaciones.js`: nueva función exportada `sendPushToAdmins(iglesiaId, payload)`.
- `whatsapp.js`: mensajes WA entrantes se guardan como `ENTRANTE` en tabla `Mensaje` y disparan push a admins.
- `mensajes.js`: `ensureMensajeSchema()` agrega `direccion` y hace nullable `userId`/`personaId`; filtro `?direccion=` en `GET /`.

**Frontend**
- `Mensajes.jsx`: i18n completo, `confirm()` → `<ConfirmModal>`, filtro ENTRANTE/SALIENTE en historial, badge de dirección en cards y tabla.
- `Comunicados.jsx`: emojis 🕐/📌 eliminados de badges y botones.

---

### v2.9.5 — 2026-06-06

**Backend**
- Parche global async Express 4 en `server.js`: monkey-patch `Layer.prototype.handle_request` → cualquier handler async sin try/catch ya no deja conexiones HTTP colgadas.

**Frontend**
- `alert()`/`confirm()` nativos eliminados de las últimas 4 páginas (`PortalMiembro`, `Discipulado`, `Mensajes`, `MinisterioDetalle`).
- `useOrientation.js`: hook de detección phone/tablet/desktop en tiempo real.
- **Separación por dispositivo** en `Personas`, `Grupos`, `Reportes`, `Configuracion`: condicional `isPhone` en lugar de CSS hide/show.
- **Búsqueda avanzada** en Personas: filtros de estado espiritual, culto, rango de fechas; panel colapsable en phone, siempre visible en desktop.

**Codex (4 commits integrados)**
- `fix(payments)`: flujos de checkout estabilizados en Planes.
- `fix(billing)`: compatibilidad label/labels en planes legacy.
- `fix(landing)`: landing actualizada al catálogo v2.9.
- `fix(ui)`: regla sin emojis en UI + hardening `MinisterioDetalle` (`.reduce` defensivo).

### v2.9.0 / v2.8.x — 2026-05-30 a 2026-06-03

- Catálogo comercial expandido a 7 planes con mapeo de tiers de acceso.
- WhatsApp Cloud API (Meta oficial): tablas, webhook, diagnósticos, multi-iglesia.
- Integración Resend (salida + inbound): aliases centralizados en `contact-mail.js`.
- Landing actualizada: propuesta actual, carrusel mobile, planes reales.
- Sistema de pagos multi-método: MP, Stripe, PayPal, Transferencia.
- i18n de 40% → 72% (6 páginas principales).
- Cards mobile en todas las listas; safe-area iOS (notch/Dynamic Island).
- Recupero de contraseña en 2 pasos.
- `ConfiguracionOrganizacion`: gestión de miembros, roles, invitaciones, sesiones.
- `frontend/dist/` commiteado; Render sirve directamente los archivos.
- `scripts/audit.mjs`: 13 checks de salud del sistema.

---

## Guía operativa

### Deploy frontend

```bash
cd frontend && pnpm build
cd ..
git add frontend/dist/
git add -A
git commit -m "tipo(scope): descripción"
git push origin master
```

### Reiniciar backend en Render

El backend está en Render. Para reiniciar: Dashboard → church-system → **Manual Deploy** o esperar auto-deploy en cada push a `master`.

Logs: Dashboard → church-system → Logs.

```bash
# (Solo desarrollo local Mac — ya no es el deploy activo)
launchctl unload ~/Library/LaunchAgents/com.churchsystem.backend.plist
launchctl load   ~/Library/LaunchAgents/com.churchsystem.backend.plist
tail -f /tmp/church-back.log
```

### Auditoría de salud

```bash
node scripts/audit.mjs
```

Advertencias esperadas (no bloquean): MP en modo TEST, Stripe/PayPal sin configurar, ANTHROPIC_API_KEY ausente.

### Sincronizar versiones

Los 4 archivos deben coincidir siempre:
- `backend/package.json` → `"version"`
- `frontend/package.json` → `"version"`
- `package.json` (raíz) → `"version"`
- `README.md` → título `# Church System — vX.Y`

```bash
grep '"version"' backend/package.json frontend/package.json package.json
grep "^# Church System" README.md
```

### Checklist pre-deploy

1. `git status` limpio (o solo cambios intencionados)
2. `cd frontend && pnpm build` sin errores
3. `cd backend && pnpm audit:launch` sin errores críticos
4. Variables críticas en entorno: `JWT_SECRET`, `DATABASE_URL`, `BASE_URL`, `FRONTEND_URL`
5. `GET /health` responde `{"status":"ok"}`

---

## Módulos ocultos (decisión permanente)

| Módulo | Archivo | Motivo |
|--------|---------|--------|
| Finanzas | `routes/finanzas.js`, `pages/Finanzas.jsx` | Decisión legal — no habilitar sin revisión |
| Oración | `routes/oracion.js`, `pages/Oracion.jsx` | Decisión legal — no habilitar sin revisión |

---

## Modo de deploy declarado

Antes de cualquier troubleshooting de infra, registrar aquí el modo activo:

**Hoy:** `MODO_RENDER` — `churchsystem.com.ar` apunta (CNAME) al servicio Render `church-system`. El backend corre en la nube 24/7, sin dependencia de la Mac.

### Variables requeridas en Render dashboard

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `QR_SECRET` | `openssl rand -hex 32` |
| `RESEND_API_KEY` | Email (Resend) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push notifications |
| `META_*` | WhatsApp Cloud API |
| `ANTHROPIC_API_KEY` / `GROQ_API_KEY` | IA |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` | MercadoPago |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth |

### Cambiar DNS en Cloudflare

En Cloudflare DNS para `churchsystem.com.ar`:
- CNAME `@` → `<nombre-servicio>.onrender.com` (Proxy: ON)
- CNAME `www` → `<nombre-servicio>.onrender.com` (Proxy: ON)

---

## v3.0.1 — 2026-06-11 — Auth fix #1 y #3: refresh tokens revocables + registro unificado

### Cambios aplicados

**Backend — `backend/src/lib/sessions.js`** (nuevo)
- Tabla `sesiones_auth` (UUID PK, token_hash NOT NULL UNIQUE, revocado_at) al boot.
- Índice parcial `idx_sesiones_usuario ON sesiones_auth(usuario_id) WHERE revocado_at IS NULL`.
- `issueSession`, `refreshSession` (rotación), `revocarSesion`, `revocarTodas`, `revocarPorToken`.
- Backward-compat: tokens hex-96 legacy se migran automáticamente en el primer refresh.

**Backend — `backend/src/routes/auth.js`**
- Delega a sessions.js; `/refresh` con rotación real; nuevos endpoints:
  - `GET /auth/sesiones`, `POST /auth/sesiones/:id/revocar`, `POST /auth/sesiones/revocar-todas`
- `/auth/registro`: alias deprecado con header `Deprecation: version="v2"`.

**Backend — `backend/src/routes/registro.js`**
- Exporta `crearCuentaHandler`; soporte `iglesiaToken`; usa `issueSession`.
- Respuesta incluye `refreshToken` + `expiresIn`.

**Frontend — `frontend/src/pages/Registro.jsx`**
- Migrado de `/auth/registro` a `/registro/crear` con `nombreIglesia` localizado por defecto.

**Scripts**
- `backend/scripts/verify-auth.mjs`: 7 checks de regresión (`pnpm verify:auth`).
- `scripts/audit.mjs`: check `sesiones_auth` (tabla, NOT NULL, import, header Deprecation).

### Versiones
- Bump `3.0.0 → 3.0.1` en los 4 lugares (root/backend/frontend `package.json` + `README.md`).
