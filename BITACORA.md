# BITÁCORA — Church System
---

## Verificación reproducible de accesos QA + GodMode — 2026-06-28

**Estado actual:** el acceso de prueba ya no depende de chequeos manuales dispersos; ahora existe una verificación dedicada que confirma logins de todas las cuentas QA formales, todos los aliases amigables y el acceso real a `GodMode`.

### Fallas detectadas
- Hasta ahora la evidencia de QA/GodMode estaba repartida entre `audit:objective`, pruebas manuales y el seed, pero no había un comando corto y específico para verificar “¿siguen entrando todas las cuentas de prueba?”.
- `backend/src/routes/godmode.js` al aprobar transferencias/manual billing dejaba `suscripcion_activa` y `plan`, pero no sincronizaba el estado comercial del onboarding (`onboarding_plan`, `onboarding_billing_confirmed`).

### Corrección aplicada
- Agregado `scripts/verify-qa-access.mjs`: loguea las 12 cuentas QA formales, las 12 cuentas alias (`godmode@test.com`, `max@test.com`, etc.) y valida que `godmode@test.com` pueda abrir `/godmode/overview`.
- Agregado `pnpm verify:qa-access` en `package.json` para correr esa auditoría puntual de accesos.
- `backend/src/routes/godmode.js`: la aprobación manual de transferencias ahora también persiste `onboarding_plan` y `onboarding_billing_confirmed='1'`.

### Evidencia
- `QA_TEST_PASSWORD='ChurchTest-2026!' node scripts/verify-qa-access.mjs` → OK, 12 cuentas QA + 12 aliases + GodMode overview.
- `node --check backend/src/routes/godmode.js scripts/verify-qa-access.mjs` → OK.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## Billing unificado con catálogo real + sync de onboarding comercial — 2026-06-28

**Estado actual:** la pantalla de facturación ya no quedó limitada a `PRO/MAX`; ahora usa el mismo catálogo comercial del signup (`Starter`, `Pro`, `Max`, `Church 100`, `Church 500`, `Church 1000+`) y cuando una suscripción se activa deja el onboarding comercial sincronizado desde backend.

### Fallas detectadas
- `frontend/src/pages/Billing.jsx` solo ofrecía `PRO` y `MAX`, aunque `Registro.jsx`, `SetupWizard.jsx` y el catálogo comercial ya manejaban más tiers reales.
- `backend/src/routes/subscriptions.js` activaba `suscripcion_activa` y `plan`, pero no persistía `onboarding_plan` ni `onboarding_billing_confirmed`, dejando onboarding y billing con fuentes de verdad distintas.
- `backend/src/routes/subscriptions.js` en `POST /subscriptions/crear` rechazaba cualquier plan fuera de `PRO/MAX`, así que varios tiers visibles en la app no tenían checkout coherente desde el panel de facturación.

### Corrección aplicada
- `frontend/src/pages/Billing.jsx`: reescrito para cargar `billing-estado` + `plan/lista`, agrupar planes de liderazgo/iglesia y derivar al checkout real con `POST /subscriptions/create`.
- `frontend/src/pages/Billing.jsx`: el proveedor se elige según país/contexto (`Mercado Pago` o `PayPal`) y el estado actual muestra trial, gracia, plan activo o falta de suscripción.
- `backend/src/routes/subscriptions.js`: `activarPlan()` ahora persiste también `onboarding_plan` y `onboarding_billing_confirmed='1'`.
- `backend/src/routes/subscriptions.js`: `POST /subscriptions/crear` acepta cualquier plan pago del catálogo comercial, no solo `PRO/MAX`.
- `backend/src/lib/pricing.js`: `montoARS()` ya no depende de una lista fija de dos planes; toma el precio USD del catálogo comercial real.

### Evidencia
- `node --check backend/src/lib/pricing.js backend/src/routes/subscriptions.js` → OK.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## Signup OAuth limpio + facturación confirmada explícitamente — 2026-06-28

**Estado actual:** el alta inicial quedó más profesional en dos puntos clave: el retorno de OAuth en registro ya no deja errores fantasma en la URL y el `SetupWizard` ya no marca la facturación como confirmada si el usuario no la aprobó explícitamente.

### Fallas detectadas
- `frontend/src/pages/SetupWizard.jsx` persistía `onboarding_billing_confirmed='1'` automáticamente al guardar el paso de facturación, aunque el usuario solo hubiese navegado por la pantalla.
- El mismo wizard permitía usar “Saltar” en facturación, dejando un onboarding aparentemente completo sin confirmación comercial real.
- `frontend/src/pages/Registro.jsx` no limpiaba `?oauth=1` / `?error=...` cuando fallaba el refresh posterior a Google/Apple, así que podían reaparecer toasts engañosos al volver o recargar.

### Corrección aplicada
- `frontend/src/pages/SetupWizard.jsx`: la validación del paso de facturación ahora exige confirmación explícita antes de avanzar.
- `frontend/src/pages/SetupWizard.jsx`: se eliminó la autoconsagración de `onboarding_billing_confirmed` al guardar; el valor solo cambia por la acción del usuario.
- `frontend/src/pages/SetupWizard.jsx`: se agregó un checkbox de confirmación comercial y se deshabilitó “Saltar” en el paso de facturación.
- `frontend/src/pages/Registro.jsx`: el retorno OAuth ahora toca sesión, usa mensaje genérico de éxito, limpia parámetros residuales y también cubre `apple_not_configured` y errores genéricos del proveedor.

### Evidencia
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## Login email para cuentas OAuth/migradas sin password — 2026-06-28

**Estado actual:** el login por email ya no cae en `500 Error de autenticación` cuando la cuenta fue creada por Google/Apple o quedó sin hash durante una migración; ahora responde `401` controlado con una guía clara para el usuario.

### Falla detectada
- `backend/src/routes/auth.js` ejecutaba `bcrypt.compare(cleanPassword, user.password)` sin validar si `user.password` existía.
- Las cuentas creadas por OAuth se guardan con `password=''` en `backend/src/routes/oauth.js`, por lo que el intento de login por email disparaba `Illegal arguments: string, undefined` / hash vacío y terminaba en el catch genérico `Error de autenticación`.
- Esto encaja con el síntoma reportado en mobile: toast rojo de autenticación aun cuando la cuenta existía, especialmente en escenarios de migración o acceso mezclado entre password manager y OAuth.

### Corrección aplicada
- `backend/src/routes/auth.js`: el flujo de `/auth/login` ahora separa tres casos:
  - usuario inexistente → `401 Credenciales inválidas`
  - cuenta existente sin hash de password → `401` con mensaje orientado a usar Google/Apple o restablecer contraseña
  - password presente pero incorrecta → `401 Credenciales inválidas`
- Se evita llamar `bcrypt.compare()` con hashes vacíos o ausentes, eliminando la causa raíz del `500`.
- Backend local reiniciado con `launchctl kickstart -k gui/$(id -u)/com.churchsystem.backend` para dejar la corrección activa en esta Mac.

### Evidencia
- Validación controlada con usuario temporal sin password y `oauth_provider='google'` → `POST http://127.0.0.1:4000/auth/login` responde HTTP `401 {"error":"Tu cuenta fue creada con Google. Ingresá con ese botón o restablecé tu contraseña."}`.
- `node --check backend/src/routes/auth.js` → OK.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## Login público: no redirigir por 401 sin sesión — 2026-06-28

**Estado actual:** el helper HTTP ya distingue entre “credenciales inválidas en pantalla pública” y “sesión vencida con token previo”, evitando errores engañosos en login.

### Falla detectada
- `frontend/src/services/api.js` redirigía a `/app/login` ante cualquier `401`, incluso cuando no había token cargado. En el formulario de login eso convertía un `401 Credenciales inválidas` en un flujo confuso y podía terminar disparando errores del tipo `undefined` o toasts poco claros.

### Corrección aplicada
- `frontend/src/services/api.js`: la redirección automática por `401` ahora solo corre si había un token activo en storage. Los `401` de pantallas públicas como login, signup o verificación vuelven al caller como error normal.

### Evidencia
- `POST http://127.0.0.1:4000/auth/login` con `max@test.com` y password inválida → HTTP `401 {"error":"Credenciales inválidas"}`.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## Verificación email sin duplicar códigos — 2026-06-28

**Estado actual:** el paso de verificación del signup quedó más profesional y consistente: ya no invalida el código inicial apenas se monta la pantalla y el reenvío usa su endpoint correcto.

### Falla detectada
- `frontend/src/components/EmailVerificacion.jsx` llamaba `/verificacion/enviar` automáticamente al montarse, aunque `/registro/crear` ya había emitido un código. Eso generaba un segundo código, invalidaba el primero y podía duplicar emails innecesariamente.
- El componente usaba el mismo endpoint para alta inicial y reenvío, y en local mostraba el código dev con un toast poco pulido (`DEV: ...`).

### Corrección aplicada
- `frontend/src/pages/Registro.jsx`: ahora conserva `codigoVerificacionDev` de `/registro/crear` cuando existe en entorno local y se lo pasa al paso de verificación.
- `frontend/src/components/EmailVerificacion.jsx`: si el registro ya envió el código, no vuelve a pedir otro al montar; solo activa el contador de reenvío.
- `frontend/src/components/EmailVerificacion.jsx`: el botón de reenvío ahora usa `/verificacion/reenviar`, que es la ruta correcta para regenerar el código.
- `frontend/src/components/EmailVerificacion.jsx`: se mejoraron los toasts para éxito, reenvío y código de prueba local.

### Evidencia
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## SetupWizard más robusto y profesional — 2026-06-28

**Estado actual:** el onboarding inicial ya no avanza “a ciegas”; ahora recupera configuración previa, bloquea pasos si falla el guardado y ofrece una experiencia más consistente para retomar el alta.

### Falla detectada
- `frontend/src/pages/SetupWizard.jsx` empezaba siempre desde estado local vacío en vez de recargar `/config`, así que al refrescar o reabrir el wizard se perdía contexto parcial del onboarding.
- `guardarPaso()` y `completar()` absorbían errores silenciosamente; si `/config` fallaba, el wizard podía seguir avanzando igual y dejar onboarding inconsistente.
- La selección de plan del paso de facturación omitía `CHURCH_1000`, dejando afuera un tier real de la app.

### Corrección aplicada
- `frontend/src/pages/SetupWizard.jsx`: ahora carga en paralelo `config`, `billing-estado` y catálogo de planes al iniciar, y mergea la configuración existente en el formulario.
- `frontend/src/pages/SetupWizard.jsx`: el guardado devuelve éxito/error real, muestra `toast` cuando falla y bloquea el avance/completado hasta persistir correctamente.
- `frontend/src/pages/SetupWizard.jsx`: se agregó validación explícita del nombre de iglesia para evitar pasos incompletos.
- `frontend/src/pages/SetupWizard.jsx`: el paso de facturación ahora también contempla `CHURCH_1000`.
- Botones principales y de “Saltar” quedan deshabilitados mientras carga o guarda, para evitar dobles submits y navegación prematura.

### Evidencia
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## Render blueprint: no fijar PORT manualmente — 2026-06-28

**Estado actual:** el bloqueo para cerrar el objetivo ya no está en el código funcional ni en auth/reset/QA, sino en el corte externo a Render. Se ajustó el Blueprint para alinearlo con el comportamiento real de Render Web Services.

### Falla detectada
- `render.yaml` fijaba `PORT=4000` manualmente, aunque Render inyecta `PORT` automáticamente para el Web Service. Eso suma riesgo de boot/healthcheck inconsistente durante el deploy del candidato `.onrender.com`.
- Los scripts locales de validación todavía trataban `PORT` como variable obligatoria del Blueprint, lo que reforzaba una configuración menos portable para Render.

### Corrección aplicada
- `render.yaml`: se eliminó `PORT` de `envVars` para dejar que Render maneje el puerto público del servicio.
- `scripts/validate-render-blueprint.mjs`: ahora valida que `PORT` quede a cargo de Render y avisa solo si alguien lo vuelve a fijar manualmente.
- `scripts/check-migration-env.mjs`: `PORT` deja de considerarse requisito del Blueprint porque Render lo provee automáticamente en runtime.
- `README.md`: checklist de migración actualizado para explicitar que `PORT` no debe configurarse manualmente en Render.

### Evidencia
- `pnpm render:validate` → OK, `PORT se deja a cargo de Render`.
- `pnpm migration:env` → OK, 0 errores / 1 advertencia esperada por secretos `sync:false` sin fuente local.
- `RENDER_EXTERNAL_URL=https://church-system.onrender.com pnpm cutover:preflight` sigue fallando por timeout del candidato Render; eso confirma que la brecha restante es de estado externo/deploy, no de schema local del Blueprint.

## Auditoría estricta reproducible + reset verificable — 2026-06-28

**Estado actual:** la auditoría amplia del objetivo ahora también pasa en modo estricto con password QA real, incluyendo login runtime, GodMode y bloqueo de JWT por query string.

### Fallas detectadas y corregidas
- `scripts/audit-objective.mjs` no era totalmente reproducible cuando se usaba `QA_TEST_PASSWORD`: los logins de runtime repoblaban `AuditLog`, por lo que una corrida posterior podía fallar el check de reset aunque la base estuviera limpia al inicio.
- El chequeo runtime de GodMode esperaba `overview.totals`, pero la respuesta actual expone KPIs en `overview.kpis`.

### Corrección aplicada
- `scripts/audit-objective.mjs`: ahora toma una línea de base de `AuditLog` al inicio y evalúa el reset contra ese snapshot, sin contar eventos creados por los propios checks runtime.
- `scripts/audit-objective.mjs`: el check de GodMode acepta `kpis` (payload actual) y mantiene compatibilidad con `totals` si reaparece.
- Se volvió a truncar `AuditLog` para dejar el reset consistente después de las pruebas manuales de autenticación.

### Evidencia
- `QA_TEST_PASSWORD='ChurchTest-2026!' pnpm audit:objective -- --strict-qa-password` → OK, `0 error(es), 6 advertencia(s), 62 check(s) OK`.
- `POST /auth/login` local con `godmode@test.com`, `max@test.com`, `free@test.com` y `church1000@test.com` → HTTP 200 en todos los casos.
- `GET /godmode/overview` con token QA → OK dentro de la auditoría estricta.

## Signup profesional + wizard obligatorio post-alta — 2026-06-28

**Estado actual:** el alta nueva ahora deja persistido el estado de onboarding/facturación desde backend y el wizard inicial vuelve a aparecer de forma consistente tanto para registro por email como para OAuth.

### Falla detectada
- El registro por email podía saltear el `SetupWizard`: `Registro.jsx` no forzaba setup al entrar al dashboard y `App.jsx` solo abría el wizard cuando faltaban simultáneamente `setup_completado` y `nombre_iglesia`.
- Como el backend ya creaba una iglesia y podía existir `nombre_iglesia` temprano, una cuenta nueva podía entrar a la app sin pasar por la etapa intermedia de configuración/facturación que el objetivo pide.
- El backend no persistía explícitamente `onboarding_plan`, `onboarding_billing_confirmed` ni `setup_completado` al crear nuevas iglesias por email/OAuth, así que el frontend no tenía una señal durable para reanudar onboarding después del primer acceso.

### Corrección aplicada
- `backend/src/routes/registro.js`: al crear una iglesia nueva ahora guarda `onboarding_plan`, `onboarding_billing_confirmed=0` y `setup_completado=0` junto al trial.
- `backend/src/routes/oauth.js`: mismo comportamiento para altas nuevas por Google/Apple.
- `frontend/src/App.jsx`: el gate del wizard ahora se basa en `setup_completado`, `nombre_iglesia` y el estado persistido de onboarding, no solo en el nombre de la iglesia.
- `frontend/src/pages/Registro.jsx`: el botón final del alta por email marca `church_force_setup=1` antes de entrar a `/`, para que el primer acceso abra directamente el setup.

### Evidencia
- Alta real local posterior al restart del backend: `wizard-check+1782662893568@churchsystem.test` → HTTP 200.
- Configuración creada para esa iglesia: `onboarding_plan=PRO`, `onboarding_billing_confirmed=0`, `setup_completado=0`, `trial_inicio=2026-06-28`, `trial_fin=2026-07-28`.
- `node --check backend/src/routes/registro.js backend/src/routes/oauth.js frontend/src/App.jsx frontend/src/pages/Registro.jsx` → OK.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

## Fix auth QA aliases + limpieza OAuth en login — 2026-06-28

**Estado actual:** el login backend responde correctamente; el fallo reportado con `max@test.com` no era una caída de autenticación global sino una combinación de cuenta alias faltante tras el reset y reintentos del login con query params OAuth residuales que dejaban el toast genérico visible.

### Fallas detectadas y corregidas
- `max@test.com` y otros aliases humanos de prueba ya no existían después del reset productivo, por lo que `/auth/login` devolvía `401 Credenciales inválidas` aunque las cuentas QA formales seguían sanas.
- `frontend/src/pages/Login.jsx` dejaba `?oauth=1` / `?error=...` en la URL cuando el refresh de OAuth fallaba o volvía con error; eso hacía reaparecer el toast `Error de autenticación` al recargar, mezclándose con el login por email.

### Corrección aplicada
- `scripts/seed-test-users.mjs`: ahora además de las 12 cuentas QA crea aliases simples para pruebas manuales (`godmode@test.com`, `max@test.com`, `pastor@test.com`, `free@test.com`, etc.) reutilizando iglesias/planes QA existentes.
- Se reejecutó el seed local con password temporal de prueba entregada en la conversación para recrear los aliases faltantes.
- `frontend/src/pages/Login.jsx`: al fallar o volver con error desde OAuth ahora limpia `oauth/error/setup` de la URL con `replace`, evitando toasts fantasma en recargas posteriores.

### Evidencia
- `POST http://127.0.0.1:4000/auth/login` con `max@test.com` → HTTP 200.
- `POST http://127.0.0.1:4000/auth/login` con `godmode@test.com` → HTTP 200.
- `GET http://127.0.0.1:4000/godmode/overview` con token de `godmode@test.com` → HTTP 200.
- `POST http://127.0.0.1:4000/auth/login` con password inválida → HTTP 401 `Credenciales inválidas`.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

### Nota operativa
- La password temporal de los aliases QA se manejó solo en runtime; no se registra en Git. Si se quiere rotar nuevamente: `pnpm seed:test-users -- --password "<nuevo-temporal>"`.

## Autocuración local + launchd sin secretos — 2026-06-28

**Estado actual:** el deploy local por Cloudflare Tunnel sigue online y ahora tiene una capa de recuperación más fuerte: backend y túnel se monitorean desde watchdog, y el plist del backend ya no guarda variables sensibles en claro.

### Fallas detectadas y corregidas
- `backend/watchdog.mjs` solo miraba `http://localhost:4000/health`; si `cloudflared` caía pero el backend seguía sano, el watchdog no detectaba el 502 público.
- `~/Library/LaunchAgents/com.churchsystem.backend.plist` tenía `EnvironmentVariables` con secretos operativos; eso queda fuera de Git, pero aumenta riesgo local y contradice la higiene de migración.
- Al reinstalar launchd sin PATH interactivo, Node podía no encontrarse; el wrapper ahora resuelve rutas comunes (`/usr/local/bin/node`, `/opt/homebrew/bin/node`).
- Reapareció el síntoma de store corrupto (`Cannot find module 'unzipper'`); se reparó con reinstalación forzada desde lockfile.
- El watchdog público disparaba falsos fallos por la validación CA local de Node; ahora reintenta health HTTPS con CA relajada sin reiniciar el túnel innecesariamente.

### Corrección aplicada
- Agregado `scripts/run-backend-launchd.sh`: carga `backend/.env` en runtime con permisos `600` y arranca `backend/src/server.js` sin secretos en plist.
- Agregado `scripts/setup-backend-launchd.sh` + `pnpm setup:backend`: reinstala `com.churchsystem.backend` como LaunchAgent limpio.
- `backend/watchdog.mjs`: ahora valida salud local y pública; reinicia `com.churchsystem.backend` si cae local y `com.churchsystem.cloudflared` si cae la salud pública con backend local OK.
- `scripts/diagnostico.sh`: ahora verifica que el backend plist no contenga `EnvironmentVariables`.
- `scripts/audit-objective.mjs`: suma checks operativos del plist limpio y wrapper launchd.
- `backend/watchdog.mjs`: health público usa cliente HTTP/HTTPS con fallback TLS controlado, igual que los verificadores de producción.
- README actualizado con `pnpm setup:backend`, `launchctl kickstart` y notas de watchdog.

### Acción ejecutada en esta Mac
- `pnpm setup:backend` reescribió `~/Library/LaunchAgents/com.churchsystem.backend.plist` sin secretos.
- `cd backend && npx -y pnpm@9.15.5 install --force --frozen-lockfile` reparó dependencias (`unzipper`/`exceljs`).
- `launchctl kickstart -k gui/$(id -u)/com.churchsystem.backend` y `launchctl kickstart -k gui/$(id -u)/com.churchsystem.watchdog` dejaron ambos servicios activos.

### Evidencia
- `http://127.0.0.1:4000/health` → HTTP 200, `{"status":"ok"}`.
- `https://churchsystem.com.ar/health` → HTTP 200, `{"status":"ok"}`.
- `pnpm diagnostico` → OK, 0 errores; confirma backend/watchdog/cloudflared activos y backend plist sin `EnvironmentVariables`.
- `pnpm audit:objective` → OK, 0 errores / 4 advertencias esperadas (TLS local Node + `QA_TEST_PASSWORD` ausente).
- `pnpm verify:prod` → OK, 0 errores; sigue advirtiendo dependencia de Cloudflare Tunnel local.
- `pnpm smoke:signup -- --dry-run` → OK.
- `cd backend && npx -y pnpm@9.15.5 audit:launch` → OK.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.

### Pendiente operativo
- Rotar los secretos que alguna vez estuvieron en el plist local antes de migrarlos a la cuenta Business/Render.
- Completar corte Render Business para que `pnpm verify:prod:render` pase y la disponibilidad no dependa de esta Mac.

---

## Auditoría objetivo + cierre JWT query frontend — 2026-06-28

**Estado actual:** existe una auditoría reproducible del objetivo amplio (`pnpm audit:objective`) que cruza producción pública, hardening auth/OAuth, onboarding/facturación, reset de datos, cuentas QA por rol/plan y GodMode.

### Fallas detectadas y corregidas
- `Login.jsx` y `Registro.jsx` aún conservaban fallback legacy para consumir `?token=<jwt>` desde la URL aunque OAuth ya usa cookie refresh y backend ya no emite JWT por query string.
- `decodeJwt()` quedó como código muerto en `services/api.js` después de quitar esos fallbacks.
- `AuditLog` tenía entradas de LOGIN generadas por pruebas QA posteriores al reset; se limpió para que el estado de factory reset vuelva a ser verificable.

### Corrección aplicada
- `frontend/src/pages/Login.jsx` y `frontend/src/pages/Registro.jsx`: OAuth solo acepta `?oauth=1` y recupera sesión vía `/auth/refresh`; ya no lee `searchParams.get('token')`.
- `frontend/src/services/api.js`: eliminado `decodeJwt()` sin uso.
- Agregado `scripts/audit-objective.mjs` y script raíz `pnpm audit:objective`.
- `AuditLog` truncado con `TRUNCATE TABLE "AuditLog" RESTART IDENTITY`.

### Qué valida `pnpm audit:objective`
- Producción pública: `/health`, home HTML y catálogo de planes.
- Seguridad/frontend: sin `alert()`/`confirm()`, sin `hooks/useToast.js`, sin hardcodeos `localhost:4000` fuera del API helper y sin JWT admin por query.
- Auth/OAuth/signup: OAuth con `state` firmado, redirects sin `token=`, Login/Registro con refresh cookie, endpoint `/registro/crear`.
- Onboarding: etapa de facturación (`onboarding_plan`, `onboarding_billing_confirmed`) en frontend y backend.
- Reset: `Persona`, `Grupo`, `Culto`, `Mensaje`, `Comunicado`, `Permiso`, `AuditLog`, `payments` y `suscripciones` en cero.
- QA/GodMode: roles requeridos, 12 cuentas QA activas/verificadas, planes QA y `qa.godmode@churchsystem.test` con `es_superadmin=true`.

### Evidencia
- `pnpm audit:objective` → OK, 0 errores / 4 advertencias esperadas: TLS local de Node y `QA_TEST_PASSWORD` ausente para no exponer credenciales en entorno.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.
- `cd backend && npx -y pnpm@9.15.5 audit:launch` → OK.
- `pnpm verify:prod` → OK, 0 errores; producción sigue por Cloudflare Tunnel local.
- `pnpm smoke:signup -- --dry-run` → OK.

### Pendiente para cierre total del objetivo
- Para probar contraseña QA sin exponerla en Git ni logs, correr localmente: `QA_TEST_PASSWORD=<password temporal> pnpm audit:objective`.
- La migración Business/Render sigue pendiente; hasta que `pnpm verify:prod:render` pase, la disponibilidad depende de la Mac local.

---

## Estabilidad producción + compatibilidad fetch — 2026-06-28

**Estado actual:** `churchsystem.com.ar` responde `200 OK`; no hay 502 activo. La causa operativa sigue siendo la misma: producción depende de Cloudflare Tunnel hacia la Mac local (`localhost:4000`), por lo que cualquier caída del backend/túnel local vuelve a provocar 502 hasta completar el corte a Render Business.

### Fallas detectadas y corregidas
- `apiFetch()` forzaba `Content-Type: application/json` en todos los requests, lo que podía romper bodies nativos (`FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`) y formularios/subidas multipart.
- `mensajes` y `godmode` ejecutaban bootstrap de schema con booleanos simples; en requests concurrentes podían disparar DDL repetido o carreras de inicialización.

### Corrección aplicada
- `frontend/src/services/api.js`: ahora omite `Content-Type` automático cuando el body es nativo o cuando el caller ya define el header; el navegador vuelve a setear el boundary correcto para multipart.
- `backend/src/routes/mensajes.js` y `backend/src/routes/godmode.js`: el bootstrap de schema queda memoizado con promesa compartida y retry si falla.
- Backend local productivo reiniciado con `launchctl kickstart -k gui/$(id -u)/com.churchsystem.backend`.

### Evidencia
- `https://churchsystem.com.ar/health` → HTTP 200, `{"status":"ok"}`.
- `https://churchsystem.com.ar` → HTTP 200.
- `http://127.0.0.1:4000/health` → HTTP 200.
- `node --check backend/src/routes/mensajes.js backend/src/routes/godmode.js frontend/src/services/api.js` → OK.
- `cd frontend && npx -y pnpm@9.15.5 build` → OK.
- `cd backend && npx -y pnpm@9.15.5 audit:launch` → OK.
- `pnpm smoke:signup -- --dry-run` → OK: health + 7 tarjetas de planes.
- `pnpm render:validate` → OK, 0 errores / 0 advertencias.
- `pnpm migration:env` → OK, 0 errores; advierte secretos `sync:false` que deben cargarse manualmente si aplican.
- `pnpm verify:prod` → OK, 0 errores; advertencias esperadas por TLS local de Node, Cloudflare Tunnel local y falta de Render CLI/API key.
- `pnpm verify:prod:render` → falla correctamente por dependencia de `localhost:4000`; esto confirma que la migración Business/Render sigue pendiente.

### Pendiente operativo P0
- Crear/activar el servicio Render en la cuenta Business, cargar secretos `sync:false`, validar el candidato `.onrender.com` con `pnpm cutover:preflight` y recién después cambiar DNS/Cloudflare para eliminar la dependencia de la Mac.

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
