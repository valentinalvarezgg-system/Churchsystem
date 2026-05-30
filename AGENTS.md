# AGENTS.md — ChatGPT Codex / OpenAI Agents

## PASO 0 (OBLIGATORIO): leé la BITÁCORA

Antes de escribir una sola línea de código, leé el archivo:

```
/BITACORA.md
```

Contiene: estado del proyecto, convenciones técnicas, pendientes priorizados
y bitácora de cambios. **Actualizala siempre al terminar tu turno.**

---

## Contexto del proyecto

**Church System** es una plataforma SaaS multi-tenant para gestión de iglesias.
Rama principal: `master` (sin ramas secundarias activas).

### Backend (`backend/`)
- Node.js + Express, módulos ES (`type: module`).
- Base de datos **PostgreSQL** (Neon). Driver `pg` crudo, sin ORM en runtime.
- Helpers: `backend/src/lib/pg.js` — `pgOne`, `pgMany`, `pgExec` (todos async).
- Middlewares: `backend/src/middlewares/auth.js` — `requireAuth`, `requireRol`.
- Rutas: `backend/src/routes/*.js`.
- **Prohibido:** `sql.js`, `lib/db.js`, Prisma en runtime, `?` como placeholder.

### Frontend (`frontend/`)
- React 18 + Vite + React Router. Code splitting con `React.lazy()`.
- Estilos: `frontend/src/index.css` (base) + `frontend/src/theme.css` (tokens).
- API: `frontend/src/services/api.js` → `apiFetch()`, `getApiUrl()`, `getUser()`.
- Toasts: `import { toast } from '../components/Toast.jsx'`.
- i18n: objeto `I18N` en `components/Menu.jsx` (es / pt / en).
- **Prohibido:** `alert()`, `confirm()`, URLs hardcodeadas, `hooks/useToast.js`.

### Convenciones de DB
```sql
-- Multi-tenant: siempre filtrar por iglesiaId
SELECT * FROM "Persona" WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL

-- Parámetros: $1, $2, $3 (NO ?)
-- Tablas: PascalCase con comillas dobles
-- Columnas: camelCase con comillas dobles
-- Soft-delete: "deletedAt" IS NULL
```

### Roles de usuario
`PASTOR_GENERAL` | `PASTOR_CULTO` | `CONSOLIDACION` | `STAFF` | `LIDER`

### Mobile-first (90% de usuarios)
- Inputs ≥ 44px, botones ≥ 40px.
- Tablas → cards en móvil usando `.mobile-list` + `.mobile-person-card`.
- Modales → bottom-sheet en `@media (max-width: 767px)`.
- **No** `alert()` / `confirm()` nativos — rompen la UX en iOS/Android.

---

## Cómo trabajar

1. Leer `/BITACORA.md` completo.
2. Implementar lo solicitado por Valentín siguiendo las convenciones de arriba.
3. Verificar: `cd frontend && pnpm build` debe pasar.
4. Commit + push a `master`.
5. Actualizar `/BITACORA.md` (mover de Pendientes → Estado actual, agregar entrada).

## Estructura clave de archivos

```
/BITACORA.md                          ← leer siempre primero
/INTEGRACIONES.md                     ← servicios externos y variables de entorno
/backend/src/server.js                ← entry point backend
/backend/src/lib/pg.js                ← helpers PostgreSQL
/backend/src/middlewares/auth.js      ← auth + roles
/backend/src/routes/                  ← todas las rutas API
/frontend/src/App.jsx                 ← rutas React
/frontend/src/components/Menu.jsx     ← sidebar + nav móvil + i18n
/frontend/src/services/api.js         ← cliente HTTP + getApiUrl()
/frontend/src/index.css               ← estilos base (incluye móvil)
/frontend/src/theme.css               ← tokens y utilidades móvil
```
