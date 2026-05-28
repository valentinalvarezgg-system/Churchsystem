# Changelog

## [2.6.0] - 2026-05-28

### ✨ Added
- **Sistema de Planes** — LIDER / CULTO / CONSOLIDACION / ADMINISTRACION / GENERAL
- **UpgradeGate** — pantalla de upgrade cuando el módulo no está en el plan
- **usePlan hook** — detecta módulos disponibles desde el backend
- **Tokens de Iglesia** — formato `IGL-XXXX-XXXX`, compartible por el pastor
- **TokenIglesiaAdmin** — panel en Configuración para ver/copiar/regenerar token
- **TokenIglesiaInput** — campo en Registro y Mi Perfil para unirse/cambiar iglesia
- **Verificación de email** — código 6 dígitos con inputs individuales y auto-submit
- **Email código** — template HTML oscuro con dígitos grandes (Resend)
- **Email bienvenida** — template con botón de ingreso tras verificación
- **6 perfiles de prueba** — 2 iglesias con tokens fijos para testing
- **GitHub Actions CI/CD** — deploy automático en cada push a master

### 🎨 Improved
- **Bottom nav mobile** — íconos 24px, texto 14px, centrado, altura 68px
- **Safari iOS** — fix crash por `Notification` API no disponible
- **Vista Ejecutiva** — gráficos de barras, feed de actividad reciente, saludo personalizado

### 🐛 Fixed
- `Can't find variable: Notification` en Safari iOS
- Bottom nav descentrado en mobile
- Íconos pequeños en menú mobile

## [Pre-Release Beta 2.5] - 2026-05-26

### ✨ Added
- **Toast Notification System** — Global toast con auto-cierre 4s, pause on hover, dismiss button
- **Modal System** — Modal reutilizable + ConfirmModal, Escape key, overlay blur
- **Bug Reporter** — Botón flotante "?" con modal y envío email via Resend
- **Dashboard Premium** — Vista ejecutiva `/premium` con 5 KPI cards para PASTOR_GENERAL
- **Promo Codes Admin** — CRUD completo en `/promo-codes` para gestionar códigos promocionales
- **OAuth Skeleton** — Endpoints Google/Apple (pendiente integración completa)
- **Layout Component** — Component reutilizable para páginas admin
- **Banner Notificaciones** — Overlay flotante con glass effect, no empuja contenido

### 🎨 Improved
- **CSS System** — +500 líneas: `.btn-danger`, `.btn-ghost`, `.spinner-xs`, `.empty-state`, `.skeleton`, `.table-responsive`, `.kpi-grid`
- **Responsive Design** — Grids colapsan, sidebar overlay, landscape adaptativo
- **Dark Mode** — Compatible con nuevos componentes
- **Mobile UX** — Banner notificaciones, modales y toasts optimizados mobile

### 🐛 Fixed
- Dashboard.jsx style duplicado (línea 91)
- Link `/premium` agregado al menú sidebar
- Banner notificaciones ya no empuja contenido (position fixed)
- Build warnings eliminados

### 🔧 Backend
- Endpoints `/stats/*` con queries SQL reales (no mock)
- Tabla `promo_codes` creada en DB
- Route `/bug-report` con Resend email
- Route `/promo-codes` para CRUD admin
- Route `/oauth` skeleton Google/Apple

### 📦 Dependencies
- Added: `resend@6.12.4` para email

---

## [Beta 2.4.1] - 2026-05-25

### Features anteriores
- Sistema de personas y grupos
- Control de asistencia QR
- Dashboard con stats
- Mensajería y alertas
- Calendario y eventos
- Reportes y finanzas
- Multi-tenancy básico

---

**Formato:** [Semantic Versioning](https://semver.org/)  
**Tipos:** Added, Changed, Deprecated, Removed, Fixed, Security
