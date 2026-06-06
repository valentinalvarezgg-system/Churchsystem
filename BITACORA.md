# BITÁCORA — Church System

> Fuente única de verdad operativa del proyecto.  
> Leer esto antes de tocar cualquier archivo.

**Versión:** v2.9.5 · **Fecha:** 2026-06-06 · **Rama:** `master`  
**Deploy activo:** `MODO_CLOUDFLARE_LOCAL` (Mac + Cloudflare Tunnel → `churchsystem.com.ar`)

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
| Mensajería | 78% | 🟡 push on-message pendiente |
| Comunicados | 80% | ✅ cards, programación, variables |
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
| **PROMEDIO GLOBAL** | **82%** | |

---

## Roadmap activo

### P0 — Completar en próximas sesiones

| # | Tarea | Dónde | Notas |
|---|-------|-------|-------|
| 1 | **i18n restante** | `Configuracion`, `Reportes`, `Eventos`, `Discipulado` | 72% → 85%; usar `makeI18n()` |
| 2 | **Estadísticas por culto** en Asistencia | `Asistencia.jsx` + `backend/routes/reportes.js` | Tendencias, ausencias, comparativo |
| 3 | **Push on-message** en Mensajería | `mensajes.js` + `notificaciones.js` | Notificar al receptor en tiempo real |

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

### Reiniciar backend (Mac/launchd)

```bash
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

**Hoy:** `MODO_CLOUDFLARE_LOCAL` — `churchsystem.com.ar` resuelve a Mac → Cloudflare Tunnel → `localhost:4000`.

> Si se cambia a Render: actualizar esta línea y verificar que las variables de entorno en Render estén completas.
