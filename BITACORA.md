# BITACORA — Church System

Ultima actualizacion: 2026-05-30  
Rama principal: `master`

## Protocolo operativo

1. Antes de trabajar: leer este archivo completo.
2. Durante el trabajo: respetar multi-tenant, no hardcodear URLs, no reintroducir `sql.js`.
3. Al terminar: actualizar este archivo y dejar pruebas ejecutadas.
4. Verificaciones minimas:
   - `cd frontend && pnpm build`
   - `cd backend && pnpm audit:launch`

## Estado actual (hecho)

- Migracion de rutas legacy a PostgreSQL completada.
- `master` consolidado como rama principal.
- Navegacion mobile role-aware en `Menu.jsx`:
  - `bottom-nav` y `landscape-rail` adaptados por rol.
- Ocultamiento legal aplicado (sin borrar codigo) para `Finanzas` y `Oracion`:
  - Removidas de menu y accesos visibles.
  - Rutas `/finanzas` y `/oracion` redirigen a `/`.
  - Removidas de `GestionPermisos` y del panel de estado en `Dashboard`.
- Mobile UX mejorado en listas con tabla:
  - `Users.jsx`: vista `mobile-list` + tabla desktop.
  - `Historial.jsx`: vista `mobile-list` + tabla desktop.
- Integracion de herramientas locales:
  - VS Code: `.vscode/tasks.json` y `.vscode/launch.json`.
  - Docker: compose operativo, plantilla `.env.docker.example`.
  - README actualizado con flujo VS Code + Docker + Termius.
- Hardening de Docker:
  - `docker-compose.yml` sin `version` obsoleto.
  - `DB_PASSWORD` y `JWT_SECRET` como requeridos.
  - `DATABASE_URL` con `sslmode` para pasar validacion de arranque.
  - Fix runtime de frontend Docker (`nginx.pid` permissions) en `frontend/Dockerfile`.
- Bloque comercial/suscripcion reforzado:
  - `mercadopago` ahora exige `PUBLIC_URL` valido para checkout (sin fallback inseguro).
  - `external_reference` fortalecido con `userId|iglesiaId|plan|promo|timestamp`.
  - Se persiste `checkout_reference` y `plan_pendiente` en configuracion para trazabilidad.
  - Webhook valida tenant (`iglesiaId`) antes de activar plan.
  - Al aprobar pago, limpia `plan_pendiente` y deja estado coherente.
  - `Configuracion` muestra aviso de pago pendiente por plan.
- Diagnostico comercial integrado:
  - Nuevo endpoint `GET /config/commercial-diagnostics` (pago + OAuth + email en un solo estado).
  - Panel de Suscripcion ahora muestra semaforo comercial por check (MP, URLs, OAuth, email).
  - Permite auditar readiness de venta sin revisar logs de Render.
- OAuth de produccion reforzado:
  - `oauth.js` ahora valida URLs seguras (`https` en production) para base/front antes de iniciar flujo.
  - Callbacks Google/Apple usan URLs saneadas para evitar redirects invalidos.
  - `commercial-diagnostics` ahora expone callbacks esperados:
    - Google: `${BASE_URL}/oauth/google/callback`
    - Apple: `${APPLE_REDIRECT_URI}` o fallback `${BASE_URL}/oauth/apple/callback`

## Verificaciones recientes

- Frontend build: OK.
- Backend launch audit: OK (`ok: true`, sin criticos).
- Smoke test Docker end-to-end: OK.
  - `docker compose up -d --build`
  - `GET /health` => `{"status":"ok"}`
  - `docker compose down` limpio

## Pendientes / Roadmap

### P0

- Confirmar auto-deploy de Render desde `master`.
- Definir politica de manejo de backups locales pesados fuera de Git (ZIP + `.env`).
- Validar ciclo real de cobro en produccion (checkout -> webhook -> activacion plan) con transaccion de prueba.

### P1 — Mobile (prioridad alta)

- Auditar y convertir a vista cards mobile donde falte:
  - `GestionPermisos`, `PromoCodes`, `Grupos`, `Consolidacion`, `Comunicados`.
- Validar formularios largos en iOS (teclado/safe-area).

### P2 — UI/UX

- Reemplazar `alert()/confirm()` legacy por Toast/Modal.
- Unificar estados de `loading/empty/error` por pantalla.

### P3 — Visual (proximo bloque)

- Corregir modo dark/black al 100%:
  - Contraste de textos en cards, tablas, badges y modales.
  - Revisar tokens de color en `index.css` y `theme.css`.
  - Validar legibilidad en mobile y desktop.

## Bitacora de cambios (mas reciente arriba)

### 2026-05-29 — Codex

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
