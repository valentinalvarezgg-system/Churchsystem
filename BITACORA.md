# 📓 BITÁCORA — Church System

> **Este archivo es la fuente de verdad del estado del proyecto.**
> Cualquier IA (Claude, GitHub Copilot, ChatGPT Codex) y cualquier persona que
> trabaje en este repo debe **leer este archivo antes de empezar** y
> **actualizarlo al terminar**. Así el trabajo no se corta entre sesiones ni
> entre herramientas.

Última actualización: **2026-05-30** · Rama principal: **`master`** (única fuente de verdad)

---

## 🔁 EL PROTOCOLO (obligatorio para toda IA)

1. **ANTES de trabajar:** abrí y leé esta `BITACORA.md` completa. Mirá "Estado
   actual" y "Pendientes / Roadmap" para entender dónde quedó todo.
2. **Trabajá** sobre lo que pida Valentín, respetando las **convenciones** de
   más abajo (no rompas multi-tenant, no hardcodees URLs, no reintroduzcas
   `sql.js`).
3. **DESPUÉS de trabajar, actualizá esta bitácora:**
   - Mové lo que completaste de *Pendientes* a *Estado actual*.
   - Agregá una entrada nueva **al tope** de *Bitácora de cambios* con fecha,
     autor (`Claude` / `Copilot` / `Codex`) y un resumen de 1-3 líneas.
   - Si descubriste pendientes nuevos, agregalos al *Roadmap*.
4. **Verificá:** `cd frontend && pnpm build` debe pasar. Para backend:
   `cd backend && pnpm audit:launch` no debe fallar.
5. **Commit + push a `master`** con un mensaje claro en español.

> Regla de oro: si dejás algo a medias, **escribilo en Pendientes** con el
> detalle suficiente para que el próximo (vos en otra sesión, u otra IA) lo
> retome sin contexto previo.

---

## 🧱 Stack y arquitectura

- **Backend:** Node + Express (ESM, `type: module`). Base de datos
  **PostgreSQL** (Neon en producción) accedida con el driver `pg` crudo.
  - Helpers en `backend/src/lib/pg.js`: `pgOne(sql, params)` (una fila),
    `pgMany(sql, params)` (array), `pgExec(sql, params)` (sin retorno). Todos `async`.
  - **NO** se usa Prisma en runtime (solo schema/migraciones). **NO** usar `sql.js`
    ni `lib/db.js` (legacy en proceso de retiro).
- **Frontend:** React 18 + Vite. Páginas con `React.lazy()` + `Suspense`
  (code splitting). Router en `frontend/src/App.jsx`.
- **Deploy:** Render (backend sirve también la SPA build). Túnel Cloudflare en dev.

### Convenciones de base de datos (multi-tenant)
- Cada tabla tiene `"iglesiaId"`. **Toda** query filtra por
  `req.user.iglesiaId` (lo setea `requireAuth`). Nunca devolver datos de otra iglesia.
- Tablas en **PascalCase** entre comillas dobles: `"Persona"`, `"Culto"`,
  `"Evento"`, `"Comunicado"`, etc.
- Columnas en **camelCase** entre comillas dobles: `"iglesiaId"`, `"createdAt"`,
  `"deletedAt"`.
- **Soft-delete:** filtrar siempre con `"deletedAt" IS NULL`.
- Placeholders de parámetros: `$1, $2, $3` (Postgres), **no** `?`.

### Auth y roles
- Middlewares en `backend/src/middlewares/auth.js`: `requireAuth`,
  `requireRol('PASTOR_GENERAL', ...)` (rest params, **no** array).
- Roles: `PASTOR_GENERAL`, `PASTOR_CULTO`, `CONSOLIDACION`, `STAFF`, `LIDER`.

### Frontend — reglas
- API: `frontend/src/services/api.js` → `apiFetch(path, opts)`, `getApiUrl()`,
  `getUser()`. **Nunca** hardcodear `http://localhost:4000` ni IPs: usar `getApiUrl()`.
- Notificaciones: `components/Toast.jsx` → `import { toast } from '...'`.
  (El hook viejo `hooks/useToast.js` fue eliminado.)
- i18n: objeto `I18N` en `components/Menu.jsx` (es / pt / en).
- **Mobile-first**: ~90% de los usuarios son móviles. CSS en
  `frontend/src/index.css` + `frontend/src/theme.css`. Clases móviles útiles:
  `.mobile-list`, `.mobile-person-card`, `.mobile-filter-bar`, `.mobile-tabs`,
  modales tipo bottom-sheet (`.modal`/`.modal-overlay`), `.bottom-nav`.

---

## ✅ Estado actual (hecho)

- **Migración completa** de las 11 rutas legacy de `sql.js`/SQLite → PostgreSQL
  (comunicados, eventos, oración, consolidación, discipulado, checkin, backup,
  import, excel_ia, export, persona_perfil).
- **Lazy loading** de todas las páginas (bundle inicial mucho más liviano).
- **Página Eventos** (`/eventos`) CRUD completa + **Oración** agregada al sidebar.
- **Ramas unificadas:** `master` es la única fuente de verdad. (`stabilization-v1`
  y `claude/code-review-H1k1R` quedaron obsoletas; borrar en GitHub).
- **Limpieza de código muerto:** eliminados `KPICard.jsx`, `CheckInFacial.jsx`,
  `hooks/useToast.js`; imports duplicados/sin uso corregidos.
- **Textos obsoletos corregidos:** UI ahora refleja PostgreSQL/Neon (no SQLite);
  enlace de backup muerto (410) reemplazado por nota de Neon.
- **CSP de Vite** sin IP hardcodeada; `localhost:4000` reemplazado por
  `getApiUrl()` en Asistencia, ExcelIA y CheckIn.
- **Robustez móvil base:** safe-area insets, tap-highlight, `touch-action`,
  `overscroll-behavior`, breakpoints por orientación, modales bottom-sheet.
- **App Store (iOS):** Capacitor configurado, QR scanner nativo implementado,
  eliminación de cuenta en-app (guideline 5.1.1), manifest.json corregido.
  Ver `APPSTORE.md` para el proceso completo de publicación.

---

## 🗺️ Pendientes / Roadmap (por prioridad)

### P0 — Deploy / infraestructura (bloquea funciones nuevas)
- [x] ~~Ejecutar migración SQL en Neon~~ — tablas `Evento`, `Oracion`, `OracionApoyo`,
      `Consolidacion`, `DiscipuladoProg`, `Familiar`, `ContactoExtra`, `VisitaOrigen`
      creadas el 2026-05-30.
- [ ] Configurar `DATABASE_URL` en Render (Environment Variables) si no está seteada.
- [ ] Confirmar auto-deploy de Render desde `master`.

### P1 — Móvil (90% de los clientes) 🔥 PRIORIDAD ESPECIAL
- [x] ~~Vista móvil en cards para Finanzas, Discipulado~~ (`.mobile-list` + `.table-responsive`)
- [x] ~~Role-aware sidebar para rol `LIDER`~~ — sección propia con Personas/Grupos/Mensajes.
- [ ] Auditar páginas con `<table>` pendientes: Grupos, Reportes, Consolidacion,
      Comunicados, Oracion, Eventos, Users, PromoCodes, GestionPermisos, Historial.
      (Historial y Reportes ya tienen vista móvil.)
- [ ] Formularios largos (Perfil, Registro, Configuracion): verificar 1 columna,
      inputs ≥44px y teclado que no tape campos en iOS.
- [ ] Probar el flujo **público de CheckIn (QR)** en un móvil real.
- [ ] Verificar safe-area (notch / home-bar) en todas las pantallas `fixed`.

### P2 — UI/UX
- [x] ~~`alert()`/`confirm()` reemplazados por toast/ConfirmModal en TODAS las páginas~~
      Alertas, Asistencia, Calendario, Comunicados, Consolidacion, Discipulado,
      GestionPermisos, Mensajes, Perfil, Users. (**Completado** — ninguna página usa
      `window.alert()` ni `window.confirm()` en el frontend.)
- [x] ~~Estados de *loading / empty / error* en todas las páginas~~ — Grupos, Comunicados,
      Consolidacion, Discipulado, Oracion, Finanzas, Calendario, Asistencia.
- [ ] Comunicados: tabla de cards en mobile (actualmente lista, funciona en mobile).

### P3 — Backend / limpieza
- [x] ~~Consolidar loggers~~ — auth.js, bug-report.js, mercadopago.js, notificaciones.js,
      oauth.js, registro.js ahora usan `lib/logger.js` con redacción de secretos.
- [x] ~~Defaults inseguros~~ — `QR_SECRET` usa `randomBytes` al inicio si no está en env;
      `frontUrl` fallback `localhost:4000` eliminado de oauth.js.
- [x] ~~Completar `backend/.env.example`~~ (hecho, sesión 2026-05-30)
- [x] ~~`server.js`: regex `isApi` no cubría `/mi-perfil`, `/excel-ia`, `/godmode`~~ — corregido.
- [x] ~~Quitar dependencia `zod`~~ — eliminada de `backend/package.json`.
- [ ] Revisar exports muertos: `billing.js` (currencyForCountry, formatMoney,
      publicBillingContext), `plan.js` (getModulosPlan), `auth.js`
      (requireRole alias, requirePermiso, requireTenant), `security.js`
      (validate, requireJSON), `pg.js` (pgQuery, closePgPool).

---

## 📝 Bitácora de cambios (más reciente arriba)

### 2026-05-30 (sesión 4) — Claude
- **Loading/error states JSX** en 8 páginas: Grupos, Comunicados, Consolidacion, Discipulado,
  Oracion, Finanzas, Calendario, Asistencia — spinner + error alert visibles al usuario.
- **Consolidacion catch** corregido: `catch {}` → `catch(e) { setError(e.message) }`.
- **Loggers consolidados**: 6 rutas (auth, registro, oauth, bug-report, mercadopago, notificaciones)
  ahora importan `lib/logger.js` con redacción de secretos en lugar de crear pino local.
- **Seguridad**: `QR_SECRET` usa `randomBytes(32)` por defecto; `localhost:4000` eliminado
  de oauth.js; `zod` sin uso eliminado de backend/package.json.
- **Comunicados**: label de destinatarios visible en la card cuando no es TODOS.
- Build OK. Pushed a `master`.

### 2026-05-30 (sesión 3) — Claude
- **Migración Neon ejecutada:** tablas `Evento`, `Oracion`, `OracionApoyo`, `Consolidacion`,
  `DiscipuladoProg`, `Familiar`, `ContactoExtra`, `VisitaOrigen` creadas en producción.
- **`alert()`/`confirm()` eliminados en todas las páginas**: GestionPermisos, Mensajes,
  Consolidacion, Discipulado, Perfil — todos usan `toast` / `ConfirmModal` ahora.
- **Vista móvil Discipulado**: cards `.mobile-list` + tabla `.table-responsive`.
- **GestionPermisos**: grilla `260px 1fr` → `repeat(auto-fit,minmax(260px,1fr))` (responsive).
- **Perfil**: bug `setPersona` corregido → `load()`; botón ✕ para eliminar foto;
  ConfirmModals para quitar familiar, eliminar contacto y eliminar foto.
- **LIDER sidebar**: sección propia con Personas / Grupos / Mensajes (antes vacío en desktop).

### 2026-05-30 (sesión 2) — Claude — App Store
- **Capacitor nativo**: `frontend/capacitor.config.ts` con config iOS completa
  (scheme, backgroundColor, limitsNavigationsToAppBoundDomains, plugins).
- **QR scanner nativo** (`QRScannerNativo.jsx`): botón visible solo en iOS/Android
  nativo; usa `@capacitor-mlkit/barcode-scanning` con dynamic import para no
  romper en web; navega internamente a CheckInPublico si el QR es de la app.
- **Capacitor deps** en `package.json` + scripts `cap:sync`, `cap:ios`, `ios`.
- **Eliminación de cuenta** (Apple guideline 5.1.1): UI en MiPerfil + endpoint
  `DELETE /mi-perfil/cuenta` con confirmación por contraseña.
- **manifest.json** corregido: `start_url: "/app/"`, `scope: "/app/"`, iconos
  separados por `any`/`maskable`.
- **`APPSTORE.md`**: guía paso a paso completa para publicar en App Store.
- `alert()` reemplazado por `toast.error()` en CheckIn.jsx (era el último).

### 2026-05-30 (sesión 1) — Claude
- Creados `.github/copilot-instructions.md`, `AGENTS.md` y `CLAUDE.md`
  para continuidad entre herramientas IA.
- `BITACORA.md` actualizada con fecha y estado de hoy.
- Actualización masiva móvil: `alert()`/`confirm()` reemplazados por toast/modal
  en Personas, Grupos, Asistencia, Finanzas, Eventos, Oracion, CheckIn.
- Finanzas agregado al sidebar (isMid) para AUDIT roles.
- `cargarConfigEnv()` segunda llamada redundante eliminada de server.js.
- `.env.example` completado con vars faltantes (DATABASE_URL, QR_SECRET, etc.).

### 2026-05-29 — Claude
- Unificación de ramas: `master` queda como única fuente de verdad (fast-forward
  desde `stabilization-v1`, cherry-pick de `INTEGRACIONES.md`).
- Limpieza de código muerto (3 archivos) y textos obsoletos (SQLite→PostgreSQL).
- `localhost:4000` → `getApiUrl()` en CheckIn/Asistencia/ExcelIA.
- Creada esta `BITACORA.md` + notas para Copilot (`/.github/copilot-instructions.md`),
  Codex (`/AGENTS.md`) y Claude (`/CLAUDE.md`).
- Robustez móvil: `touch-action` + `overscroll-behavior` en elementos interactivos.

### 2026-05-29 (previo) — Claude
- Lazy loading de todas las páginas; nueva página Eventos; Oración al sidebar.
- Migración de las 11 rutas legacy de sql.js → PostgreSQL.

- Se implemento navegacion mobile role-aware y ocultamiento legal de `Finanzas`/`Oracion`.
- Se migraron `Users` y `Historial` a patron mobile cards + tabla desktop.
- Se integro VS Code + Docker + Termius en la operacion del repo y se actualizo README.
- Se endurecio Docker Compose y se resolvieron fallos de arranque; smoke test E2E OK con `/health`.

### 2026-05-30 — Codex

- Se cerro bloque grande de suscripcion/cobro: hardening de `mp/crear-preferencia`, trazabilidad por tenant y consistencia de estado post-webhook.
- Se sincronizo UI de Configuracion para mostrar estado de pago pendiente (`plan_pendiente`).
- Verificaciones del bloque: `backend pnpm audit:launch` OK y `frontend pnpm build` OK.
- Se agrego diagnostico comercial integral (`/config/commercial-diagnostics`) y se incorporo a la UI de Suscripcion.
- Se reforzo OAuth para produccion (validacion de URL segura + callbacks esperados en diagnostico comercial).
- Se implemento bloque de trazabilidad QA comercial:
  - Nuevo endpoint `GET /mp/qa` (solo `PASTOR_GENERAL`) para inspeccionar checkout/webhook/suscripcion por tenant.
  - Se guardan marcas de tiempo y estado tecnico del ultimo checkout y ultimo webhook:
    - `mp_last_checkout_at`, `mp_last_checkout_plan`, `mp_last_checkout_price`
    - `mp_last_webhook_at`, `mp_last_webhook_payment_id`, `mp_last_webhook_status`
  - Objetivo: permitir validacion E2E de cobro sin depender de logs de infraestructura.
- Verificaciones del bloque de trazabilidad: `backend pnpm audit:launch` OK y `frontend pnpm build` OK.
- Se implemento bloque de readiness de lanzamiento:
  - Nuevo endpoint `GET /config/launch-readiness` para evaluar go/no-go tecnico/comercial.
  - Checks unificados: `JWT_SECRET`, `DATABASE_URL`, `BASE_URL`, `FRONTEND_URL`, estado comercial (MP/OAuth) y email saliente.
  - Score consolidado (ej: `5/6`) para priorizar cierre de pendientes antes de publicar.
  - UI en Suscripcion ahora muestra tarjeta "Readiness de lanzamiento" con estado y detalle por check.
- Verificaciones del bloque de readiness: `backend pnpm audit:launch` OK y `frontend pnpm build` OK.
- Se ejecuto bloque de seguridad de dependencias:
  - Corregido registry npm local a `https://registry.npmjs.org/` (audit funcional).
  - Eliminado `sql.js` residual de `backend/package.json` y lockfile.
  - Endurecida importacion Excel en `import.js`:
    - validacion base64 estricta,
    - limite real de 5MB,
    - validacion de hojas existentes,
    - limite de filas (`MAX_IMPORT_ROWS=5000`) para reducir superficie DoS/ReDoS.
- Estado auditoria:
  - Frontend: sin vulnerabilidades conocidas.
  - Backend: persiste riesgo alto en `xlsx` (advisories GHSA-4r6h-8v6p-xvw6 y GHSA-5pgg-2g8v-p4x9) sin parche estable en el paquete actual; mitigado por limites de entrada y pendiente de migracion de libreria Excel.
- Verificacion post-bloque: `backend pnpm audit:launch` OK.
- Se completo migracion de seguridad Excel:
  - Eliminado uso de `xlsx` en rutas backend (`import`, `export`, `excel_ia`, `finanzas`).
  - Incorporado wrapper interno [`backend/src/lib/xlsx-safe.js`](/Users/Valentin/Desktop/church-system-alpha/backend/src/lib/xlsx-safe.js) sobre `exceljs` para mantener compatibilidad de endpoints sin romper contrato.
  - Dependencias actualizadas: removido `xlsx`, agregado `exceljs`.
  - Override de `uuid` a `^11.1.1` para resolver advisory transitivo moderado en auditoria.
- Estado auditoria tras migracion:
  - `backend pnpm audit --prod --audit-level=moderate`: sin vulnerabilidades conocidas.
  - `backend pnpm audit:launch`: OK.
- Se inicio bloque visual de estabilizacion dark/mobile (prioridad legibilidad):
  - Correccion de contraste en `BannerNotificaciones` usando tokens del tema (`var(--text)`, `var(--text-muted)`, `var(--border)`) en lugar de colores hardcodeados.
  - Activada clase `cs-notif-banner` en el banner para que apliquen correctamente los overrides de tema oscuro ya definidos.
  - Correccion de separadores en `Login` para modo dark (`var(--text-faint)`).
- Verificacion del bloque visual parcial: `frontend pnpm build` OK.
- Se implemento bloque GodMode (panel dueño / control total):
  - Nuevo backend [`/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/godmode.js`](/Users/Valentin/Desktop/church-system-alpha/backend/src/routes/godmode.js) con `GET /godmode/overview`.
  - Seguridad: acceso solo para emails explícitamente permitidos en `GODMODE_EMAILS` (lista separada por comas).
  - Datos globales incluidos:
    - KPIs globales (usuarios, iglesias, iglesias con/sin pago registrado),
    - distribución de planes,
    - cuentas OAuth vinculadas,
    - configuraciones de correo relevantes por iglesia.
  - Integrado en servidor: `app.use('/godmode', godmodeRouter)`.
  - Nuevo frontend [`/Users/Valentin/Desktop/church-system-alpha/frontend/src/pages/GodMode.jsx`](/Users/Valentin/Desktop/church-system-alpha/frontend/src/pages/GodMode.jsx) y ruta protegida `/godmode`.
  - Acceso en menú admin: enlace directo a GodMode.
- Verificaciones del bloque GodMode:
  - `backend pnpm audit:launch` OK.
  - `frontend pnpm build` OK.
- Se implemento bloque de configuracion de mails (operacion dueño):
  - GodMode ahora expone estado de inbox central (`OWNER_REPORTS_EMAIL`) y soporte (`SUPPORT_EMAIL`) en `GET /godmode/overview`.
  - Nuevo endpoint `POST /godmode/mail-test` para enviar prueba directa al inbox dueño desde la plataforma.
  - `bug-report` ahora reenvia a ambos destinos (owner + soporte) para centralizar incidencias.
  - UI GodMode incorpora tarjeta "Inbox central" con botón "Enviar prueba" para validación operativa inmediata.
- Verificaciones del bloque mail:
  - `backend pnpm audit:launch` OK.
  - `frontend pnpm build` OK.

## 2026-05-30 — Step 1+2 (Auth UX + Responsive Registro)

- Se unifico copy critico de acceso para reducir confusion login/sign-in/sign-up:
  - Login ES: `Iniciar sesión`, CTA de alta: `Crear cuenta`.
  - Login PT/EN ajustado al mismo criterio de acción.
- Se reforzo responsive de `Registro` para evitar superposiciones:
  - `Stepper` en pantallas angostas oculta labels largas y mantiene solo indicadores.
  - Contenedor principal de registro reduce padding base para mobile.
  - Grillas de contexto y planes pasan a `minmax` mas conservador.
  - Form de nombre/apellido pasa a `auto-fit` para romper en una columna cuando no entra.
- Verificacion Step 1+2:
  - `frontend pnpm build` OK.

## 2026-05-30 — Step 3+4 (Contexto global + i18n operativo)

- Se implemento selector global dentro de plataforma (sidebar):
  - Pais + idioma + divisa con persistencia.
  - Bandera rectangular del pais visible junto al selector.
  - Cambios guardan `church_country/church_currency/church_lang` y sincronizan contexto global.
- Se agrego API de contexto cliente:
  - `setStoredContext(...)` en `frontend/src/services/api.js`.
- Este bloque prepara el camino para centralizar traducciones sin perder compatibilidad con la estructura actual.
- Verificacion Step 3+4:
  - `frontend pnpm build` OK.
  - `backend pnpm audit:launch` OK.

## 2026-05-30 — Step 5+6 (i18n central + QA visual)

- Step 5 — i18n centralizado (núcleo auth):
  - Nuevo módulo único: `frontend/src/utils/i18n-auth.js`.
  - `Login.jsx` ahora consume copy desde ese módulo en lugar de mantener duplicación local.
  - `Registro.jsx` reutiliza ese mismo diccionario para terminología crítica de acceso (sign-in).
- Step 6 — QA visual y hardening de superposición:
  - Se agregó refuerzo CSS para pantallas <=520px en `index.css` para colapsar grillas conflictivas a una sola columna y reducir riesgo de solape en formularios.
  - Se validó compilación del frontend y sanity de backend.
- Verificación Step 5+6:
  - `frontend pnpm build` OK.
  - `backend pnpm audit:launch` OK.

## 2026-05-30 — Barrido visual release (pantallas críticas)

- Se realizó hardening responsive en pantallas con mayor riesgo de solapamiento:
  - `SetupWizard.jsx`:
    - grids fijos (`1fr 1fr`) migrados a `auto-fit/minmax` en formularios y acciones finales.
    - footer de acciones migrado a layout adaptable para evitar botones encimados.
  - `CheckIn.jsx`:
    - acciones de QR (`copiar/imprimir/probar`) pasan de 3 columnas rígidas a grid flexible.
  - `Perfil.jsx`:
    - layout principal cambia de `300px 1fr` a `auto-fit/minmax` para mejor comportamiento tablet/mobile.
- Verificación del bloque:
  - `frontend pnpm build` OK.

## 2026-05-30 — Barrido visual release (Comunicados, Mensajes, Configuracion, Dashboard)

- `Comunicados.jsx`
  - padding y acción de “Archivar” ajustados para evitar quiebres en cards angostas.
- `Mensajes.jsx`
  - tabs mobile migrados a grid adaptable.
  - header de plantillas y acciones de formulario con `wrap/grid` para no superponer botones.
- `Configuracion.jsx`
  - shell principal de 2 columnas rígidas migrado a `auto-fit/minmax` para mejorar tablet/mobile.
- `Dashboard.jsx`
  - quick actions reforzadas con `minmax(0,1fr)` y altura mínima de botón para consistencia.
- Verificación del bloque:
  - `frontend pnpm build` OK.

## 2026-05-30 — Barrido visual release (Alertas, Reportes, Asistencia, Personas)

- `Alertas.jsx`
  - Tabs principales pasan de `repeat(5,1fr)` a `auto-fit/minmax(120px,1fr)` para evitar compresión extrema y solapes.
  - Barra de acciones masivas ahora usa `flexWrap` para mantener botones legibles en mobile.
- `Reportes.jsx`
  - Header de filtros/acciones reforzado con `justifyContent: flex-end` y `flexWrap` en el selector de período para eliminar encimado.
- `Asistencia.jsx`
  - Shell principal migra de `280px 1fr` a `auto-fit/minmax(280px,1fr)` para mejorar tablet y celular.
  - Barra de búsqueda/acción dentro del detalle ahora envuelve correctamente en pantallas angostas.
- `Personas.jsx`
  - Filtros migrados de fila flexible a grid adaptable (`auto-fit/minmax(180px,1fr)`), quitando anchos fijos.
  - Formulario CRUD y formulario de seguimiento pasan a `auto-fit/minmax(220px,1fr)` para prevenir cortes de campos.
- Verificación del bloque:
  - `frontend pnpm build` OK.

## 2026-05-30 — Hardening visual/carga browser (bloque 1)

- Ajustes globales en [`frontend/src/theme.css`](/Users/Valentin/Desktop/church-system-alpha/frontend/src/theme.css):
  - Refuerzo de `page-actions` para evitar desbordes horizontales en iPhone.
  - Normalización de tablas mobile (`table-responsive` y `attendance-table-wrap`) para que no fuerzen ancho fijo.
  - Refuerzo extra en breakpoint muy angosto (`<=379px`) para colapsar `quick-actions`, `alerts-tabs` y filtros a una sola columna.
- Objetivo del bloque:
  - Reducir fallas de visualización/carga percibida en browser mobile sin tocar lógica de negocio.
- Verificaciones del bloque:
  - `frontend pnpm build` OK.
  - `backend pnpm audit:launch` OK.
