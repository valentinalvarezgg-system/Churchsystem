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
