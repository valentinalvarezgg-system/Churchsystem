# Roadmap a v3.0 — Church System

> Estado base: v2.8.1 en producción. 45 rutas backend, 3 planes (Starter/Pro/Max),
> Postgres con índices en iglesiaId, emails (Resend) operativos, recupero de contraseña OK,
> push (VAPID), WhatsApp (Twilio). Producción vía Cloudflare Tunnel → Mac.
>
> Este documento es una PROPUESTA para discutir y priorizar. No empieza a buildearse
> hasta que Valentin confirme qué entra en su visión de v3.0 y en qué orden.

---

## ⚠️ Pregunta abierta para Valentin
Tenés una v3.0 pensada. Para alinear, decime cuál de estos ejes es el corazón de tu v3.0
(puede ser más de uno):
- **A) Monetización real** — cobrar las suscripciones de verdad (hoy los planes existen pero no hay cobro automático).
- **B) Robustez/escala** — que aguante muchas iglesias sin caerse, con tests y CI.
- **C) Producto/features** — nuevas capacidades pastorales (IA, finanzas, app móvil, etc.).
- **D) Otra cosa que tenés en mente** — contámela.

Lo de abajo cubre los 4 ejes para que tengas el mapa completo.

---

## BLOQUE 1 — Fundaciones técnicas (hacer SÍ o SÍ antes de escalar)
Esto no es "features" pero es lo que separa un proyecto que crece de uno que se rompe.

### 1.1 — Tests automatizados (HOY: 0 tests)
- No hay ni un test. Cada cambio se valida a mano. A medida que crezca, esto se vuelve insostenible.
- Propuesta: Vitest para backend (los endpoints críticos: auth, login, planes, CRUD personas) + algunos de frontend.
- Empezar por auth y gating de planes (lo que más duele si se rompe).
- Riesgo: bajo. Beneficio: altísimo. **Candidato a empezar ya.**

### 1.2 — CI/CD (HOY: build + push manual)
- Hoy buildeás a mano y hacés push. Un GitHub Action que corra los tests + lint en cada push evita meter bugs a master.
- Opcional: auto-deploy (pero como es Cloudflare→Mac, requiere pensar el trigger).

### 1.3 — Actualización de dependencias mayores (HOY: 7 atrasadas + 3 vulns dependabot)
- Express 4→5, Prisma 6→7, bcryptjs 2→3, helmet 7→8, dotenv 16→17, express-rate-limit 7→8.
- **Express 5 es breaking** — cambia manejo de async errors, rutas, middlewares. Requiere QA completo después.
- Recomendación: hacerlo en una rama aparte, una dep por vez, con los tests del 1.1 ya hechos. NO automático.
- Las 3 vulns dependabot son moderadas — revisar cuáles son y si las afecta el uso real.

### 1.4 — Variables de entorno y secretos
- Hoy el `.env` tiene secretos en texto plano (normal en dev). Para v3.0 con cobros reales, evaluar un gestor de secretos.

---

## BLOQUE 2 — Monetización (si el eje es A)
Hoy las tablas `payments`, `subscription_plans`, `promo_codes` existen pero el cobro no está automatizado.

### 2.1 — Pasarela de pago real
- Para Argentina: **Mercado Pago** (suscripciones recurrentes) es lo natural. Stripe si apuntás a internacional.
- Flujo: alta de plan → checkout → webhook que activa el plan → renovación automática.
- Manejo de fallos de pago, downgrade automático, período de gracia.

### 2.2 — Gestión de suscripción in-app
- Que el pastor pueda ver su plan, cambiarlo, ver facturas, cancelar — sin escribirte a vos.
- La página /planes ya existe; falta conectarla al cobro real.

### 2.3 — Facturación
- Comprobantes/facturas. En AR, si facturás, evaluar integración con AFIP o un sistema de comprobantes.

---

## BLOQUE 3 — Producto / Features pastorales (si el eje es C)

### 3.1 — Finanzas de la iglesia (hay tabla `Finanza` pero el módulo está deshabilitado: /finanzas → redirect a /)
- Diezmos y ofrendas, categorías de ingreso/egreso, reportes financieros, exportación.
- Probablemente un módulo MAX. Sensible — requiere permisos finos.

### 3.2 — Oración (hay tabla `Oracion` + `OracionApoyo` pero /oracion redirige a /)
- Muro de pedidos de oración, "estoy orando por esto", seguimiento de respuestas.

### 3.3 — IA expandida (hoy hay excel-IA y asistente-IA)
- Asistente que responda sobre los datos de la iglesia ("¿quiénes no vinieron las últimas 3 semanas?").
- Resúmenes automáticos, sugerencias de seguimiento, detección de personas en riesgo de alejarse.

### 3.4 — App móvil / PWA completa
- Ya hay check-in QR mobile + push. Falta hacer el panel pastoral una PWA instalable con offline básico.

### 3.5 — Comunicación masiva mejorada
- WhatsApp ya está (Twilio). Sumar: campañas segmentadas, plantillas, programación de envíos, métricas de apertura.

### 3.6 — Portal del miembro
- Hoy el sistema es para el staff pastoral. Un portal donde el miembro vea sus grupos, eventos, dé su asistencia.

---

## BLOQUE 4 — UX y calidad percibida (transversal, suma a cualquier eje)

### 4.1 — Onboarding del pastor nuevo
- El primer login define si se queda. Wizard guiado: crear iglesia → primeros datos → invitar equipo.

### 4.2 — Refactor de páginas gigantes
- `Configuracion.jsx` (54K), `Perfil.jsx` (51K), `Registro.jsx` (43K) son archivos enormes.
- Dividirlas en componentes mejora mantenibilidad y reduce bugs.

### 4.3 — Accesibilidad y responsive
- Auditar mobile real (no solo desktop), contraste, navegación por teclado.

### 4.4 — Internacionalización completa
- Ya hay i18n (multimoneda, multi-idioma). Completar cobertura — hay textos hardcodeados en español (ej: la página de recupero que armamos hoy).

---

## BLOQUE 5 — Observabilidad y operación (si el eje es B)

### 5.1 — Monitoreo y alertas
- Hoy: logs en archivos. Si el server cae a las 3am, ¿te enterás? Health checks + alerta (email/WhatsApp a vos).
- Uptime monitoring externo.

### 5.2 — Backups automáticos verificados
- Hay script de backup. Automatizarlo (cron), verificar que el restore funciona, retención.

### 5.3 — Auditoría y seguridad
- Ya hay AuditLog. Expandir: log de accesos, intentos de login fallidos, cambios sensibles.
- Rate limiting por endpoint (hoy es global).

---

## Sugerencia de orden (mi opinión, ajustable)
1. **Bloque 1.1 (tests) + 1.3 (deps)** — base sólida antes de construir encima.
2. Lo que elijas como eje de v3.0 (A/B/C).
3. Bloque 4 (UX) en paralelo, de a poco.

---

_Generado durante la sesión de QA+emails. Pendiente: validación de Valentin sobre alcance de v3.0._
