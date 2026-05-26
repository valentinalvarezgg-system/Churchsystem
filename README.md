# Church System Alpha — Gestión Pastoral Inteligente

Sistema integral de gestión para iglesias evangélicas. Stack: Node.js/Express + SQLite + React/Vite.

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

## 📦 Estructura

```
church-system-alpha/
├── backend/          # Node.js + Express + SQLite
│   ├── src/
│   │   ├── routes/   # Endpoints API
│   │   ├── lib/      # DB y utilities
│   │   └── server.js
│   └── church.db     # SQLite database
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
- **OAuth Skeleton** — Google/Apple (pendiente keys)

## 🔧 Configuración

Crear `.env` en `/backend`:

```env
JWT_SECRET=tu_secret_aqui
PORT=4000
RESEND_API_KEY=re_xxxxx              # Para bug reporter
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
BASE_URL=http://localhost:4000
```

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

SQLite en `/backend/church.db`. Tablas principales:

- `users` — Usuarios y roles
- `personas` — Miembros y visitantes
- `grupos` — Células/grupos pequeños
- `cultos` — Eventos y asistencia
- `seguimientos` — Tracking contactos
- `promo_codes` — Códigos promocionales

## 🚦 Estado

**Versión:** Pre-Release Beta 2.5  
**Branch:** master  
**Último commit:** Sprint 3 completo  
**Status:** ✅ Listo para testing producción

## 📝 Pendientes

- [ ] OAuth Google/Apple completo (DB + JWT)
- [ ] Email templates (Resend)
- [ ] Testing mobile iOS/Android
- [ ] Reemplazar window.alert legacy
- [ ] Changelog formal

## 📄 Licencia

Privado — Todos los derechos reservados

---

**Desarrollado con ❤️ para iglesias evangélicas**
