# CLAUDE.md — Church System

## Instrucción cero

**Leer `/BITACORA.md` antes de cualquier tarea.** Contiene el estado real del
proyecto, las convenciones técnicas y el roadmap priorizado.

---

## Stack

- **Backend:** Node + Express (ESM). PostgreSQL vía `pg` crudo.
  - `pgOne(sql, params)` → fila o null
  - `pgMany(sql, params)` → array
  - `pgExec(sql, params)` → void
- **Frontend:** React 18 + Vite. Lazy loading en todas las páginas.
- **Deploy:** Render. `master` = única rama activa.

## Convenciones de DB

```sql
-- Siempre multi-tenant:
WHERE "iglesiaId"=$1 AND "deletedAt" IS NULL

-- Tablas: "PascalCase"  |  Columnas: "camelCase"
-- Parámetros: $1 $2 $3  |  NO usar ?
```

## Reglas frontend

- `getApiUrl()` de `services/api.js` para todas las llamadas. Nunca `localhost:4000`.
- `toast.success/error/info` de `components/Toast.jsx`. Nunca `alert()`/`confirm()`.
- Mobile-first: inputs ≥44px, cards en lugar de tablas en móvil, bottom-sheet modals.
- i18n: agregar keys en el objeto `I18N` de `components/Menu.jsx` (es/pt/en).

## Verificación obligatoria y deploy

**SIEMPRE ejecutar estos pasos antes de cada push, sin excepción:**

```bash
cd frontend && pnpm build          # 1. construir frontend
cd ..
git add frontend/dist/             # 2. commitear el dist compilado (OBLIGATORIO)
git add -A                         # 3. agregar resto de cambios
git commit -m "..."                # 4. commit
git push origin master             # 5. push → Render auto-redeploy
# Actualizar /BITACORA.md
```

**Por qué:** `frontend/dist/` está commiteado en git (no ignorado). Render sirve
directamente estos archivos. Si no se commitea el dist, el frontend en producción
(`churchsystem.com.ar`) no se actualiza aunque el código fuente cambie.

## Foco actual (P1): Móvil

El 90% de los usuarios son móviles. Priorizar:
1. Reemplazar `alert()`/`confirm()` por toast/modal en todas las páginas.
2. Páginas con tablas sin vista móvil alternativa (cards).
3. Formularios con 1 columna, labels claros, teclado sin tapar campos.
