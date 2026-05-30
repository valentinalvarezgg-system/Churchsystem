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
- [ ] Estados de *loading / empty / error* consistentes en todas las páginas.

### P3 — Backend / limpieza
- [ ] Consolidar loggers: 6 rutas crean su propio `pino` y se saltan la redacción
      de secretos de `lib/logger.js` (auth.js, bug-report.js, mercadopago.js,
      notificaciones.js, oauth.js, registro.js).
- [ ] Defaults inseguros: `QR_SECRET` (default débil en checkin.js), `frontUrl`
      fallback `localhost:4000` en oauth.js, `PUBLIC_URL` fallback a prod en mercadopago.js.
- [x] ~~Completar `backend/.env.example`~~ (hecho, sesión 2026-05-30)
- [ ] `server.js`: el regex `isApi` no cubre `/mi-perfil`, `/excel-ia`,
      `/registro` ni `/checkin` completo → un 404 en esas rutas devuelve HTML
      en vez de JSON.
- [ ] Evaluar quitar dependencia `zod` (no se usa en ningún archivo).
- [ ] Revisar exports muertos: `billing.js` (currencyForCountry, formatMoney,
      publicBillingContext), `plan.js` (getModulosPlan), `auth.js`
      (requireRole alias, requirePermiso, requireTenant), `security.js`
      (validate, requireJSON), `pg.js` (pgQuery, closePgPool).

---

## 📝 Bitácora de cambios (más reciente arriba)

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
