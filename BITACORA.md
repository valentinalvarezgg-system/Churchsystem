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
- `v2.7-beta/block-03` — navegación visible, QR, reportes y flujos críticos UX.

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
