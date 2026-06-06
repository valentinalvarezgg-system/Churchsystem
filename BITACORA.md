# BITÁCORA — Church System

Última actualización: **2026-06-06**  
Versión: **v2.9**  
Rama activa: **master**

---

## Estado general del producto

| Área | % | Estado |
|------|---|--------|
| Backend / infraestructura | 95% | ✅ |
| Autenticación y seguridad | 90% | ✅ |
| Gestión de personas | 92% | ✅ filtros avanzados |
| Grupos y discipulado | 80% | ✅ |
| Asistencia y QR | 85% | ✅ |
| Ministerios | 85% | ✅ 10 sub-recursos |
| Reportes | 80% | 🟡 PDF con logo pendiente |
| Mensajería (WhatsApp) | 78% | 🟡 push on-message pendiente |
| Comunicados | 75% | ✅ |
| Alertas push | 85% | ✅ |
| Calendario / Eventos | 72% | 🟡 recurrencias pendientes |
| IA pastoral | 65% | 🟡 contexto histórico pendiente |
| Comercial / pagos | 92% | ✅ MP + Stripe + PayPal + Transferencia |
| Configuración | 85% | ✅ |
| GodMode | 82% | ✅ |
| Mobile / responsive | 90% | ✅ |
| i18n | 72% | 🟡 Configuracion/Reportes/Eventos/Discipulado pendientes |
| Testing | 20% | 🔴 prioridad baja por ahora |
| Documentación | 90% | ✅ |
| Deploy | 92% | ✅ |
| **PROMEDIO GLOBAL** | **82%** | |

---

## Roadmap operativo

### P0 — Urgente (próximo bloque)

1. **i18n restante** — Configuracion, Reportes, Eventos, Discipulado (72% → 85%)
2. **Estadísticas por culto en Asistencia** — tendencias de ausencias, promedio por día
3. **Push on-message en Mensajería** — notificación cuando llega mensaje entrante por WhatsApp

### P1 — Importante (siguiente)

4. **PDF con logo en Reportes** — actualmente exporta sin branding de la iglesia
5. **Recurrencias en Eventos** — soporte para eventos semanales/mensuales
6. **Contexto histórico en IA** — que el asistente recuerde el hilo de conversación
7. **Sincronizar versión en package.json** — alinear `backend`, `frontend` y raíz a `2.9.0`

### P2 — Backlog

8. Testing unitario (mínimo rutas críticas)
9. WhatsApp templates oficiales (aprobación Meta)
10. iOS app (Capacitor + TestFlight)
11. Finanzas y Oración — revisión y decisión sobre apertura comercial

---

## Reglas de trabajo

1. **Leer esta bitácora antes de cualquier tarea** — es la única fuente de verdad del estado.
2. **Commit del dist antes de cada push** — `pnpm build` → `git add frontend/dist/` → commit → push a `master`.
3. **No `alert()`/`confirm()` en el frontend** — usar `toast.success/error/info` o `<ConfirmModal>`.
4. **No emojis en UI nueva** — usar iconos de `Icons.jsx` (lucide-react SVG).
5. **No `localhost:4000` en el frontend** — siempre `apiFetch()` de `services/api.js`.
6. **Multi-tenant siempre** — toda query lleva `WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL`.
7. **JWT nunca en URL** — exports de Excel/PDF usan `fetch + blob + Authorization: Bearer`.
8. **Módulos ocultos intactos** — Finanzas y Oración permanecen en código pero fuera del menú.

---

## Módulos ocultos (decisión legal / comercial)

| Módulo | Archivo | Estado |
|--------|---------|--------|
| Finanzas | `backend/routes/finanzas.js` | en código, ruta redirige a `/` |
| Oración | `backend/routes/oracion.js` | en código, ruta redirige a `/` |

---

## Changelog

### v2.9 — 2026-06-06

**Correcciones visuales (bugs del video de usuario):**
- `Menu.jsx` — Fix condición STARTER que duplicaba menú cuando el rol es PASTOR_GENERAL (`isStarter && !isPro` → `isStarter && !isPro && !isMax`). Eliminar emojis 📁🌱🗺️ de navlinks Documentos/Liderazgo/Mapa de grupos → `Icons.jsx` SVG.
- `Analytics.jsx` — Fix iconos KPI: props `icon=""` e `icon="Listo"/"Advertencia"/"Cultos"/"Email"` reemplazados por `Icons.jsx`. Fix `InsightBadge` con mismo patrón.
- `MinisterioDetalle.jsx` — Eliminar emojis 🗓⭐📦🧭🔄 de `TAB_LABELS`. Reemplazar 3x `confirm()` (TabTurnos, TabEvaluaciones, TabInventario) por `<ConfirmModal>`.
- `Planes.jsx` — Fix layout móvil: 4 columnas de 82px en iPhone → columna única con `useOrientation()`.

**Documentación:**
- `README.md` — reescrito completo: v2.9, stack con WhatsApp Meta, módulos con tiers correctos (STARTER/PRO/MAX), tabla de 7 planes comerciales.
- `BITACORA.md` — reemplazado: ~1.500 líneas de historial acumulado → documento operativo limpio.

### v2.9-pre — 2026-06-06

**Búsqueda avanzada en Personas:**
- Backend: nuevos query params `estadoEspiritual`, `cultoDia`, `fechaIngresoDesde`, `fechaIngresoHasta` con parámetros `$idx` dinámicos.
- Frontend: panel colapsable en móvil con badge de filtros activos, grilla auto-fit en desktop.

### v2.8.3 — 2026-06-03

- Contact mail centralizado (`backend/lib/contact-mail.js`) con fallback seguro.
- Landing comercial actualizada a catálogo 7 planes con i18n es/pt/en.
- Landing mobile: carrusel de categorías, Safari pageshow fix.
- CI: hardening pnpm/Corepack en GitHub Actions.

### v2.8.2 — 2026-06-01

- Catálogo comercial 7 planes (`FREE/STARTER/PRO/MAX/CHURCH_100/CHURCH_500/CHURCH_1000`).
- WhatsApp Cloud API (Meta oficial): tablas, webhook, templates, conexión multi-iglesia.
- `frontend/lib/commercialPlans.js` y `resolveAccessTier()` desacoplan pricing de permisos.
- `Planes.jsx` nueva página con pricing por audiencia (liderazgo / iglesia).

### v2.8.1 — 2026-05-31

- Planes simplificados a 3 tiers internos: STARTER / PRO / MAX.
- Métodos de pago: Mercado Pago + Stripe + PayPal + Transferencia bancaria.
- Versión centralizada en `frontend/src/version.js`.
- `scripts/audit.mjs` — 13 checks de salud del sistema.

### v2.8.0 — 2026-05-30

- Mobile-first: cards en todas las páginas de lista.
- i18n operativa en 6 páginas principales (Personas, Asistencia, Grupos, Alertas, Mensajes, Historial).
- QR Check-in: URL pública permanente con `QR_SECRET` + widget de configuración.
- Exports Excel/PDF sin JWT en URL (`fetch + blob + Authorization: Bearer`).
- `frontend/dist/` commiteado: Render sirve estos archivos directamente.
- Safe-area (notch/Dynamic Island) en todas las orientaciones.

---

## Deploy

### Modo activo: `MODO_CLOUDFLARE_LOCAL`

Backend corre en Mac (launchd), Cloudflare Tunnel expone `localhost:4000` como `churchsystem.com.ar`.

```bash
# Ciclo de release (obligatorio antes de push)
cd frontend && pnpm build
cd ..
git add frontend/dist/
git add -A
git commit -m "tipo(scope): descripción"
git push origin master

# Reiniciar backend local si es necesario
launchctl unload ~/Library/LaunchAgents/com.churchsystem.backend.plist
launchctl load  ~/Library/LaunchAgents/com.churchsystem.backend.plist
```

### Variables críticas en producción (Render / launchd)

`JWT_SECRET` · `DATABASE_URL` · `BASE_URL` · `FRONTEND_URL` · `RESEND_API_KEY` · `QR_SECRET` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `GODMODE_USER_EMAIL` · `GODMODE_USER_PASSWORD`
