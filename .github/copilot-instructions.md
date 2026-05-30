# GitHub Copilot — Instrucciones para Church System

## PASO 0 (OBLIGATORIO): leé la BITÁCORA antes de tocar código

```
/BITACORA.md   ← fuente de verdad del estado del proyecto
```

Leé la sección **"Estado actual"** para entender qué ya está hecho y
**"Pendientes / Roadmap"** para saber qué está pendiente. Cuando termines,
actualizá ambas secciones y agregá una entrada en **"Bitácora de cambios"**.

---

## Stack rápido

| Capa | Tecnología |
|------|-----------|
| Backend | Node + Express (ESM). DB: **PostgreSQL** (driver `pg` crudo, NO Prisma en runtime) |
| Frontend | React 18 + Vite. Pages: `React.lazy()` + `Suspense` |
| Deploy | Render (backend sirve la SPA). Cloudflare Tunnel en dev |
| Rama | `master` — única fuente de verdad |

## Reglas críticas

1. **Multi-tenant:** toda query filtra `"iglesiaId" = $N`. Nunca mezclar datos de iglesias.
2. **No hardcodear URLs:** usar `getApiUrl()` de `frontend/src/services/api.js`.
3. **No reintroducir `sql.js`** ni `lib/db.js` (legacy eliminado).
4. **Tablas PascalCase** con comillas: `"Persona"`, `"Evento"`, etc.  
   **Columnas camelCase** con comillas: `"iglesiaId"`, `"deletedAt"`, etc.
5. **Soft-delete:** filtrar siempre con `"deletedAt" IS NULL`.
6. **Parámetros:** `$1, $2, $3` (Postgres). NO usar `?`.
7. **Auth:** `requireAuth`, `requireRol('ROL')` — rest params, NO array.
8. **Toasts:** `import { toast } from '../components/Toast.jsx'`. NO `alert()`/`confirm()`.
9. **Mobile-first:** 90% de usuarios son móviles. Usar clases `.mobile-list`,
   `.mobile-person-card`, modales bottom-sheet, inputs ≥ 44px.

## pg.js API (backend)

```js
import { pgOne, pgMany, pgExec } from '../lib/pg.js'

const row  = await pgOne('SELECT * FROM "Tabla" WHERE "id"=$1', [id])
const rows = await pgMany('SELECT * FROM "Tabla" WHERE "iglesiaId"=$1', [igId])
await pgExec('INSERT INTO "Tabla" (...) VALUES (...)', [...params])
```

## Verificación antes de commit

```bash
cd frontend && pnpm build        # debe pasar sin errores
cd backend && pnpm audit:launch  # no debe detectar sql.js ni lib/db.js
git push origin master
```

Luego actualizá `/BITACORA.md`.
