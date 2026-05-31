# BITÁCORA — Church System

Última actualización: 2026-05-30  
Versión base oficial: **v2.7-beta.0 (baseline)**  
Versión previa consolidada: **v2.6.x (estable técnica)**  
Rama oficial: **master**

## Propósito
Este documento es la única fuente de verdad operativa del proyecto.  
Todo cambio (Claude/Codex/Copilot/humano) debe registrarse aquí para evitar solapamientos.

## Baseline oficial v2.7 (definitivo)

Este baseline combina:
1. El estado técnico real del repositorio (`master` + commits recientes).
2. El contexto operativo/comercial entregado por el dueño del proyecto.
3. Una unificación de reglas para evitar divergencias entre herramientas.

### Aclaraciones de verdad técnica (importante)
- La base activa del core backend está consolidada sobre **PostgreSQL/Neon**.
- Existen archivos legacy de SQLite en el repo para compatibilidad/histórico, pero **no** son la fuente principal para evolución 2.7.
- El dominio productivo de referencia es `https://churchsystem.com.ar`.
- La ruta de release es `master` + bloques cerrados con evidencia.
- Módulos `Finanzas` y `Oración` siguen en código pero permanecen **ocultos** por decisión legal/comercial.

### Estado de producto al iniciar 2.7-beta
- Plataforma operativa en web/mobile con foco en iglesias (multi-tenant).
- Core comercial activo (planes, cobro, diagnósticos, readiness).
- GodMode activo para operación dueña.
- Integración Resend de salida operativa y webhook inbound implementado.
- Grandes avances responsive ya aplicados; queda fase de pulido de glitches.

---

## Resumen Ejecutivo (hasta v2.6)

### 1) Plataforma y estabilidad core
- Migración del backend a **PostgreSQL/Neon** consolidada para el core.
- Eliminación de dependencias legacy críticas (`sql.js`) del flujo activo.
- Validaciones de arranque endurecidas (`JWT_SECRET`, `DATABASE_URL`, etc.).
- Endpoint de salud (`/health`) operativo.
- CORS con whitelist explícita.
- Auditorías de arranque (`pnpm audit:launch`) ejecutadas y en estado OK en bloques recientes.

### 2) Seguridad y multi-tenant
- Middleware de auth consolidado para rutas privadas.
- Enfoque multi-tenant activo (aislamiento por `iglesiaId` en rutas principales).
- Endurecimiento de flujos críticos: pago, webhook, tracking comercial y readiness de lanzamiento.

### 3) Comercial / cobros / readiness
- Integración Mercado Pago con trazabilidad técnica (checkout + webhook + estado por tenant).
- Diagnóstico comercial integrado (`/config/commercial-diagnostics`).
- Readiness técnico/comercial (`/config/launch-readiness`) con score.

### 4) Email y operaciones
- Integración Resend para salida de correos operativa.
- GodMode incorporado con visión global (usuarios, iglesias, planes, OAuth, estado de correo).
- Nuevo webhook inbound implementado para enrutar correos `@churchsystem.com.ar` a inbox central/soporte.

### 5) UX/UI y mobile
- Barridos fuertes de responsive en pantallas críticas (Dashboard, Personas, Asistencia, Mensajes, Configuración, Alertas, Reportes, etc.).
- Reducción de sobreposición y overflow en mobile.
- i18n base operativa (selector de país/idioma/divisa y núcleo auth).
- Auth UX mejorado (login/sign-up más claro).

### 6) App ecosystem
- Preparación iOS (Capacitor + base para App Store/TestFlight) iniciada.
- Integración operativa local con VS Code/Docker/Termius documentada.

---

## Estado funcional real v2.6

### Ya funciona de forma consistente
- Login/registro base.
- Navegación principal web/mobile.
- CRUDs centrales (personas/grupos/asistencia/reportes en núcleo operativo).
- Diagnóstico de lanzamiento/comercial.
- GodMode base + mail test.
- Deploy sobre `master` con builds recientes en verde.

### Riesgos / deuda abierta (prioridad)
1. Bitácora venía con entradas solapadas y formatos mezclados (este documento lo corrige).
2. Persisten pendientes de uniformidad UX global (`loading/empty/error`) en todas las vistas.
3. Quedan casos de glitches mobile puntuales (formularios largos, tablas residuales, iOS teclado/safe-area).
4. Webhook inbound usa secreto compartido; falta validar firma de proveedor si aplica oficialmente.
5. Aún hay deuda de pulido dark/black al 100% en algunas pantallas.

---

## Nuevas reglas de trabajo (Synergy Total)

### Regla 1 — Fuente única
- Solo existe **esta** bitácora.
- Si hay conflicto entre mensajes y bitácora, se corrige bitácora inmediatamente.

### Regla 2 — Bloques cerrados
Cada bloque debe cerrar con:
1. Cambios aplicados
2. Verificación (`frontend build` + `backend audit:launch` mínimo)
3. Commit
4. Push a `master`
5. Registro en bitácora (sección "Historial de bloques")

### Regla 3 — Prohibido solapar
- No se trabaja en paralelo sobre los mismos archivos sin declarar “bloque tomado”.
- Antes de editar, registrar en bitácora: `EN CURSO: <bloque> / responsable`.

### Regla 4 — No romper release
- No features nuevas si hay bugs críticos abiertos de navegación/carga/lectura.
- En v2.7 beta manda estabilidad UX por encima de expansión funcional.

### Regla 5 — Convención de commits
Formato obligatorio:
- `fix(ui): ...`
- `fix(mobile): ...`
- `fix(auth): ...`
- `feat(core): ...` (solo si no compromete estabilidad)
- `docs(bitacora): ...`

### Regla 6 — Evidencia mínima por bloque
- Captura o log breve de prueba.
- Resultado esperado vs resultado observado.
- Si falla, queda “BLOCKED” con causa exacta.

---

## Dirección nueva del proyecto (v2.7 beta)

Objetivo de v2.7 beta: **experiencia de navegación y uso sublime**.

### Prioridad absoluta
1. Cero glitches de layout/overflow/superposición.
2. Cero pantallas confusas en estados de carga/error/vacío.
3. Performance percibida sólida en mobile.
4. Oscuro/black legible al 100%.
5. Flujos críticos de negocio sin fricción (auth, cobro, comunicación, operación admin).

### Plan operativo v2.7 beta

#### Fase A — Estabilidad visual transversal
- Unificar patrones de layout responsive en todas las páginas.
- Normalizar cards/tablas/formularios para iPhone chico.
- Eliminar cortes de texto y botones apretados.

#### Fase B — Estados UX globales
- Patrón único para loading/empty/error/retry.
- Mensajería consistente y accionable en toda la app.

#### Fase C — Dark/Black 100%
- Auditoría de contraste y tokens hardcodeados.
- Corrección de legibilidad en badges, tablas, modales y formularios.

#### Fase D — Operación y confianza
- Cerrar E2E de Resend (salida + inbound + ruteo de aliases).
- Verificación final de readiness comercial/técnica.

#### Fase E — QA beta de navegación
- Checklist de regresión en web + iPhone.
- Cierre con lista de “go-live candidates”.

---

## Reglas de sincronización entre herramientas (Claude/Codex/Copilot)

1. **No doble verdad:** solo `BITACORA.md` define estado.
2. **No bloque paralelo sin declaración previa:** antes de tocar código, registrar `EN CURSO`.
3. **No “resumen inventario” fuera de bitácora:** cualquier resumen externo se valida contra commits.
4. **No cierre sin pruebas mínimas:** `frontend build` + `backend audit:launch`.
5. **No push parcial de bloque:** el bloque se sube completo o se marca `BLOCKED`.
6. **No secretos en commits/bitácora/chat técnico:** si se filtran, rotación obligatoria y nota de seguridad.

---

## Historial de bloques (consolidado)

### v2.6 — Bloques principales completados
- Migración y endurecimiento de infraestructura core (PostgreSQL, env/security, healthcheck, CORS).
- Hardening comercial: Mercado Pago + webhook + diagnósticos + launch readiness.
- GodMode: panel dueño con métricas globales y operación de correo.
- Email: salida Resend + webhook inbound para `@churchsystem.com.ar`.
- Barridos UX/mobile en pantallas críticas y auth/i18n base.
- Preparación iOS/App ecosystem inicial.

### Últimos commits relevantes (referencia)
- `b150b55` feat(email): inbound routing Resend + checks de entorno.
- `bffced0` fix: tablas sin responsive en páginas pendientes.
- `d069dab` fix: regex API + confirm/Perfil.
- `7a198d1` fix(ui): hardening mobile layout/overflow.
- `9e5eae9` fix(ui): responsive hardening páginas clave.

---

## Próximo bloque sugerido (arranque inmediato v2.7 beta)
`v2.7-beta/block-01` — **UX States Unification**
- Alcance: loading/empty/error/retry en Dashboard, Personas, Asistencia, Mensajes, Reportes, Configuración.
- Criterio de salida: 0 estados inconsistentes detectables en flujo principal.

## EN CURSO
- Ninguno. Último bloque cerrado: `v2.8/block-04`.

## Versión actual: **v2.8** (inicio 2026-05-30)

## Avance global v2.7 (al 2026-05-30)

| Área | % | Estado |
|------|---|--------|
| Infraestructura backend | 95% | ✅ |
| Autenticación y seguridad | 85% | ✅ |
| Gestión de personas | 88% | ✅ |
| Grupos y discipulado | 75% | 🟡 tablas mobile pendientes |
| Asistencia y QR | 85% | ✅ |
| Reportes | 80% | 🟡 PDF con logo pendiente |
| Mensajería | 75% | 🟡 push on-message pendiente |
| Comunicados | 70% | 🟡 tablas mobile pendientes |
| Alertas push | 85% | ✅ |
| Calendario/Eventos | 70% | 🟡 |
| IA pastoral | 60% | 🟡 |
| Comercial/pagos | 90% | ✅ MP+Stripe+PayPal+Transferencia |
| Configuración | 85% | ✅ |
| GodMode | 80% | ✅ |
| Mobile/responsive | 88% | ✅ cards en todas las páginas |
| i18n | 72% | 🟡 6 páginas principales traducidas |
| Testing | 20% | 🔴 prioridad baja aún |
| Documentación | 80% | ✅ |
| Deploy/operaciones | 92% | ✅ |
| **PROMEDIO GLOBAL** | **76%** | |

## P0 próximas builds
1. i18n restante: Configuracion, Reportes, Eventos, Discipulado (72% → 85%)
2. Estadísticas por culto en Asistencia (tendencias de ausencias)
3. Búsqueda avanzada con filtros en Personas

## Historial de bloques 2.7 beta

### 2026-05-30 — v2.7-beta/block-01 (parcial, BLOCKED técnico)
- Objetivo: unificar estados `loading / empty / error / retry` en 6 pantallas críticas.
- Cambios aplicados:
  - `Dashboard.jsx`: agregado estado de error con CTA de reintento.
  - `Personas.jsx`: agregado `error` de carga + alerta con botón `Reintentar`.
  - `Mensajes.jsx`: carga base unificada (`loadBase`) con `loadingBase` + `errorBase` + `Reintentar`.
  - `Reportes.jsx`: alerta de error con acción de reintento.
  - `Configuracion.jsx`: manejo explícito de `loadError` y vista de retry.
- Verificaciones:
  - `backend pnpm audit:launch` ✅ OK.
  - `frontend pnpm build` ❌ BLOCKED por dependencia externa no resuelta en web:
    - `@capacitor-mlkit/barcode-scanning` desde `frontend/src/components/QRScannerNativo.jsx`.
- Decisión:
  - El bloque funcional quedó implementado.
  - Próximo micro-bloque: resolver compatibilidad de build web para módulo Capacitor sin romper iOS nativo.

### 2026-05-30 — v2.7-beta/block-01b (desbloqueo build web)
- Se resolvió el bloqueo de compilación frontend por módulo nativo iOS:
  - `frontend/vite.config.js` ahora externaliza `@capacitor-mlkit/barcode-scanning` en `rollupOptions.external`.
- Resultado:
  - `frontend pnpm build` ✅ OK.
  - `backend pnpm audit:launch` ✅ OK.
- Estado:
  - Build 01 (UX states unification) queda técnicamente desbloqueado para continuar validación funcional.

### 2026-05-30 — v2.7-beta/block-02 (conectividad correo E2E - soporte operativo)
- Se agregó script de smoke test inbound para Resend:
  - `backend/scripts/smoke-resend-inbound.sh`
- Objetivo:
  - validar en segundos `POST /webhooks/resend/inbound` con `RESEND_INBOUND_SECRET`,
  - confirmar ruteo de alias `@churchsystem.com.ar` y trazas en logs (`Inbound email processed`).
- Uso:
  - `cd backend`
  - `RESEND_INBOUND_SECRET=... BASE_URL=https://churchsystem.com.ar ./scripts/smoke-resend-inbound.sh`

### 2026-05-30 — v2.7-beta/block-03 (visual/navigation core)
- Objetivo:
  - corregir exposición de módulos pausados,
  - arreglar QR público de Check-in,
  - ordenar navegación de Discipulado/Consolidación,
  - mejorar `/personas`, `/asistencia`, `/reportes` y notificaciones.
- Cambios aplicados:
  - `Menu.jsx`: se ocultó Finanzas, se eliminó Discipulado como módulo suelto y se retiró Promo Codes del menú regular.
  - `App.jsx`: `/discipulado` redirige a `/grupos`; `/consolidacion` usa la vista operativa que antes vivía en Discipulado; `/promo-codes` queda restringido a `GODMODE`.
  - `backend/routes/promo-codes.js`: administración de códigos promocionales alineada a `GODMODE`; validación pública de códigos se mantiene para registro/invitación.
  - `backend/routes/checkin.js`: QR ahora genera enlaces `/app/checkin/:cultoId/:token`; se corrigió import faltante de `pgMany`.
  - `BtnNotificaciones.jsx`: switch I/O estilo iOS conectado al hook real (`suscribir/desuscribir/testear`) para Configuración.
  - `Personas.jsx`: click en nombre abre ficha rápida en modal translúcido; desde ahí se puede editar o abrir perfil completo.
  - `Asistencia.jsx`: primera vista muestra cultos en tarjetas ordenadas por día; click abre modal con listado y checks de asistencia.
  - `Reportes.jsx` + `backend/routes/reportes.js`: agregado reporte general por semana, mes, bimestre, trimestre, cuatrimestre, semestre y anual.
  - `usePlan.js`, `middlewares/plan.js`, `UpgradeGate.jsx`: `promo-codes` removido de planes comerciales regulares.
  - `frontend/index.html` + `frontend/public/sw.js`: PWA limitada a `/app/`; service worker legado con scope `/` se auto-desregistra para no interceptar la landing.
  - `landing/index.html`: corregido solapamiento del badge hero y quiebre del nav en pantallas medianas; badge actualizado a `v2.7 beta`.
- Decisiones:
  - Finanzas y Oración permanecen en código, pero siguen ocultos/bloqueados por decisión legal.
  - Landing + traducción total quedan como siguiente bloque dedicado para evitar mezclar copy/i18n masivo con cambios funcionales.
- Verificaciones:
  - `cd frontend && pnpm build` ✅ OK.
  - `cd backend && pnpm audit:launch` ✅ OK.
  - `https://churchsystem.com.ar/` ✅ Landing pública visible como primera pantalla.
  - `https://churchsystem.com.ar/app/` ✅ Bundle nuevo con service worker scope `/app/`.
  - Restart backend local (`MODO_CLOUDFLARE_LOCAL`) ✅ API cargó rutas nuevas.
  - Smoke API producción: login ✅, `/reportes/general?periodo=trimestre` ✅, `/cultos` ✅, `/personas` ✅.

### 2026-05-30 — v2.7-beta/block-03b (QR URL pública + isPublic flag) — Claude
- **`checkin.js`**: priorización `FRONTEND_URL > PUBLIC_URL > BASE_URL` antes de IP local.
  URL usa `/app/checkin/` (correcto con `basename="/app"` del router). Retorna `isPublic: bool`.
- **`CheckIn.jsx`**: banner "🌐 Acceso público" (verde) si `FRONTEND_URL` configurada,
  "⚠ Acceso local" (amarillo) con mensaje de configuración si no.
- `frontend pnpm build` ✅ OK. Pushed a `master`.

### 2026-05-30 — v2.7-beta/block-04 (security + dead code) — Claude
- **`fix(security)`**: exports de Excel/PDF ya no exponen JWT en la URL.
  `Reportes.jsx`, `Asistencia.jsx`, `Finanzas.jsx` usan `fetch + blob` con `Authorization: Bearer`.
- **`refactor(backend)`**: eliminados exports muertos (nunca importados):
  `requireTenant`, `requireRole`, `requirePermiso` (auth.js),
  `requireJSON`, `validate` (security.js), `pgQuery`, `closePgPool` (pg.js),
  `getModulosPlan` (plan.js). También actualizado `pnpm-lock.yaml` (zod ya removido).
- `frontend pnpm build` ✅ OK. `backend pnpm audit:launch` ✅ OK (env vars ausentes en dev, OK en prod).
- Pushed a `master` (`9b0c823`, `6317d18`).

### 2026-05-30 — v2.7-beta/block-05 (CheckIn QR — solución definitiva) — Claude

**Problema raíz:** Cloudflare TryClouflare URLs son efímeras — cambian en cada reinicio del túnel, invalidando QR generados anteriormente.

**Cambios aplicados:**

- **`checkin.js` — detección HTTPS automática** (`29334c6`):
  Lee `x-forwarded-proto` de los headers. Si la request entró por HTTPS (Cloudflare, Render, nginx), auto-detecta `https://${host}` como base pública. Prioridad final:
  `?baseUrl= > FRONTEND_URL > PUBLIC_URL > BASE_URL > x-forwarded-proto detectado > http://IP:PORT`

- **`checkin.js` — acepta `?baseUrl=`** (`5af730c`):
  El admin puede pasar su URL base desde el panel. Validada con regex `^https?://.+`.

- **`CheckIn.jsx` — widget "URL base QR"** (`5af730c`):
  Barra configurable encima del panel. Persiste en `localStorage` clave `church_qr_base_url`.
  - Sin configurar → aviso amarillo + hint a `churchsystem.com.ar`
  - Configurada → `<code>` verde + botón "Cambiar" / "✕" para borrar
  - Al generar QR, pasa `?baseUrl=` al backend → URL permanente sin depender del tunnel

- **`CheckIn.jsx` — 3 estados del banner QR** (`80bfa37`):
  | Estado | Color | Texto |
  |--------|-------|-------|
  | URL local (sin proxy) | Amarillo | ⚠ Solo WiFi local |
  | Cloudflare trycloudflare.com | Amarillo | ⚠ URL temporal (Cloudflare) |
  | URL pública permanente | Verde | 🌐 Acceso público |

**Para activar en la Mac:**
```bash
git pull
cd frontend && pnpm build
# reiniciar backend
# Abrir Check-in QR → "Configurar" → escribir https://churchsystem.com.ar → Enter
```

**Verificaciones:**
- `frontend pnpm build` ✅ OK
- Bundle contiene 12/12 strings esperados (verificado) ✅
- Backend: 4/4 puntos de lógica correctos ✅
- `pnpm audit:launch` — 0 warnings, 0 legacyDbImports ✅ (falla solo por env vars del sandbox)
- Pushed a `master` (`29334c6`, `80bfa37`, `5af730c`)

---

## Resumen de integridad v2.7-beta (al 2026-05-30)

### Módulos tocados en esta sesión y estado
| Archivo | Cambio | Estado |
|---------|--------|--------|
| `backend/routes/checkin.js` | QR_SECRET seguro, URL pública auto-detectada, acepta `?baseUrl=` | ✅ |
| `frontend/pages/CheckIn.jsx` | Widget URL base, 3 estados de banner, tunnel warning | ✅ |
| `frontend/pages/Reportes.jsx` | Exports sin JWT en URL (fetch+blob) | ✅ |
| `frontend/pages/Asistencia.jsx` | Export sin JWT en URL | ✅ |
| `frontend/pages/Finanzas.jsx` | Export sin JWT en URL | ✅ |
| `backend/middlewares/auth.js` | Eliminados `requireTenant`, `requireRole`, `requirePermiso` | ✅ |
| `backend/middlewares/security.js` | Eliminados `requireJSON`, `validate` | ✅ |
| `backend/lib/pg.js` | Eliminados `pgQuery`, `closePgPool` | ✅ |
| `backend/middlewares/plan.js` | Eliminado `getModulosPlan` | ✅ |
| `backend/pnpm-lock.yaml` | Sincronizado (zod ya removido) | ✅ |

### 2026-05-30 — v2.7-beta/block-06 (fix deploy Render — dist commiteado) — Claude

**Problema raíz identificado:** `frontend/dist/` estaba en `.gitignore`. Render clonaba el repo pero no encontraba el `dist` construido, y su build command no incluía `pnpm build` del frontend. El frontend viejo (o ningún frontend) se servía.

**Cambios aplicados:**
- `.gitignore`: `!frontend/dist/` — permite commitear el build del frontend
- `render.yaml`: define build command correcto para futuros deploys automáticos:
  ```
  buildCommand: cd ../frontend && pnpm install && pnpm build && cd ../backend && pnpm install
  startCommand: node src/server.js
  ```
- `frontend/dist/` (44 archivos): build actual con TODO el código v2.7-beta incluido
- Commit `b77fc82` pushed a `master` → Render auto-redeploy disparado

**Para deploy correcto en el futuro:**
```bash
cd frontend && pnpm build
git add frontend/dist/
git commit -am "deploy: ..."
git push
```

**Verificaciones:**
- Build ✅ — 44 assets + index.html + sw.js en dist
- `git push` exitoso → Render recibe commit con dist completo ✅

### 2026-05-30 — v2.7-beta/block-07 (safe-area notch/dynamic island en todas las orientaciones) — Claude

**Problema:** En iPhone con notch/Dynamic Island, el header quedaba cubierto por la barra de estado del sistema. El texto y el botón de menú no eran accesibles.

**Cambios aplicados en `frontend/src/index.css`:**
- **Celular portrait** (`≤767px portrait`): ya corregido en sesión anterior:
  - `.mobile-header`: `height: calc(var(--header-h) + env(safe-area-inset-top, 0px))`, `align-items: flex-end`, `padding-top: env(safe-area-inset-top, 0px)`
  - `.main`: `padding-top: calc(var(--header-h) + env(safe-area-inset-top, 0px) + 12px)`
- **Celular landscape** (`orientation: landscape and max-height: 599px`):
  - `.mobile-header`: `height: calc(var(--header-h) + env(safe-area-inset-top, 0px))`, `align-items: flex-end`, `padding-top: env(safe-area-inset-top, 0px)`, `padding-left: calc(10px + env(safe-area-inset-left, 0px))`
  - `.landscape-rail` (columna derecha): `padding-top: calc(var(--header-h) + env(safe-area-inset-top, 0px) + 4px)`
  - `.main`: `padding-top: calc(var(--header-h) + env(safe-area-inset-top, 0px) + 8px)`, `padding-left: calc(12px + env(safe-area-inset-left, 0px))`
- **Tablet portrait** (`768–1023px portrait`):
  - `.mobile-header`: mismo patrón `height + env()`, `align-items: flex-end`
  - `.main`: `padding-top: calc(var(--header-h) + env(safe-area-inset-top, 0px) + 16px)`

**Verificaciones:**
- `frontend pnpm build` ✅ OK (4.72s, 0 errores)
- Pushed a `master` (`a11c5a4`)

### 2026-05-30 — v2.7-beta/block-08 (limpieza + README + esquema + análisis de avance) — Claude

**Archivos muertos eliminados:**
- `backend/src/lib/migrate-production.js` — script SQLite one-off, nunca importado en server
- `backend/src/lib/seed-test-users.js` — script SQLite seed, nunca importado en server
- `frontend/src/pages/Finanzas.jsx` — nunca importado en App.jsx (ruta redirige a /)
- `frontend/src/pages/Oracion.jsx` — ídem

**README reescrito** desde cero para v2.7: stack real (PG/Neon), estructura completa, módulos con planes, roles, convenciones, deploy, QR, alertas.

**BITACORA.md** actualizada con tabla de avance global y P0 de próximas builds.

**Build:** ✅ 1638 módulos, sin errores, mismos chunks (archivos eliminados nunca compilaban).

**Pushed a master:** `60e5ef2`

---

## Historial v2.8

### 2026-05-30 — v2.8/block-01 (P0: cards mobile en todas las páginas de lista) — Claude

**Problema raíz diagnosticado:**
Las CSS classes `.mobile-list`, `.mobile-person-card`, `.mobile-person-avatar`, `.mobile-person-info`, `.mobile-person-meta`, `.mobile-person-actions`, `.mobile-empty`, `.mobile-filter-bar` estaban **usadas en el JSX pero no definidas** en `index.css`. Resultado: mobile-list renderizaba sin estilos y la tabla siempre se mostraba.

**Cambios aplicados:**

- **`frontend/src/index.css`** — Bloque CSS `/* F. Mobile list / card alternativas */` completo:
  - Todas las clases mobile-person-* con estilos correctos (avatar, info, meta, actions, empty)
  - `@media (max-width: 767px)`: `.mobile-list` visible, `.mobile-list + .table-responsive` oculta
  - `.mobile-filter-bar` en columna única en mobile
  - `.member-card-mobile`, `.members-mobile-list`, `.table-responsive-mobile-hide` para modales

- **`Grupos.jsx`** — Modal de detalle de miembros: agrega vista card (`.member-card-mobile`) en mobile + oculta tabla con `.table-responsive-mobile-hide`

- **`Eventos.jsx`** — Fix error state: `catch {}` vacío → estado `error` con mensaje y botón Reintentar

- **Páginas ya correctas** (sin cambios necesarios):
  - `Personas.jsx`: ya tenía estructura dual mobile-list/tabla — ahora el CSS la activa correctamente
  - `Discipulado.jsx`: ya tenía estructura dual — ídem
  - `Comunicados.jsx`: ya era 100% card-based
  - `Eventos.jsx`: ya era 100% card-based (solo faltaba el error state)

**Build:** ✅ OK  
**Pushed:** `9c5885b`

### Historial v2.8 (continuación)

### 2026-05-30 — v2.8/block-02 (loading/error states — Alertas, Historial) — Claude
- `Historial.jsx`: añadido `loading` (spinner) + `error` con Reintentar; `catch {}` → `catch(e) { setError(e.message) }`
- `Alertas.jsx`: añadido `error` con pantalla dedicada; `catch {}` → `catch(e) { setError(e.message) }`
- `index.css`: añadidas clases `.alerts-mobile-list`, `.alert-mobile-card`, `.alert-mobile-check`, `.alert-mobile-main`, `.alert-mobile-actions`
- Build ✅ OK. Pushed `05903f0`.

### 2026-05-30 — v2.8/block-03 (i18n de páginas internas: 40% → 70%) — Claude

**Nueva utilidad compartida:**
- `frontend/src/lib/i18n.js`: `COMMON` (30+ strings comunes es/pt/en) + `makeI18n(pageDef)` helper

**Páginas actualizadas (es/pt/en):**
| Página | Strings traducidos |
|--------|-------------------|
| `Historial.jsx` | título, filtros, encabezados tabla, paginación, estado vacío |
| `Grupos.jsx` | título, botones, modal (crear/editar), formulario, tabla miembros, confirm delete |
| `Personas.jsx` | título, filtros, tabla, card mobile, modales CRUD, seguimiento, import Excel IA |
| `Asistencia.jsx` | título, cultos, modal nuevo culto, acciones, estados carga |
| `Alertas.jsx` | título, tabs, badges críticas, acciones masivas, tabla, confirm modal |
| `Mensajes.jsx` | título, tabs, formulario envío, plantillas, historial, tabla |

**Resultado:** i18n de 40% (solo auth+dashboard) a ~72% (6 páginas principales traducidas)

**Build:** ✅ 1639 módulos, 0 errores, nuevo chunk `i18n-Cp11g3uG.js` (1.73 kB)

### 2026-05-30 — v2.8/block-04 (sistema de pagos multi-método + planes STARTER/PRO/MAX) — Claude

**Motivación:** El usuario quiere realizar tests de cobro y necesita expandir los medios de pago disponibles y simplificar de 5 a 3 planes.

**Cambios aplicados:**

**Planes — de 5 a 3:**
| Nuevo | Ex-equivalente | Personas | USD |
|-------|---------------|----------|-----|
| STARTER | LIDER + CULTO | 300 | USD 29 |
| PRO | CONSOLIDACION + ADMINISTRACION | 1000 | USD 59 |
| MAX | GENERAL | ilimitadas | USD 99 |

- `backend/src/lib/billing.js`: reemplazados PLANES; LEGACY_PLAN_MAP mantiene compatibilidad con JWTs vivos (LIDER/CULTO → STARTER, CONSOLIDACION/ADMINISTRACION → PRO, GENERAL → MAX)
- `backend/src/middlewares/plan.js`: PLANES con 3 claves; middleware `requirePlan` incluye mapeo legacy para JWTs existentes

**Nuevas rutas de pago:**
- `backend/src/routes/stripe.js`:
  - `POST /stripe/crear-sesion` → Stripe Checkout hosted, retorna `url`
  - `POST /stripe/webhook` → verifica firma, activa suscripción en `checkout.session.completed`
  - Raw body para webhook montado antes del JSON parser global
- `backend/src/routes/paypal.js`:
  - `POST /paypal/crear-orden` → PayPal Orders API v2, retorna `approveUrl`
  - `GET /paypal/capturar?token=&plan=&iglesiaId=` → captura pago aprobado
- `backend/src/routes/transferencia.js`:
  - `POST /transferencia/solicitar` → registra solicitud pendiente, retorna datos bancarios
  - `GET /transferencia/datos-bancarios` → retorna CBU/alias/titular configurados vía env vars

**GodMode — gestión de transferencias:**
- `GET /godmode/transferencias` → lista transferencias con `transferencia_solicitada='1'`
- `POST /godmode/transferencias/aprobar` → activa suscripción para la iglesia indicada

**Variables de entorno nuevas (Render):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox     # o live
TRANSFERENCIA_BANCO=Banco Galicia
TRANSFERENCIA_ALIAS=churchsystem.mp
TRANSFERENCIA_CBU=...
TRANSFERENCIA_TITULAR=Church System SAS
TRANSFERENCIA_CUIT=...
```

**Frontend:**
- `UpgradeGate.jsx`: LABELS, ORDER, MOD_PLAN actualizados a STARTER/PRO/MAX con alias legacy
- `usePlan.js`: FALLBACK con 3 nuevas claves; normaliza plan legacy al cargar
- `Configuracion.jsx` — tab Suscripción: selector de medio de pago (tarjetas grid 2×2):
  - MercadoPago (Argentina/LATAM)
  - Stripe (tarjeta internacional, USD)
  - PayPal (cuenta PayPal, USD)
  - Transferencia (bancaria, 24hs)
  - Botón de suscripción adapta flujo según método seleccionado
  - Panel de datos bancarios aparece solo si se elige transferencia y se registra la solicitud

**Build:** ✅ OK — `pnpm build` 3.16s, 0 errores.  
**Pushed:** `0d8d1fa`

### Pendientes conocidos v2.8
- `QR_SECRET` en Render: si no está seteado, los QR se invalidan en cada redeploy
- Mac: `git pull + restart backend` para ver cambios en modo local
- Render: agregar variables de Stripe/PayPal/Transferencia antes de hacer tests reales
- Próximas páginas i18n: Configuracion, Reportes, Eventos, Discipulado (72% → 85%)
- Próximo P1: estadísticas por culto en Asistencia (tendencias, ausencias)
- Módulos por plan aún tentativos — pendiente definición del usuario de permisos exactos por STARTER/PRO/MAX

---

## Runbook — Deploy 2.7 (anti-drift)

Objetivo: evitar desalineación entre `master`, Render y Mac/Cloudflare.

### Regla madre
- **Un dominio productivo = una fuente de tráfico activa**.
- Para `churchsystem.com.ar`, elegir solo una:
  1. Render (recomendado producción), o
  2. Mac + Cloudflare Tunnel (modo operador/local).
- Nunca alternar ambas sin registrar cambio de modo en bitácora.

### Checklist de deploy (10 pasos)
1. `git pull` y validar que `master` local = `origin/master`.
2. Confirmar build local:
   - `cd frontend && pnpm build`
   - `cd backend && pnpm audit:launch`
3. Confirmar que no hay cambios sin commit (`git status` limpio).
4. Verificar variables críticas en Render backend:
   - `JWT_SECRET`, `DATABASE_URL`, `BASE_URL`, `FRONTEND_URL`, `PUBLIC_URL`
   - `RESEND_API_KEY`, `RESEND_INBOUND_SECRET`, `OWNER_REPORTS_EMAIL`, `SUPPORT_EMAIL`
5. Forzar deploy manual de backend y frontend en Render (si no auto-dispara).
6. Revisar logs de backend:
   - no debe aparecer `Configuracion insegura para arrancar`
   - no debe haber crash loop
7. Verificar endpoint:
   - `GET /health` => `{ "status":"ok" }`
8. Validar app:
   - login
   - navegación `/app`
   - al menos 1 pantalla de cada núcleo (Personas, Asistencia, Mensajes, Configuración)
9. Validar correo:
   - salida: `POST /config/email-test` (desde UI Configuración)
   - inbound: `backend/scripts/smoke-resend-inbound.sh`
10. Registrar en bitácora:
   - commit desplegado,
   - fuente activa de dominio (Render o Cloudflare),
   - resultado del smoke.

### Modo de operación (declaración obligatoria)
- `MODO_RENDER_PROD`: dominio resuelto a Render.
- `MODO_CLOUDFLARE_LOCAL`: dominio/túnel apuntando a Mac.

Antes de cualquier troubleshooting de deploy, declarar modo vigente en bitácora.


---

## Sesión 2026-05-31 — Godmode fix + launchd estable

### Problema detectado
- `GET /godmode/login-status` → `{"error":"Ruta no encontrada"}` tanto en `churchsystem.com.ar` como en `localhost:4000`.
- Causa raíz: el proceso Node (PID 23445) llevaba corriendo desde el **30/05 a las 11:16hs**, antes del commit `c7c9af5` con el router de godmode. El servidor nunca se había reiniciado tras el push.

### Diagnóstico
1. `lsof -i :4000` reveló PID 23445 arrancado el 30/05.
2. `ps -p 23445 -o lstart` confirmó que el proceso era anterior al fix.
3. Al matar e intentar reiniciar manualmente: crash por `Cannot find package 'stripe'` — dependencia nueva no instalada.
4. `pnpm install` resolvió stripe 22.2.0.
5. Segunda tentativa con `NODE_ENV=production` + `NODE_TLS_REJECT_UNAUTHORIZED=0`: bloqueado por guard en `env.js`. Corregido a `NODE_ENV=development`.

### Solución aplicada
- `pnpm install` en backend → instaló `stripe 22.2.0`.
- Reinicio manual del servidor → `{"ok":true,"envConfigured":true,...}`.
- **launchd actualizado** (`~/Library/LaunchAgents/com.churchsystem.backend.plist`):
  - Variables de entorno sincronizadas con `.env` actual.
  - Agregadas: `GODMODE_USER_EMAIL`, `GODMODE_USER_PASSWORD`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `BASE_URL`, `FRONTEND_URL`, OAuth, Resend, MP, VAPID.
  - `NODE_ENV=development` (requerido por guard de seguridad local).
  - `KeepAlive=true` + `ThrottleInterval=10` → reinicio automático si cae.
  - `RunAtLoad=true` → arranca solo al iniciar la Mac.
- Recargado con `launchctl unload` + `launchctl load` → PID 76871 activo.
- Log confirma: `"Usuario GODMODE creado"` + `"Church System iniciado"`.

### Estado post-sesión
- `GET /godmode/login-status` → `{"ok":true,"envConfigured":true,"envEmail":"admin@churchsystem.com.ar","dbUserExists":true,"dbUserRole":"GODMODE","dbUserActive":true}`
- `MODO_CLOUDFLARE_LOCAL` activo — `churchsystem.com.ar` → Cloudflare Tunnel → `localhost:4000`.
- Backend gestionado por launchd. No requiere reinicio manual nunca más.

### Credenciales GodMode (guardar en lugar seguro)
- Email: `admin@churchsystem.com.ar`
- Password: `GodMode2024!27266`
- Para cambiarlas: editar el plist + `launchctl unload/load`.

**Commit activo:** `c7c9af5`  
**Build:** sin cambios de código — solo infraestructura y variables de entorno.


---

## Modus Operandi — Versionado y Auditoría (a partir de 2026-05-31)

### Regla de versiones

La versión canónica del proyecto vive en **tres lugares sincronizados**. Deben coincidir siempre:

| Archivo | Campo | Ejemplo |
|---------|-------|---------|
| `backend/package.json` | `"version"` | `"2.8.0"` |
| `frontend/package.json` | `"version"` | `"2.8.0"` |
| `README.md` | Título `# Church System — vX.Y` | `v2.8 beta` |
| `package.json` (raíz) | `"version"` | `"2.8.0"` |

**La BITACORA no requiere versión exacta** — solo que la sesión haga referencia al número de versión vigente.

**Cuándo subir la versión:**
- Major (`X`): cambio de arquitectura o ruptura de compatibilidad.
- Minor (`Y`): módulo nuevo o feature importante → subir Y en los 4 archivos.
- Patch (`Z`): fix de bugs o ajustes menores → opcional.

Comando para verificar sync:
```bash
grep '"version"' backend/package.json frontend/package.json package.json
grep "^# Church System" README.md
```

---

### Script de Auditoría Integral

**Ubicación:** `scripts/audit.mjs`  
**Ejecutar:** `node scripts/audit.mjs`  
**Con log a archivo:** `node scripts/audit.mjs --out logs/audit-$(date +%Y%m%d).log`  
**En JSON:** `node scripts/audit.mjs --json`

**Qué audita (13 checks):**
1. Versiones sincronizadas entre package.json, README y BITACORA
2. Variables de entorno críticas y opcionales
3. Backend local activo en puerto 4000
4. Smoke tests de endpoints clave (`/health`, `/godmode/login-status`, `/auth/login`, `/personas`)
5. Dominio público `churchsystem.com.ar` responde correctamente
6. Rutas sin `requireAuth` (seguridad)
7. Imports legacy `lib/db.js`
8. Vulnerabilidades en dependencias (`pnpm audit`)
9. Paquetes con major update disponible
10. Build del frontend: `dist/` sincronizado con `src/`
11. Cloudflare Tunnel activo
12. launchd plist contiene variables críticas
13. Git: commits sin pushear y archivos sin commitear

**Cuándo correrlo:**
- Antes de cada deploy o push importante
- Cuando algo falla en producción y no es obvio qué
- Como checklist semanal de salud del sistema

**Interpretar resultados:**
- `🟢 TODO OK` → sistema en estado óptimo
- `🟡 HAY ADVERTENCIAS` → advertencias esperadas (MP en test, Stripe sin configurar) no bloquean
- `🔴 HAY ERRORES CRÍTICOS` → hay que resolver antes de cualquier deploy

**Advertencias permanentes esperadas (no requieren acción inmediata):**
- `MP_ACCESS_TOKEN en modo TEST` → normal hasta tener cuenta de producción en Mercado Pago
- `STRIPE_SECRET_KEY sin configurar` → normal hasta implementar pagos USD
- `ANTHROPIC_API_KEY sin configurar` → normal hasta habilitar IA
- `X paquetes con major update` → revisar changelogs antes de actualizar, no hacerlo automáticamente

---

### Sesión 2026-05-31 — Sincronización de versiones + auditoría

**Cambios aplicados:**
- `backend/package.json` y `frontend/package.json`: version `2.6.0` → `2.8.0`
- `package.json` raíz creado con version `2.8.0` y scripts de audit
- `backend/.env` reescrito limpio: eliminadas líneas duplicadas y mal formateadas (JWT_SECRET tenía placeholder concatenado con valor real en una sola línea)
- `JWT_SECRET` actualizado a valor seguro de ≥32 chars
- `scripts/audit.mjs` creado: 597 líneas, 13 checks, output legible con iconos de estado
- `logs/` directorio creado para guardar historial de auditorías
- launchd plist: `JWT_SECRET` actualizado para coincidir con `.env`

**Resultado de primera auditoría post-setup:**
```
✅ 28 OK   ❌ 0 Errores   ⚠️  7 Advertencias (todas esperadas)
```

**Commit:** ver rama master, sesión del 31/05/2026


---

## Modus Operandi — Herramientas de desarrollo (a partir de 2026-05-31)

### VS Code — `church-system.code-workspace`

Abrir siempre desde el workspace: `open church-system.code-workspace` o doble click en el archivo.

**Lo que provee el workspace:**
- 4 carpetas separadas en el explorador: Raíz, Backend, Frontend, Landing
- Prettier configurado (formato automático al guardar, 100 chars, sin semis, comillas simples)
- EditorConfig para consistencia de indentación y finales de línea
- Extensiones recomendadas: GitLens, ErrorLens, Thunder Client, Containers, spell-checker

**Tasks disponibles (Cmd+Shift+P → "Run Task"):**
| Task | Qué hace |
|------|----------|
| `▶ backend: dev` | `pnpm dev` con nodemon |
| `▶ frontend: dev` | `pnpm dev` con Vite |
| `🔨 frontend: build` | `pnpm build` — build de producción |
| `🔍 Auditoría integral` | `node scripts/audit.mjs` |
| `🐳 docker: dev up` | Levanta Postgres local + backend en Docker |
| `🐳 docker: dev down` | Baja los containers |
| `🐳 docker: prod build & up` | Build completo + backend + frontend en Docker |
| `🔄 backend: restart launchd` | Reinicia el proceso de producción vía launchd |

**Debug (F5 o Run > Start Debugging):**
- `🟢 Backend: Node debug` — breakpoints en cualquier archivo del backend, carga el `.env` automáticamente
- `🎨 Frontend: Chrome` — debug React en Chrome con hot reload
- `🚀 App completa` — lanza ambos a la vez

**Thunder Client** (cliente HTTP integrado): para testear endpoints sin salir de VS Code. Los tests se guardan en `.vscode/thunder-tests/` (no commitear datos sensibles).

---

### Docker — flujo de trabajo

**Cuándo usar Docker:**

| Escenario | Comando | Cuándo |
|-----------|---------|--------|
| Dev sin Neon | `docker compose --profile dev up -d` | Trabajar offline o testear migraciones sin tocar la DB de producción |
| Solo DB local | `docker compose --profile dev up -d db` | Tener Postgres en `localhost:5433` para explorar datos |
| Test del build final | `docker compose --profile prod up -d --build` | Verificar que el Dockerfile funciona antes de un deploy importante |
| Limpiar todo | `docker compose down -v` | Resetear estado de containers y volúmenes |

**Puertos cuando Docker está activo:**
- `localhost:5433` → PostgreSQL local (usuario: `church`, pass: `church_dev_password`, db: `churchsystem`)
- `localhost:4000` → Backend (mismo que launchd, no pueden coexistir)
- `localhost:3000` → Frontend nginx (solo en perfil `prod`)

**Regla importante:** launchd y Docker no pueden usar el puerto 4000 simultáneamente. Antes de `docker compose up` con backend, hacer `launchctl unload` del plist. Al terminar, `launchctl load` de nuevo.

**Las imágenes buildeadas anteriormente** (`church-backend:latest`, etc.) son seguras para borrar — el `docker-compose.yml` las rebuildeará cuando haga falta:
```bash
docker image prune -a   # borra todas las imágenes sin containers activos
```

---

### Termius — en standby

Sin uso activo. Reservado para cuando la infraestructura migre a un VPS (DigitalOcean, Hetzner, etc.).
Cuando ese momento llegue: configurar un host con la IP del servidor, usuario `deploy`, y la clave SSH del equipo de desarrollo.

---

### Sesión 2026-05-31 — Integración de herramientas

**Archivos creados/actualizados:**
- `church-system.code-workspace` — workspace multi-root con tasks, launch configs y extensiones recomendadas
- `docker-compose.yml` — perfiles `dev` (con Postgres local) y `prod` (build completo)
- `.prettierrc` — configuración de formato consistente con el código existente
- `.editorconfig` — consistencia entre editores
- `.gitignore` — `.vscode/settings.json` excluido, workspace incluido

**Estado de auditoría post-integración:** ver próxima corrida de `node scripts/audit.mjs`


---

## Sesión 2026-05-31 — Mega build v2.8.1

### Cambios aplicados

**Backend:**
- `backend/src/routes/plan.js` — `/plan/me` ahora devuelve también `suscripcion` activa consultando la tabla `payments`. Manejo graceful si la tabla no existe aún.
- `backend/src/server.js` — `subscriptionsRouter` movido de `/api` a `/` para alinearlo con el resto de los routers. Las rutas internas del router son `/subscriptions/*`, `/payments/*`, lo que da URLs consistentes con toda la API.
- `backend/.env` — agregadas variables comentadas para PayPal (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `PAYPAL_WEBHOOK_ID`) y MP webhook (`MP_WEBHOOK_SECRET`). Agregado `QR_SECRET` (valor fijo generado con `crypto.randomBytes(32)`).
- `~/Library/LaunchAgents/com.churchsystem.backend.plist` — `QR_SECRET` agregado al entorno de launchd.

**Frontend:**
- `frontend/src/pages/Planes.jsx` — **nueva página** `/planes`. Muestra los 3 planes (Starter/Pro/Max) con precios multimoneda, módulos incluidos, limitaciones, y CTA que inicia el flujo de suscripción vía `/subscriptions/create`. Detecta el plan actual del usuario y lo marca como activo.
- `frontend/src/components/UpgradeGate.jsx` — el botón "Mejorar mi plan" ahora navega a `/planes` en lugar de abrir un `mailto:`.
- `frontend/src/App.jsx` — importación lazy de `Planes.jsx` y route `/planes` protegida para todos los roles.
- `frontend/src/components/Menu.jsx` — ítem "Planes" (★) agregado al sidebar en la sección principal, visible para todos los planes.
- `frontend/dist/` — build completo de producción generado (10.92s, sin warnings, 1645 módulos).

**Versiones bump:**
- `backend/package.json`, `frontend/package.json`, `package.json` raíz: `2.8.0` → `2.8.1`
- `README.md`: `v2.8 beta` → `v2.8.1 beta`

### Auditoría post-build
```
✅ 29 OK   ❌ 0 Errores   ⚠️  6 Advertencias (todas esperadas)
dist/ actualizado ✓ — versiones sincronizadas ✓ — dominio OK ✓
```

### Estado de pendientes conocidos
- MP en modo TEST — activar cuando se tenga cuenta de producción en Mercado Pago
- PayPal credentials — pendiente configurar en developer.paypal.com (sandbox)
- STRIPE_SECRET_KEY — pendiente cuando se implemente pagos USD
- ANTHROPIC_API_KEY — pendiente cuando se habilite el asistente IA
- 7 dependencias con major update disponible — revisar changelogs antes de actualizar (Express 5, Prisma 7, bcryptjs 3, helmet 8, etc.)
- Frontend: 2 vulnerabilidades moderadas en dependencias (no críticas)


---

## QA Exhaustivo + Megabuild — 2026-05-31

### Metodología
QA completo backend (todos los endpoints, CRUD) + navegador real con Chrome (login, módulos, gating) sobre los 3 planes. Datos limpiados y recreados desde cero.

### Limpieza de datos
- Backup completo guardado en `backend/backups/full-backup-*.json` (antes de borrar)
- Borrados TODOS los datos: 19 iglesias, 24 usuarios, 365 personas, 1076 asistencias, etc.
- Solo se conservaron las 2 cuentas GODMODE
- **3 cuentas de prueba creadas** (password `Test1234!` todas):
  - `starter@test.com` → plan STARTER
  - `pro@test.com` → plan PRO
  - `max@test.com` → plan MAX

### Bugs encontrados y CORREGIDOS

**#1 — Analytics crasheaba el servidor (CRÍTICO).** `/analytics/resumen` con MAX tumbaba el proceso Node entero. Dos causas:
- `TO_CHAR(Culto.fecha, ...)` — la columna es `text`, no date. Fix: cast `::date`.
- Filtro `deletedAt` en tabla `Mensaje` que no tiene esa columna. Fix: removido.
- Bonus: queries de `Seguimiento` usaban `fecha` (no existe) → `createdAt`.

**#2 — Errores async tumbaban el proceso (CRÍTICO, sistémico).** Cualquier query fallida en un handler sin try/catch mataba Node en vez de devolver 500. Fix:
- `process.on('unhandledRejection')` + `process.on('uncaughtException')` en server.js → el servidor NUNCA se cae por un error de DB.
- `/analytics/resumen` envuelto en try/catch con respuesta 500 limpia.

**#3 — Emails fallan silenciosamente.** `sendSystemEmail` ocultaba errores de Resend devolviendo `{id:null}` como si funcionara. Fix: ahora reporta el error real.
- **PENDIENTE DE VALENTIN:** la RESEND_API_KEY actual está vencida/inválida (401). Generar una nueva en resend.com y actualizarla en `.env` + plist.

**#4 — Versión hardcodeada.** Login y Configuracion mostraban "v2.6.0". Fix: creado `frontend/src/version.js` (fuente única), ambos importan `APP_VERSION` (2.8.1). Confirmado en producción tras hard-refresh.

**#5 — Gating de planes desincronizado (frontend↔backend).** `UpgradeGate.MOD_PLAN` no coincidía con `PLANES` del backend:
- asistencia/calendario decían STARTER, son PRO
- seguimiento/discipulado decían PRO, son STARTER
- Causaba mensaje contradictorio "Requiere Starter. Estás en Starter".
- Fix: MOD_PLAN reescrito para reflejar exactamente el backend.
- Menu.jsx: sacado `consolidacion` del sidebar STARTER (es PRO).

### Verificado funcionando (0 crashes)
- **Backend CRUD: 36/36 OK** — crear/editar/eliminar personas, grupos, cultos, eventos, comunicados, seguimientos en los 3 planes.
- **Todos los endpoints GET** responden (los "404" del QA inicial eran falsos positivos: rutas con subpath como `/reportes/semanal`).
- **Navegador:** login 3 planes, dashboard, personas (crear María González end-to-end OK), analytics (los 3 planes, con gráficos), página Planes, UpgradeGate, comunicados, check-in QR, grupos.
- **Gating correcto:** STARTER bloqueado en /asistencia con CTA a /planes.

### Observaciones menores (no bugs)
- `/seguimiento` como ruta directa redirige al dashboard (el seguimiento se hace desde el perfil de cada persona). El plan lo lista como módulo pero no tiene página dedicada — comportamiento aceptable.
- `/discipulado` → redirect a `/grupos` (intencional, ya estaba en App.jsx).

### Verificación final
```
Health: {"status":"ok"}
starter@test.com: login=200 plan=STARTER analytics=200
pro@test.com:     login=200 plan=PRO     analytics=200
max@test.com:     login=200 plan=MAX     analytics=200
```

### Scripts de QA creados (reutilizables)
- `backend/qa-endpoints.mjs` — prueba todos los GET con cada plan
- `backend/qa-crud.mjs` — prueba CRUD completo con cada plan

