# BITÁCORA — Church System

Última actualización: 2026-05-30  
Versión actual: **v2.6 (estable técnica)**  
Rama oficial: **master**

## Propósito
Este documento es la única fuente de verdad operativa del proyecto.  
Todo cambio (Claude/Codex/Copilot/humano) debe registrarse aquí para evitar solapamientos.

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

