# Church System Alpha — Gestión Pastoral Inteligente

Sistema integral de gestión para iglesias evangélicas. Stack actual: Node.js/Express + PostgreSQL (Neon) + React/Vite.

## 🚀 Inicio Rápido

```bash
# Clonar
git clone git@github.com:valentinalvarezgg-system/Churchsystem.git
cd Churchsystem

# Backend
cd backend
pnpm install
node src/server.js

# Frontend (otra terminal)
cd frontend
pnpm install
pnpm dev
```

**Acceso:** http://localhost:4000  
**Admin:** admin@iglesia.com / admin123

## 🧰 Integración local (VS Code + Docker + Termius)

### VS Code (workspace operativo)

Este repo ya incluye:

- `.vscode/tasks.json`
- `.vscode/launch.json`

Tareas recomendadas:

- `backend: dev`
- `backend: audit launch`
- `frontend: dev`
- `frontend: build`
- `docker: up`
- `docker: down`

Debug recomendado:

- `Backend: Node (server.js)`
- `Frontend: Chrome (Vite 5173)`
- `App completa (backend + frontend)`

### Docker (entorno reproducible)

El proyecto incluye `docker-compose.yml` con:

- `postgres` (local)
- `backend`
- `frontend`

Comandos:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
docker compose down
```

Para variables locales usar `.env.docker` como base.

### Termius (operación remota)

Uso recomendado de perfiles:

- `church-dev`
- `church-staging`
- `church-prod`

Checklist de operación segura:

1. Verificar rama y commit desplegado.
2. Ejecutar `backend pnpm audit:launch`.
3. Revisar estado de servicio (Render) y salud `GET /health`.
4. Registrar cambios operativos en el runbook del equipo.

## 📦 Estructura

```
church-system-alpha/
├── .vscode/          # Tasks + Debug local
├── backend/          # Node.js + Express + SQLite
│   ├── src/
│   │   ├── routes/   # Endpoints API
│   │   ├── lib/      # DB y utilities
│   │   └── server.js
│   └── src/          # API + middlewares + lib
├── frontend/         # React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── dist/         # Build production
└── landing/          # Landing page estática
```

## ✨ Features Beta 2.5

### Core
- Dashboard ejecutivo con KPIs
- Gestión de personas y grupos
- Sistema de seguimientos
- Control de asistencia + QR check-in
- Calendario y eventos
- Mensajería interna
- Reportes y finanzas

### Nuevos
- **Toast Notifications** — Sistema global con auto-cierre
- **Modal System** — Modales reutilizables
- **Bug Reporter** — Botón flotante "?" con envío email
- **Dashboard Premium** — Vista ejecutiva para pastor general
- **Promo Codes** — Admin panel para códigos promocionales
- **OAuth Google/Apple** — requiere keys de proveedor en Render

## 🔧 Configuración

Crear `.env` en `/backend`:

```env
JWT_SECRET=tu_secret_aqui
PORT=4000
RESEND_API_KEY=re_xxxxx              # Emails transaccionales, soporte y verificacion
EMAIL_FROM=Church System <no-reply@churchsystem.com.ar>
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
APPLE_CLIENT_ID=com.churchsystem.web
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:4000
MP_ACCESS_TOKEN=APP_USR-xxxxx
```

En Render deben existir esas mismas variables. Para que funcionen los correos `@churchsystem.com.ar`, el dominio remitente configurado en Resend tiene que estar verificado con SPF/DKIM y `EMAIL_FROM` debe usar ese dominio verificado.

## 🛠️ Scripts

```bash
# Backend
node src/server.js                    # Producción
npm run dev                           # Desarrollo con nodemon

# Frontend
pnpm dev                              # Dev server (localhost:5173)
pnpm build                            # Build producción → /dist
pnpm preview                          # Preview build local
```

## 📱 Build Producción

```bash
cd frontend && pnpm build
# Archivos en frontend/dist/
# Backend sirve desde /dist automáticamente
```

## 🎯 Roles

- **PASTOR_GENERAL** — Admin completo
- **PASTOR_CULTO** — Gestión congregación
- **CONSOLIDACION** — Seguimientos y alertas
- **STAFF** — Operaciones diarias
- **LIDER** — Visualización básica

## 🐛 Bug Tracking

Botón flotante "?" en esquina inferior derecha. Reportes enviados a `soporte@churchsystem.com.ar` (requiere `RESEND_API_KEY`).

## 📊 Database

PostgreSQL (Neon en producción). Esquema y migraciones en `backend/prisma/`.

## 🛡️ Backups (Neon + Export Diario)

ChurchSystem usa doble capa de respaldo:

1. Backups automáticos nativos de Neon (recuperación rápida de base).
2. Export diario independiente vía GitHub Actions (snapshot SQL comprimido).

### A) Neon (obligatorio)

En Neon:

1. Ir al proyecto `neondb`.
2. Activar `Automatic backups` (si no está activo).
3. Definir política de retención recomendada (>= 14 días).
4. Registrar en runbook interno la fecha de último restore test.

Frecuencia recomendada de restore test: 1 vez por mes.

### B) GitHub Actions (ya configurado)

Workflow: [.github/workflows/db-backup.yml](/Users/Valentin/Desktop/church-system-alpha/.github/workflows/db-backup.yml)

- Corre diariamente por cron.
- También se puede disparar manualmente (`workflow_dispatch`).
- Usa `postgres:18` para evitar incompatibilidades de cliente/servidor.
- Sube el backup como artifact con retención de 14 días.

#### Secret requerido en GitHub

Crear en `Settings > Secrets and variables > Actions`:

- `DATABASE_URL` = cadena PostgreSQL de Neon.

### Verificación rápida

1. Ejecutar manualmente el workflow `Database Backup`.
2. Confirmar status `success`.
3. Descargar artifact `postgres-backup-<run_id>`.
4. Validar que contiene archivo `.sql.gz`.

## 🚦 Estado

**Versión:** 2.6.0  
**Branch:** master  
**Último commit:** Sistema de planes, tokens, verificación email, fixes iOS  
**Status:** ✅ Pre-Release estable

## 📝 Pendientes

- [ ] Completar traducciones de todas las pantallas internas
- [ ] Testing mobile iOS/Android
- [ ] Reemplazar window.alert legacy
- [ ] Changelog formal

## 📄 Licencia

Privado — Todos los derechos reservados

---

**Desarrollado con ❤️ para iglesias evangélicas**
