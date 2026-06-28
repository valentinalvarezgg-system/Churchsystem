# BITÁCORA — Church System
---

## Hardening OAuth/copy comercial — 2026-06-28

**Estado actual:** OAuth ya no expone JWT en query string; el acceso admin por `?token=` quedó bloqueado y el copy público habla consistentemente de trial de 30 días.

### Fallas detectadas y corregidas
- Google/Apple volvían a `/app/login?token=<jwt>`, dejando JWT en URL/historial/logs.
- `requireAuth` todavía aceptaba `req.query.token` como fallback genérico para rutas admin.
- FAQ y Términos seguían mencionando 14 días de prueba, contradiciendo el trial real de 30 días.

### Corrección aplicada
- `backend/src/routes/oauth.js`: al volver de Google/Apple se emite sesión revocable con cookie refresh y se redirige con `?oauth=1` sin JWT.
- `frontend/src/pages/Login.jsx` y `Registro.jsx`: cuando reciben `oauth=1`, llaman `/auth/refresh` para obtener access token desde cookie.
- `frontend/src/services/api.js`: `fetch` usa `credentials: include` para soportar refresh cookie same-origin/cross-origin controlado.
- `backend/src/middlewares/auth.js`: `requireAuth` ya no acepta JWT por query string.
- `frontend/src/pages/FAQ.jsx` y `Terminos.jsx`: copy actualizado a trial de 30 días y planes comerciales actuales.

### Evidencia
- Refresh por cookie: `POST /auth/refresh` con cookie `church_refresh` → OK para `qa.pastor.general@churchsystem.test`.
- Token admin en query: `GET /personas?token=<jwt>` → HTTP 401 `Token requerido`.
- `rg` ya no encuentra `alert()`/`confirm()` ni JWT admin por query; quedan solo tokens públicos RSVP/eventos y token miembro legacy.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.
- `cd backend && npx -y pnpm@9.15.5 audit:launch` → OK.
- `pnpm smoke:signup -- --dry-run` → OK.
- `pnpm verify:prod` → OK, 0 errores; advertencias esperadas por TLS local de Node, Cloudflare Tunnel local y falta de Render CLI/API key.

---

## Auth/onboarding profesional + QA — 2026-06-28

**Estado actual:** login/signup siguen operativos, GodMode ya recibe `es_superadmin` en el payload frontend y hay cuentas QA por rol/plan para pruebas.

### Fallas detectadas y corregidas
- OAuth creaba cuentas con trial de 14 días, plan `STARTER`, sin contexto de plan/país/idioma y sin sesión revocable en `sesiones_auth`.
- `ProtectedRoute` exigía `user.es_superadmin` para GodMode, pero `userPayload()` no lo enviaba; el backend protegía bien, pero el frontend podía bloquear el panel aunque el usuario fuera superadmin.
- El onboarding inicial no tenía una etapa explícita de facturación entre configuración y uso de la app.
- Los textos del signup todavía hablaban de 14 días aunque backend usa trial de 30 días.

### Corrección aplicada
- `backend/src/routes/oauth.js`: Google/Apple reciben y preservan `plan`, `country`, `currency`, `lang`, `promo` mediante `state` firmado; nuevas cuentas OAuth quedan con trial de 30 días, config inicial y sesión revocable vía `issueSession()`.
- `backend/src/lib/sessions.js`: `userPayload()` incluye `es_superadmin`.
- `frontend/src/pages/Login.jsx` y `Registro.jsx`: botones OAuth envían contexto comercial; copy de trial actualizado a 30 días.
- `frontend/src/pages/SetupWizard.jsx`: agregado paso intermedio de Facturación con estado de trial, plan efectivo y selección de plan objetivo.
- `backend/src/routes/config.js`: admite `onboarding_plan` y `onboarding_billing_confirmed`.
- Agregado `scripts/seed-test-users.mjs` + `pnpm seed:test-users` para crear cuentas QA por rol y plan sin commitear passwords.

### Cuentas QA creadas
- Password temporal entregada por conversación, no registrada en Git.
- GodMode: `qa.godmode@churchsystem.test`.
- Roles: `qa.pastor.general@churchsystem.test`, `qa.pastor.culto@churchsystem.test`, `qa.consolidacion@churchsystem.test`, `qa.staff@churchsystem.test`, `qa.lider@churchsystem.test`.
- Planes: `qa.plan.free@churchsystem.test`, `qa.plan.pro@churchsystem.test`, `qa.plan.max@churchsystem.test`, `qa.plan.church100@churchsystem.test`, `qa.plan.church500@churchsystem.test`, `qa.plan.church1000@churchsystem.test`.

### Evidencia
- Login API OK para las 12 cuentas QA; GodMode devuelve `SUPERADMIN` en payload.
- `GET /godmode/overview` con `qa.godmode@churchsystem.test` → OK.
- Conteos finales: `Iglesia=10`, `User=14`, `Persona=0`, `Grupo=0`, `Culto=0`, `Mensaje=0`, `Comunicado=0`, `payments=0`, `suscripciones=0`, `subscription_plans=18`, `promo_codes=4`.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.
- `cd backend && npx -y pnpm@9.15.5 audit:launch` → OK.
- `pnpm smoke:signup -- --dry-run` → OK.
- `pnpm smoke:signup` → OK: creó `reset-smoke+20260628110246@churchsystem.test`, validó trial 30 días, billing y onboarding inicial.
- `pnpm verify:prod` → OK, 0 errores; advertencias esperadas por TLS local de Node, Cloudflare Tunnel local y falta de Render CLI/API key.

### Pendiente operativo
- La migración Business/Render sigue pendiente: producción continúa en `MODO_CLOUDFLARE_LOCAL`.
- Rotar la password temporal QA cuando terminen las pruebas o regenerarla con `pnpm seed:test-users -- --password "..."`.

---

## Reset productivo ejecutado — 2026-06-28

**Estado actual:** la DB configurada quedó reseteada para cuentas/tenants y el alta desde cero volvió a pasar completa en producción pública.

### Acción ejecutada
- Se ejecutó `pnpm reset:accounts` en dry-run como última revisión.
- Se ejecutó el reset real con:

```bash
pnpm reset:accounts -- --execute --confirm RESET_ACCOUNT_DATA --allow-production
```

- Resultado: 49 tablas tenant/cuentas/sesiones truncadas con `RESTART IDENTITY CASCADE`.
- Catálogos preservados: `Rol`, `_prisma_migrations`, `promo_codes`, `subscription_plans`.

### Evidencia post-reset
- `pnpm smoke:signup` → OK completo contra `https://churchsystem.com.ar`.
- Cuenta de prueba creada para inspección:
  - Email: `reset-smoke+20260628054344@churchsystem.test`
  - Password: `ChurchSmoke2026!`
- Conteos post-reset + smoke:
  - `Iglesia`: 1
  - `User`: 1
  - `Configuracion`: 2
  - `Persona`, `Grupo`, `Culto`, `Permiso`, `AuditLog`, `payments`, `suscripciones`: 0
  - `sesiones_auth`: 1
  - `subscription_plans`: 18
  - `promo_codes`: 4
  - `Rol`: 7
- `pnpm verify:prod` → OK, 0 errores; advertencias esperadas: TLS local de Node, origen Cloudflare Tunnel local, sin Render CLI/API key.
- `cd backend && npx -y pnpm@9.15.5 audit:launch` → OK.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

### Notas operativas
- La página sigue disponible por `MODO_CLOUDFLARE_LOCAL`; la migración Business/Render queda pendiente hasta que `pnpm verify:prod:render` pase.
- Si Valentín quiere usar GodMode con una cuenta real nueva, crear primero la cuenta desde `/registro` y luego ejecutar `node scripts/make-superadmin.mjs <email>`.
- Rotar/no reutilizar credenciales legacy GodMode si existieron en entornos anteriores.

---

## Estabilización onboarding/reset — 2026-06-28

**Estado actual:** `churchsystem.com.ar` sigue online (`200 OK`) y el flujo de signup nuevo quedó probado hasta trial/billing/onboarding.

### Causa encontrada
- El smoke real de signup creó correctamente la cuenta, pero `GET /subscriptions/billing-estado` quedaba colgado.
- La ruta dinámica `GET /subscriptions/:userId` estaba declarada antes de endpoints estáticos y capturaba `/subscriptions/billing-estado` como `userId = NaN`.
- Ese `NaN` terminaba en una query PostgreSQL y dejaba la request sin respuesta útil, afectando banners/tarjetas de billing y checklist inicial.

### Corrección aplicada
- `backend/src/routes/subscriptions.js`: la ruta histórica por usuario ahora solo matchea ids numéricos (`/subscriptions/:userId(\\d+)`), por lo que endpoints estáticos como `/subscriptions/billing-estado` y `/subscriptions/onboarding-progreso` ya no son interceptados.
- Agregado `scripts/reset-account-data.mjs` + `pnpm reset:accounts`: reset seguro con `dry-run` por defecto, confirmación explícita y guardia extra para DB no-local.
- El reset preserva catálogos globales por defecto: `Rol`, `_prisma_migrations`, `promo_codes`, `subscription_plans`; trunca datos tenant/cuentas/sesiones con `RESTART IDENTITY CASCADE` solo si se ejecuta con confirmación.
- Agregado `scripts/smoke-zero-signup.mjs` + `pnpm smoke:signup`: valida health, catálogo de planes/tarjetas, signup, trial de 30 días, billing y onboarding inicial.
- README actualizado con protocolo de reset controlado y smoke tests.

### Evidencia
- `pnpm reset:accounts` → OK en dry-run; no se ejecutó reset destructivo.
- `pnpm smoke:signup -- --dry-run` → OK: health + 7 tarjetas de planes.
- `pnpm smoke:signup` → OK: creó cuenta de prueba `reset-smoke+20260628053808@churchsystem.test`, validó trial 30 días, plan efectivo PRO y onboarding inicial.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.
- `cd backend && npx -y pnpm@9.15.5 audit:launch` → OK, sin rutas críticas sin proteger.
- `pnpm verify:prod` → OK, 0 errores; advertencias esperadas: TLS local de Node, origen Cloudflare Tunnel local, sin Render CLI/API key.

### Pendiente operativo
- Ejecutar el reset destructivo solo cuando Valentín confirme el momento exacto:

```bash
pnpm reset:accounts -- --execute --confirm RESET_ACCOUNT_DATA --allow-production
```

- Después del reset: crear la primera cuenta desde `/registro`; si se necesita GodMode, reactivar el dueño con `node scripts/make-superadmin.mjs <email>`.
- Rotar/no reutilizar credenciales legacy GodMode si existieron en entornos anteriores.

---

## Incidente producción — 2026-06-27 — 502 Cloudflare recuperado

**Estado actual:** `churchsystem.com.ar` vuelve a responder `200 OK` y `/health` devuelve `{"status":"ok"}`.

### Causa encontrada
- El modo activo real al momento del incidente era `MODO_CLOUDFLARE_LOCAL`: `~/.cloudflared/config.yml` enruta `churchsystem.com.ar` a `http://localhost:4000`.
- El backend local no estaba disponible para Cloudflare durante el 502.
- Al intentar arrancar backend, Node falló con `Cannot find module 'unzipper'` desde `exceljs`.
- `pnpm store status` confirmó store corrupto/mutado (`unzipper`, `dayjs`, `asn1.js`, `get-intrinsic`).

### Corrección aplicada
- Se reparó el store local con `cd backend && pnpm install --force --frozen-lockfile`.
- Backend local quedó escuchando en `0.0.0.0:4000` y `GET /health` responde OK.
- `render.yaml` ahora fija `pnpm@9.15.5`, ejecuta `pnpm store prune` y fuerza reinstalación desde lockfiles para evitar cache corrupta en Render.
- `cd frontend && pnpm build` pasó correctamente y `frontend/dist/` fue regenerado.
- Hardening posterior: `ChatGrupo`, `LoginMiembro` y `PortalMiembro` dejaron de hardcodear `localhost:4000`/`/api`; usan `getApiUrl()` y el stream de chat ya no manda JWT en query string.
- Versiones sincronizadas a `3.1.2` en raíz, backend, frontend y README.
- Agregado `scripts/verify-prod.mjs` + comandos `pnpm verify:prod` y `pnpm verify:prod:render` para diferenciar “sitio online” de “migración Render completa”.
- Modernizado `scripts/diagnostico.sh`: deja de revisar PM2/nginx/puerto 3000 y ahora diagnostica backend local :4000, launchd, Cloudflare Tunnel, dominio público, git y migración Render sin imprimir secretos.
- Eliminado seed legacy `GODMODE_USER_EMAIL`/`GODMODE_USER_PASSWORD` del arranque y de auditorías/plantillas; GodMode queda solo por flag DB + `scripts/make-superadmin.mjs`.
- Agregado `scripts/check-migration-env.mjs` + `pnpm migration:env` para cruzar variables usadas por backend contra `render.yaml` y fuentes locales sin exponer valores.
- `render.yaml` declara ahora todas las variables runtime detectadas para la migración Business (pagos, OAuth, Resend inbound, Meta, IA, transferencia y Twilio legacy).
- Variables legacy GodMode removidas del `launchd` local y de `backend/.env`; si existían en entornos anteriores, rotarlas/no migrarlas.
- Agregado `scripts/preflight-render-cutover.mjs` + `pnpm cutover:preflight` para validar un candidato `.onrender.com` antes de cambiar DNS.
- `ALLOWED_ORIGINS` en `render.yaml` incluye `https://church-system.onrender.com` para permitir prueba pre-DNS del servicio Render.
- `render.yaml` actualizado al formato Blueprint actual: `runtime: node` y `autoDeployTrigger: commit`.
- Agregado `scripts/render-blueprint-link.mjs` + `pnpm render:blueprint-link` para abrir el Blueprint correcto desde el remote GitHub.
- Agregado `scripts/validate-render-blueprint.mjs` + `pnpm render:validate` para detectar campos deprecados, env duplicadas, secretos en claro y variables mínimas faltantes sin depender del CLI de Render.
- Agregado `scripts/setup-cloudflared-launchd.sh` + `pnpm setup:cloudflared` para gestionar Cloudflare Tunnel con `launchd` y reducir riesgo de 502 por proceso caído/reinicio de Mac.
- Agregado `scripts/run-cloudflared-tunnel.sh`: wrapper que usa named tunnel si existe `credentials-file` válido o token local `~/.cloudflared/church-system.token` con permisos `600`.

### Evidencia
- `https://churchsystem.com.ar/health` → HTTP 200, `{"status":"ok"}`.
- `https://churchsystem.com.ar` → HTTP 200.
- `http://127.0.0.1:4000/health` → HTTP 200.
- `cd backend && pnpm store status` → `Packages in the store are untouched`.
- `cd frontend && pnpm build` → OK.
- `cd backend && pnpm audit:launch` → OK, sin rutas críticas sin proteger.
- `pnpm verify:prod` → OK con advertencias esperadas: TLS local de Node, origen Cloudflare Tunnel local, sin `render` CLI/`RENDER_API_KEY`.
- `pnpm verify:prod:render` → falla correctamente mientras `churchsystem.com.ar` dependa de `localhost:4000`.
- `pnpm diagnostico` → confirma backend local, launchd y Cloudflare Tunnel activos; advierte que producción todavía depende de `localhost:4000`.
- `pnpm migration:env` → OK sin errores: todas las variables usadas por `backend/src` están declaradas en `render.yaml`; queda advertencia de secretos opcionales/manuales que deben cargarse en Render Business si aplican.
- `pnpm cutover:preflight` → producción actual OK; falla en candidato `https://church-system.onrender.com/health` por timeout hasta que exista/deploye el servicio Render Business.
- `pnpm render:blueprint-link` → genera `https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2Fvalentinalvarezgg-system%2FChurchsystem`.
- `pnpm render:validate` → OK, 0 errores / 0 advertencias.
- `pnpm setup:cloudflared` → instala/carga `~/Library/LaunchAgents/com.churchsystem.cloudflared.plist` usando `~/.cloudflared/config.yml` sin commitear tokens.
- `pnpm diagnostico` → confirma `com.churchsystem.cloudflared` activo en `launchd`, además de backend/watchdog/caffeinate.

### Pendiente operativo P0
- Resolver la contradicción de deploy: la bitácora decía `MODO_RENDER`, pero la web pública actualmente depende del túnel local de Cloudflare.
- Si se quiere completar migración a cuenta Business/Render nueva, copiar secretos `sync:false` en Render (`DATABASE_URL`, `JWT_SECRET`, `QR_SECRET`, VAPID, Resend, Meta, OAuth, pagos) y apuntar DNS al origen correcto.
- Verificar logs/deploy de Render desde dashboard o CLI autenticada; en esta máquina no hay `render` CLI ni `RENDER_API_KEY`.
- Criterio de cierre de migración: `pnpm verify:prod:render` debe pasar sin errores después del cambio DNS.

---

## v3.1.2 — 2026-06-26 — GodMode: revertir auto-elevación; acceso por script offline

### Cambios
- **Eliminado `POST /godmode/login`** y la función `elevateEnvOwnerToGodMode`. GodMode ya no tiene un endpoint de login propio.
- **Eliminada la auto-elevación automática** al loguear con credenciales env (`GODMODE_USER_EMAIL`/`GODMODE_USER_PASSWORD`). Ese mecanismo mutaba `es_superadmin=true` en DB desde un endpoint HTTP, lo cual no era el modelo acordado.
- **GodModeLogin.jsx** ahora usa el flujo de login normal (`/auth/login`). El usuario ingresa con su email y contraseña regular; `requiereSuperadmin` valida el flag `es_superadmin` en DB en cada request al panel.
- **`gdProtect`** simplificado a `[requireAuth, requiereSuperadmin]`. `requireFreshSession` quitado por ahora (sin hardening extra hasta revisión).
- **`scripts/make-superadmin.mjs`** es el ÚNICO modo de otorgar acceso superadmin. Corre offline con acceso a DB:

```bash
# Con DATABASE_URL en entorno:
node scripts/make-superadmin.mjs tu@email.com

# O directo con psql:
psql $DATABASE_URL -c "UPDATE \"User\" SET es_superadmin=true, rol='GODMODE' WHERE lower(email)='tu@email.com';"
```

### Acceso GodMode (flujo correcto)
1. Primero correr `node scripts/make-superadmin.mjs <email>` (una vez, con acceso a DB)
2. Ingresar desde `/vault-login` con contraseña normal
3. `requiereSuperadmin` en backend valida `es_superadmin=true` de DB en cada request

### Sin credenciales commiteadas ni seed por env
`GODMODE_USER_EMAIL` y `GODMODE_USER_PASSWORD` no deben migrarse a Render. El acceso dueño se otorga offline con `scripts/make-superadmin.mjs` y se valida con `es_superadmin=true` en DB.

---

## v3.1.1 — 2026-06-12 — GodMode: acceso por flag superadmin, audit log, hardening

### Cambios de seguridad
- **Cerrado** `GET /godmode/login-status` — endpoint público que exponía el email del superadmin sin auth. Eliminado completamente.
- **Nuevo middleware `requiereSuperadmin`**: verifica `es_superadmin = true` en DB en **cada request** (no confía en el JWT). Reemplaza al anterior `requireGodMode` que solo chequeaba el rol del token.
- **Nuevo middleware `requireFreshSession`**: exige que el último login sea de menos de 12 h. Si la sesión es vieja, pide re-login.
- **Stack de protección compuesto** `[requireAuth, requiereSuperadmin, requireFreshSession]` aplicado a **todos** los endpoints del router godmode sin excepción.
- **Columna `es_superadmin`** (BOOLEAN, default false) en tabla `User`, agregada con `ALTER TABLE IF NOT EXISTS` (idempotente).
- **Tabla `godmode_audit`**: registra toda acción de escritura del panel (LOGIN, APROBAR_TRANSFERENCIA, MAIL_TEST) con usuario_id, acción, detalle JSONB, IP y timestamp.
- **Nuevo endpoint `GET /godmode/audit-log`**: expone el log de auditoría (protegido).
- **`es_superadmin` incluido en el JWT payload** del login GodMode y en el objeto de usuario del localStorage.
- **Rate limit estricto**: 30 req/min en `/godmode/*` (antes solo el límite global de 500/15min).
- **`ProtectedRoute.jsx`**: ahora también verifica `es_superadmin` para rutas `roles={['GODMODE']}` (defensa en profundidad frontend).
- **`scripts/audit.mjs`**: reemplazada la verificación de `/godmode/login-status` (ya no existe) por un check que confirma que `/godmode/overview` retorna 401/403 sin token.

### Archivos nuevos
- `scripts/make-superadmin.mjs` — activa el flag superadmin para un email dado. **Corre esto una sola vez para habilitarte el acceso.**

### Cómo el dueño se da acceso (instrucciones de bootstrap)

El endpoint godmode ahora exige `es_superadmin = true` en DB. Para activarlo:

```bash
# En el servidor (o con DATABASE_URL en entorno local):
node scripts/make-superadmin.mjs tu@email.com
```

El script:
1. Busca el usuario por email en la DB.
2. Setea `es_superadmin = true`, `rol = 'GODMODE'`, `activo = true`.
3. Imprime confirmación.

Luego ingresar desde `/vault-login` con tu contraseña normal.

Si el usuario no existe todavía: primero registrate en `/registro` (trial normal), y después correr el script.

Si en producción (Render) no tenés acceso directo al servidor: conectate a la DB con `psql $DATABASE_URL` y ejecutar:
```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "es_superadmin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "es_superadmin"=true, "rol"='GODMODE', "plan"='GODMODE' WHERE lower(email)='tu@email.com';
```

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

**Versión:** v3.1.2 · **Fecha:** 2026-06-27 · **Rama:** `master`  
**Deploy activo real:** `MODO_CLOUDFLARE_LOCAL` (Cloudflare Tunnel → Mac local `localhost:4000`). `MODO_RENDER` queda como migración pendiente.

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
pnpm diagnostico        # diagnóstico 502: backend local, launchd, tunnel y dominio
pnpm migration:env      # inventario seguro para migrar variables a Render Business
pnpm render:blueprint-link # genera deeplink al Blueprint de Render
pnpm render:validate    # validación local de campos críticos de render.yaml
pnpm cutover:preflight  # valida candidato Render antes de tocar DNS
pnpm verify:prod          # salud pública actual
pnpm verify:prod:render   # exige que producción ya no dependa del túnel local
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

**Hoy:** `MODO_CLOUDFLARE_LOCAL` — `churchsystem.com.ar` entra por Cloudflare Tunnel y apunta a `http://localhost:4000` en la Mac. `MODO_RENDER` todavía no está probado desde dashboard/CLI autenticada y requiere completar secretos `sync:false` + DNS/origen correcto.

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

Ejecutar `pnpm migration:env` antes del corte: el script no imprime secretos y marca qué variables `sync:false` faltan cargar manualmente en la cuenta Business.

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
